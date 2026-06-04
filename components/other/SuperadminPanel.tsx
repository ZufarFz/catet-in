import React, { useState, useEffect } from 'react';
import { 
  Users, Trash2, Check, X, 
  Globe, UserCheck, RefreshCw, LogOut, Edit, ShieldCheck, 
  Lock, Database, Mail
} from 'lucide-react';
import { centralDb, getFirestoreForConfig } from '../../firebase';
import SetupGuide from './SetupGuide';
import { 
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc
} from 'firebase/firestore';

interface SuperadminPanelProps {
  onLogout: () => void;
  notify: (msg: string, type: 'success' | 'error') => void;
  confirm: (title: string, msg: string, confirmText: string, onConfirm: () => void, isDanger?: boolean) => void;
}

export const SuperadminPanel: React.FC<SuperadminPanelProps> = ({ onLogout, notify, confirm }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'setup'>('pending');
  
  // Edit State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState('Viewer');
  const [editOriginalRole, setEditOriginalRole] = useState('');
  const [editWebAccess, setEditWebAccess] = useState({ bendahara: true, absensi: true });
  const [editFirebaseConfig, setEditFirebaseConfig] = useState('');

  const fetchPortalData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all configurations in instansi (formerly firebase_config)
      const configSnap = await getDocs(collection(centralDb, 'instansi'));
      const configList: any[] = [];
      configSnap.forEach(d => {
        configList.push({ id: d.id, ...d.data() });
      });
      setConfigs(configList);

      // 2. Fetch all users from centralDb
      const usersSnap = await getDocs(collection(centralDb, 'users'));
      const usersList: any[] = [];
      usersSnap.forEach(d => {
        usersList.push({ id: d.id, ...d.data() });
      });
      setUsers(usersList);
    } catch (err: any) {
      console.error("Error fetching portal data:", err);
      notify("Gagal memuat data portal: " + (err.message || String(err)), "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPortalData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setEditFullName(user.full_name || user.username || '');
    setEditRole(user.role === 'Pending' ? 'Viewer' : (user.role || 'Viewer'));
    setEditOriginalRole(user.original_role || '');
    
    // Parse web_access
    const accessStr = String(user.web_access || 'bendahara,absensi').toLowerCase();
    setEditWebAccess({
      bendahara: accessStr.includes('bendahara'),
      absensi: accessStr.includes('absensi')
    });

    // Default to matching config or first available
    const instansiId = user.instansi || user.firebase_config;
    if (instansiId) {
      if (typeof instansiId === 'string') {
        setEditFirebaseConfig(instansiId);
      } else if (typeof instansiId === 'object') {
        setEditFirebaseConfig(instansiId.projectId || '');
      }
    } else {
      setEditFirebaseConfig(configs[0]?.id || '');
    }
  };

  const handleCloseEdit = () => {
    setEditingUser(null);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    if (!editFullName.trim()) {
      notify("Nama Lengkap tidak boleh kosong", "error");
      return;
    }

    try {
      const selectedConfig = configs.find(c => c.id === editFirebaseConfig);

      const webAccessArray: string[] = [];
      if (editWebAccess.bendahara) webAccessArray.push('bendahara');
      if (editWebAccess.absensi) webAccessArray.push('absensi');
      const webAccessStr = webAccessArray.join(',');

      if (webAccessArray.length === 0) {
        notify("Pilih minimal satu aplikasi web yang ingin diakses", "error");
        return;
      }

      const userDocRef = doc(centralDb, 'users', editingUser.id);
      
      const updatedData = {
        full_name: editFullName.trim(),
        role: editRole,
        original_role: editOriginalRole.trim() || editRole,
        web_access: webAccessStr,
        instansi: editFirebaseConfig || null,
        status: 'Active' // clear pending status
      };

      await updateDoc(userDocRef, updatedData);

      // Clean up the user from the previously assigned operational/tenant database if it changed
      const prevInstansiId = editingUser.instansi || editingUser.firebase_config;
      if (prevInstansiId && prevInstansiId !== editFirebaseConfig) {
        try {
          const prevConfig = configs.find(c => c.id === prevInstansiId);
          if (prevConfig) {
            try {
              const { getAuthForConfig } = await import('../../firebase');
              const prevAuth = getAuthForConfig(prevConfig);
              const { signInWithEmailAndPassword } = await import('firebase/auth');
              await signInWithEmailAndPassword(prevAuth, 'superadmin@catetin.com', 'superadmin354');
            } catch (authErr) {
              console.warn("Prev dynamic DB auth login skipped:", authErr);
            }

            const prevDb = getFirestoreForConfig(prevConfig);
            await deleteDoc(doc(prevDb, 'users', editingUser.id));
            console.log(`Cleaned up user from previous operational DB: ${prevInstansiId}`);
          }
        } catch (prevDelErr) {
          console.warn("Gagal menghapus user dari instansi lama:", prevDelErr);
        }
      }

      // Sync updated user credentials to target operational/tenant database
      if (selectedConfig) {
        try {
          try {
            const { getAuthForConfig } = await import('../../firebase');
            const targetAuth = getAuthForConfig(selectedConfig);
            const { signInWithEmailAndPassword } = await import('firebase/auth');
            await signInWithEmailAndPassword(targetAuth, 'superadmin@catetin.com', 'superadmin354');
            console.log("Superadmin silent sign-in to tenant Auth successful");
          } catch (superSignErr) {
            console.warn("Superadmin silent sign-in to tenant Auth failed:", superSignErr);
          }

          const targetDb = getFirestoreForConfig(selectedConfig);
          const targetUserDocRef = doc(targetDb, 'users', editingUser.id);
          await setDoc(targetUserDocRef, {
            email: editingUser.email || '',
            full_name: editFullName.trim(),
            role: editRole,
            original_role: editOriginalRole.trim() || editRole,
            web_access: webAccessStr,
            instansi: editFirebaseConfig || null,
            status: 'Active',
            created_at: editingUser.created_at || new Date().toISOString()
          }, { merge: true });
          console.log(`Successfully synced user edit to operational tenant DB: ${editFirebaseConfig}`);
        } catch (syncErr) {
          console.error("Gagal sinkronisasi data user ke database instansi operasional:", syncErr);
        }
      }
      
      notify("Akun berhasil diperbarui & disinkronisasikan", "success");
      setEditingUser(null);
      fetchPortalData();
    } catch (err: any) {
      console.error("Gagal memperbarui akun:", err);
      notify("Gagal memperbarui akun: " + (err.message || String(err)), "error");
    }
  };

  const handleApproveQuick = async (user: any) => {
    confirm(
      "Setujui Pengajuan?",
      `Setujui pengajuan akses dari ${user.full_name || user.email} dengan akses default (Web Bendahara & Absensi, Role: Viewer)?`,
      "Ya, Setujui",
      async () => {
        try {
          const userDocRef = doc(centralDb, 'users', user.id);
          
          // Get first firebase config as default fallback if not specified
          const defaultConfId = configs[0]?.id || '';

          const rawTargetInstansiId = user.instansi || user.firebase_config || defaultConfId;
          let instansiIdStr = '';
          if (typeof rawTargetInstansiId === 'string') {
            instansiIdStr = rawTargetInstansiId;
          } else if (rawTargetInstansiId && typeof rawTargetInstansiId === 'object') {
            instansiIdStr = rawTargetInstansiId.projectId || rawTargetInstansiId.id || defaultConfId;
          } else {
            instansiIdStr = defaultConfId;
          }

          await updateDoc(userDocRef, {
            role: 'Viewer',
            original_role: user.original_role || 'Viewer',
            status: 'Active',
            web_access: 'bendahara,absensi',
            instansi: instansiIdStr
          });

          // Sync approved user to the designated operational/tenant database
          const selectedConfig = configs.find(c => c.id === instansiIdStr);
          if (selectedConfig) {
            try {
              try {
                const { getAuthForConfig } = await import('../../firebase');
                const targetAuth = getAuthForConfig(selectedConfig);
                const { signInWithEmailAndPassword } = await import('firebase/auth');
                await signInWithEmailAndPassword(targetAuth, 'superadmin@catetin.com', 'superadmin354');
                console.log("Superadmin silent sign-in to tenant Auth successful");
              } catch (superSignErr) {
                console.warn("Superadmin silent sign-in to tenant Auth failed:", superSignErr);
              }

              const targetDb = getFirestoreForConfig(selectedConfig);
              const targetUserDocRef = doc(targetDb, 'users', user.id);
              await setDoc(targetUserDocRef, {
                email: user.email || '',
                full_name: user.full_name || '',
                role: 'Viewer',
                original_role: user.original_role || 'Viewer',
                web_access: 'bendahara,absensi',
                instansi: instansiIdStr,
                status: 'Active',
                created_at: user.created_at || new Date().toISOString()
              }, { merge: true });
              console.log(`Successfully synced approved user to operational tenant DB: ${instansiIdStr}`);
            } catch (syncErr) {
              console.error("Gagal sinkronisasi user aktif ke database operasional instansi:", syncErr);
            }
          } else {
            console.warn("Could not find matching instansi configuration to sync user data for ID:", instansiIdStr);
          }

          notify("Pengajuan akun berhasil disetujui", "success");
          fetchPortalData();
        } catch (err: any) {
          console.error("Gagal menyetujui pengajuan:", err);
          notify("Gagal menyetujui: " + (err.message || String(err)), "error");
        }
      }
    );
  };

  const handleDeleteUser = async (user: any) => {
    confirm(
      "Hapus/Tolak Akun?",
      `Apakah Anda yakin ingin menolak atau menghapus akun ${user.full_name || user.email}? Tindakan ini tidak dapat dibatalkan.`,
      "Ya, Hapus",
      async () => {
        try {
          const userDocRef = doc(centralDb, 'users', user.id);
          await deleteDoc(userDocRef);

          // Dual-delete user from operational database if they were linked to one
          const targetInstansiId = user.instansi || user.firebase_config;
          if (targetInstansiId) {
            const selectedConfig = configs.find(c => c.id === targetInstansiId);
            if (selectedConfig) {
              try {
                try {
                  const { getAuthForConfig } = await import('../../firebase');
                  const targetAuth = getAuthForConfig(selectedConfig);
                  const { signInWithEmailAndPassword } = await import('firebase/auth');
                  await signInWithEmailAndPassword(targetAuth, 'superadmin@catetin.com', 'superadmin354');
                  console.log("Superadmin silent sign-in to tenant Auth successful context deletion");
                } catch (superSignErr) {
                  console.warn("Superadmin silent sign-in to tenant Auth failed for delete operation:", superSignErr);
                }

                const targetDb = getFirestoreForConfig(selectedConfig);
                await deleteDoc(doc(targetDb, 'users', user.id));
                console.log(`Successfully deleted user from operational DB: ${targetInstansiId}`);
              } catch (delErr) {
                console.warn("Gagal menghapus user dari database operasional instansi:", delErr);
              }
            }
          }

          notify("Akun berhasil dihapus", "success");
          fetchPortalData();
        } catch (err: any) {
          console.error("Gagal menghapus akun:", err);
          notify("Gagal menghapus: " + (err.message || String(err)), "error");
        }
      },
      true // danger
    );
  };

  const pendingUsers = users.filter(u => String(u.role).toLowerCase() === 'pending' || String(u.status).toLowerCase() === 'pending');
  const activeUsers = users.filter(u => String(u.role).toLowerCase() !== 'pending' && String(u.status).toLowerCase() !== 'pending' && u.id !== 'superadmin');

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden">
      {/* HEADER BAR */}
      <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-500/20">
            <Lock size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.2em] leading-none">CATET-IN MASTER</h1>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Superadmin Control Panel</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={fetchPortalData} 
            disabled={isLoading}
            className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-all border border-slate-700/50 cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={onLogout}
            className="px-4 py-2 bg-rose-500/15 hover:bg-rose-500 hover:text-white text-rose-400 rounded-xl font-black text-[9px] uppercase tracking-widest border border-rose-500/20 transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <LogOut size={12} />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl w-full mx-auto p-4 md:p-6 gap-6">
        {/* LEFT COLUMN: NAVIGATION / STATS */}
        <div className="w-full md:w-80 flex flex-col shrink-0 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Portal Statistics</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-center">
                <span className="text-xs font-black text-rose-600 block">{pendingUsers.length}</span>
                <span className="text-[8px] font-black text-rose-500 uppercase tracking-tight block mt-0.5">Pengajuan</span>
              </div>
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center">
                <span className="text-xs font-black text-emerald-600 block">{activeUsers.length}</span>
                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tight block mt-0.5">Aktif</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Database Template</span>
              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-mono text-[8.5px] font-black rounded-md">{configs.length}</span>
            </div>
          </div>

          <div className="bg-white p-2 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col gap-1 shrink-0">
            <button 
              onClick={() => setActiveTab('pending')}
              className={`w-full flex items-center justify-start space-x-2.5 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'pending' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <Users size={14} className={pendingUsers.length > 0 ? 'text-rose-500' : ''} />
              <span>Daftar Pengajuan</span>
              {pendingUsers.length > 0 && (
                <span className="ml-auto px-1.5 py-0.5 bg-rose-500 text-white font-black text-[8px] rounded-full scale-90">
                  {pendingUsers.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('active')}
              className={`w-full flex items-center justify-start space-x-2.5 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'active' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <ShieldCheck size={14} />
              <span>Pengguna Aktif ({activeUsers.length})</span>
            </button>
            <button 
              onClick={() => setActiveTab('setup')}
              className={`w-full flex items-center justify-start space-x-2.5 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'setup' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <Database size={14} className="text-amber-500 animate-pulse" />
              <span>Setup Guide (Aturan DB)</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: CORE WORKSPACE */}
        <div className="flex-1 bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col relative min-w-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
              {activeTab === 'pending' ? 'Daftar Pengajuan Akun Baru' : activeTab === 'active' ? 'Daftar Pengguna Aktif' : 'Aturan Keamanan & Setup Firebase (Multi-DB)'}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center py-20 space-y-3">
                <RefreshCw className="animate-spin text-blue-600" size={24} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memuat database portal...</span>
              </div>
            ) : activeTab === 'pending' ? (
              pendingUsers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-200/50 text-slate-300">
                    <UserCheck size={28} />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Tidak Ada Pengajuan Pending</h5>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight max-w-xs">Seluruh registrasi user Google baru telah disetujui atau diproses.</p>
                  </div>
                </div>
              ) : (
                pendingUsers.map(user => (
                  <div 
                    key={user.id} 
                    className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 bg-rose-100/80 text-rose-600 rounded text-[7.5px] font-black uppercase tracking-wider font-mono">PENDING</span>
                        <h4 className="text-xs font-black text-slate-800 truncate uppercase mt-0.5">{user.full_name || 'Tidak ada nama'}</h4>
                        {user.original_role && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-black uppercase tracking-tight shrink-0">
                            {user.original_role}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[8.5px] font-bold text-slate-500 uppercase tracking-tight">
                        <span className="flex items-center gap-1">
                          <Mail size={11} className="text-slate-400" />
                          <span>{user.email || user.username}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Database size={11} className="text-slate-400" />
                          <span>Saran Instansi: {user.instansi || 'Default Seeder'}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Globe size={11} className="text-slate-400" />
                          <span>Aplikasi Diminta: {String(user.web_access || 'bendahara').toUpperCase()}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 w-full sm:w-auto self-end sm:self-center shrink-0">
                      <button 
                        onClick={() => handleApproveQuick(user)}
                        className="flex-1 sm:flex-initial flex items-center justify-center space-x-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] rounded-xl uppercase tracking-widest transition-all cursor-pointer border border-emerald-600/10"
                      >
                        <Check size={12} />
                        <span>Setujui</span>
                      </button>
                      <button 
                        onClick={() => handleOpenEdit(user)}
                        className="flex-1 sm:flex-initial flex items-center justify-center space-x-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 font-black text-[9px] rounded-xl uppercase tracking-widest transition-all cursor-pointer"
                      >
                        <Edit size={12} />
                        <span>Atur</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user)}
                        className="p-2 text-rose-500 bg-rose-50 border border-rose-100 hover:bg-rose-500 hover:text-white rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : activeTab === 'active' ? (
              activeUsers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-200/50 text-slate-400">
                    <Users size={28} />
                  </div>
                  <h5 className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Tidak ada akun terdaftar</h5>
                </div>
              ) : (
                activeUsers.map(user => (
                  <div 
                    key={user.id} 
                    className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[7.5px] font-black uppercase tracking-wider font-mono">{user.role || 'Viewer'}</span>
                        <h4 className="text-xs font-black text-slate-800 truncate uppercase mt-0.5">{user.full_name || 'Tidak ada nama'}</h4>
                        {user.original_role && user.original_role !== user.role && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-black uppercase tracking-tight shrink-0">
                            {user.original_role}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[8.5px] font-bold text-slate-500 uppercase tracking-tight">
                        <span className="flex items-center gap-1">
                          <Mail size={11} className="text-slate-400" />
                          <span>{user.email || user.username}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Database size={11} className="text-slate-400" />
                          <span>Database Instansi: {user.instansi || 'Central Db'}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Globe size={11} className="text-slate-400" />
                          <span>Aplikasi: {String(user.web_access || 'bendahara').toUpperCase()}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 w-full sm:w-auto self-end sm:self-center shrink-0">
                      <button 
                        onClick={() => handleOpenEdit(user)}
                        className="flex-1 sm:flex-initial flex items-center justify-center space-x-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[9px] rounded-xl uppercase tracking-widest transition-all cursor-pointer border border-slate-200"
                      >
                        <Edit size={12} />
                        <span>Edit</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user)}
                        className="p-2 text-rose-500 bg-rose-50 border border-rose-100 hover:bg-rose-500 hover:text-white rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : (
              <SetupGuide />
            )}
          </div>
        </div>
      </div>

      {/* EDIT USER ACCOUNT MODAL */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-dialog-bounce my-auto">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Edit size={16} className="text-blue-500" />
                <h3 className="text-xs font-black uppercase tracking-widest">Konfigurasi Hak Akses</h3>
              </div>
              <button onClick={handleCloseEdit} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {/* Email (Readonly) */}
              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Google Email</label>
                <div className="bg-slate-50 border border-slate-100 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-500 flex items-center space-x-2">
                  <Mail size={12} className="text-slate-400 shrink-0" />
                  <span className="truncate">{editingUser.email || editingUser.username}</span>
                </div>
              </div>

              {/* Full Name Input */}
              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none uppercase transition-all"
                  placeholder="NAMA LENGKAP PENGGUNA"
                />
              </div>

              {/* Jabatan / Posisi Input */}
              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Jabatan / Posisi Anda (Ketik Manual)</label>
                <input 
                  type="text" 
                  value={editOriginalRole}
                  onChange={(e) => setEditOriginalRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none uppercase transition-all"
                  placeholder="MISAL: BENDAHARA UMUM, KETUA CABANG"
                />
              </div>

              {/* Role Select */}
              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Tingkatan Akses (Role)</label>
                <select 
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none transition-all"
                >
                  <option value="Viewer">TIER 5 (VIEWER)</option>
                  <option value="Bendahara">TIER 4 (BENDAHARA / OPERATOR)</option>
                  <option value="Wakil">TIER 3 (WAKIL)</option>
                  <option value="Ketua">TIER 2 (KETUA)</option>
                  <option value="Admin">TIER 1 (ADMIN)</option>
                  <option value="Superadmin">SUPERADMIN (PORTAL MASTER)</option>
                </select>
              </div>

              {/* Instansi Select from firebase_config */}
              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Pilih Database Instansi</label>
                <select 
                  value={editFirebaseConfig}
                  onChange={(e) => setEditFirebaseConfig(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none uppercase transition-all"
                >
                  {configs.map(c => (
                    <option key={c.id} value={c.id}>
                      {String(c.instansiName || c.instansi || c.id).toUpperCase()}
                    </option>
                  ))}
                  <option value="">PORTAL CENTRAL (FALLBACK)</option>
                </select>
              </div>

              {/* Web Access Checklists */}
              <div className="space-y-2">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Fitur Aplikasi Yang Diaktifkan</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`p-3 rounded-2xl border flex items-center space-x-2.5 transition-all cursor-pointer ${editWebAccess.bendahara ? 'bg-blue-500/10 border-blue-400 text-blue-700 font-black' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      checked={editWebAccess.bendahara}
                      onChange={(e) => setEditWebAccess({ ...editWebAccess, bendahara: e.target.checked })}
                    />
                    <span className="text-[10px] uppercase tracking-wider">Bendahara</span>
                  </label>
                  
                  <label className={`p-3 rounded-2xl border flex items-center space-x-2.5 transition-all cursor-pointer ${editWebAccess.absensi ? 'bg-blue-500/10 border-blue-400 text-blue-700 font-black' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      checked={editWebAccess.absensi} 
                      onChange={(e) => setEditWebAccess({ ...editWebAccess, absensi: e.target.checked })}
                    />
                    <span className="text-[10px] uppercase tracking-wider">Absensi</span>
                  </label>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={handleCloseEdit}
                  className="flex-1 py-3 bg-slate-100 font-black text-[10px] text-slate-500 rounded-xl uppercase tracking-widest hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveUser}
                  className="flex-1 py-3 bg-blue-600 text-white font-black text-[10px] rounded-xl uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 cursor-pointer"
                >
                  Setujui / Simpan
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
