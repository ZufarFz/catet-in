import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'motion/react';
import { 
  Lock, User, Eye, EyeOff, Loader2, ArrowRight, XCircle, 
  RefreshCw, CheckCircle, Mail, Database, CheckSquare, Square,
  Briefcase, X, Sparkles, AlertTriangle, ChevronDown,
  ReceiptText, Fingerprint
} from 'lucide-react';
import { db, centralClient } from '../../supabase';

interface LoginProps {
  onLoginSuccess: (data: any, selectedApp?: 'bendahara' | 'absensi') => void;
  onOpenSetup?: () => void;
}

interface AccessibleAppOption {
  id: 'bendahara' | 'absensi';
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  icon: any;
  gradient: string;
  borderActive: string;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onOpenSetup }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');

  // Self-Registration States
  const [isSelfReg, setIsSelfReg] = useState(false);
  const [mobilePhase, setMobilePhase] = useState<'login' | 'expandingToRegister' | 'register' | 'expandingToLogin'>('login');

  // Motion values to dynamically sync opacities during pull / drag transitions
  const mobileY = useMotionValue(-465);
  const signUpOpacity = useTransform(mobileY, [-465, -230, 0], [0, 0.5, 1]);
  const signInOpacity = useTransform(mobileY, [-465, -230, 0], [1, 0.3, 0]);

  // Social login coming soon states
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [selectedSocialProvider, setSelectedSocialProvider] = useState('');

  // App Selection Modal States
  const [showAppChooser, setShowAppChooser] = useState(false);
  const [resolvedUserData, setResolvedUserData] = useState<any>(null);
  const [accessibleApps, setAccessibleApps] = useState<AccessibleAppOption[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<'bendahara' | 'absensi'>('bendahara');

  // Smooth mode switching helper to preserve visual layout stability
  const handleToggleMode = (isReg: boolean) => {
    setLoginError('');
    setRegisterError('');
    setIsSelfReg(isReg);

    if (isReg) {
      setMobilePhase('expandingToRegister');
      setTimeout(() => {
        setMobilePhase('register');
      }, 400);
    } else {
      setMobilePhase('expandingToLogin');
      setTimeout(() => {
        setMobilePhase('login');
      }, 400);
    }
  };

  const handleSocialClick = async (provider: 'google' | 'facebook' | 'twitter') => {
    const displayProvider = provider === 'twitter' ? 'X / Twitter' : provider.charAt(0).toUpperCase() + provider.slice(1);
    setSelectedSocialProvider(displayProvider);
    setShowSocialModal(true);
  };
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regJabatan, setRegJabatan] = useState('');
  const [regWebAccess, setRegWebAccess] = useState({ bendahara: true, absensi: true });
  const [regFirebaseConfig, setRegFirebaseConfig] = useState('');
  const [configs, setConfigs] = useState<any[]>([]);
  const [isDesktopDropdownOpen, setIsDesktopDropdownOpen] = useState(false);
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState(false);
  const [isAppDropdownOpen, setIsAppDropdownOpen] = useState(false);
  
  // Custom Flow States
  const [isRegisteredCompleted, setIsRegisteredCompleted] = useState(false);
  const [isPendingUser, setIsPendingUser] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  // Load available Instansi databases for the dropdown
  useEffect(() => {
    const loadConfigs = async () => {
      if (!db) {
        console.warn("Supabase db is not initialized yet. Please configure Supabase first.");
        return;
      }
      try {
        const { data, error: confErr } = await db.from('instansi').select('*');
        if (confErr) throw confErr;

        const list = (data || []).map(row => ({
          id: row.id,
          instansiName: row.instansi_name || row.instansi || row.id,
          ...row
        }));
        setConfigs(list);
        // Do not pre-select automatically, keep regFirebaseConfig as empty string
      } catch (err) {
        console.error("Gagal memuat list instansi dari Supabase:", err);
      }
    };
    loadConfigs();
  }, [isSelfReg]);

  const cleanBrowserCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    setLoginError('Memori sesi dibersihkan. Silakan login ulang.');
    setTimeout(() => setLoginError(''), 2000);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername.trim()) {
      setRegisterError("Username wajib diisi!");
      return;
    }
    if (!regEmail.trim()) {
      setRegisterError("Email wajib diisi!");
      return;
    }
    if (!regPassword.trim()) {
      setRegisterError("Password wajib diisi!");
      return;
    }
    if (!regFullName.trim()) {
      setRegisterError("Nama Lengkap wajib diisi!");
      return;
    }
    if (!regJabatan.trim()) {
      setRegisterError("Jabatan wajib diisi!");
      return;
    }
    if (!regFirebaseConfig) {
      setRegisterError("Silakan pilih Instansi Cabang terlebih dahulu!");
      return;
    }

    setIsLoading(true);
    setRegisterError('');

    try {
      const activeClient = centralClient || db;
      if (!activeClient) {
        throw new Error("Supabase belum dikonfigurasi.\nSilakan hubungi admin sistem atau atur database terlebih dahulu.");
      }
      const cleanRegName = regUsername.trim().toLowerCase();
      const cleanEmail = regEmail.trim().toLowerCase();

      // Check if username/email already taken in central DB
      const { data: existingUser, error: checkErr } = await activeClient
        .from('users')
        .select('*')
        .or(`username.eq.${cleanRegName},email.eq.${cleanEmail}`)
        .maybeSingle();

      if (checkErr) throw checkErr;
      if (existingUser) {
        setRegisterError("Username atau Email sudah terdaftar di sistem.");
        setIsLoading(false);
        return;
      }

      const webAccessArray: string[] = [];
      if (regWebAccess.bendahara) webAccessArray.push('bendahara');
      if (regWebAccess.absensi) webAccessArray.push('absensi');
      const webAccessStr = webAccessArray.join(',');

      if (webAccessArray.length === 0) {
        setRegisterError("Pilih minimal satu aplikasi web!");
        setIsLoading(false);
        return;
      }

      // 1. Sign up user on Central Supabase Auth
      const { data: authResult, error: authErr } = await activeClient.auth.signUp({
        email: cleanEmail,
        password: regPassword,
        options: {
          data: {
            username: cleanRegName,
            full_name: regFullName.trim(),
            original_role: regJabatan.trim(),
            instansi: regFirebaseConfig,
            web_access: webAccessStr,
          }
        }
      });

      if (authErr) throw authErr;

      const resolvedUid = authResult?.user?.id || 'user_u' + Math.random().toString(36).substring(2, 11);

      // 2. Operational DB registration is skipped in single database mode

      // 3. Insert user record inside central users table as Pending
      const newRequestUser = {
        id: resolvedUid,
        username: cleanRegName,
        email: cleanEmail,
        full_name: regFullName.trim(),
        role: 'Pending',
        original_role: regJabatan.trim(),
        status: 'Pending',
        instansi: regFirebaseConfig || null,
        web_access: webAccessStr,
        created_at: new Date().toISOString()
      };

      const { error: insertErr } = await activeClient.from('users').upsert([newRequestUser]);
      if (insertErr) throw insertErr;

      // Complete registration process
      setPendingEmail(cleanEmail);
      setIsRegisteredCompleted(true);
      setIsSelfReg(false);
    } catch (err: any) {
      console.error("Self Registration failed:", err);
      setRegisterError("Pendaftaran gagal: " + (err.message || String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');
    setIsPendingUser(false);

    const cleanUser = username.trim().toLowerCase();
    const activeClient = centralClient || db;

    try {
      if (!activeClient) {
        throw new Error("Supabase belum dikonfigurasi.\nSilakan klik tombol 'Atur Database Supabase' di bawah terlebih dahulu.");
      }
      
      // 1. Resolve username to email if necessary
      let resolvedEmail = cleanUser;
      let activeUserDoc: any = null;
      let authData: any = null;

      if (!cleanUser.includes('@')) {
        // Resolve username to email using secure RPC (to avoid exposing public select on users table)
        const { data: resolved, error: rpcErr } = await activeClient.rpc('resolve_username_to_email', {
          p_username: cleanUser
        });

        if (rpcErr) {
          console.error("RPC resolve error:", rpcErr);
        }

        if (!resolved) {
          setLoginError('Username tidak terdaftar.');
          setIsLoading(false);
          return;
        }
        resolvedEmail = resolved;
      }

      // 2. Perform authentication in the central Supabase auth schema
      const { data: signInData, error: signInErr } = await activeClient.auth.signInWithPassword({
        email: resolvedEmail,
        password: password,
      });

      if (signInErr) {
        throw new Error("Password atau email Anda salah: " + signInErr.message);
      }
      authData = signInData;

      // 3. Now that the user is authenticated, we can safely and securely load their profile from public.users!
      const { data: authenticatedUserDoc, error: userLookupErr } = await activeClient
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (userLookupErr) {
        await activeClient.auth.signOut();
        throw new Error("Gagal mengambil data akun dari server: " + userLookupErr.message);
      }

      if (!authenticatedUserDoc) {
        await activeClient.auth.signOut();
        throw new Error("Profil pengguna tidak ditemukan di database. Silakan hubungi Administrator.");
      }

      activeUserDoc = authenticatedUserDoc;

      const activeUserId = authData?.user?.id || activeUserDoc.id;
      const sessionToken = authData?.session?.access_token || 'sess_' + Math.random().toString(36).substring(2, 11);

      // 3. Handle Pending approval state
      const roleStr = String(activeUserDoc.role || '').toLowerCase();
      const statusStr = String(activeUserDoc.status || '').toLowerCase();
      if (statusStr === 'disabled' || statusStr === 'nonaktif' || statusStr === 'inactive') {
        await activeClient.auth.signOut();
        throw new Error("Akun Anda saat ini dinonaktifkan sementara oleh Administrator. Hubungi admin untuk mengaktifkan kembali.");
      }

      if (roleStr === 'pending' || statusStr === 'pending') {
        await activeClient.auth.signOut();
        setPendingEmail(resolvedEmail);
        setIsPendingUser(true);
        setIsLoading(false);
        return;
      }

      // 4. Resolve Instansi dynamic configurations
      let instansiConfigMap: any = null;
      let instansiName = 'Catet-In (Master)';
      let appscriptBackup = '';

      if (activeUserDoc.instansi && activeUserDoc.instansi !== 'Catet-In (Master)') {
        try {
          const { data: instansiDoc, error: instansiRowErr } = await activeClient
            .from('instansi')
            .select('*')
            .eq('id', activeUserDoc.instansi)
            .maybeSingle();

          if (!instansiRowErr && instansiDoc) {
            instansiName = instansiDoc.instansi_name || instansiDoc.instansi || instansiDoc.id;
            appscriptBackup = instansiDoc.appscriptbackuptreasurerweb || '';
            // We set instansiConfigMap to null in single DB mode so it doesn't spin up other clients
            instansiConfigMap = null;
          }
        } catch (instansiErr: any) {
          console.error("Gagal mengambil detail instansi:", instansiErr);
          instansiName = activeUserDoc.instansi;
        }
      }

      const serverRole = String(activeUserDoc.role || 'Viewer').trim();
      const webAccess = String(activeUserDoc.web_access || 'bendahara,absensi').toLowerCase();

      // 5. Commit sessions inside client browser LocalStorage
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('user_id', activeUserId);
      localStorage.setItem('active_session_token', sessionToken);
      localStorage.setItem('username', activeUserDoc.username || cleanUser);
      localStorage.setItem('full_name', activeUserDoc.full_name || 'User');
      localStorage.setItem('role', serverRole);
      localStorage.setItem('original_role', activeUserDoc.original_role || '');
      localStorage.setItem('instansi', instansiName);
      localStorage.setItem('instansi_id', activeUserDoc.instansi || '');
      localStorage.setItem('web_access', webAccess);

      localStorage.setItem('restricted_daerah_id', activeUserDoc.restricted_daerah_id || '');
      localStorage.setItem('restricted_desa_id', activeUserDoc.restricted_desa_id || '');
      localStorage.setItem('restricted_kelompok_id', activeUserDoc.restricted_kelompok_id || '');
      localStorage.setItem('restricted_age_category_id', activeUserDoc.restricted_age_category_id || '');
      localStorage.setItem('grouping_write_permissions', JSON.stringify(activeUserDoc.grouping_write_permissions || {}));

      localStorage.setItem('activeScriptUrl', appscriptBackup || 'native');
      localStorage.setItem('absensiMasterUrl', 'native');
      localStorage.setItem('absensiLogUrl', 'native');

      const resolvedUserDoc = {
        ...activeUserDoc,
        id: activeUserId,
        firebase_config: instansiConfigMap,
        instansi: instansiName,
        instansi_id: activeUserDoc.instansi,
        appsscript: appscriptBackup || 'native'
      };

      if (instansiConfigMap) {
        localStorage.setItem('instansi_db_config', JSON.stringify(instansiConfigMap));
      } else {
        localStorage.removeItem('instansi_db_config');
      }

      // Check if user is PortalMaster / Superadmin (direct to Portal Panel)
      if (serverRole === 'PortalMaster' || serverRole === 'Superadmin' || serverRole === 'Super Admin') {
        onLoginSuccess(resolvedUserDoc);
        return;
      }

      // 6. Calculate accessible apps list based on user privileges
      const appOptions: AccessibleAppOption[] = [];
      const hasBendahara = webAccess.includes('bendahara') || webAccess.includes('keuangan');
      const hasAbsensi = webAccess.includes('absensi') || webAccess.includes('presensi');

      if (hasBendahara) {
        appOptions.push({
          id: 'bendahara',
          title: 'Sistem Keuangan',
          subtitle: 'Catet-In Treasurer',
          description: 'Pencatatan kas, transaksi pemasukan & pengeluaran, audit log, dan laporan keuangan instansi.',
          badge: 'Modul Kas & Laporan',
          icon: ReceiptText,
          gradient: 'from-sky-600 to-blue-700',
          borderActive: 'border-sky-500 ring-2 ring-sky-400/30'
        });
      }

      if (hasAbsensi) {
        appOptions.push({
          id: 'absensi',
          title: 'Sistem Presensi',
          subtitle: 'Catet-In Attendance',
          description: 'Pencatatan kehadiran jamaah, manajemen data anggota, rekapitulasi presensi harian, dan scan NFC/RFID.',
          badge: 'Modul Presensi & Anggota',
          icon: Fingerprint,
          gradient: 'from-emerald-600 to-teal-700',
          borderActive: 'border-emerald-500 ring-2 ring-emerald-400/30'
        });
      }

      // If user only has 1 app (or none specified): Direct Login instantly without popup!
      if (appOptions.length <= 1) {
        const targetApp = appOptions[0]?.id || 'bendahara';
        onLoginSuccess(resolvedUserDoc, targetApp);
      } else {
        // If user has 2 or more apps: Show the modern Selection Modal
        setResolvedUserData(resolvedUserDoc);
        setAccessibleApps(appOptions);
        setSelectedAppId(appOptions[0].id);
        setShowAppChooser(true);
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      setLoginError(err.message || 'Gagal masuk ke sistem.');
      setIsLoading(false);
    }
  };

  const handleSelectAndProceed = (appId: 'bendahara' | 'absensi') => {
    if (!resolvedUserData) return;
    setShowAppChooser(false);
    onLoginSuccess(resolvedUserData, appId);
  };

  const resetAllFlows = () => {
    setIsSelfReg(false);
    setIsPendingUser(false);
    setIsRegisteredCompleted(false);
    setShowAppChooser(false);
    setResolvedUserData(null);
    setLoginError('');
    setRegisterError('');
  };

  // --- RENDER SCREEN: 1. PENDING APPROVAL SCREEN ---
  if (isPendingUser || isRegisteredCompleted) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-4 sm:p-6 z-[500]">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col items-center p-6 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-amber-100 p-4 rounded-3xl text-amber-600 shadow-inner border border-amber-200">
            <CheckCircle className="w-12 h-12" strokeWidth={2.5} />
          </div>

          <div className="space-y-2">
            <h1 className="text-lg font-black tracking-tight text-slate-800 uppercase">
              {isRegisteredCompleted ? 'Pendaftaran Berhasil!' : 'Pengajuan Ditinjau'}
            </h1>
            <div className="bg-slate-50 p-2 text-[10px] font-mono text-slate-500 rounded-lg inline-block border border-slate-100 uppercase">
              {pendingEmail}
            </div>
          </div>

          <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed max-w-xs px-2">
            Pendaftaran & pengajuan akses akun Anda telah dikirim dan sedang dalam proses peninjauan oleh <b className="text-blue-600">Administrator</b>. Mohon bersabar dan hubungi Administrator Anda untuk verifikasi.
          </p>

          <button
            onClick={resetAllFlows}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest py-3.5 rounded-xl transition-all cursor-pointer"
          >
            Kembali ke Beranda Login
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER SCREEN: 2. COMBINED SLIDING PORTAL (SIGN IN & REGISTER) ---
  return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-4 sm:p-6 z-[500] font-sans">
      
      {/* DESKTOP VIEW: Double Sliding Panels (from user design images) */}
      <div className="hidden md:flex w-full max-w-5xl h-[620px] relative overflow-hidden bg-white rounded-xl shadow-[0_20px_50px_rgba(8,112,184,0.12)] border border-slate-150 flex-row">
        
        {/* Forms - Left Slot: Sign In (Visible when isSelfReg is false) */}
        <motion.div 
          className="absolute left-0 top-0 w-1/2 h-full z-10 flex flex-col justify-center pl-10 pr-16 py-8 text-left select-none"
          initial={false}
          animate={{ 
            x: isSelfReg ? '30px' : '0px', 
            opacity: isSelfReg ? 0 : 1, 
            pointerEvents: isSelfReg ? 'none' : 'auto' 
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 120 }}
        >
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase leading-none">SELAMAT DATANG</h1>
            
            {/* Brand social row with sleek vector icons instead of text G, f, X */}
            <div className="flex justify-center space-x-3.5 mt-4 mb-3">
              <button 
                type="button" 
                onClick={() => handleSocialClick('google')}
                title="Google Workspace Secure Login"
                className="w-9 h-9 rounded-xl border border-slate-200/80 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-rose-500 hover:border-slate-300 transition-all cursor-pointer active:scale-95 shadow-sm bg-white"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.529-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C18.155 2.114 15.46 1 12.24 1 5.918 1 .8 6.012 .8 12.2s5.118 11.2 11.44 11.2c6.6 0 11-4.588 11-11.2 0-.756-.08-1.332-.178-1.715H12.24z"/>
                </svg>
              </button>
              <button 
                type="button" 
                onClick={() => handleSocialClick('facebook')}
                title="Facebook Secure Login"
                className="w-9 h-9 rounded-xl border border-slate-200/80 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-blue-600 hover:border-slate-300 transition-all cursor-pointer active:scale-95 shadow-sm bg-white"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>
              <button 
                type="button" 
                onClick={() => handleSocialClick('twitter')}
                title="X Workspace Secure Login"
                className="w-9 h-9 rounded-xl border border-slate-200/80 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all cursor-pointer active:scale-95 shadow-sm bg-white"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </button>
            </div>
            <p className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest mt-1">atau menggunakan akun anda</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 pr-4">
            <div className="space-y-1">
              <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Email / Username</label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Email atau Username Anda"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Masukkan password Anda"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end pr-0.5">
              <button 
                type="button" 
                onClick={() => setLoginError('Hubungi Admin Pusat/Instansi Anda untuk memulihkan kredensial masuk.')}
                className="text-[9px] font-bold text-slate-400 hover:text-slate-800 transition-colors uppercase tracking-wider"
              >
                Lupa Kata Sandi?
              </button>
            </div>

            {loginError && (
              <div className="bg-rose-50 text-rose-600 p-3 rounded-xl flex items-start space-x-2 border border-rose-100 animate-in slide-in-from-top-1 text-left">
                <XCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span className="text-[9px] font-black uppercase tracking-tight leading-normal whitespace-pre-line">{loginError}</span>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-950 hover:bg-slate-900 text-white py-3.5 rounded-full font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-slate-950/20 active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Verifikasi...</span>
                  </>
                ) : (
                  <>
                    <span>MASUK SISTEM</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              {onOpenSetup && (
                <button
                  type="button"
                  onClick={onOpenSetup}
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 text-[8.5px] font-black text-amber-500 hover:text-amber-600 transition-colors uppercase tracking-widest cursor-pointer border border-amber-200/50 rounded-lg bg-amber-50/50"
                >
                  <Database size={11} />
                  <span>Setup Guide</span>
                </button>
              )}

              <button
                type="button"
                onClick={cleanBrowserCache}
                className="w-full flex items-center justify-center space-x-1 py-1 text-[8px] font-extrabold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest cursor-pointer"
              >
                <RefreshCw size={10} />
                <span>Reset Sesi Portal</span>
              </button>
            </div>
          </form>
        </motion.div>

        {/* Forms - Right Slot: Create Account (Visible when isSelfReg is true) */}
        <motion.div 
          className="absolute left-1/2 top-0 w-1/2 h-full z-10 flex flex-col justify-center pl-16 pr-10 py-8 text-left select-none"
          initial={false}
          animate={{ 
            x: isSelfReg ? '0px' : '-30px', 
            opacity: isSelfReg ? 1 : 0, 
            pointerEvents: isSelfReg ? 'auto' : 'none' 
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 120 }}
        >
          <div className="text-center mb-4 shrink-0">
            <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase leading-none">Registrasi Akun</h1>
            
            {/* Brand social row with sleek vector icons instead of text G, f, X */}
            <div className="flex justify-center space-x-3.5 mt-4 mb-3">
              <button 
                type="button" 
                onClick={() => handleSocialClick('google')}
                title="Google Secure Integration"
                className="w-9 h-9 rounded-xl border border-slate-200/80 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-rose-500 hover:border-slate-300 transition-all cursor-pointer active:scale-95 shadow-sm bg-white"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.529-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C18.155 2.114 15.46 1 12.24 1 5.918 1 .8 6.012 .8 12.2s5.118 11.2 11.44 11.2c6.6 0 11-4.588 11-11.2 0-.756-.08-1.332-.178-1.715H12.24z"/>
                </svg>
              </button>
              <button 
                type="button" 
                onClick={() => handleSocialClick('facebook')}
                title="Facebook Secure Integration"
                className="w-9 h-9 rounded-xl border border-slate-200/80 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-blue-600 hover:border-slate-300 transition-all cursor-pointer active:scale-95 shadow-sm bg-white"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>
              <button 
                type="button" 
                onClick={() => handleSocialClick('twitter')}
                title="X Secure Integration"
                className="w-9 h-9 rounded-xl border border-slate-200/80 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all cursor-pointer active:scale-95 shadow-sm bg-white"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </button>
            </div>
            <p className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">atau isi formulir pendaftaran di bawah</p>
          </div>

          <form onSubmit={handleRegisterSubmit} className="space-y-3 max-h-[420px] overflow-y-auto no-scrollbar pr-1 pl-4">
            {/* Instansi Dropdown (Sleek UI Custom Dropdown) - Placed at the very top */}
            <div className="space-y-0.5 relative">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Instansi Cabang</label>
              <div className="relative">
                <Database size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <button
                  type="button"
                  onClick={() => setIsDesktopDropdownOpen(!isDesktopDropdownOpen)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none transition-all uppercase cursor-pointer text-slate-700 flex items-center justify-between min-h-[34px] hover:border-slate-300 focus:border-blue-500 focus:bg-white text-left shadow-sm"
                >
                  <span className="truncate">
                    {regFirebaseConfig 
                      ? (configs.find(c => c.id === regFirebaseConfig)?.instansiName || regFirebaseConfig).toUpperCase() 
                      : "PILIH INSTANSI CABANG"}
                  </span>
                  <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${isDesktopDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {isDesktopDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDesktopDropdownOpen(false)} />
                  <div className="absolute left-0 right-0 mt-1 bg-white/80 backdrop-blur-md border border-slate-200/50 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setRegFirebaseConfig('');
                        setIsDesktopDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-[9px] uppercase font-black tracking-wider transition-colors border-b border-slate-100/50 ${!regFirebaseConfig ? 'bg-blue-100/70 text-blue-800' : 'text-slate-400 hover:bg-blue-50/50 hover:text-blue-600'}`}
                    >
                      -- BELUM MEMILIH INSTANSI --
                    </button>
                    {configs.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setRegFirebaseConfig(c.id);
                          setIsDesktopDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-[9px] uppercase font-bold transition-colors flex items-center justify-between ${regFirebaseConfig === c.id ? 'bg-blue-100 text-blue-900 font-extrabold hover:bg-blue-200' : 'text-slate-700 hover:bg-blue-50/50 hover:text-blue-600'}`}
                      >
                        <span className="truncate">{String(c.instansiName || c.id).toUpperCase()}</span>
                        {regFirebaseConfig === c.id && <CheckCircle size={10} className="text-blue-600 shrink-0 ml-1" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Nama Lengkap */}
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Nama Lengkap</label>
                <div className="relative">
                  <User size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Nama Lengkap Anda"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:font-normal placeholder:text-slate-400 uppercase"
                  />
                </div>
              </div>

              {/* Username */}
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Username Unik</label>
                <div className="relative">
                  <User size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="username123"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Email Address */}
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Alamat Email</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="email@catetin.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Password Baru</label>
                <div className="relative">
                  <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="Password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Jabatan - Full Width at bottom */}
            <div className="space-y-0.5">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Jabatan / Posisi</label>
              <div className="relative">
                <Briefcase size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Jabatan Anda"
                  value={regJabatan}
                  onChange={(e) => setRegJabatan(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:font-normal placeholder:text-slate-400 uppercase"
                />
              </div>
            </div>

            {/* Web Access Checklist App Choices */}
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-0.5 block">Aplikasi Yang Ingin Diakses</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRegWebAccess({ ...regWebAccess, bendahara: !regWebAccess.bendahara })}
                  className={`px-3 py-1.5 rounded-lg border flex items-center space-x-1.5 cursor-pointer transition-all ${regWebAccess.bendahara ? 'bg-blue-500/10 border-blue-400 text-blue-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400 font-normal'}`}
                >
                  {regWebAccess.bendahara ? <CheckSquare size={13} className="text-blue-600 shrink-0" /> : <Square size={13} className="shrink-0" />}
                  <span className="text-[8px] uppercase tracking-wider">Bendahara</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRegWebAccess({ ...regWebAccess, absensi: !regWebAccess.absensi })}
                  className={`px-3 py-1.5 rounded-lg border flex items-center space-x-1.5 cursor-pointer transition-all ${regWebAccess.absensi ? 'bg-blue-500/10 border-blue-400 text-blue-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400 font-normal'}`}
                >
                  {regWebAccess.absensi ? <CheckSquare size={13} className="text-blue-600 shrink-0" /> : <Square size={13} className="shrink-0" />}
                  <span className="text-[8px] uppercase tracking-wider">Absensi</span>
                </button>
              </div>
            </div>

            {registerError && (
              <div className="bg-rose-50 text-rose-600 p-2.5 rounded-xl border border-rose-100 text-[8.5px] uppercase font-bold tracking-tight">
                {registerError}
              </div>
            )}

            <div className="pt-2 shrink-0">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-950 text-white py-3 rounded-full font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-slate-950/20 hover:bg-slate-900 active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Mendaftarkan...</span>
                  </>
                ) : (
                  <>
                    <span>KIRIM PENGAJUAN</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Sliding Overlay Slider Side Container */}
        <motion.div 
          className="absolute top-0 w-1/2 h-full z-20 overflow-hidden"
          initial={false}
          animate={{ 
            left: isSelfReg ? '0%' : '50%',
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 120 }}
        >
          <motion.div
            className="w-[200%] h-full flex relative"
            initial={false}
            animate={{
              x: isSelfReg ? '0%' : '-50%'
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
          >
            {/* UNIFIED BACKGROUND (No cut / seamless) */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#00A1E5] via-[#007CC2] to-[#004D90] z-0"></div>
            
            {/* UNIFIED STARLIGHTS & METEORS BACKGROUND (spanning 1000 viewBox width instead of 500) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none select-none z-0" viewBox="0 0 1000 500" preserveAspectRatio="none" fill="none">
              <defs>
                <linearGradient id="unifiedMeteorGrad" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Left Side Stars (0 to 500) */}
              <circle cx="50" cy="80" r="1.5" fill="#ffffff" opacity="0.8" />
              <circle cx="120" cy="50" r="1" fill="#ffffff" opacity="0.6" />
              <circle cx="180" cy="140" r="2" fill="#ffffff" opacity="0.9" />
              <circle cx="210" cy="70" r="1.5" fill="#ffffff" opacity="0.5" />
              <circle cx="290" cy="110" r="1" fill="#ffffff" opacity="0.7" />
              <circle cx="340" cy="65" r="2" fill="#ffffff" opacity="0.85" />
              <circle cx="410" cy="130" r="1" fill="#ffffff" opacity="0.4" />
              <circle cx="460" cy="90" r="1.5" fill="#ffffff" opacity="0.9" />
              <circle cx="70" cy="200" r="1.5" fill="#ffffff" opacity="0.6" />
              <circle cx="150" cy="170" r="2" fill="#ffffff" opacity="0.8" />
              <circle cx="260" cy="220" r="1" fill="#ffffff" opacity="0.5" />
              <circle cx="380" cy="190" r="1.5" fill="#ffffff" opacity="0.7" />
              <circle cx="440" cy="230" r="2" fill="#ffffff" opacity="0.9" />
              
              {/* Right Side Stars (500 to 1000) */}
              <circle cx="550" cy="80" r="1.5" fill="#ffffff" opacity="0.8" />
              <circle cx="620" cy="50" r="1" fill="#ffffff" opacity="0.6" />
              <circle cx="680" cy="140" r="2" fill="#ffffff" opacity="0.9" />
              <circle cx="710" cy="70" r="1.5" fill="#ffffff" opacity="0.5" />
              <circle cx="790" cy="110" r="1" fill="#ffffff" opacity="0.7" />
              <circle cx="840" cy="65" r="2" fill="#ffffff" opacity="0.85" />
              <circle cx="910" cy="130" r="1" fill="#ffffff" opacity="0.4" />
              <circle cx="960" cy="90" r="1.5" fill="#ffffff" opacity="0.9" />
              <circle cx="570" cy="200" r="1.5" fill="#ffffff" opacity="0.6" />
              <circle cx="650" cy="170" r="2" fill="#ffffff" opacity="0.8" />
              <circle cx="760" cy="220" r="1" fill="#ffffff" opacity="0.5" />
              <circle cx="880" cy="190" r="1.5" fill="#ffffff" opacity="0.7" />
              <circle cx="940" cy="230" r="2" fill="#ffffff" opacity="0.9" />

              {/* Meteors positioned dynamically across the whole 1000px */}
              <line x1="120" y1="40" x2="60" y2="90" stroke="url(#unifiedMeteorGrad)" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="280" y1="55" x2="230" y2="95" stroke="url(#unifiedMeteorGrad)" strokeWidth="2" strokeLinecap="round" />
              <line x1="430" y1="80" x2="370" y2="130" stroke="url(#unifiedMeteorGrad)" strokeWidth="2.5" strokeLinecap="round" />
              
              <line x1="620" y1="40" x2="560" y2="90" stroke="url(#unifiedMeteorGrad)" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="780" y1="55" x2="730" y2="95" stroke="url(#unifiedMeteorGrad)" strokeWidth="2" strokeLinecap="round" />
              <line x1="930" y1="80" x2="870" y2="130" stroke="url(#unifiedMeteorGrad)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>

            {/* UNIFIED OVERLAPPING CLOUDS FLOW */}
            <svg className="absolute bottom-0 left-0 w-full h-[65%] pointer-events-none select-none z-0" viewBox="0 0 1000 300" preserveAspectRatio="none" fill="none">
              <defs>
                <linearGradient id="unidCloudL1" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00AEEF" />
                  <stop offset="100%" stopColor="#0054A6" />
                </linearGradient>
                <linearGradient id="unidCloudL2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#009EE2" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#004D8C" />
                </linearGradient>
                <linearGradient id="unidCloudL3" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0072BC" />
                  <stop offset="100%" stopColor="#003580" />
                </linearGradient>
              </defs>
              <path d="M-50,180 Q200,80 500,150 T1050,160 L1050,350 L-50,350 Z" fill="url(#unidCloudL1)" opacity="0.85" />
              <path d="M-50,210 Q250,110 500,180 T1050,200 L1050,350 L-50,350 Z" fill="url(#unidCloudL2)" opacity="0.9" />
              <path d="M-50,240 Q300,150 600,230 T1050,210 L1050,350 L-50,350 Z" fill="url(#unidCloudL3)" />
            </svg>

            {/* Left Box (Welcome Back - Overlay displays when isSelfReg is true, sliding over to the left side) */}
            <div className="w-1/2 h-full text-white flex flex-col justify-center items-center p-12 text-center relative select-none bg-transparent">
              <div className="relative z-10 space-y-5 flex flex-col items-center">
                <div className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center">
                  <img src="/catet-in-light.svg" alt="Catet-In Logo" className="w-full h-full object-contain drop-shadow-md" />
                </div>
                <h1 className="text-3xl font-black tracking-tight leading-none uppercase">Sudah Ada Akun?</h1>
                <p className="text-xs text-blue-100/80 tracking-wide leading-relaxed max-w-sm mt-2 font-medium">
                  Masuk menggunakan akun anda untuk memulai mencatat administrasi keuangan dan presensi anda dengan aplikasi Catet-in.
                </p>
                
                <button
                  type="button"
                  onClick={() => handleToggleMode(false)}
                  className="px-10 py-3 rounded-full border-2 border-white/25 hover:border-white hover:bg-white hover:text-indigo-950 font-extrabold text-xs uppercase tracking-[0.15em] transition-all duration-300 active:scale-95 cursor-pointer mt-4 shadow-md"
                >
                  Masuk
                </button>
              </div>
            </div>

            {/* Right Box (Hey There! - Overlay displays when isSelfReg is false, sliding over to the right side) */}
            <div className="w-1/2 h-full text-white flex flex-col justify-center items-center p-12 text-center relative select-none bg-transparent">
              <div className="relative z-10 space-y-5 flex flex-col items-center">
                <div className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center">
                  <img src="/catet-in-light.svg" alt="Catet-In Logo" className="w-full h-full object-contain drop-shadow-md" />
                </div>
                <h1 className="text-3xl font-black tracking-tight leading-none uppercase">Belum Terdaftar?</h1>
                <p className="text-xs text-blue-100/80 tracking-wide leading-relaxed max-w-sm mt-2 font-medium">
                  Daftarkan akun anda untuk memulai mencatat administrasi keuangan dan presensi anda dengan aplikasi Catet-in
                </p>

                <button
                  type="button"
                  onClick={() => handleToggleMode(true)}
                  className="px-10 py-3 rounded-full bg-white text-indigo-900 hover:bg-indigo-50 border-2 border-white font-extrabold text-xs uppercase tracking-[0.15em] transition-all duration-300 active:scale-95 cursor-pointer mt-4 shadow-lg shadow-indigo-950/20"
                >
                  Ajukan Pendaftaran
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* MOBILE VIEW: Compact Smooth Slider Container (Full Width Switcher) */}
      <div className="w-full max-w-[328px] h-[540px] bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col md:hidden relative select-none mx-auto">
        
        {/* SLIDING REGISTRATION PANEL (Full Width Curtain with bottom-attached Notch that supports drag & tap) */}
        <motion.div
          drag="y"
          dragConstraints={{ top: -456, bottom: 0 }}
          dragElastic={{ top: 0.05, bottom: 0.15 }}
          dragMomentum={false}
          style={{ y: mobileY }}
          onDragEnd={(event, info) => {
            if (mobilePhase === 'login' || mobilePhase === 'expandingToLogin') {
              if (info.offset.y > 50) {
                handleToggleMode(true);
              }
            } else if (mobilePhase === 'register' || mobilePhase === 'expandingToRegister') {
              if (info.offset.y < -50) {
                handleToggleMode(false);
              }
            }
          }}
          className="absolute top-0 left-0 right-0 h-[505px] bg-gradient-to-br from-[#00A1E5] via-[#007CC2] to-[#004D90] rounded-b-3xl shadow-xl z-20 flex flex-col justify-between cursor-grab active:cursor-grabbing"
          initial={false}
          animate={{
            y: (mobilePhase === 'register' || mobilePhase === 'expandingToRegister') ? 0 : -456,
          }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Inner content wrapper with inherited border radius and clipping to contain background graphics */}
          <div className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none">
            {/* STARLIGHTS & METEORS BACKGROUND */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none select-none" viewBox="0 0 500 500" preserveAspectRatio="xMidYMid slice" fill="none">
              <defs>
                <linearGradient id="meteorGradMobile" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle cx="55" cy="85" r="1.5" fill="#ffffff" opacity="0.8" />
              <circle cx="125" cy="45" r="1" fill="#ffffff" opacity="0.6" />
              <circle cx="185" cy="135" r="2" fill="#ffffff" opacity="0.9" />
              <circle cx="215" cy="65" r="1.5" fill="#ffffff" opacity="0.5" />
              <circle cx="295" cy="105" r="1" fill="#ffffff" opacity="0.7" />
              <circle cx="345" cy="55" r="2" fill="#ffffff" opacity="0.85" />
              <circle cx="415" cy="125" r="1" fill="#ffffff" opacity="0.4" />
              <circle cx="465" cy="85" r="1.5" fill="#ffffff" opacity="0.9" />
              <circle cx="75" cy="195" r="1.5" fill="#ffffff" opacity="0.6" />
              <circle cx="155" cy="165" r="2" fill="#ffffff" opacity="0.8" />
              <circle cx="265" cy="215" r="1" fill="#ffffff" opacity="0.5" />
              <circle cx="385" cy="185" r="1.5" fill="#ffffff" opacity="0.7" />
              <circle cx="445" cy="225" r="2" fill="#ffffff" opacity="0.9" />
              <line x1="120" y1="40" x2="60" y2="90" stroke="url(#meteorGradMobile)" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="280" y1="55" x2="230" y2="95" stroke="url(#meteorGradMobile)" strokeWidth="2" strokeLinecap="round" />
              <line x1="430" y1="80" x2="370" y2="130" stroke="url(#meteorGradMobile)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>

            {/* OVERLAPPING CLOUDS FLOW */}
            <svg className="absolute bottom-0 left-0 w-full h-[65%] pointer-events-none select-none" viewBox="0 0 500 300" preserveAspectRatio="none" fill="none">
              <defs>
                <linearGradient id="cloudMobileL1" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00AEEF" />
                  <stop offset="100%" stopColor="#0054A6" />
                </linearGradient>
                <linearGradient id="cloudMobileL2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#009EE2" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#004D8C" />
                </linearGradient>
                <linearGradient id="cloudMobileL3" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0072BC" />
                  <stop offset="100%" stopColor="#003580" />
                </linearGradient>
              </defs>
              <path d="M-50,180 Q20,100 120,150 T310,140 T550,160 L550,300 L-50,300 Z" fill="url(#cloudMobileL1)" opacity="0.85" />
              <path d="M-50,210 Q90,130 220,180 T460,160 T550,200 L550,300 L-50,300 Z" fill="url(#cloudMobileL2)" opacity="0.9" />
              <path d="M-50,240 Q150,180 300,230 T550,210 L550,300 L-50,300 Z" fill="url(#cloudMobileL3)" />
            </svg>
          </div>

          {/* BELUM TERDAFTAR? TEXT (ABOVE THE NOTCH IN LOGIN MODE - VISIBLE AT THE TOP) */}
          <motion.div
            style={{ opacity: signInOpacity }}
            className="absolute bottom-3.5 inset-x-0 px-2 flex flex-col justify-end items-center text-center select-none pointer-events-none pb-0 z-25"
            animate={{
              pointerEvents: (mobilePhase === 'login' || mobilePhase === 'expandingToLogin') ? 'auto' : 'none'
            }}
          >
            <p className="text-[7px] font-light text-blue-200/60 leading-tight max-w-[285px] uppercase tracking-wider">
              Daftarkan akun anda untuk memulai mencatat administrasi keuangan dan presensi anda dengan aplikasi Catet-in.
            </p>
          </motion.div>

          {/* SIGN UP NOTCH (PONY) - Integrated at the bottom center of the sliding card (Seamless waterdrop design, no top shadow bleeding, exact color match) */}
          <div 
            className="absolute bottom-[-35px] left-1/2 -translate-x-1/2 w-[140px] h-[36px] z-10 flex items-center justify-center cursor-pointer select-none"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleMode(mobilePhase === 'login' || mobilePhase === 'expandingToLogin');
            }}
          >
            {/* Exact smooth SVG "valley" (u-notch) shape, shifted up to clip the top shadow */}
            <svg 
              className="absolute top-[-4px] left-0 w-full h-[40px] drop-shadow-[0_4px_10px_rgba(0,53,128,0.3)] overflow-visible" 
              viewBox="0 0 140 40" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M 0,0 H 140 V 4 C 110,4 95,36 70,36 C 45,36 30,4 0,4 Z" fill="#003580" />
            </svg>

            {/* Starlight accents inside notch, vertically balanced */}
            <span className="relative z-10 text-[9px] font-black uppercase tracking-widest text-white hover:text-blue-100 active:scale-95 transition-all pb-1.5 select-none flex items-center space-x-1">
              <span>{(mobilePhase === 'login' || mobilePhase === 'expandingToLogin') ? 'Daftar?' : 'Masuk?'}</span>
            </span>
          </div>
          
          {/* 3. SIGN UP FORM PANEL (INTEGRATED INSIDE THE BLUE CONTAINER IN REGISTER MODE) */}
          <motion.div
            className="absolute inset-x-0 top-0 h-[505px] px-5 pt-4 pb-2 flex flex-col justify-between z-20"
            initial={false}
            style={{ opacity: signUpOpacity }}
            animate={{
              y: (mobilePhase === 'register' || mobilePhase === 'expandingToRegister') ? 0 : 30,
              pointerEvents: (mobilePhase === 'register' || mobilePhase === 'expandingToRegister') ? 'auto' : 'none'
            }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex-[3] flex flex-col min-h-0 max-h-[385px]">
              <div className="text-center pt-0.5 mb-2 shrink-0">
                <h1 className="text-lg font-black tracking-tight text-white uppercase leading-none mb-0.5">REGISTRASI AKUN</h1>
              </div>

              <form 
                onSubmit={handleRegisterSubmit} 
                onPointerDownCapture={(e) => e.stopPropagation()}
                className="space-y-1 flex-1 overflow-y-auto no-scrollbar pr-0.5"
              >
                {/* Side-by-side Dropdowns for Instansi Cabang and Aplikasi Akses */}
                <div className="grid grid-cols-2 gap-1.5 relative z-50">
                  {/* Instansi Cabang Custom Dropdown */}
                  <div className="space-y-0.5 relative">
                    <label className="text-[7.5px] font-black text-blue-100/90 uppercase tracking-widest ml-1 block">Instansi Cabang</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileDropdownOpen(!isMobileDropdownOpen);
                        setIsAppDropdownOpen(false);
                      }}
                      className="w-full px-2 py-1 bg-white/10 border border-white/15 focus:border-white focus:bg-white/20 text-white rounded-lg text-[10px] font-bold outline-none uppercase cursor-pointer flex items-center justify-between min-h-[26px] text-left"
                    >
                      <span className="truncate">
                        {regFirebaseConfig 
                          ? (configs.find(c => c.id === regFirebaseConfig)?.instansiName || regFirebaseConfig).toUpperCase() 
                          : "PILIH INSTANSI"}
                      </span>
                      <ChevronDown size={11} className={`text-blue-100/80 transition-transform duration-200 ${isMobileDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isMobileDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsMobileDropdownOpen(false)} />
                        <div className="absolute left-0 right-0 mt-1 bg-white/80 backdrop-blur-md border border-white/20 rounded-lg shadow-2xl z-50 max-h-44 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1 duration-150 text-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setRegFirebaseConfig('');
                              setIsMobileDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-[8.5px] uppercase font-bold transition-colors border-b border-slate-100/50 ${!regFirebaseConfig ? 'bg-blue-100/70 text-blue-800 font-extrabold' : 'text-slate-400 hover:bg-blue-50/50 hover:text-blue-600'}`}
                          >
                            -- PILIH INSTANSI --
                          </button>
                          {configs.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setRegFirebaseConfig(c.id);
                                setIsMobileDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-[8.5px] uppercase font-bold transition-colors flex items-center justify-between ${regFirebaseConfig === c.id ? 'bg-blue-100/90 text-blue-900 font-extrabold hover:bg-blue-200/80' : 'text-slate-700 hover:bg-blue-50/50 hover:text-blue-600'}`}
                            >
                              <span className="truncate">{String(c.instansiName || c.id).toUpperCase()}</span>
                              {regFirebaseConfig === c.id && <CheckCircle size={9} className="text-blue-600 shrink-0 ml-1" />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Aplikasi Akses Custom Dropdown */}
                  <div className="space-y-0.5 relative">
                    <label className="text-[7.5px] font-black text-blue-100/90 uppercase tracking-widest ml-1 block">Aplikasi Akses</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAppDropdownOpen(!isAppDropdownOpen);
                        setIsMobileDropdownOpen(false);
                      }}
                      className="w-full px-2 py-1 bg-white/10 border border-white/15 focus:border-white focus:bg-white/20 text-white rounded-lg text-[10px] font-bold outline-none uppercase cursor-pointer flex items-center justify-between min-h-[26px] text-left"
                    >
                      <span className="truncate">
                        {(() => {
                          const selected = [];
                          if (regWebAccess.bendahara) selected.push("BENDAHARA");
                          if (regWebAccess.absensi) selected.push("ABSENSI");
                          return selected.length > 0 ? selected.join(", ") : "PILIH AKSES";
                        })()}
                      </span>
                      <ChevronDown size={11} className={`text-blue-100/80 transition-transform duration-200 ${isAppDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isAppDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsAppDropdownOpen(false)} />
                        <div className="absolute left-0 right-0 mt-1 bg-white/80 backdrop-blur-md border border-white/20 rounded-lg shadow-2xl z-50 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1 duration-150 text-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setRegWebAccess({
                                ...regWebAccess,
                                bendahara: !regWebAccess.bendahara
                              });
                            }}
                            className={`w-full text-left px-3 py-2 text-[8.5px] uppercase font-bold transition-colors flex items-center justify-between border-b border-slate-100/50 ${regWebAccess.bendahara ? 'bg-blue-100/90 text-blue-900 font-extrabold hover:bg-blue-200/80' : 'text-slate-700 hover:bg-blue-50/50 hover:text-blue-600'}`}
                          >
                            <span className="flex items-center space-x-1.5">
                              {regWebAccess.bendahara ? <CheckSquare size={10} className="text-blue-700 shrink-0" /> : <Square size={10} className="text-slate-400 shrink-0" />}
                              <span>BENDAHARA</span>
                            </span>
                            {regWebAccess.bendahara && <CheckCircle size={9} className="text-blue-600 shrink-0" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRegWebAccess({
                                ...regWebAccess,
                                absensi: !regWebAccess.absensi
                              });
                            }}
                            className={`w-full text-left px-3 py-2 text-[8.5px] uppercase font-bold transition-colors flex items-center justify-between ${regWebAccess.absensi ? 'bg-blue-100/90 text-blue-900 font-extrabold hover:bg-blue-200/80' : 'text-slate-700 hover:bg-blue-50/50 hover:text-blue-600'}`}
                          >
                            <span className="flex items-center space-x-1.5">
                              {regWebAccess.absensi ? <CheckSquare size={10} className="text-blue-700 shrink-0" /> : <Square size={10} className="text-slate-400 shrink-0" />}
                              <span>ABSENSI</span>
                            </span>
                            {regWebAccess.absensi && <CheckCircle size={9} className="text-blue-600 shrink-0" />}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <label className="text-[7.5px] font-black text-blue-100/90 uppercase tracking-widest ml-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama Lengkap Anda"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full px-2.5 py-1 bg-white/10 border border-white/15 focus:border-white focus:bg-white/20 text-white placeholder-blue-200/50 rounded-lg text-[10.5px] font-bold outline-none uppercase transition-all"
                  />
                </div>

                <div className="space-y-0.5">
                  <label className="text-[7.5px] font-black text-blue-100/90 uppercase tracking-widest ml-1">Username Unik</label>
                  <input
                    type="text"
                    required
                    placeholder="username123"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full px-2.5 py-1 bg-white/10 border border-white/15 focus:border-white focus:bg-white/20 text-white placeholder-blue-200/50 rounded-lg text-[10.5px] font-bold outline-none transition-all"
                  />
                </div>

                <div className="space-y-0.5">
                  <label className="text-[7.5px] font-black text-blue-100/90 uppercase tracking-widest ml-1">Alamat Email</label>
                  <input
                    type="email"
                    required
                    placeholder="email@catetin.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-2.5 py-1 bg-white/10 border border-white/15 focus:border-white focus:bg-white/20 text-white placeholder-blue-200/50 rounded-lg text-[10.5px] font-bold outline-none transition-all"
                  />
                </div>

                <div className="space-y-0.5">
                  <label className="text-[7.5px] font-black text-blue-100/90 uppercase tracking-widest ml-1">Password Baru</label>
                  <input
                    type="password"
                    required
                    placeholder="Masukkan password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-2.5 py-1 bg-white/10 border border-white/15 focus:border-white focus:bg-white/20 text-white placeholder-blue-200/50 rounded-lg text-[10.5px] font-bold outline-none transition-all"
                  />
                </div>

                {/* Jabatan - Full Width below Password */}
                <div className="space-y-0.5">
                  <label className="text-[7.5px] font-black text-blue-100/90 uppercase tracking-widest ml-1 block">Jabatan</label>
                  <input
                    type="text"
                    required
                    placeholder="Jabatan Anda"
                    value={regJabatan}
                    onChange={(e) => setRegJabatan(e.target.value)}
                    className="w-full px-2.5 py-1 bg-white/10 border border-white/15 focus:border-white focus:bg-white/20 text-white placeholder-blue-200/50 rounded-lg text-[10.5px] font-bold outline-none uppercase transition-all"
                  />
                </div>

                {registerError && (
                  <div className="bg-rose-500/20 text-rose-100 p-1.5 rounded-lg border border-rose-500/30 text-[7.5px] uppercase font-black tracking-tight text-center leading-normal">
                    {registerError}
                  </div>
                )}

                <div className="pt-1.5 shrink-0">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-white hover:bg-slate-50 text-indigo-950 py-2.5 rounded-full font-black text-[9px] uppercase tracking-[0.15em] shadow-md shadow-indigo-950/10 active:scale-95 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    {isLoading ? (
                      <Loader2 size={11} className="animate-spin text-indigo-950" />
                    ) : (
                      <>
                        <span>KIRIM PENGAJUAN</span>
                        <ArrowRight size={11} className="text-indigo-950" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* SUDAH ADA AKUN? TEXT (ABOVE THE NOTCH IN REGISTER MODE) */}
            <div className="flex flex-col justify-end items-center text-center pb-3.5 select-none pointer-events-none mt-1 shrink-0 px-2">
              <p className="text-[7px] font-light text-blue-200/60 leading-tight max-w-[285px] uppercase tracking-wider">
                Masuk menggunakan akun anda untuk memulai mencatat administrasi keuangan dan presensi anda dengan aplikasi Catet-in.
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* 3. SIGN IN FORM PANEL (STATIONARY ON SYSTEM WHITE CANVAS AT THE BOTTOM PORTION) */}
        <motion.div
          className="absolute inset-x-0 top-[85px] bottom-0 px-5 pt-3 pb-6 flex flex-col justify-between z-10"
          initial={false}
          style={{ opacity: signInOpacity }}
          animate={{
            y: (mobilePhase === 'login' || mobilePhase === 'expandingToLogin') ? 0 : 20,
            pointerEvents: (mobilePhase === 'login' || mobilePhase === 'expandingToLogin') ? 'auto' : 'none'
          }}
          transition={{ duration: 0.3 }}
        >
          <div className="space-y-2.5">
            <div className="text-center pt-0.5">
              <h1 className="text-lg font-black tracking-tight text-slate-800 uppercase leading-none mb-1">SELAMAT DATANG</h1>
              
              <div className="flex justify-center space-x-3 mt-2 mb-0.5">
                <button 
                  type="button" 
                  onClick={() => handleSocialClick('google')}
                  title="Sign in with Google"
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-rose-500 active:scale-95 cursor-pointer transition-all shadow-sm bg-white"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.529-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C18.155 2.114 15.46 1 12.24 1 5.918 1 .8 6.012 .8 12.2s5.118 11.2 11.44 11.2c6.6 0 11-4.588 11-11.2 0-.756-.08-1.332-.178-1.715H12.24z"/>
                  </svg>
                </button>
                <button 
                  type="button" 
                  onClick={() => handleSocialClick('facebook')}
                  title="Sign in with Facebook"
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-blue-600 active:scale-95 cursor-pointer transition-all shadow-sm bg-white"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </button>
                <button 
                  type="button" 
                  onClick={() => handleSocialClick('twitter')}
                  title="Sign in with X"
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-550 hover:bg-slate-50 hover:text-slate-900 active:scale-95 cursor-pointer transition-all shadow-sm bg-white"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </button>
              </div>

              <div className="text-center mt-1.5">
                <p className="text-[7.5px] text-slate-400 font-extrabold uppercase tracking-widest">atau menggunakan akun anda</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-2.5">
              <div className="space-y-0.5">
                <label className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Email / Username</label>
                <div className="relative">
                  <User size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Email atau Username Anda"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-800 placeholder-slate-400 rounded-xl text-[11px] font-bold outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-0.5">
                <label className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Password</label>
                <div className="relative">
                  <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Masukkan password Anda"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-8 pr-9 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-800 placeholder-slate-400 rounded-xl text-[11px] font-bold outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pr-0.5">
                <button 
                  type="button" 
                  onClick={() => setLoginError('Hubungi Admin Pusat/Instansi Anda untuk pemulihan akun.')}
                  className="text-[8px] font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider"
                >
                  Lupa Kata Sandi?
                </button>
              </div>

              {loginError && (
                <div className="bg-rose-50 text-rose-600 p-1.5 rounded-lg border border-rose-100 text-[7.5px] uppercase font-black tracking-tight text-center leading-normal">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-950 hover:bg-slate-900 text-white py-2 rounded-full font-black text-[9px] uppercase tracking-[0.15em] shadow-md shadow-slate-950/20 active:scale-95 transition-all flex items-center justify-center space-x-1.5 cursor-pointer mt-1"
              >
                {isLoading ? (
                  <Loader2 size={11} className="animate-spin text-white" />
                ) : (
                  <>
                    <span>MASUK SISTEM</span>
                    <ArrowRight size={11} className="text-white" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Setup Guide & Cache Reset Options styled elegantly at bottom of login form */}
          <div className="flex flex-col space-y-1 pt-1.5 border-t border-slate-100">
            {onOpenSetup && (
              <button
                type="button"
                onClick={onOpenSetup}
                className="w-full flex items-center justify-center space-x-1 py-1 text-[7.5px] font-black text-amber-600 hover:text-amber-700 uppercase tracking-widest cursor-pointer border border-amber-350/20 rounded-lg bg-amber-500/5 animate-pulse"
              >
                <Database size={9} />
                <span>Setup Guide</span>
              </button>
            )}
            <button
              type="button"
              onClick={cleanBrowserCache}
              className="w-full flex items-center justify-center space-x-1 py-0.5 text-[7.5px] font-bold text-slate-400 hover:text-rose-600 uppercase tracking-widest cursor-pointer"
            >
              <RefreshCw size={8} />
              <span>Reset Sesi Portal</span>
            </button>
          </div>
        </motion.div>


      </div>

      {/* MODERN APP SELECTION MODAL (POP-UP PILIH APLIKASI) */}
      <AnimatePresence>
        {showAppChooser && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-5 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col relative"
            >
              {/* Header Banner - Subtle Sky/Slate with minimal rounded corners */}
              <div className="bg-gradient-to-r from-sky-600 to-sky-700 px-5 py-4 text-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center border border-white/20">
                    <Briefcase className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-white uppercase">
                      Pilih Aplikasi
                    </h3>
                    <p className="text-[11px] text-sky-100 font-medium">
                      Silakan tentukan modul kerja yang ingin Anda buka
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetAllFlows}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Batalkan & Kembali"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body Content */}
              <div className="p-4 sm:p-6 space-y-4 bg-slate-50/50">
                {/* User Info Capsule */}
                <div className="bg-white border border-slate-200/80 rounded-lg p-3 flex items-center justify-between shadow-xs">
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 font-black text-xs flex items-center justify-center shrink-0 border border-sky-200">
                      {resolvedUserData?.full_name ? resolvedUserData.full_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {resolvedUserData?.full_name || resolvedUserData?.username || 'Pengguna'}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate font-medium">
                        {resolvedUserData?.instansi || 'Instansi Terdaftar'} • <span className="font-semibold text-sky-700">{resolvedUserData?.role || 'Staff'}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                    Login Terverifikasi
                  </span>
                </div>

                {/* List of Applications to Select */}
                <div className="grid grid-cols-1 gap-3">
                  {accessibleApps.map((app) => {
                    const isSelected = selectedAppId === app.id;
                    const IconComponent = app.icon;

                    return (
                      <div
                        key={app.id}
                        onClick={() => setSelectedAppId(app.id)}
                        className={`group relative p-4 rounded-lg bg-white border transition-all cursor-pointer select-none text-left shadow-xs ${
                          isSelected
                            ? `${app.borderActive} bg-sky-50/20`
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start space-x-3.5">
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white bg-gradient-to-br ${app.gradient} shadow-sm`}
                            >
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2 flex-wrap">
                                <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                                  {app.title}
                                </h4>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                  app.id === 'bendahara' 
                                    ? 'bg-sky-50 text-sky-700 border-sky-200' 
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                  {app.badge}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                {app.description}
                              </p>
                            </div>
                          </div>

                          <div className="pt-0.5 shrink-0">
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                isSelected
                                  ? 'border-sky-600 bg-sky-600 text-white ring-2 ring-sky-100'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 sm:px-6 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={resetAllFlows}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900 text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectAndProceed(selectedAppId)}
                  className="flex-1 sm:flex-none sm:min-w-[190px] px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
                >
                  <span>Masuk ke {accessibleApps.find(a => a.id === selectedAppId)?.title || 'Aplikasi'}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COMING SOON SOCIAL LOGIN MODAL */}
      {showSocialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="w-full max-w-sm bg-white rounded-xl border border-slate-100 shadow-2xl p-6 relative overflow-hidden text-center"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600"></div>
            
            <button 
              onClick={() => setShowSocialModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Tutup"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col items-center mt-3">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <Sparkles size={24} />
              </div>
              
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 mb-2">
                Fitur Belum Tersedia
              </h3>
              
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-6 leading-relaxed max-w-[280px]">
                Metode masuk menggunakan <span className="font-bold text-indigo-600">{selectedSocialProvider}</span> masih dalam tahap pengembangan dan belum aktif. Silakan masuk menggunakan Username dan Kata Sandi resmi instansi Anda terlebih dahulu.
              </p>

              <button
                onClick={() => setShowSocialModal(false)}
                className="w-full bg-slate-950 hover:bg-slate-900 text-white py-3 rounded-lg font-black text-[9px] uppercase tracking-[0.15em] transition-all cursor-pointer shadow-lg shadow-slate-900/15 active:scale-95"
              >
                Dimengerti
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
};

export default Login;
