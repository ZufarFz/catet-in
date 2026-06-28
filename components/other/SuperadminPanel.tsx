import React, { useState, useEffect } from 'react';
import { 
  Users, Trash2, Check, X, 
  Globe, UserCheck, RefreshCw, LogOut, Edit, ShieldCheck, 
  Lock, Database, Mail, Plus
} from 'lucide-react';
import { db, centralClient } from '../../supabase';
import SetupGuide from './SetupGuide';

interface SuperadminPanelProps {
  onLogout: () => void;
  notify: (msg: string, type: 'success' | 'error') => void;
  confirm: (title: string, msg: string, confirmText: string, onConfirm: () => void, isDanger?: boolean) => void;
}

export const SuperadminPanel: React.FC<SuperadminPanelProps> = ({ onLogout, notify, confirm }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'instansi' | 'setup'>('pending');
  
  // Edit State
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // Instansi CRUD States
  const [editingInstansi, setEditingInstansi] = useState<any | null>(null);
  const [isCreatingInstansi, setIsCreatingInstansi] = useState(false);
  const [newInstansiName, setNewInstansiName] = useState('');
  const [newSupabaseUrl, setNewSupabaseUrl] = useState('');
  const [newSupabaseAnonKey, setNewSupabaseAnonKey] = useState('');
  const [newBackupUrl, setNewBackupUrl] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState('Viewer');
  const [editOriginalRole, setEditOriginalRole] = useState('');
  const [editWebAccess, setEditWebAccess] = useState({ bendahara: true, absensi: true });
  const [editFirebaseConfig, setEditFirebaseConfig] = useState('');
  const [editStatus, setEditStatus] = useState('Active');

  const activeClient = centralClient || db;

  const fetchPortalData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all configurations in instansi from central Supabase DB
      const { data: configList, error: configErr } = await activeClient.from('instansi').select('*');
      if (configErr) throw configErr;

      const mappedConfigs = (configList || []).map(d => ({
        id: d.id,
        instansiName: d.instansi_name || d.id,
        ...d
      }));
      setConfigs(mappedConfigs);

      // 2. Fetch all users from central Supabase DB
      const { data: usersList, error: usersErr } = await activeClient.from('users').select('*');
      if (usersErr) throw usersErr;

      setUsers(usersList || []);
    } catch (err: any) {
      console.error("Error fetching portal data from Supabase:", err);
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
    setEditStatus(user.status || 'Active');
    
    // Parse web_access
    const accessStr = String(user.web_access || 'bendahara,absensi').toLowerCase();
    setEditWebAccess({
      bendahara: accessStr.includes('bendahara'),
      absensi: accessStr.includes('absensi')
    });

    const instansiId = user.instansi;
    if (instansiId) {
      setEditFirebaseConfig(instansiId);
    } else {
      setEditFirebaseConfig(configs[0]?.id || '');
    }
  };

  const handleCloseEdit = () => {
    setEditingUser(null);
    setEditStatus('Active');
  };

  // Instansi crud functions
  const handleCreateInstansi = async () => {
    if (!newInstansiName.trim()) {
      notify("Nama Instansi tidak boleh kosong", "error");
      return;
    }
    if (!newSupabaseUrl.trim() || !newSupabaseAnonKey.trim()) {
      notify("Supabase URL dan Anon Key harus diisi", "error");
      return;
    }

    try {
      setIsLoading(true);
      
      const cleanSlug = newInstansiName.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      const baseId = cleanSlug || 'inst';

      let finalId = `${baseId}-${Math.random().toString(36).substring(2, 6)}`;
      while (configs.some(c => c.id === finalId)) {
        finalId = `${baseId}-${Math.random().toString(36).substring(2, 6)}`;
      }

      const payload = {
        id: finalId,
        instansi_name: newInstansiName.trim(),
        supabase_url: newSupabaseUrl.trim(),
        supabase_anon_key: newSupabaseAnonKey.trim(),
        appscriptbackuptreasurerweb: newBackupUrl.trim() || null
      };

      const { error } = await activeClient.from('instansi').insert([payload]);
      if (error) throw error;

      notify("Instansi berhasil ditambahkan dengan ID: " + finalId, "success");
      setIsCreatingInstansi(false);
      setNewInstansiName('');
      setNewSupabaseUrl('');
      setNewSupabaseAnonKey('');
      setNewBackupUrl('');
      await fetchPortalData();
    } catch (err: any) {
      console.error("Gagal menambahkan instansi:", err);
      notify("Gagal menambahkan instansi: " + (err.message || String(err)), "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateInstansi = async () => {
    if (!editingInstansi) return;
    if (!editingInstansi.instansi_name?.trim()) {
      notify("Nama Instansi tidak boleh kosong", "error");
      return;
    }
    if (!editingInstansi.supabase_url?.trim() || !editingInstansi.supabase_anon_key?.trim()) {
      notify("Supabase URL dan Anon Key harus diisi", "error");
      return;
    }

    try {
      setIsLoading(true);
      const payload = {
        instansi_name: editingInstansi.instansi_name.trim(),
        supabase_url: editingInstansi.supabase_url.trim(),
        supabase_anon_key: editingInstansi.supabase_anon_key.trim(),
        appscriptbackuptreasurerweb: editingInstansi.appscriptbackuptreasurerweb?.trim() || null
      };

      const { error } = await activeClient.from('instansi').update(payload).eq('id', editingInstansi.id);
      if (error) throw error;

      notify("Instansi berhasil diperbarui", "success");
      setEditingInstansi(null);
      await fetchPortalData();
    } catch (err: any) {
      console.error("Gagal memperbarui instansi:", err);
      notify("Gagal memperbarui instansi: " + (err.message || String(err)), "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteInstansi = (inst: any) => {
    confirm(
      "Hapus Instansi?",
      `Apakah Anda yakin ingin menghapus instansi ${inst.instansi_name} (${inst.id})? Pengguna yang terhubung dengan instansi ini tidak akan bisa login ke database ini lagi.`,
      "Ya, Hapus",
      async () => {
        try {
          setIsLoading(true);
          const { error } = await activeClient.from('instansi').delete().eq('id', inst.id);
          if (error) throw error;
          notify("Instansi berhasil dihapus", "success");
          await fetchPortalData();
        } catch (err: any) {
          console.error("Gagal menghapus instansi:", err);
          notify("Gagal menghapus instansi: " + (err.message || String(err)), "error");
        } finally {
          setIsLoading(false);
        }
      },
      true
    );
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

      const updatedData = {
        full_name: editFullName.trim(),
        role: editRole,
        original_role: editOriginalRole.trim() || editRole,
        web_access: webAccessStr,
        instansi: editFirebaseConfig || null,
        status: editStatus
      };

      // 1. Update user inside Central DB
      const { error: centralErr } = await activeClient.from('users').update(updatedData).eq('id', editingUser.id);
      if (centralErr) throw centralErr;

      // Clean up the user from the previously assigned operational/tenant database if it changed
      const prevInstansiId = editingUser.instansi;
      if (prevInstansiId && prevInstansiId !== editFirebaseConfig) {
        try {
          const prevConfig = configs.find(c => c.id === prevInstansiId);
          if (prevConfig && prevConfig.supabase_url && prevConfig.supabase_anon_key) {
            const { createClient } = await import('@supabase/supabase-js');
            const targetClient = createClient(prevConfig.supabase_url, prevConfig.supabase_anon_key);
            await targetClient.from('users').delete().eq('id', editingUser.id);
            console.log(`Cleaned up user from previous operational DB: ${prevInstansiId}`);
          }
        } catch (prevDelErr) {
          console.warn("Gagal menghapus user dari instansi lama:", prevDelErr);
        }
      }

      // 2. Sync updated user credentials to target operational/tenant database
      if (selectedConfig && selectedConfig.supabase_url && selectedConfig.supabase_anon_key) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const targetClient = createClient(selectedConfig.supabase_url, selectedConfig.supabase_anon_key);
          await targetClient.from('users').upsert([{
            id: editingUser.id,
            email: editingUser.email || '',
            full_name: editFullName.trim(),
            role: editRole,
            original_role: editOriginalRole.trim() || editRole,
            web_access: webAccessStr,
            instansi: editFirebaseConfig || null,
            status: editStatus,
            created_at: editingUser.created_at || new Date().toISOString()
          }]);
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
          const defaultConfId = configs[0]?.id || '';
          const rawTargetInstansiId = user.instansi || defaultConfId;
          const instansiIdStr = typeof rawTargetInstansiId === 'string' ? rawTargetInstansiId : defaultConfId;

          const updatedData = {
            role: 'Viewer',
            original_role: user.original_role || 'Viewer',
            status: 'Active',
            web_access: 'bendahara,absensi',
            instansi: instansiIdStr
          };

          const { error: centralErr } = await activeClient.from('users').update(updatedData).eq('id', user.id);
          if (centralErr) throw centralErr;

          // Sync approved user to the designated operational/tenant database
          const selectedConfig = configs.find(c => c.id === instansiIdStr);
          if (selectedConfig && selectedConfig.supabase_url && selectedConfig.supabase_anon_key) {
            try {
              const { createClient } = await import('@supabase/supabase-js');
              const targetClient = createClient(selectedConfig.supabase_url, selectedConfig.supabase_anon_key);
              await targetClient.from('users').upsert([{
                id: user.id,
                email: user.email || '',
                full_name: user.full_name || '',
                role: 'Viewer',
                original_role: user.original_role || 'Viewer',
                web_access: 'bendahara,absensi',
                instansi: instansiIdStr,
                status: 'Active',
                created_at: user.created_at || new Date().toISOString()
              }]);
              console.log(`Successfully synced approved user to operational tenant DB: ${instansiIdStr}`);
            } catch (syncErr) {
              console.error("Gagal sinkronisasi user aktif ke database operasional instansi:", syncErr);
            }
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

  const handleToggleUserStatus = async (user: any) => {
    const isCurrentlyActive = String(user.status || 'Active').toLowerCase() === 'active';
    const newStatus = isCurrentlyActive ? 'Disabled' : 'Active';
    const actionLabel = isCurrentlyActive ? 'menonaktifkan sementara' : 'mengaktifkan kembali';
    const confirmBtn = isCurrentlyActive ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan';

    confirm(
      isCurrentlyActive ? "Nonaktifkan Akun?" : "Aktifkan Akun?",
      `Apakah Anda yakin ingin ${actionLabel} akun ${user.full_name || user.email}?`,
      confirmBtn,
      async () => {
        try {
          setIsLoading(true);

          // 1. Update status in Central DB
          const { error: centralErr } = await activeClient
            .from('users')
            .update({ status: newStatus })
            .eq('id', user.id);
          if (centralErr) throw centralErr;

          // 2. Sync to operational database if configured
          const targetInstansiId = user.instansi;
          if (targetInstansiId) {
            const selectedConfig = configs.find(c => c.id === targetInstansiId);
            if (selectedConfig && selectedConfig.supabase_url && selectedConfig.supabase_anon_key) {
              try {
                const { createClient } = await import('@supabase/supabase-js');
                const targetClient = createClient(selectedConfig.supabase_url, selectedConfig.supabase_anon_key);
                await targetClient.from('users').update({ status: newStatus }).eq('id', user.id);
                console.log(`Synced dynamic power-toggle status: ${newStatus} to operational DB`);
              } catch (syncErr) {
                console.warn("Gagal sinkron status dinonaktifkan ke database operasional instansi:", syncErr);
              }
            }
          }

          notify(`Akun berhasil ${isCurrentlyActive ? 'dinonaktifkan' : 'diaktifkan'}`, "success");
          fetchPortalData();
        } catch (err: any) {
          console.error("Gagal mengubah status akun:", err);
          notify("Gagal mengubah status: " + (err.message || String(err)), "error");
        } finally {
          setIsLoading(false);
        }
      },
      isCurrentlyActive // passes isDanger if the action is to disable
    );
  };

  const handleDeleteUser = async (user: any) => {
    confirm(
      "Hapus/Tolak Akun?",
      `Apakah Anda yakin ingin menolak atau menghapus akun ${user.full_name || user.email}? Tindakan ini tidak dapat dibatalkan.`,
      "Ya, Hapus",
      async () => {
        try {
          const { error: centralErr } = await activeClient.from('users').delete().eq('id', user.id);
          if (centralErr) throw centralErr;

          // Dual-delete user from operational database if they were linked to one
          const targetInstansiId = user.instansi;
          if (targetInstansiId) {
            const selectedConfig = configs.find(c => c.id === targetInstansiId);
            if (selectedConfig && selectedConfig.supabase_url && selectedConfig.supabase_anon_key) {
              try {
                const { createClient } = await import('@supabase/supabase-js');
                const targetClient = createClient(selectedConfig.supabase_url, selectedConfig.supabase_anon_key);
                await targetClient.from('users').delete().eq('id', user.id);
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
              onClick={() => setActiveTab('instansi')}
              className={`w-full flex items-center justify-start space-x-2.5 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'instansi' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <Globe size={14} className="text-blue-500" />
              <span>Kelola Instansi ({configs.length})</span>
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
              {activeTab === 'pending' ? 'Daftar Pengajuan Akun Baru' : activeTab === 'active' ? 'Daftar Pengguna Aktif' : activeTab === 'instansi' ? 'Kelola Database Instansi Cabang' : 'Aturan Keamanan & Setup Firebase (Multi-DB)'}
            </h3>
            {activeTab === 'instansi' && (
              <button
                onClick={() => setIsCreatingInstansi(true)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-[9px] rounded-xl uppercase tracking-widest transition-all cursor-pointer border-0"
              >
                <Plus size={11} strokeWidth={3} />
                <span>Tambah Instansi</span>
              </button>
            )}
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
                    className={`p-4 border rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${
                      String(user.status || 'Active').toLowerCase() === 'active'
                        ? 'bg-white border-slate-200 hover:border-slate-300'
                        : 'bg-rose-50/20 border-rose-200 hover:border-rose-300'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[7.5px] font-black uppercase tracking-wider font-mono">{user.role || 'Viewer'}</span>
                        {String(user.status || 'Active').toLowerCase() !== 'active' && (
                          <span className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[7.5px] font-black uppercase tracking-wider font-mono animate-pulse">NONAKTIF</span>
                        )}
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
                        onClick={() => handleToggleUserStatus(user)}
                        title={String(user.status || 'Active').toLowerCase() === 'active' ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                        className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1 px-3 py-2 font-black text-[9px] rounded-xl uppercase tracking-widest transition-all cursor-pointer border ${
                          String(user.status || 'Active').toLowerCase() === 'active'
                            ? 'bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white'
                            : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-500 hover:text-white'
                        }`}
                      >
                        {String(user.status || 'Active').toLowerCase() === 'active' ? 'Matikan' : 'Aktifkan'}
                      </button>
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
            ) : activeTab === 'instansi' ? (
              configs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-200/50 text-slate-400">
                    <Globe size={28} />
                  </div>
                  <h5 className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Belum ada instansi terdaftar</h5>
                  <button 
                    onClick={() => setIsCreatingInstansi(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] rounded-xl uppercase tracking-widest cursor-pointer border-0"
                  >
                    Tambah Instansi Baru
                  </button>
                </div>
              ) : (
                configs.map(inst => (
                  <div 
                    key={inst.id} 
                    className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded text-[7.5px] font-black uppercase tracking-wider font-mono">{inst.id}</span>
                        <h4 className="text-xs font-black text-slate-800 truncate uppercase mt-0.5">{inst.instansi_name}</h4>
                      </div>
                      
                      <div className="space-y-1 text-[8.5px] font-bold text-slate-500 tracking-tight">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-black text-slate-400 uppercase w-20 shrink-0">Supabase URL:</span>
                          <span className="text-slate-600 truncate font-mono bg-slate-50 px-1 py-0.5 rounded">{inst.supabase_url}</span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-black text-slate-400 uppercase w-20 shrink-0">Anon Key:</span>
                          <span className="text-slate-600 truncate font-mono bg-slate-50 px-1 py-0.5 rounded" title={inst.supabase_anon_key}>
                            {inst.supabase_anon_key.substring(0, 30)}...
                          </span>
                        </div>
                        {inst.appscriptbackuptreasurerweb ? (
                          <div className="flex items-center gap-1.5 truncate text-emerald-600">
                            <span className="font-black text-slate-400 uppercase w-20 shrink-0">Backup URL:</span>
                            <span className="truncate font-mono">{inst.appscriptbackuptreasurerweb}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span className="font-black text-slate-400 uppercase w-20 shrink-0">Backup URL:</span>
                            <span>BELUM SET (BACKUP OFF)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 w-full sm:w-auto self-end sm:self-center shrink-0">
                      <button 
                        onClick={() => setEditingInstansi({ ...inst })}
                        className="flex-1 sm:flex-initial flex items-center justify-center space-x-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[9px] rounded-xl uppercase tracking-widest transition-all cursor-pointer border border-slate-200"
                      >
                        <Edit size={12} />
                        <span>Edit</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteInstansi(inst)}
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

              {/* Status Akun Select */}
              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Status Akun</label>
                <select 
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none uppercase transition-all"
                >
                  <option value="Active">AKTIF / DISETUJUI</option>
                  <option value="Disabled">NONAKTIF (DISABLED)</option>
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

      {/* ADD INSTANSI MODAL */}
      {isCreatingInstansi && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-dialog-bounce my-auto">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Globe size={16} className="text-blue-500" />
                <h3 className="text-xs font-black uppercase tracking-widest">Tambah Instansi</h3>
              </div>
              <button onClick={() => setIsCreatingInstansi(false)} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white cursor-pointer border-0">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block font-mono">ID Instansi (Dibuat Otomatis)</label>
                <div className="bg-slate-50 border border-slate-100 px-3.5 py-2.5 rounded-xl text-xs font-mono font-black text-slate-500">
                  {newInstansiName.trim() ? (
                    `${newInstansiName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'inst'}-[xxxx]`
                  ) : (
                    "[TULIS NAMA INSTANSI DI BAWAH]"
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Nama Instansi</label>
                <input 
                  type="text" 
                  value={newInstansiName}
                  onChange={(e) => setNewInstansiName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none transition-all uppercase"
                  placeholder="misal: CABANG MALANG"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Supabase Project URL</label>
                <input 
                  type="text" 
                  value={newSupabaseUrl}
                  onChange={(e) => setNewSupabaseUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none transition-all"
                  placeholder="https://xxxx.supabase.co"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Supabase Anon Public Key</label>
                <textarea 
                  value={newSupabaseAnonKey}
                  onChange={(e) => setNewSupabaseAnonKey(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white px-3.5 py-2 rounded-xl text-[10px] font-mono outline-none transition-all break-all"
                  placeholder="eyJhbGciOi..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block font-bold">Google AppScript Backup URL (Opsional)</label>
                <input 
                  type="text" 
                  value={newBackupUrl}
                  onChange={(e) => setNewBackupUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none transition-all"
                  placeholder="https://script.google.com/macros/s/..."
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setIsCreatingInstansi(false)}
                  className="flex-1 py-3 bg-slate-100 font-black text-[10px] text-slate-500 rounded-xl uppercase tracking-widest hover:bg-slate-200 cursor-pointer border-0"
                >
                  Batal
                </button>
                <button 
                  onClick={handleCreateInstansi}
                  className="flex-1 py-3 bg-blue-600 text-white font-black text-[10px] rounded-xl uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 cursor-pointer border-0"
                >
                  Tambah
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT INSTANSI MODAL */}
      {editingInstansi && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-dialog-bounce my-auto">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Edit size={16} className="text-blue-500" />
                <h3 className="text-xs font-black uppercase tracking-widest">Edit Instansi</h3>
              </div>
              <button onClick={() => setEditingInstansi(null)} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white cursor-pointer border-0">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block block font-mono">ID Instansi (Tidak Dapat Diubah)</label>
                <div className="bg-slate-50 border border-slate-100 px-3.5 py-2.5 rounded-xl text-xs font-mono font-black text-slate-500">
                  {editingInstansi.id}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Nama Instansi</label>
                <input 
                  type="text" 
                  value={editingInstansi.instansi_name || ''}
                  onChange={(e) => setEditingInstansi({ ...editingInstansi, instansi_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none transition-all uppercase"
                  placeholder="misal: CABANG MALANG"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block block">Supabase Project URL</label>
                <input 
                  type="text" 
                  value={editingInstansi.supabase_url || ''}
                  onChange={(e) => setEditingInstansi({ ...editingInstansi, supabase_url: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none transition-all"
                  placeholder="https://xxxx.supabase.co"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block block">Supabase Anon Public Key</label>
                <textarea 
                  value={editingInstansi.supabase_anon_key || ''}
                  onChange={(e) => setEditingInstansi({ ...editingInstansi, supabase_anon_key: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white px-3.5 py-2 rounded-xl text-[10px] font-mono outline-none transition-all break-all"
                  placeholder="eyJhbGciOi..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block block font-bold">Google AppScript Backup URL (Opsional)</label>
                <input 
                  type="text" 
                  value={editingInstansi.appscriptbackuptreasurerweb || ''}
                  onChange={(e) => setEditingInstansi({ ...editingInstansi, appscriptbackuptreasurerweb: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none transition-all"
                  placeholder="https://script.google.com/macros/s/..."
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setEditingInstansi(null)}
                  className="flex-1 py-3 bg-slate-100 font-black text-[10px] text-slate-500 rounded-xl uppercase tracking-widest hover:bg-slate-200 cursor-pointer border-0"
                >
                  Batal
                </button>
                <button 
                  onClick={handleUpdateInstansi}
                  className="flex-1 py-3 bg-blue-600 text-white font-black text-[10px] rounded-xl uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 cursor-pointer border-0"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
