import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Users, 
  LogOut, 
  Search, 
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  User,
  Trash2,
  Check,
  ShieldCheck,
  Bell,
  BookOpen,
  Filter,
  ArrowRight
} from 'lucide-react';

/**
 * INTEGRATED API LOGIC
 * Menggunakan kredensial dan endpoint asli dari UIN Suska
 */
const KC_URL = "https://id.tif.uin-suska.ac.id";
const BASE_URL = "https://api.tif.uin-suska.ac.id/setoran-dev/v1";

const api = {
  login: async (username, password) => {
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
    if (!response.ok) throw new Error("Gagal login");
    return response.json();
  },

  getSetoran: async (nim, token) => {
    const response = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  },

  simpanSetoran: async (nim, token, data) => {
    const res = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteSetoran: async (nim, token, data) => {
    const res = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getMahasiswaBimbingan: async (token) => {
    const response = await fetch(`${BASE_URL}/dosen/pa-saya`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  }
};

const App = () => {
  // --- Auth & Data State ---
  const [username, setUsername] = useState(localStorage.getItem('sd_username') || "");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem('sd_token') || "");
  const [data, setData] = useState(null);
  const [selectedSurah, setSelectedSurah] = useState([]);
  const [nim, setNim] = useState("");
  const [notif, setNotif] = useState(null);
  const [mahasiswaBimbingan, setMahasiswaBimbingan] = useState([]);
  const [loadingBimbingan, setLoadingBimbingan] = useState(false);
  const notifTimer = useRef(null);

  // --- UI State ---
  const [activeTab, setActiveTab] = useState(localStorage.getItem('sd_activeTab') || 'dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // --- Fetch Mahasiswa Bimbingan ---
  const [dosenInfo, setDosenInfo] = useState({ nama: "Pak Fikri", email: "", nip: "" });

  const fetchMahasiswaBimbingan = useCallback(() => {
    if (!token) return;
    setLoadingBimbingan(true);

    api.getMahasiswaBimbingan(token)
      .then((res) => {
        console.log("[DEBUG] Response dari /dosen/pa-saya:", res);

        let list = null;

        // Format API PA-Saya: res.data.info_mahasiswa_pa.daftar_mahasiswa
        if (res.response === true && res.data?.info_mahasiswa_pa?.daftar_mahasiswa) {
          list = res.data.info_mahasiswa_pa.daftar_mahasiswa;
          // Simpan info dosen juga
          if (res.data.nama) {
            setDosenInfo({
              nama: res.data.nama,
              email: res.data.email || "",
              nip: res.data.nip || "",
            });
          }
        }
        // Fallbacks untuk format lain
        else if (Array.isArray(res.data)) {
          list = res.data;
        } else if (Array.isArray(res)) {
          list = res;
        } else if (res.data?.mahasiswa && Array.isArray(res.data.mahasiswa)) {
          list = res.data.mahasiswa;
        } else if (res.data?.list && Array.isArray(res.data.list)) {
          list = res.data.list;
        } else if (res.data && typeof res.data === 'object') {
          const firstArray = Object.values(res.data).find(v => Array.isArray(v));
          if (firstArray) list = firstArray;
        }

        if (list && Array.isArray(list)) {
          setMahasiswaBimbingan(list);
          console.log("[DEBUG] Data mahasiswa bimbingan dimuat:", list.length, "item");
        } else {
          console.warn("[DEBUG] Format respons tidak dikenali:", res);
          setMahasiswaBimbingan([]);
        }
      })
      .catch((err) => {
        console.error("[DEBUG] Error fetch mahasiswa bimbingan:", err);
        setMahasiswaBimbingan([]);
      })
      .finally(() => {
        setLoadingBimbingan(false);
      });
  }, [token]);

  useEffect(() => {
    if (activeTab === 'data' && token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchMahasiswaBimbingan();
    }
  }, [activeTab, token, fetchMahasiswaBimbingan]);

  // Persist activeTab changes to localStorage
  useEffect(() => {
    localStorage.setItem('sd_activeTab', activeTab);
  }, [activeTab]);

  // --- Notification Logic ---
  const showNotif = (type, message) => {
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotif(null);
    setTimeout(() => {
      setNotif({ type, message });
      notifTimer.current = setTimeout(() => setNotif(null), 4000);
    }, 50);
  };

  // --- API Handlers ---
  const handleLogin = async () => {
    if (!username || !password) {
      showNotif("error", "Harap masukkan username dan password!");
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.login(username, password);
      const newToken = res.access_token;
      setToken(newToken);
      localStorage.setItem('sd_token', newToken);
      localStorage.setItem('sd_username', username);
      showNotif("success", "Selamat datang kembali, Dosen!");
      setActiveTab('dashboard');
      localStorage.setItem('sd_activeTab', 'dashboard');
    } catch {
      showNotif("error", "Login gagal. Cek kembali akun Anda.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetData = async () => {
    if (!token || !nim) {
      showNotif("error", !token ? "Sesi berakhir." : "NIM tidak boleh kosong.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.getSetoran(nim, token);
      if (!res.response) {
        showNotif("error", res.message || "Mahasiswa tidak ditemukan.");
        setData(null);
      } else {
        setData(res.data);
        setActiveTab('input');
        showNotif("success", `Data ${res.data.info.nama} dimuat.`);
      }
    } catch {
      showNotif("error", "Gangguan koneksi ke server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSurah = (item) => {
    const exist = selectedSurah.find((s) => s.id_komponen_setoran === item.id);
    if (exist) {
      setSelectedSurah(selectedSurah.filter((s) => s.id_komponen_setoran !== item.id));
    } else {
      setSelectedSurah([...selectedSurah, {
        nama_komponen_setoran: item.nama,
        id_komponen_setoran: item.id,
      }]);
    }
  };

  const handleSimpan = async () => {
    if (!nim || selectedSurah.length === 0) {
      showNotif("error", "Pilih setoran terlebih dahulu!");
      return;
    };
    setIsLoading(true);
    const payload = {
      data_setoran: selectedSurah,
      tgl_setoran: new Date().toISOString().split("T")[0],
    };
    try {
      const res = await api.simpanSetoran(nim, token, payload);
      showNotif(res.response ? "success" : "error", res.message);
      if (res.response) {
        setSelectedSurah([]);
        setTimeout(() => handleGetData(), 500);
      }
    } catch {
      showNotif("error", "Gagal menyimpan data.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Hapus permanen setoran ${item.nama}?`)) return;
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
      const res = await api.deleteSetoran(nim, token, payload);
      showNotif(res.response ? "success" : "error", res.message);
      if (res.response) handleGetData();
    } catch {
      showNotif("error", "Gagal menghapus.");
    }
  };

  // --- Views ---

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6">
        <div className="grid md:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 max-w-4xl w-full overflow-hidden border border-slate-100">
          <div className="hidden md:flex bg-indigo-600 p-12 flex-col justify-between text-white relative overflow-hidden">
             <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-50"></div>
             <div className="relative z-10">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                  <ShieldCheck size={28} />
                </div>
                <h1 className="text-4xl font-bold leading-tight">Sistem Monitoring Setoran</h1>
                <p className="mt-4 text-indigo-100 text-lg">Platform khusus dosen untuk memvalidasi dan memantau progres hafalan mahasiswa Teknik Informatika.</p>
             </div>
             <div className="relative z-10 flex items-center gap-2 text-sm font-medium text-indigo-200">
                <BookOpen size={16} />
                <span>UIN Suska Riau • Teknik Informatika</span>
             </div>
          </div>
          
          <div className="p-10 md:p-14">
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Selamat Datang</h2>
              <p className="text-slate-400 mt-2 font-medium">Masuk untuk mengelola data setoran</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Username</label>
                <input
                  type="text"
                  placeholder="NIP/Username"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Kata Sandi</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>

              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-3 text-lg mt-8"
              >
                {isLoading ? <Clock className="animate-spin" size={22} /> : null}
                {isLoading ? "Menghubungkan..." : "Masuk Sekarang"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc] font-sans text-slate-900">
      {/* Notif */}
      {notif && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-8 duration-300">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-[1.25rem] shadow-2xl text-white font-bold backdrop-blur-md ${notif.type === 'success' ? 'bg-emerald-500/90' : 'bg-rose-500/90'}`}>
            {notif.type === 'success' ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
            {notif.message}
          </div>
        </div>
      )}

      {/* Sidebar - Sleek & Compact */}
      <aside className="w-24 lg:w-72 bg-white border-r border-slate-100 hidden md:flex flex-col transition-all duration-300">
        <div className="p-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-[1rem] flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-100">S</div>
          <span className="font-black text-xl tracking-tighter text-slate-900 hidden lg:block">SETORAN<span className="text-indigo-600">DOSEN</span></span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <SidebarLink active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={22} />} label="Beranda" />
          <SidebarLink active={activeTab === 'input'} onClick={() => setActiveTab('input')} icon={<PlusCircle size={22} />} label="Verifikasi Baru" />
          <SidebarLink active={activeTab === 'data'} onClick={() => setActiveTab('data')} icon={<Users size={22} />} label="Mahasiswa Bimbingan" />
        </nav>

        <div className="p-6 border-t border-slate-50">
          <button 
            onClick={() => { setToken(""); setData(null); setNim(""); localStorage.removeItem('sd_token'); localStorage.removeItem('sd_username'); localStorage.removeItem('sd_activeTab'); }}
            className="flex items-center gap-4 w-full p-4 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all font-bold text-sm"
          >
            <LogOut size={22} />
            <span className="hidden lg:block">Keluar Sistem</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-24 bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 flex items-center justify-between px-10">
          <div className={`flex items-center bg-slate-50 rounded-2xl px-5 py-3 w-full max-w-md border transition-all ${searchFocused ? 'border-indigo-400 bg-white ring-4 ring-indigo-50' : 'border-slate-100'}`}>
            <Search size={20} className={searchFocused ? 'text-indigo-500' : 'text-slate-400'} />
            <input 
              type="text" 
              placeholder="Ketik NIM Mahasiswa..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              value={nim}
              onChange={(e) => setNim(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGetData()}
              className="bg-transparent border-none focus:ring-0 text-sm w-full font-bold ml-3"
            />
            {nim && (
              <button 
                onClick={handleGetData}
                disabled={isLoading}
                className="bg-indigo-600 text-white text-xs font-black px-4 py-2 rounded-xl hover:bg-indigo-700 transition shadow-md active:scale-95"
              >
                {isLoading ? "..." : "CARI"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-sm font-black text-slate-800">{username}</span>
              <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-widest">Dosen Verifikator</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border-2 border-white shadow-md flex items-center justify-center font-black text-indigo-600 text-lg">
              {username?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Dynamic Canvas */}
        <div className="flex-1 p-10 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-8">
            
            {activeTab === 'dashboard' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 opacity-10"><BookOpen size={240} /></div>
                    <h2 className="text-3xl font-black mb-4">Mulai Verifikasi Hari Ini</h2>
                    <p className="text-indigo-100 text-lg mb-8 max-w-md leading-relaxed">Penyetoran hafalan adalah bagian krusial dari evaluasi akademik mahasiswa. Mari pastikan kualitas hafalan tetap terjaga.</p>
                    <button 
                       onClick={() => document.querySelector('input')?.focus()}
                       className="bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-indigo-50 transition-all shadow-xl active:scale-95"
                    >
                      Masukkan NIM <ArrowRight size={20} />
                    </button>
                  </div>
                  
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

            {activeTab === 'input' && data && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Profile Card */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-8 group">
                  <div className="relative">
                    <div className="w-24 h-24 bg-gradient-to-tr from-indigo-50 to-indigo-100 rounded-[2rem] flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform duration-300">
                        <User size={48} strokeWidth={1.5} />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2 rounded-xl shadow-lg border-4 border-white">
                        <Check size={16} strokeWidth={3} />
                    </div>
                  </div>
                  
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

                  <button 
                    onClick={handleSimpan}
                    disabled={selectedSurah.length === 0 || isLoading}
                    className="w-full md:w-auto bg-emerald-600 text-white px-10 py-5 rounded-2xl font-black text-lg hover:bg-emerald-700 disabled:opacity-30 disabled:bg-slate-200 shadow-2xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    {isLoading ? <Clock className="animate-spin" /> : <CheckCircle2 />}
                    SIMPAN ({selectedSurah.length})
                  </button>
                </div>

                {/* Table/List Card */}
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
                    {data.setoran.detail.map((item) => (
                      <div 
                        key={item.id} 
                        className={`flex items-center justify-between px-10 py-6 transition-all duration-200 ${
                            item.sudah_setor 
                            ? 'bg-slate-50/50 opacity-80' 
                            : selectedSurah.some(s => s.id_komponen_setoran === item.id)
                                ? 'bg-indigo-50/30'
                                : 'hover:bg-slate-50/30'
                        }`}
                      >
                        <div className="flex items-center gap-6">
                          <div 
                            onClick={() => !item.sudah_setor && handleSelectSurah(item)}
                            className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer ${
                              item.sudah_setor 
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' 
                                : selectedSurah.some(s => s.id_komponen_setoran === item.id)
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110'
                                    : 'border-slate-200 bg-white hover:border-indigo-400'
                            }`}
                          >
                            {(item.sudah_setor || selectedSurah.some(s => s.id_komponen_setoran === item.id)) && <Check size={18} strokeWidth={4} />}
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2">
                                <p className={`font-black text-lg ${item.sudah_setor ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                    {item.nama}
                                </p>
                                {item.sudah_setor && <span className="bg-emerald-100 text-emerald-600 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">VERIFIED</span>}
                            </div>
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-0.5">{item.label}</p>
                          </div>
                        </div>

                        {item.sudah_setor && (
                          <div className="flex items-center gap-8">
                            <div className="text-right">
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 justify-end">
                                <Calendar size={14} className="text-slate-300" />
                                {item.info_setoran.tgl_setoran}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 mt-1 justify-end uppercase tracking-widest">
                                <User size={12} /> {item.info_setoran.dosen_yang_mengesahkan?.nama}
                              </div>
                            </div>
                            <button 
                                onClick={() => handleDelete(item)} 
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
                  
                  <div className="p-10 bg-slate-50/50 flex justify-center border-t border-slate-50">
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ujung Halaman • Data Sinkron</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <h2 className="text-3xl font-black text-slate-900">Mahasiswa Bimbingan</h2>
                      <p className="text-slate-400 mt-2 font-medium">Dosen Pembimbing: <span className="text-indigo-600 font-black">{dosenInfo.nama}</span></p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={fetchMahasiswaBimbingan}
                        disabled={loadingBimbingan}
                        className="bg-white text-indigo-600 border border-indigo-200 px-4 py-3 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        <Clock className={loadingBimbingan ? 'animate-spin' : ''} size={16} />
                        Refresh
                      </button>
                      <div className="bg-indigo-50 text-indigo-600 px-6 py-3 rounded-2xl font-black text-sm">
                        Total: {mahasiswaBimbingan.length} Mahasiswa
                      </div>
                    </div>
                  </div>

                  {loadingBimbingan && (
                    <div className="flex items-center justify-center py-20">
                      <Clock className="animate-spin text-indigo-500" size={32} />
                      <span className="ml-3 text-slate-500 font-bold">Memuat data mahasiswa...</span>
                    </div>
                  )}

                  {!loadingBimbingan && mahasiswaBimbingan.length === 0 && (
                    <div className="text-center py-20">
                      <Users size={48} className="text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold">Tidak ada data mahasiswa bimbingan</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {mahasiswaBimbingan.map((mhs, idx) => {
                      // Handle berbagai format field dari API
                      const nimMhs = mhs.nim || mhs.npm || mhs.nim_mhs || mhs.id || idx + 1;
                      const namaMhs = mhs.nama || mhs.nm_mhs || mhs.name || mhs.nama_mahasiswa || "Mahasiswa";
                      const semesterMhs = mhs.semester || mhs.smt || mhs.sem || "-";
                      const progresMhs = mhs.progres || mhs.jumlah_setoran || mhs.total_setoran || mhs.setoran_count || 0;
                      const totalMhs = mhs.total || mhs.total_target || mhs.target || 30;
                      const percent = totalMhs > 0 ? Math.round((progresMhs / totalMhs) * 100) : 0;
                      
                      return (
                        <div
                          key={nimMhs}
                          className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 transition-all duration-300 group cursor-pointer"
                          onClick={() => { setNim(String(nimMhs)); handleGetData(); }}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                              {namaMhs.charAt(0)}
                            </div>
                            <span className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest bg-slate-100 text-slate-500">
                              {percent}%
                            </span>
                          </div>

                          <h3 className="font-black text-lg text-slate-900 mb-1">{namaMhs}</h3>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">NIM {nimMhs} • Semester {semesterMhs}</p>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-slate-500">Progres Hafalan</span>
                              <span className="text-indigo-600">{progresMhs}/{totalMhs}</span>
                            </div>
                            <div className="h-3 bg-white rounded-full overflow-hidden border border-slate-100">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${percent >= 80 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>

                          <button className="w-full mt-6 bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all text-sm flex items-center justify-center gap-2 group-hover:shadow-md">
                            Lihat Detail <ArrowRight size={16} />
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

// --- Custom Components ---

const SidebarLink = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-4 w-full p-4 rounded-2xl transition-all duration-300 font-black text-sm group ${
      active 
        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 translate-x-1' 
        : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
    }`}
  >
    <span className={`${active ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>{icon}</span>
    <span className="hidden lg:block">{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full hidden lg:block"></div>}
  </button>
);

export default App;
