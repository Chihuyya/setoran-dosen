// URL dasar untuk server autentikasi (Keycloak) UIN Suska
const KC_URL = "https://id.tif.uin-suska.ac.id";
// URL dasar untuk mengakses endpoint API setoran hafalan
const BASE_URL = "https://api.tif.uin-suska.ac.id/setoran-dev/v1";

// Fungsi asinkron untuk melakukan proses login
export async function login(username, password) {
  // Melakukan HTTP Request menggunakan fetch ke endpoint token
  const response = await fetch(
    `${KC_URL}/realms/dev/protocol/openid-connect/token`,
    {
      method: "POST", // Menggunakan metode POST untuk mengirim data kredensial
      headers: {
        // Memberitahu server bahwa data dikirim dalam bentuk form URL encoded
        "Content-Type": "application/x-www-form-urlencoded",
      },
      // Membungkus data kredensial (client_id, secret, grant_type, user, pass) ke dalam URLSearchParams
      body: new URLSearchParams({
        client_id: "setoran-mobile-dev", // ID Aplikasi klien
        client_secret: "aqJp3xnXKudgC7RMOshEQP7ZoVKWzoSl", // Kunci rahasia klien
        grant_type: "password", // Tipe otorisasi menggunakan password
        username, // Username inputan dari user
        password, // Password inputan dari user
      }),
    }
  );

  // Mengembalikan hasil respons dari server yang sudah diubah ke format JSON
  return response.json();
}

// Fungsi asinkron untuk mengambil data setoran berdasarkan NIM mahasiswa
export async function getSetoran(nim, token) {
  // Request GET (default) ke endpoint setoran mahasiswa
  const response = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
    headers: {
      // Menyisipkan token Bearer di header untuk otentikasi bahwa user berhak mengakses ini
      Authorization: `Bearer ${token}`,
    },
  });

  // Mengembalikan respons dalam bentuk JSON
  return response.json();
}

// Fungsi asinkron untuk menyimpan/memverifikasi setoran hafalan baru
export const simpanSetoran = async (nim, token, data) => {
  // Request POST untuk mengirim data baru ke server
  const res = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
    method: "POST",
    headers: {
      // Memberitahu server bahwa data yang dikirim berformat JSON
      "Content-Type": "application/json",
      // Menyisipkan token otentikasi
      Authorization: `Bearer ${token}`,
    },
    // Mengubah parameter 'data' (berbentuk Object/Array JS) menjadi string JSON
    body: JSON.stringify(data),
  });

  // Mengembalikan respons JSON dari server
  return res.json();
};

// Fungsi asinkron untuk menghapus data setoran yang sudah ada
export const deleteSetoran = async (nim, token, data) => {
  // Request DELETE untuk memberi perintah hapus ke server
  const res = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    // Data (biasanya ID setoran) yang ingin dihapus dikirim melalui body
    body: JSON.stringify(data),
  });

  // Mengembalikan respons JSON dari server
  return res.json();
};