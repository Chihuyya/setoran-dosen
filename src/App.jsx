// Mengimpor hooks bawaan React untuk mengelola state, referensi, efek samping, dan memoisasi fungsi
import { useState, useRef, useEffect, useCallback } from 'react';
// Mengimpor ikon-ikon dari library lucide-react untuk keperluan UI
import { 
  LayoutDashboard, PlusCircle, Users, LogOut, Search, CheckCircle2,
  Clock, AlertCircle, Calendar, User, Trash2, Check, ShieldCheck,
  Bell, BookOpen, Filter, ArrowRight
} from 'lucide-react';

/**
 * INTEGRATED API LOGIC
 * Menggunakan kredensial dan endpoint asli dari UIN Suska
 * Catatan: Ini adalah versi gabungan dari api.js di atas agar bisa dipanggil langsung dari dalam file komponen ini.
 */
const KC_URL = "https://id.tif.uin-suska.ac.id";
const BASE_URL = "https://api.tif.uin-suska.ac.id/setoran-dev/v1";

const api = {
  // Objek api yang berisi fungsi-fungsi untuk berinteraksi dengan backend
  login: async (username, password) => {
    // Memanggil endpoint login Keycloak
    const response = await fetch(
      `${KC_URL}/realms/dev/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: "setoran-mobile-dev",
          client_secret: "aqJp3xnXKudgC7RMOshEQP7ZoVKWzoSl",
          grant_type: "password",
          username,
          password,
        }),
      }
    );
    // Error handling: jika status response bukan 2xx (berhasil), maka lempar error
    if (!response.ok) {
      const err = await response.json().catch(() => ({})); // Menangkap pesan error dari backend
      throw new Error(err.error_description || "Gagal login"); // Melempar error agar ditangkap oleh blok catch nantinya
    }
    return response.json();
  },

  getSetoran: async (nim, token) => {
    // Mengambil data detail setoran mahasiswa berdasarkan NIM
    const response = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || "Gagal mengambil data");
    }
    return response.json();
  },

  simpanSetoran: async (nim, token, data) => {
    // Menyimpan verifikasi hafalan baru
    const res = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Gagal menyimpan data");
    }
    return res.json();
  },

  deleteSetoran: async (nim, token, data) => {
    // Menghapus riwayat verifikasi hafalan
    const res = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Gagal menghapus data");
    }
    return res.json();
  },

  getMahasiswaBimbingan: async (token) => {
    // Mengambil daftar mahasiswa yang berada di bawah bimbingan (PA) dosen yang sedang login
    const response = await fetch(`${BASE_URL}/dosen/pa-saya`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || "Gagal mengambil bimbingan");
    }
    return response.json();
  }
};

// --- Custom Components (Moved to top to prevent "use before define" error) ---
// Komponen kecil yang dapat digunakan kembali untuk membuat tombol navigasi di Sidebar
const SidebarLink = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick} // Menjalankan fungsi onClick saat ditekan
    // Baris di bawah mengatur styling dengan TailwindCSS. Jika props 'active' true, warnanya jadi indigo (aktif).
    className={`flex items-center gap-4 w-full p-4 rounded-2xl transition-all duration-300 font-black text-sm group ${
      active 
        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 translate-x-1' 
        : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
    }`}
  >
    {/* Merender ikon yang dilempar via props */}
    <span className={`${active ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>{icon}</span>
    {/* Merender teks label untuk menu */}
    <span className="hidden lg:block">{label}</span>
    {/* Indikator titik putih kecil di sebelah kanan jika menu sedang aktif */}
    {active && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full hidden lg:block"></div>}
  </button>
);

const App = () => {
  // --- Auth & Data State ---
  // Menyimpan username, mencoba mengambil dari localStorage (penyimpanan browser) jika sudah pernah login
  const [username, setUsername] = useState(localStorage.getItem('sd_username') || "");
  // Menyimpan password saat proses pengetikan di form login
  const [password, setPassword] = useState("");
  // Menyimpan token akses dari API, mencoba mengambil dari localStorage agar user tetap login walau browser di-refresh
  const [token, setToken] = useState(localStorage.getItem('sd_token') || "");
  // Menyimpan data detail setoran mahasiswa yang dicari
  const [data, setData] = useState(null);
  // Menyimpan daftar surah/komponen hafalan yang dicentang oleh dosen sebelum disimpan
  const [selectedSurah, setSelectedSurah] = useState([]);
  // Menyimpan NIM mahasiswa yang sedang diketik di kolom pencarian
  const [nim, setNim] = useState("");
  // Menyimpan data notifikasi untuk ditampilkan (tipe: success/error, message: pesan)
  const [notif, setNotif] = useState(null);
  // Menyimpan daftar array mahasiswa bimbingan PA
  const [mahasiswaBimbingan, setMahasiswaBimbingan] = useState([]);
  // Menandai apakah sistem sedang mengambil data mahasiswa bimbingan dari server
  const [loadingBimbingan, setLoadingBimbingan] = useState(false);
  
  // State Progress Hafalan (Hanya untuk Detail)
  // Menyimpan persentase progres hafalan mahasiswa yang sedang dibuka datanya
  const [progress, setProgress] = useState(0);
  
  // Membuat referensi untuk menyimpan ID timer (timeout) notifikasi agar bisa di-clear/dibatalkan
  const notifTimer = useRef(null);

  // --- UI State ---
  // Menentukan tab/halaman mana yang sedang aktif (dashboard, input, atau data)
  const [activeTab, setActiveTab] = useState(localStorage.getItem('sd_activeTab') || 'dashboard');
  // Menandai status loading global (misal saat login atau mencari NIM)
  const [isLoading, setIsLoading] = useState(false);
  // Menandai apakah kotak pencarian di header sedang diklik (fokus)
  const [searchFocused, setSearchFocused] = useState(false);

  // Cleanup timer on unmount
  // useEffect ini berjalan sekali saat komponen dimuat. Jika komponen dihancurkan (unmount), timer notifikasi dihapus agar tidak terjadi memory leak.
  useEffect(() => {
    return () => {
      if (notifTimer.current) clearTimeout(notifTimer.current);
    };
  }, []);

  // --- Fetch Mahasiswa Bimbingan ---
  // Menyimpan informasi profil dosen yang sedang login
  const [dosenInfo, setDosenInfo] = useState({ nama: "Dosen PA", email: "", nip: "" });

  // useCallback digunakan agar fungsi ini tidak dirender ulang terus menerus oleh React kecuali dependency (token) berubah
  const fetchMahasiswaBimbingan = useCallback(() => {
    if (!token) return; // Batalkan jika tidak ada token (belum login)
    setLoadingBimbingan(true); // Hidupkan animasi loading bimbingan

    // Memanggil API getMahasiswaBimbingan
    api.getMahasiswaBimbingan(token)
      .then((res) => {
        let list = null;

        // Mengecek struktur respons dari API. Struktur API bisa berbeda, jadi kode ini mencoba menemukan array mahasiswanya di beberapa tempat.
        if (res.response === true && res.data?.info_mahasiswa_pa?.daftar_mahasiswa) {
          list = res.data.info_mahasiswa_pa.daftar_mahasiswa; // Path untuk data mahasiswa
          if (res.data.nama) {
            // Jika ada info nama dosen, simpan ke state dosenInfo
            setDosenInfo({
              nama: res.data.nama,
              email: res.data.email || "",
              nip: res.data.nip || "",
            });
          }
        } else if (Array.isArray(res.data)) {
          list = res.data; // Fallback pengecekan array
        } else if (Array.isArray(res)) {
          list = res; // Fallback pengecekan array
        }

        // Jika data list valid dan berbentuk array, simpan ke state
        if (list && Array.isArray(list)) {
          setMahasiswaBimbingan(list);
        } else {
          setMahasiswaBimbingan([]); // Kosongkan jika tidak valid
        }
      })
      .catch((err) => {
        // Jika API error (misal jaringan putus), kosongkan list
        setMahasiswaBimbingan([]);
      })
      .finally(() => {
        // Matikan animasi loading apapun hasil akhirnya (sukses/gagal)
        setLoadingBimbingan(false);
      });
  }, [token]);

  // useEffect ini akan terpanggil otomatis setiap kali 'activeTab' atau 'token' berubah
  useEffect(() => {
    // Jika tab pindah ke 'data' (Mahasiswa Bimbingan) dan token ada, maka jalankan fetch data bimbingan
    if (activeTab === 'data' && token) {
      fetchMahasiswaBimbingan();
    }
  }, [activeTab, token, fetchMahasiswaBimbingan]);

  // Persist activeTab changes to localStorage
  // Efek ini menyimpan tab terakhir yang dibuka ke local storage browser. Saat di-refresh, user akan kembali ke tab ini.
  useEffect(() => {
    localStorage.setItem('sd_activeTab', activeTab);
  }, [activeTab]);

  // --- Logic Perhitungan Progress (Hanya saat data detail dimuat) ---
  // Efek ini berjalan setiap kali state 'data' (data mahasiswa yang dicari) berubah
  useEffect(() => {
    // Jika data mahasiswa, setoran, dan detail setorannya tersedia...
    if (data && data.setoran && data.setoran.detail) {
      const list = data.setoran.detail; // Array seluruh surah/komponen
      const total = list.length; // Jumlah total surah
      // Menghitung berapa surah yang property 'sudah_setor' nya bernilai true
      const selesai = list.filter(item => item.sudah_setor).length;
      // Menghitung persentase progres (selesai dibagi total dikali 100) dan dibulatkan
      const percent = total > 0 ? Math.round((selesai / total) * 100) : 0;
      setProgress(percent); // Memperbarui state progress
    } else {
      setProgress(0); // Jika data tidak lengkap, kembalikan ke 0
    }
  }, [data]);

  // --- Notification Logic ---
  // Fungsi untuk menampilkan notifikasi pop-up (toast)
  const showNotif = (type, message) => {
    // Reset timer jika sebelumnya masih ada notifikasi yang tayang
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotif(null); // Menghapus notif lama (untuk memicu animasi ulang)
    
    // Memberikan delay sangat singkat (50ms) sebelum memunculkan notif baru agar animasi React tertrigger
    setTimeout(() => {
      setNotif({ type, message }); // Set notifikasi baru
      // Hilangkan notifikasi secara otomatis setelah 4 detik
      notifTimer.current = setTimeout(() => setNotif(null), 4000);
    }, 50);
  };

  // --- API Handlers ---
  // Fungsi yang dipanggil saat tombol "Masuk Sekarang" diklik
  const handleLogin = async () => {
    // Validasi form kosong
    if (!username || !password) {
      showNotif("error", "Harap masukkan username dan password!");
      return;
    }
    setIsLoading(true); // Hidupkan loading button
    try {
      // Memanggil API login
      const res = await api.login(username, password);
      const newToken = res.access_token; // Ekstrak token dari respons
      setToken(newToken); // Simpan token ke state React
      localStorage.setItem('sd_token', newToken); // Simpan token ke memori browser
      localStorage.setItem('sd_username', username); // Simpan username ke memori browser
      showNotif("success", "Selamat datang kembali, Dosen!");
      setActiveTab('dashboard'); // Pindahkan tampilan ke Dashboard
      localStorage.setItem('sd_activeTab', 'dashboard');
    } catch {
      // Menangkap error jika username/pass salah atau server mati
      showNotif("error", "Login gagal. Cek kembali akun Anda.");
    } finally {
      setIsLoading(false); // Matikan loading button
    }
  };

  // Fungsi untuk mencari data setoran mahasiswa tertentu
  const handleGetData = async (nimOverride) => {
    // Pastikan nimOverride benar-benar string NIM. Memprioritaskan nimOverride jika ada, jika tidak pakai nim dari state pencarian.
    const targetNim = (typeof nimOverride === 'string' ? nimOverride : null) || nim;
    
    // Validasi jika belum login atau NIM kosong
    if (!token || !targetNim) {
      showNotif("error", !token ? "Sesi berakhir." : "NIM mahasiswa harus diisi.");
      return;
    }
    setIsLoading(true); // Hidupkan indikator loading pencarian
    try {
      // Panggil API getSetoran
      const res = await api.getSetoran(targetNim, token);
      if (!res.response) {
        // Jika respons API false (mahasiswa tidak ada)
        showNotif("error", res.message || "Mahasiswa tidak ditemukan.");
        setData(null); // Kosongkan data sebelumnya
      } else {
        // Jika data mahasiswa ditemukan
        setData(res.data); // Simpan data mahasiswa
        setSelectedSurah([]); // Reset pilihan (centang surah) karena pindah mahasiswa
        setActiveTab('input'); // Pindahkan ke tab input/verifikasi
        showNotif("success", `Data ${res.data.info.nama} dimuat.`); // Beri notif sukses
      }
    } catch {
      showNotif("error", "Gangguan koneksi ke server.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi untuk menambah atau menghapus surah dari daftar yang akan diverifikasi (saat checkbox dicentang)
  const handleSelectSurah = (item) => {
    // Mengecek apakah komponen/surah ini sudah ada di dalam state selectedSurah
    const exist = selectedSurah.find((s) => s.id_komponen_setoran === item.id);
    if (exist) {
      // Jika sudah ada, hapus dari list (Uncheck) menggunakan filter
      setSelectedSurah(selectedSurah.filter((s) => s.id_komponen_setoran !== item.id));
    } else {
      // Jika belum ada, tambahkan ke dalam list (Check) dengan format payload yang diminta API
      setSelectedSurah([...selectedSurah, {
        nama_komponen_setoran: item.nama,
        id_komponen_setoran: item.id,
      }]);
    }
  };

  // Fungsi untuk mensubmit/menyimpan hasil centangan surah ke server
  const handleSimpan = async () => {
    // Validasi jika NIM tidak ada atau tidak ada surah yang dicentang
    if (!nim || selectedSurah.length === 0) {
      showNotif("error", "Pilih setoran terlebih dahulu!");
      return;
    }
    setIsLoading(true); // Hidupkan loading button Simpan
    // Membentuk payload (data yang akan dikirim) sesuai standar API backend
    const payload = {
      data_setoran: selectedSurah, // Array surah yang dicentang tadi
      tgl_setoran: new Date().toISOString().split("T")[0], // Tanggal hari ini dengan format YYYY-MM-DD
    };
    try {
      // Panggil API simpanSetoran
      const res = await api.simpanSetoran(nim, token, payload);
      // Munculkan notif sukses atau error tergantung respons API
      showNotif(res.response ? "success" : "error", res.message);
      if (res.response) {
        // Jika sukses menyimpan, kosongkan centangan
        setSelectedSurah([]);
        // Otomatis refresh data mahasiswa terbaru setelah 0.5 detik (agar status centang di layar berubah jadi hijau)
        setTimeout(() => handleGetData(nim), 500); 
      }
    } catch {
      showNotif("error", "Gagal menyimpan data.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi untuk membatalkan/menghapus verifikasi hafalan yang sudah disahkan sebelumnya
  const handleDelete = async (item) => {
    // Memunculkan dialog konfirmasi bawaan browser (Confirm Box)
    if (!window.confirm(`Hapus permanen setoran ${item.nama}?`)) return; // Berhenti jika user klik "Cancel"
    
    // Payload untuk menghapus data berdasarkan ID
    const payload = {
      data_setoran: [
        {
          id: item.info_setoran.id, // ID unik dari histori setoran tersebut
          id_komponen_setoran: item.id,
          nama_komponen_setoran: item.nama,
        },
      ],
    };
    try {
      // Panggil API deleteSetoran
      const res = await api.deleteSetoran(nim, token, payload);
      showNotif(res.response ? "success" : "error", res.message);
      // Jika sukses dihapus, refresh data mahasiswa agar layar terupdate
      if (res.response) await handleGetData(nim); 
    } catch {
      showNotif("error", "Gagal menghapus.");
    }
  };

  // --- Views (Tampilan JSX) ---

  // Jika token kosong (Belum Login), render Tampilan Halaman Login
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6">
        {/* Kontainer utama kotak login */}
        <div className="grid md:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 max-w-4xl w-full overflow-hidden border border-slate-100">
          
          {/* Sisi Kiri Kotak Login (Banner Visual/Informasi) - Disembunyikan di layar HP (hidden md:flex) */}
          <div className="hidden md:flex bg-indigo-600 p-12 flex-col justify-between text-white relative overflow-hidden">
             {/* Elemen dekoratif background (lingkaran blur) */}
             <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-50"></div>
             
             {/* Konten teks utama banner */}
             <div className="relative z-10">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                  <ShieldCheck size={28} /> {/* Render Ikon Perisai */}
                </div>
                <h1 className="text-4xl font-bold leading-tight">Sistem Monitoring Setoran</h1>
                <p className="mt-4 text-indigo-100 text-lg">Platform khusus dosen untuk memvalidasi dan memantau progres hafalan mahasiswa Teknik Informatika.</p>
             </div>
             
             {/* Footer banner */}
             <div className="relative z-10 flex items-center gap-2 text-sm font-medium text-indigo-200">
                <BookOpen size={16} />
                <span>UIN Suska Riau • Teknik Informatika</span>
             </div>
          </div>
          
          {/* Sisi Kanan Kotak Login (Formulir Login) */}
          <div className="p-10 md:p-14">
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Selamat Datang</h2>
              <p className="text-slate-400 mt-2 font-medium">Masuk untuk mengelola data setoran</p>
            </div>

            <div className="space-y-6">
              {/* Input Kolom Username */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Username</label>
                <input
                  type="text"
                  placeholder="NIP/Username"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                  value={username} // Menghubungkan value input ke state React
                  onChange={(e) => setUsername(e.target.value)} // Mengubah state username saat diketik
                />
              </div>

              {/* Input Kolom Password */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Kata Sandi</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                  value={password} // Menghubungkan value input ke state
                  onChange={(e) => setPassword(e.target.value)} // Mengubah state password saat diketik
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()} // Memungkinkan login dengan menekan tombol 'Enter' pada keyboard
                />
              </div>

              {/* Tombol Eksekusi Login */}
              <button
                onClick={handleLogin} // Eksekusi fungsi handleLogin saat diklik
                disabled={isLoading} // Tombol dinonaktifkan jika state isLoading sedang true
                className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-3 text-lg mt-8"
              >
                {/* Menampilkan Ikon Jam berputar (loading) jika isLoading true */}
                {isLoading ? <Clock className="animate-spin" size={22} /> : null}
                {/* Teks tombol berubah berdasarkan state isLoading */}
                {isLoading ? "Menghubungkan..." : "Masuk Sekarang"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Jika sudah login (Token tersedia), kembalikan layout utama aplikasi (Dashboard)
  return (
    // Kontainer Wrapper Utama
    <div className="flex min-h-screen bg-[#f8fafc] font-sans text-slate-900">
      
      {/* Pop-up Notifikasi Global */}
      {notif && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-8 duration-300">
          {/* Warna background notif hijau untuk success, merah/rose untuk error */}
          <div className={`flex items-center gap-3 px-6 py-4 rounded-[1.25rem] shadow-2xl text-white font-bold backdrop-blur-md ${notif.type === 'success' ? 'bg-emerald-500/90' : 'bg-rose-500/90'}`}>
            {/* Ikon centang untuk sukses, ikon tanda seru untuk error */}
            {notif.type === 'success' ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
            {notif.message} {/* Pesan notifikasinya */}
          </div>
        </div>
      )}

      {/* Sidebar Navigasi Kiri (Disembunyikan di HP) */}
      <aside className="w-24 lg:w-72 bg-white border-r border-slate-100 hidden md:flex flex-col transition-all duration-300">
        {/* Header/Logo Sidebar */}
        <div className="p-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-[1rem] flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-100">S</div>
          <span className="font-black text-xl tracking-tighter text-slate-900 hidden lg:block">SETORAN<span className="text-indigo-600">DOSEN</span></span>
        </div>
        
        {/* Menu Navigasi memanggil komponen SidebarLink */}
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <SidebarLink active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={22} />} label="Beranda" />
          <SidebarLink active={activeTab === 'input'} onClick={() => setActiveTab('input')} icon={<PlusCircle size={22} />} label="Verifikasi Baru" />
          <SidebarLink active={activeTab === 'data'} onClick={() => setActiveTab('data')} icon={<Users size={22} />} label="Mahasiswa Bimbingan" />
        </nav>

        {/* Tombol Logout di bagian paling bawah Sidebar */}
        <div className="p-6 border-t border-slate-50">
          <button 
            // Membersihkan seluruh state dan memori lokal (localStorage) saat ditekan
            onClick={() => { setToken(""); setData(null); setNim(""); localStorage.removeItem('sd_token'); localStorage.removeItem('sd_username'); localStorage.removeItem('sd_activeTab'); }}
            className="flex items-center gap-4 w-full p-4 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all font-bold text-sm"
          >
            <LogOut size={22} />
            <span className="hidden lg:block">Keluar Sistem</span>
          </button>
        </div>
      </aside>

      {/* Area Konten Utama Sebelah Kanan */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header Atas (Pencarian NIM & Profil User) */}
        <header className="h-24 bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 flex items-center justify-between px-10">
          
          {/* Kotak Pencarian NIM */}
          <div className={`flex items-center bg-slate-50 rounded-2xl px-5 py-3 w-full max-w-md border transition-all ${searchFocused ? 'border-indigo-400 bg-white ring-4 ring-indigo-50' : 'border-slate-100'}`}>
            <Search size={20} className={searchFocused ? 'text-indigo-500' : 'text-slate-400'} />
            <input 
              type="text" 
              placeholder="Ketik NIM Mahasiswa..."
              onFocus={() => setSearchFocused(true)} // Mengubah state fokus menjadi true
              onBlur={() => setSearchFocused(false)} // Mengubah state fokus menjadi false
              value={nim} // Menyambungkan dengan state NIM
              onChange={(e) => setNim(e.target.value)} // Memperbarui state NIM
              onKeyDown={(e) => e.key === 'Enter' && handleGetData()} // Cari data jika 'Enter' ditekan
              className="bg-transparent border-none focus:ring-0 text-sm w-full font-bold ml-3"
            />
            {/* Tombol Cari (Hanya muncul jika kolom NIM ada isinya) */}
            {nim && (
              <button 
                onClick={() => handleGetData()} // Menjalankan fungsi get data
                disabled={isLoading}
                className="bg-indigo-600 text-white text-xs font-black px-4 py-2 rounded-xl hover:bg-indigo-700 transition shadow-md active:scale-95"
              >
                {isLoading ? "..." : "CARI"}
              </button>
            )}
          </div>

          {/* Info Profil di Sudut Kanan Header */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-sm font-black text-slate-800">{dosenInfo.nama || username}</span>
              <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-widest">{dosenInfo.nip || "Dosen Verifikator"}</span>
            </div>
            {/* Avatar Inisial */}
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border-2 border-white shadow-md flex items-center justify-center font-black text-indigo-600 text-lg">
              {username?.charAt(0).toUpperCase()} {/* Mengambil huruf pertama dari username */}
            </div>
          </div>
        </header>

        {/* Dynamic Canvas - Menampilkan konten berbeda berdasarkan 'activeTab' */}
        <div className="flex-1 p-10 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-8">
            
            {/* TAMPILAN 1: Dashboard / Beranda */}
            {activeTab === 'dashboard' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Kotak Pengumuman Utama (Ungu) */}
                  <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 opacity-10"><BookOpen size={240} /></div>
                    <h2 className="text-3xl font-black mb-4">Mulai Verifikasi Hari Ini</h2>
                    <p className="text-indigo-100 text-lg mb-8 max-w-md leading-relaxed">Penyetoran hafalan adalah bagian krusial dari evaluasi akademik mahasiswa. Mari pastikan kualitas hafalan tetap terjaga.</p>
                    <button 
                       // Saat diklik, ini membuat kursor otomatis fokus ke kolom pencarian NIM di atas
                       onClick={() => document.querySelector('input')?.focus()}
                       className="bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-indigo-50 transition-all shadow-xl active:scale-95"
                    >
                      Masukkan NIM <ArrowRight size={20} />
                    </button>
                  </div>
                  
                  {/* Kotak Status Koneksi/Sistem */}
                  <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 flex flex-col justify-between shadow-sm">
                    <div>
                        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-6">
                            <Bell size={24} />
                        </div>
                        <h3 className="font-black text-xl mb-2">Ringkasan Sesi</h3>
                        <p className="text-slate-400 text-sm font-medium">Aktivitas verifikasi Anda akan muncul di sini setelah mulai mencari data.</p>
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status</span>
                        <span className="flex items-center gap-2 text-emerald-500 font-black text-xs uppercase tracking-widest">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            Terhubung
                        </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAMPILAN 2: Halaman Input/Verifikasi (Terlihat jika tab input aktif DAN data mahasiswa ada) */}
            {activeTab === 'input' && data && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Profil Singkat Mahasiswa yang dicari */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-8 group">
                  <div className="relative">
                    {/* Avatar Mahasiswa */}
                    <div className="w-24 h-24 bg-gradient-to-tr from-indigo-50 to-indigo-100 rounded-[2rem] flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform duration-300">
                        <User size={48} strokeWidth={1.5} />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2 rounded-xl shadow-lg border-4 border-white">
                        <Check size={16} strokeWidth={3} />
                    </div>
                  </div>
                  
                  {/* Teks Identitas Mahasiswa */}
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                        <h2 className="text-3xl font-black text-slate-900">{data.info.nama}</h2>
                        <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">AKTIF</span>
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-6 mt-3 text-slate-500 font-bold text-sm">
                      <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl">
                        <ShieldCheck size={16} className="text-indigo-400" /> NIM {data.info.nim}
                      </div>
                      <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl">
                        <LayoutDashboard size={16} className="text-indigo-400" /> Semester {data.info.semester}
                      </div>
                    </div>
                  </div>

                  {/* Tombol Simpan Verifikasi Utama */}
                  <button 
                    onClick={handleSimpan} // Menjalankan API simpan saat di klik
                    // Tombol mati (disabled) jika belum ada yang dicentang (selectedSurah.length === 0) atau sedang loading
                    disabled={selectedSurah.length === 0 || isLoading}
                    className="w-full md:w-auto bg-emerald-600 text-white px-10 py-5 rounded-2xl font-black text-lg hover:bg-emerald-700 disabled:opacity-30 disabled:bg-slate-200 shadow-2xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    {isLoading ? <Clock className="animate-spin" /> : <CheckCircle2 />}
                    {/* Menampilkan jumlah item yang sudah dicentang */}
                    SIMPAN ({selectedSurah.length})
                  </button>
                </div>

                {/* Indikator Progres Bar Hafalan */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col gap-4">
  <div className="flex justify-between items-end">
    <div>
      <h3 className="font-black text-xl text-slate-900">
        Progres Hafalan 
        {/* NOTED: Menambahkan Nama dan NIM mahasiswa di samping judul progres */}
        <span className="ml-3 text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
          {data.info.nama} ({data.info.nim})
        </span>
      </h3>
      <p className="text-slate-400 text-sm font-medium mt-1">Jumlah setoran yang sudah diverifikasi</p>
    </div>
    <div className="text-4xl font-black text-indigo-600">
      {progress.selesai} <span className="text-2xl text-slate-400">/ {progress.total}</span>
    </div>
  </div>
  <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-50 relative">
    <div 
      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-1000 ease-out"
      style={{ width: `${progress.persentase}%` }}
    />
  </div>
</div>

                {/* Tabel / List Checklist Surah */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                    <div>
                        <h3 className="font-black text-slate-900 text-xl">Daftar Komponen Hafalan</h3>
                        <p className="text-slate-400 text-sm font-medium mt-1">Centang pada kotak untuk menambahkan verifikasi baru</p>
                    </div>
                    <button className="p-3 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100">
                        <Filter size={20} className="text-slate-400" />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-50">
                    {/* Melakukan perulangan (map) terhadap array 'detail' setoran yang didapat dari API */}
                    {data.setoran.detail.map((item) => (
                      <div 
                        key={item.id} // Wajib di React: Key unik untuk elemen di dalam list
                        // Logika Styling: Jika sudah_setor, warnanya buram. Jika dicentang (selectedSurah), warnanya kebiruan.
                        className={`flex items-center justify-between px-10 py-6 transition-all duration-200 ${
                            item.sudah_setor 
                            ? 'bg-slate-50/50 opacity-80' 
                            : selectedSurah.some(s => s.id_komponen_setoran === item.id)
                                ? 'bg-indigo-50/30'
                                : 'hover:bg-slate-50/30'
                        }`}
                      >
                        <div className="flex items-center gap-6">
                          {/* Kotak Checkbox Custom */}
                          <div 
                            // Event klik: Hanya bisa diklik jika belum disetor. Fungsi handleSelectSurah dipanggil.
                            onClick={() => !item.sudah_setor && handleSelectSurah(item)}
                            // Mengubah warna dan bentuk checkbox tergantung dari status disetor atau dipilih.
                            className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer ${
                              item.sudah_setor 
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' 
                                : selectedSurah.some(s => s.id_komponen_setoran === item.id)
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110'
                                    : 'border-slate-200 bg-white hover:border-indigo-400'
                            }`}
                          >
                            {/* Memunculkan Ikon Centang jika sudah diverifikasi database ATAU jika sedang dipilih dosen untuk di-submit */}
                            {(item.sudah_setor || selectedSurah.some(s => s.id_komponen_setoran === item.id)) && <Check size={18} strokeWidth={4} />}
                          </div>
                          
                          {/* Teks Nama Surah */}
                          <div>
                            <div className="flex items-center gap-2">
                                {/* Mencoret teks (line-through) jika sudah pernah disetor */}
                                <p className={`font-black text-lg ${item.sudah_setor ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                    {item.nama}
                                </p>
                                {/* Badge Verified hijau jika sudah selesai */}
                                {item.sudah_setor && <span className="bg-emerald-100 text-emerald-600 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">VERIFIED</span>}
                            </div>
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-0.5">{item.label}</p>
                          </div>
                        </div>

                        {/* Tampilan Informasi Ekstra & Tombol Hapus (KHUSUS UNTUK YANG SUDAH DISETOR) */}
                        {item.sudah_setor && (
                          <div className="flex items-center gap-8">
                            <div className="text-right">
                              {/* Menampilkan Tanggal Setoran */}
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 justify-end">
                                <Calendar size={14} className="text-slate-300" />
                                {item.info_setoran.tgl_setoran}
                              </div>
                              {/* Menampilkan Nama Dosen yang Mengesahkan */}
                              <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 mt-1 justify-end uppercase tracking-widest">
                                <User size={12} /> {item.info_setoran.dosen_yang_mengesahkan?.nama}
                              </div>
                            </div>
                            {/* Tombol Delete (Tong Sampah) */}
                            <button 
                                onClick={() => handleDelete(item)} // Memanggil API hapus
                                className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90"
                                title="Batalkan Verifikasi"
                            >
                                <Trash2 size={20} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Footer Tabel */}
                  <div className="p-10 bg-slate-50/50 flex justify-center border-t border-slate-50">
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ujung Halaman • Data Sinkron</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAMPILAN 3: Halaman Daftar Mahasiswa Bimbingan */}
            {activeTab === 'data' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <h2 className="text-3xl font-black text-slate-900">Mahasiswa Bimbingan</h2>
                      <p className="text-slate-400 mt-2 font-medium">Dosen Pembimbing: <span className="text-indigo-600 font-black">{dosenInfo.nama}</span></p>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Tombol Refresh Manual untuk memanggil ulang API getMahasiswaBimbingan */}
                      <button
                        onClick={fetchMahasiswaBimbingan}
                        disabled={loadingBimbingan}
                        className="bg-white text-indigo-600 border border-indigo-200 px-4 py-3 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {/* Memberi animasi mutar saat loading */}
                        <Clock className={loadingBimbingan ? 'animate-spin' : ''} size={16} />
                        Refresh
                      </button>
                      {/* Lencana (Badge) Total Mahasiswa */}
                      <div className="bg-indigo-50 text-indigo-600 px-6 py-3 rounded-2xl font-black text-sm">
                        Total: {mahasiswaBimbingan.length} Mahasiswa
                      </div>
                    </div>
                  </div>

                  {/* Menampilkan indikator loading (Teks & Putaran Jam) saat request API berjalan */}
                  {loadingBimbingan && (
                    <div className="flex items-center justify-center py-20">
                      <Clock className="animate-spin text-indigo-500" size={32} />
                      <span className="ml-3 text-slate-500 font-bold">Memuat data mahasiswa...</span>
                    </div>
                  )}

                  {/* Menampilkan pesan Kosong jika API sukses tetapi array mahasiswa tidak ada isinya */}
                  {!loadingBimbingan && mahasiswaBimbingan.length === 0 && (
                    <div className="text-center py-20">
                      <Users size={48} className="text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold">Tidak ada data mahasiswa bimbingan</p>
                    </div>
                  )}

                  {/* Grid / Layout Kotak untuk daftar Kartu Mahasiswa */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {/* Melakukan perulangan (map) data mahasiswa bimbingan dari state */}
                    {mahasiswaBimbingan.map((mhs, idx) => {
                      // KODE BARU: Progress & Bar sudah dihapus dari sini karena API /pa-saya tidak mengirim data tersebut
                      
                      // Fallback: Karena field API dari backend bisa berubah-ubah, ini melakukan pengecekan beberapa nama field (mhs.nim / mhs.npm dll).
                      const nimMhs = mhs.nim || mhs.npm || mhs.nim_mhs || mhs.id || idx + 1;
                      const namaMhs = mhs.nama || mhs.nm_mhs || mhs.name || mhs.nama_mahasiswa || "Mahasiswa";
                      const semesterMhs = mhs.semester || mhs.smt || mhs.sem || "-";
                      
                      return (
                        <div
                          key={nimMhs} // Kunci unik untuk react
                          className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 transition-all duration-300 group cursor-pointer flex flex-col justify-between"
                          // Event Klik pada Kartu: Akan langsung menset kotak pencarian dengan NIM orang ini, lalu otomatis mencari datanya
                          onClick={() => { 
                            const nimStr = String(nimMhs); // Pastikan NIM berupa string
                            setNim(nimStr);  // Isi kolom input dengan NIM
                            handleGetData(nimStr); // Cari data detailnya
                          }}
                        >
                          <div>
                            <div className="flex items-start justify-between mb-4">
                              {/* Avatar inisial nama mahasiswa */}
                              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                                {namaMhs.charAt(0)}
                              </div>
                              <span className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest bg-emerald-100 text-emerald-600 shadow-sm border border-emerald-200">
                                Aktif
                              </span>
                            </div>

                            <h3 className="font-black text-lg text-slate-900 mb-1 line-clamp-2">{namaMhs}</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">NIM {nimMhs} • Sem {semesterMhs}</p>
                          </div>

                          {/* Tombol Dummy (Fungsi kliknya ditangani oleh parent div di atasnya) */}
                          <button className="w-full mt-4 bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all text-sm flex items-center justify-center gap-2 group-hover:shadow-md">
                            Cek Hafalan <ArrowRight size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App; // Mengekspor komponen App agar bisa dirender oleh React DOM di file utama (index.js/main.jsx)