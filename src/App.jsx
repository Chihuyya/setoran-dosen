import { useState, useRef } from "react";
import { login, getSetoran, simpanSetoran, deleteSetoran } from "./api";

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [data, setData] = useState(null);
  const [selectedSurah, setSelectedSurah] = useState([]);
  const [nim, setNim] = useState("");
  const [notif, setNotif] = useState(null);
  const notifTimer = useRef(null);

const showNotif = (type, message) => {
  if (notifTimer.current) {
    clearTimeout(notifTimer.current);
  }

  setNotif(null);

  setTimeout(() => {
    setNotif({ type, message });

    notifTimer.current = setTimeout(() => {
      setNotif(null);
    }, 4000);
  }, 50);
};

  const handleLogin = async () => {
    try {
      const res = await login(username, password);
      setToken(res.access_token);
      showNotif("success", "Login berhasil!");
    } catch (err) {
      showNotif("error", "Login gagal!");
    }
  };

  const handleGetData = async () => {
    if (!token) {
      showNotif("error", "Login gagal!");
      return;
    }

    if (!nim) {
      showNotif("error", "Masukkan NIM!");
      return;
    }
    
    const res = await getSetoran(nim, token);

    if (!res.response) {
      showNotif("error", res.message);
      setData(null);
      return;
    }

    setData(res.data);
  };

  const handleSelectSurah = (item) => {
    const exist = selectedSurah.find(
      (s) => s.id_komponen_setoran === item.id
    );

    if (exist) {
      setSelectedSurah(
        selectedSurah.filter(
          (s) => s.id_komponen_setoran !== item.id
        )
      );
    } else {
      setSelectedSurah([
        ...selectedSurah,
        {
          nama_komponen_setoran: item.nama,
          id_komponen_setoran: item.id,
        },
      ]);
    }
  };

  const handleSimpan = async () => {
    if (!nim) return;
    if (selectedSurah.length === 0) return;

    const payload = {
      data_setoran: selectedSurah,
      tgl_setoran: new Date().toISOString().split("T")[0],
    };

    try {
      const res = await simpanSetoran(nim, token, payload);

      showNotif(
  res.response ? "success" : "error",
  res.message
);
      if (res.response) {
        setSelectedSurah([]);
        setTimeout(() => {
  handleGetData();
}, 500);
      }
    } catch (err) {
  showNotif("error", "Terjadi kesalahan di server!");
}
    }

  const handleDelete = async (item) => {
    const payload = {
      data_setoran: [
        {
          id: item.info_setoran.id,
          id_komponen_setoran: item.id,
          nama_komponen_setoran: item.nama,
        },
      ],
    };

    try {
      const res = await deleteSetoran(nim, token, payload);

      showNotif(
  res.response ? "success" : "error",
  res.message
);

      if (res.response) handleGetData();
    } catch (err) {
  showNotif("error", "Terjadi kesalahan di server!");
}
  };

  return (
    <>
      {/* 🔐 LOGIN */}
      {!token && (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-600">
          <div className="bg-white/20 backdrop-blur-lg p-8 rounded-2xl shadow-xl w-80 border border-white/30">
            <h1 className="text-3xl font-bold text-white text-center mb-6">
              Setoran Hafalan
            </h1>

            <p className="text-white text-sm text-center mb-6">
              Silakan login terlebih dahulu
            </p>

            <input
              type="text"
              placeholder="Username"
              className="w-full p-3 mb-3 rounded-lg bg-white/80 focus:outline-none"
              onChange={(e) => setUsername(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full p-3 mb-4 rounded-lg bg-white/80 focus:outline-none"
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              onClick={handleLogin}
              className="w-full bg-white text-blue-600 font-semibold py-2 rounded-lg hover:bg-gray-200 transition"
            >
              Login
            </button>
          </div>
        </div>
      )}

      {/* 📊 DASHBOARD */}
      {token && (
        <div className="min-h-screen bg-gradient-to-r from-blue-500 to-indigo-600 p-10">
          <div className="max-w-4xl mx-auto">

            <h1 className="text-3xl font-bold text-white text-center mb-6">
              Dashboard Setoran
            </h1>

            {notif && (
  <div
    className={`mb-4 p-3 rounded text-white transform transition-all duration-500 ease-in-out
    ${notif.type === "success" ? "bg-green-500" : "bg-red-500"}
    ${notif ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}
    `}
  >
    {notif.message}
  </div>
)}

            {/* INPUT */}
            <div className="bg-white/20 backdrop-blur-lg p-5 rounded-xl mb-5 border border-white/30">
              <div className="flex flex-col items-center gap-3">
                <input
                  type="text"
                  placeholder="Masukkan NIM"
                  className="p-3 rounded w-64 bg-white/80"
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                />

                <div className="flex gap-3">
                  <button
                    onClick={handleGetData}
                    className="bg-green-500 text-white px-4 py-2 rounded"
                  >
                    Search
                  </button>

                  <button
                    onClick={handleSimpan}
                    className="bg-purple-500 text-white px-4 py-2 rounded"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>

            {/* DATA */}
            {data && (
              <div className="space-y-5">

                {/* INFO */}
                <div className="bg-white p-5 rounded-xl shadow">
                  <h2 className="text-lg font-semibold">
                    {data.info.nama}
                  </h2>
                  <p>{data.info.nim}</p>
                  <p>Semester: {data.info.semester}</p>
                </div>

                {/* LIST */}
                <div className="bg-white p-5 rounded-xl shadow">
                  <h2 className="mb-3 font-semibold">
                    Daftar Surah
                  </h2>

                  {data.setoran.detail.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between border-b py-2"
                    >
                      <div>
                        <p className="font-medium">
                          {item.nama} ({item.label})
                        </p>

                        {item.sudah_setor && item.info_setoran && (
  <div className="text-sm text-gray-500">
    <p>
      📅{" "}
      {new Date(
        item.info_setoran.tgl_setoran
      ).toLocaleDateString("id-ID")}
    </p>

    <p>
      👨‍🏫{" "}
      {item.info_setoran.dosen_yang_mengesahkan?.nama || "-"}
    </p>
  </div>
)}
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          disabled={item.sudah_setor}
                          checked={selectedSurah.some(
                            (s) =>
                              s.id_komponen_setoran ===
                              item.id
                          )}
                          onChange={() =>
                            handleSelectSurah(item)
                          }
                        />

                        {item.sudah_setor && (
                          <>
                            <span className="text-green-600">
                              ✔
                            </span>
                            <button
                              onClick={() =>
                                handleDelete(item)
                              }
                              className="text-red-500"
                            >
                              🗑
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;