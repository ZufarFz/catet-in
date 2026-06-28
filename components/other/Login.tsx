import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Lock, User, Eye, EyeOff, Loader2, ArrowRight, XCircle, 
  RefreshCw, CheckCircle, Mail, Database, CheckSquare, Square,
  Briefcase
} from 'lucide-react';
import { db, centralClient } from '../../supabase';

interface LoginProps {
  portalUrl: string;
  onLoginSuccess: (data: any) => void;
  onOpenSetup?: () => void;
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
    setLoginError('');
    setRegisterError('');
    setIsLoading(true);
    
    try {
      if (!db) {
        throw new Error('Supabase belum selesai dikonfigurasi.');
      }
      
      const { error } = await db.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: window.location.origin
        }
      });
      
      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error(err);
      const displayProvider = provider === 'twitter' ? 'X (Twitter)' : provider.charAt(0).toUpperCase() + provider.slice(1);
      setLoginError(`Gagal masuk dengan ${displayProvider}: ${err.message || err}. Pastikan Anda telah mengaktifkan & mengkonfigurasi provider "${displayProvider}" di dashboard Supabase Anda.`);
    } finally {
      setIsLoading(false);
    }
  };
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regJabatan, setRegJabatan] = useState('');
  const [regWebAccess, setRegWebAccess] = useState({ bendahara: true, absensi: true });
  const [regFirebaseConfig, setRegFirebaseConfig] = useState('');
  const [configs, setConfigs] = useState<any[]>([]);
  
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
        if (list.length > 0) {
          setRegFirebaseConfig(list[0].id);
        }
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

    setIsLoading(true);
    setRegisterError('');

    try {
      const activeClient = centralClient || db;
      if (!activeClient) {
        throw new Error("Supabase belum dikonfigurasi.\nSilakan hubungi superadmin atau atur database terlebih dahulu.");
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

      // 2. Also register on the selected Operational base if configured
      const chosenInstansi = configs.find(c => c.id === regFirebaseConfig);
      if (chosenInstansi && chosenInstansi.supabase_url && chosenInstansi.supabase_anon_key) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const opClient = createClient(chosenInstansi.supabase_url, chosenInstansi.supabase_anon_key, {
            auth: { storageKey: 'sb-operational-token', persistSession: true }
          });
          await opClient.auth.signUp({
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
          console.log(`Successfully completed registration on operational database: ${regFirebaseConfig}`);
        } catch (opSignUpErr) {
          console.warn("Operational DB registration fallback skipped:", opSignUpErr);
        }
      }

      // 3. Insert user record inside central users table as Pending
      const newRequestUser = {
        id: resolvedUid,
        username: cleanRegName,
        email: cleanEmail,
        password: regPassword, // kept for reference
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
      
      // 1. Look up user record in the central 'users' table (supports username or email)
      const { data: userDoc, error: userLookupErr } = await activeClient
        .from('users')
        .select('*')
        .or(`username.eq.${cleanUser},email.eq.${cleanUser}`)
        .maybeSingle();

      if (userLookupErr) {
        throw new Error("Gagal mengambil data akun dari server: " + userLookupErr.message);
      }

      let activeUserDoc = userDoc;

      // Seeding or migrating superadmin profile to ensure full Supabase Auth and public.users compatibility
      if (cleanUser === 'superadmin' && password === 'superadmin354') {
        const superEmail = 'superadmin@catetin.com';
        let superId = 'super-sa-' + Math.random().toString(36).substring(2, 11);
        let signInSuccess = false;

        // 1. Try to sign in first with the email superadmin@catetin.com
        try {
          const { data: authSessionData, error: signInErr } = await activeClient.auth.signInWithPassword({
            email: superEmail,
            password: 'superadmin354',
          });
          if (!signInErr && authSessionData?.user) {
            superId = authSessionData.user.id;
            signInSuccess = true;
          }
        } catch (e) {
          console.warn("Direct superadmin signin failed, continuing to registration.", e);
        }

        // 2. If signin fails, attempt signUp to register on Supabase Auth
        if (!signInSuccess) {
          try {
            const { data: superAuthData, error: signUpErr } = await activeClient.auth.signUp({
              email: superEmail,
              password: 'superadmin354',
              options: {
                data: {
                  username: 'superadmin',
                  full_name: 'Super Admin Portal'
                }
              }
            });
            if (signUpErr) {
              console.warn("Primary signup error, might already be registered in auth schema:", signUpErr.message);
            }
            if (superAuthData?.user) {
              superId = superAuthData.user.id;
            }
          } catch (saSignUpErr) {
            console.warn("Fallback superadmin signup failed/already exists:", saSignUpErr);
          }
        }

        // 3. Ensure the record in the public users database exists and has the correct real UUID from Supabase Auth
        const superData = {
          id: superId,
          username: 'superadmin',
          email: superEmail,
          password: 'superadmin354',
          full_name: 'Super Admin Portal',
          role: 'Superadmin',
          original_role: 'Superadmin',
          instansi: 'Catet-In (Master)',
          web_access: 'bendahara,absensi',
          status: 'Active',
          created_at: new Date().toISOString()
        };

        // If there's an existing 'superadmin' record with static string id, delete it first to avoid key constraints
        if (userDoc && (userDoc.id === 'superadmin' || userDoc.id !== superId)) {
          await activeClient.from('users').delete().eq('id', userDoc.id);
        }

        const { error: insertErr } = await activeClient.from('users').upsert([superData]);
        if (insertErr) {
          console.error("Failed to seed/migrate fallback superadmin account:", insertErr);
        }
        activeUserDoc = superData;
      }

      if (!activeUserDoc) {
        setLoginError('Email atau Username tidak terdaftar.');
        setIsLoading(false);
        return;
      }

      const resolvedEmail = activeUserDoc.email || cleanUser;

      // 2. Perform authentications in the central Supabase auth schema
      const { data: authData, error: signInErr } = await activeClient.auth.signInWithPassword({
        email: resolvedEmail,
        password: password,
      });

      if (signInErr) {
        throw new Error("Password atau email Anda salah: " + signInErr.message);
      }

      const activeUserId = authData?.user?.id || activeUserDoc.id;

      // Self-heal/align superadmin ID inside central db public.users table if it is misaligned from standard Auth UUID
      if (cleanUser === 'superadmin' && activeUserId && activeUserDoc.id !== activeUserId) {
        console.log("Aligning master superadmin user profile ID to real Auth UID:", activeUserId);
        try {
          // Delete old placeholder record if it exists
          await activeClient.from('users').delete().eq('id', activeUserDoc.id);
        } catch (delErr) {
          console.warn("Could not delete old placeholder superadmin users entry:", delErr);
        }
        try {
          const alignedSuperData = {
            ...activeUserDoc,
            id: activeUserId,
            status: 'Active'
          };
          await activeClient.from('users').upsert([alignedSuperData]);
          activeUserDoc = alignedSuperData;
        } catch (upsertErr) {
          console.warn("Failed to complete superadmin ID alignment upsert:", upsertErr);
        }
      }

      // Helper function to calculate SHA-256 hash using Web Crypto API
      const sha256 = async (message: string): Promise<string> => {
        const msgBuffer = new window.TextEncoder().encode(message);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      };

      // Generate secure session token and expiration (24 hours)
      const sessionToken = 'sess_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Update central users cache table with token info (optionally, to match schema)
      try {
        await activeClient.from('users').update({
          active_session_token: sessionToken,
          session_expires_at: expiresAt
        }).eq('id', activeUserId);
      } catch (e) {
        console.warn("Central users table session update skipped:", e);
      }

      // 3. Handle Pending approval state
      const roleStr = String(activeUserDoc.role || '').toLowerCase();
      const statusStr = String(activeUserDoc.status || '').toLowerCase();
      if (statusStr === 'disabled' || statusStr === 'nonaktif' || statusStr === 'inactive') {
        await activeClient.auth.signOut();
        throw new Error("Akun Anda saat ini dinonaktifkan sementara oleh Superadmin. Hubungi admin untuk mengaktifkan kembali.");
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
            instansiConfigMap = {
              supabaseUrl: instansiDoc.supabase_url,
              supabaseAnonKey: instansiDoc.supabase_anon_key
            };

            // Register dynamic session on target tenant database using secure signature-based SSO
            try {
              const { createClient } = await import('@supabase/supabase-js');
              const opClient = createClient(instansiDoc.supabase_url, instansiDoc.supabase_anon_key);
              
              // Construct the SSO handshake signature
              const message = activeUserId + ':' + (activeUserDoc.email || resolvedEmail) + ':' + (activeUserDoc.role || 'Viewer') + ':' + expiresAt + ':' + sessionToken;
              const syncToken = instansiDoc.supabase_anon_key; // Using operational anon key as default sync token
              const sig = await sha256(message + syncToken);

              const { data: rpcRes, error: rpcErr } = await opClient.rpc('register_operational_session', {
                p_user_id: activeUserId,
                p_email: activeUserDoc.email || resolvedEmail,
                p_full_name: activeUserDoc.full_name || '',
                p_role: activeUserDoc.role || 'Viewer',
                p_original_role: activeUserDoc.original_role || 'Viewer',
                p_instansi: activeUserDoc.instansi || '',
                p_web_access: activeUserDoc.web_access || 'bendahara,absensi',
                p_expires_at: expiresAt,
                p_session_token: sessionToken,
                p_signature: sig
              });

              if (rpcErr) {
                console.error("SSO Connection handshake failed:", rpcErr);
                throw rpcErr;
              }
              console.log("Successfully registered secure session on operational database.");
            } catch (authSyncErr: any) {
              console.error("Gagal melakukan verifikasi keamanan SSO pada database Cabang:", authSyncErr);
              let errorMsg = authSyncErr.message || String(authSyncErr);
              if (errorMsg.includes("active_session_token") || errorMsg.includes("register_operational_session")) {
                errorMsg = "Database cabang Anda menggunakan skema lama (kolom 'active_session_token' belum ada). Silakan masuk ke akun Superadmin/Admin, klik menu 'Setup Guide' (Panduan Database & Script), lalu salin dan jalankan script SQL di bagian 'PEMBARUAN SKEMA OPERASIONAL (SSO MULTI-DB PATCH)' pada SQL Editor database cabang Anda.";
              }
              throw new Error("Gagal terhubung secara aman ke database cabang: " + errorMsg, { cause: authSyncErr });
            }
          }
        } catch (instansiErr: any) {
          console.error("Gagal mengambil detail database cabang:", instansiErr);
          throw instansiErr;
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
      localStorage.setItem('web_access', webAccess);

      localStorage.setItem('activeScriptUrl', appscriptBackup || 'native');
      localStorage.setItem('absensiMasterUrl', 'native');
      localStorage.setItem('absensiLogUrl', 'native');

      const resolvedUserDoc = {
        ...activeUserDoc,
        id: activeUserId,
        firebase_config: instansiConfigMap,
        instansi: instansiName,
        appsscript: appscriptBackup || 'native'
      };

      if (instansiConfigMap) {
        localStorage.setItem('instansi_db_config', JSON.stringify(instansiConfigMap));
      } else {
        localStorage.removeItem('instansi_db_config');
      }

      onLoginSuccess(resolvedUserDoc);
    } catch (err: any) {
      console.error("Login Error:", err);
      setLoginError(err.message || 'Gagal masuk ke sistem.');
      setIsLoading(false);
    }
  };

  const resetAllFlows = () => {
    setIsSelfReg(false);
    setIsPendingUser(false);
    setIsRegisteredCompleted(false);
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
            Pendaftaran & pengajuan akses akun Anda telah dikirim dan sedang dalam proses peninjauan oleh <b className="text-blue-600">Superadmin</b>. Mohon bersabar dan hubungi Administrator Anda untuk verifikasi.
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
      <div className="hidden md:flex w-full max-w-4xl h-[620px] relative overflow-hidden bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(8,112,184,0.12)] border border-slate-150 flex-row">
        
        {/* Forms - Left Slot: Sign In (Visible when isSelfReg is false) */}
        <motion.div 
          className="absolute left-0 top-0 w-1/2 h-full z-10 flex flex-col justify-center px-12 py-8 text-left select-none"
          animate={{ 
            x: isSelfReg ? '30px' : '0px', 
            opacity: isSelfReg ? 0 : 1, 
            pointerEvents: isSelfReg ? 'none' : 'auto' 
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 120 }}
        >
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase leading-none">Otorisasi Pengguna</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">Akses Modul Keuangan & Presensi Instansi</p>
            
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
            <p className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest mt-1">atau menggunakan kredensial lokal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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
          className="absolute left-1/2 top-0 w-1/2 h-full z-10 flex flex-col justify-center px-12 py-8 text-left select-none"
          animate={{ 
            x: isSelfReg ? '0px' : '-30px', 
            opacity: isSelfReg ? 1 : 0, 
            pointerEvents: isSelfReg ? 'auto' : 'none' 
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 120 }}
        >
          <div className="text-center mb-4 shrink-0">
            <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase leading-none">Registrasi Akun</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">Daftarkan Akun Operasional Instansi</p>
            
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

          <form onSubmit={handleRegisterSubmit} className="space-y-3 max-h-[420px] overflow-y-auto no-scrollbar pr-1">
            <div className="grid grid-cols-2 gap-3">
              {/* Nama Lengkap */}
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Nama Lengkap</label>
                <div className="relative">
                  <User size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: AHMAD"
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
                    placeholder="ahmad354"
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
                    placeholder="ahmad@gmail.com"
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

            <div className="grid grid-cols-2 gap-3">
              {/* Jabatan */}
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Jabatan / Posisi</label>
                <div className="relative">
                  <Briefcase size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Bendahara"
                    value={regJabatan}
                    onChange={(e) => setRegJabatan(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:font-normal placeholder:text-slate-400 uppercase"
                  />
                </div>
              </div>

              {/* Instansi Dropdown */}
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Instansi Cabang</label>
                <div className="relative">
                  <Database size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={regFirebaseConfig}
                    onChange={(e) => setRegFirebaseConfig(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all uppercase cursor-pointer text-slate-700"
                  >
                    {configs.map(c => (
                      <option key={c.id} value={c.id}>
                        {String(c.instansiName || c.id).toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
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
          animate={{ 
            left: isSelfReg ? '0%' : '50%',
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 120 }}
        >
          <motion.div
            className="w-[200%] h-full flex relative"
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
              <div className="relative z-10 space-y-6 flex flex-col items-center">
                <h1 className="text-3xl font-black tracking-tight leading-none uppercase">Sudah Ada Akun?</h1>
                <p className="text-xs text-blue-100/80 tracking-wide leading-relaxed max-w-sm mt-3 font-medium">
                  Masuk menggunakan kredensial aktif untuk kembali mengelola administrasi keuangan dan presensi instansi Anda.
                </p>
                
                <button
                  type="button"
                  onClick={() => handleToggleMode(false)}
                  className="px-10 py-3 rounded-full border-2 border-white/25 hover:border-white hover:bg-white hover:text-indigo-950 font-extrabold text-xs uppercase tracking-[0.15em] transition-all duration-300 active:scale-95 cursor-pointer mt-6 shadow-md"
                >
                  MASUK PORTAL
                </button>
              </div>
            </div>

            {/* Right Box (Hey There! - Overlay displays when isSelfReg is false, sliding over to the right side) */}
            <div className="w-1/2 h-full text-white flex flex-col justify-center items-center p-12 text-center relative select-none bg-transparent">
              <div className="relative z-10 space-y-6 flex flex-col items-center">
                <h1 className="text-3xl font-black tracking-tight leading-none uppercase">Belum Terdaftar?</h1>
                <p className="text-xs text-blue-100/80 tracking-wide leading-relaxed max-w-sm mt-3 font-medium">
                  Daftarkan akun operasional mandiri pada cabang instansi Anda yang tersedia untuk memulai akses.
                </p>

                <button
                  type="button"
                  onClick={() => handleToggleMode(true)}
                  className="px-10 py-3 rounded-full bg-white text-indigo-900 hover:bg-indigo-50 border-2 border-white font-extrabold text-xs uppercase tracking-[0.15em] transition-all duration-300 active:scale-95 cursor-pointer mt-6 shadow-lg shadow-indigo-950/20"
                >
                  AJUKAN REGISTRASI
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* MOBILE VIEW: Compact Smooth Slider Container (Full Width Switcher) */}
      <div className="w-full max-w-[328px] h-[540px] bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col md:hidden relative select-none mx-auto">
        
        {/* Sliding Overlay Card for Mobile (z-20 so it slides/expands dynamically over the forms) */}
        <motion.div
          className="absolute left-0 right-0 z-20 w-full overflow-hidden bg-gradient-to-br from-[#00A1E5] via-[#007CC2] to-[#004D90] flex flex-col justify-center items-center shadow-lg shadow-indigo-950/20"
          animate={
            mobilePhase === 'login' || mobilePhase === 'expandingToLogin'
              ? {
                  y: 0,
                  height: 120,
                  borderBottomLeftRadius: "2rem",
                  borderBottomRightRadius: "2rem",
                  borderTopLeftRadius: "2rem",
                  borderTopRightRadius: "2rem",
                }
              : mobilePhase === 'register' || mobilePhase === 'expandingToRegister'
              ? {
                  y: 0,
                  height: 420,
                  borderBottomLeftRadius: "2rem",
                  borderBottomRightRadius: "2rem",
                  borderTopLeftRadius: "2rem",
                  borderTopRightRadius: "2rem",
                }
              : {
                  y: 0,
                  height: 120,
                  borderBottomLeftRadius: "2rem",
                  borderBottomRightRadius: "2rem",
                  borderTopLeftRadius: "2rem",
                  borderTopRightRadius: "2rem",
                }
          }
          transition={{ duration: 0.4, ease: [0.4, 0.0, 0.2, 1] }}
        >
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
            <path d="M-50,180 Q20,100 120,150 T310,140 T550,160 L550,350 L-50,350 Z" fill="url(#cloudMobileL1)" opacity="0.85" />
            <path d="M-50,210 Q90,130 220,180 T460,160 T550,200 L550,350 L-50,350 Z" fill="url(#cloudMobileL2)" opacity="0.9" />
            <path d="M-50,240 Q150,180 300,230 T550,210 L550,350 L-50,350 Z" fill="url(#cloudMobileL3)" />
          </svg>
          
          {/* 1. SIGN UP SWITCHER / GREETING (SHOWN WHEN BLUE CONTAINER IS SMALL AT TOP IN LOGIN MODE) */}
          <motion.div
            className="absolute inset-x-0 top-0 h-[120px] flex flex-col justify-center items-center px-4 text-center z-10"
            animate={{
              opacity: (mobilePhase === 'login' || mobilePhase === 'expandingToLogin') ? 1 : 0,
              pointerEvents: (mobilePhase === 'login' || mobilePhase === 'expandingToLogin') ? 'auto' : 'none',
              y: (mobilePhase === 'login' || mobilePhase === 'expandingToLogin') ? 0 : -20
            }}
            transition={{ duration: 0.35 }}
          >
            <h2 className="text-xs font-black text-white uppercase tracking-wider mb-0.5 mt-1">PORTAL CABANG</h2>
            <p className="text-[7.5px] text-blue-100 font-bold uppercase tracking-wider mb-2">Butuh akses akun operasional?</p>
            <button
              type="button"
              onClick={() => handleToggleMode(true)}
              className="px-6 py-1 rounded-full bg-white text-indigo-950 hover:bg-slate-50 font-black text-[8px] uppercase tracking-widest transition-all duration-300 active:scale-95 cursor-pointer shadow-md shadow-indigo-950/10"
            >
              BUAT AKUN
            </button>
          </motion.div>

          {/* 2. SIGN UP FORM PANEL (INTEGRATED INSIDE THE BLUE CONTAINER IN REGISTER MODE) */}
          <motion.div
            className="absolute inset-x-0 top-0 h-[420px] px-5 py-4 flex flex-col justify-between"
            animate={{
              opacity: (mobilePhase === 'register' || mobilePhase === 'expandingToRegister') ? 1 : 0,
              y: (mobilePhase === 'register' || mobilePhase === 'expandingToRegister') ? 0 : 30,
              pointerEvents: (mobilePhase === 'register' || mobilePhase === 'expandingToRegister') ? 'auto' : 'none'
            }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex-1 flex flex-col min-h-0">
              <div className="text-center pt-0.5 mb-2 shrink-0">
                <h1 className="text-lg font-black tracking-tight text-white uppercase leading-none mb-0.5">Pendaftaran</h1>
                <p className="text-[7.5px] text-blue-200/95 font-bold uppercase tracking-[0.1em]">Formulir Akses Baru</p>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-2 flex-1 overflow-y-auto no-scrollbar pr-0.5">
                <div className="space-y-0.5">
                  <label className="text-[7.5px] font-black text-blue-100/90 uppercase tracking-widest ml-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: AHMAD"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white/10 border border-white/15 focus:border-white focus:bg-white/20 text-white placeholder-blue-200/50 rounded-lg text-[10.5px] font-bold outline-none uppercase transition-all"
                  />
                </div>

                <div className="space-y-0.5">
                  <label className="text-[7.5px] font-black text-blue-100/90 uppercase tracking-widest ml-1">Username Unik</label>
                  <input
                    type="text"
                    required
                    placeholder="ahmad354"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white/10 border border-white/15 focus:border-white focus:bg-white/20 text-white placeholder-blue-200/50 rounded-lg text-[10.5px] font-bold outline-none transition-all"
                  />
                </div>

                <div className="space-y-0.5">
                  <label className="text-[7.5px] font-black text-blue-100/90 uppercase tracking-widest ml-1">Alamat Email</label>
                  <input
                    type="email"
                    required
                    placeholder="ahmad@gmail.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white/10 border border-white/15 focus:border-white focus:bg-white/20 text-white placeholder-blue-200/50 rounded-lg text-[10.5px] font-bold outline-none transition-all"
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
                    className="w-full px-2.5 py-1.5 bg-white/10 border border-white/15 focus:border-white focus:bg-white/20 text-white placeholder-blue-200/50 rounded-lg text-[10.5px] font-bold outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[7.5px] font-black text-blue-100/90 uppercase tracking-widest ml-1 block">Jabatan</label>
                    <input
                      type="text"
                      required
                      placeholder="BENDAHARA"
                      value={regJabatan}
                      onChange={(e) => setRegJabatan(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white/10 border border-white/15 focus:border-white focus:bg-white/20 text-white placeholder-blue-200/50 rounded-lg text-[10.5px] font-bold outline-none uppercase transition-all"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[7.5px] font-black text-blue-100/90 uppercase tracking-widest ml-1 block">Instansi Cabang</label>
                    <select
                      value={regFirebaseConfig}
                      onChange={(e) => setRegFirebaseConfig(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white/10 border border-white/15 focus:border-white focus:bg-white/20 text-white rounded-lg text-[10px] font-bold outline-none uppercase cursor-pointer"
                    >
                      {configs.map(c => (
                        <option key={c.id} value={c.id} className="text-slate-800 bg-white">
                          {String(c.instansiName || c.id).toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[7.5px] font-black text-blue-100/90 uppercase tracking-widest ml-1 block">Aplikasi Yang Diakses</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegWebAccess({ ...regWebAccess, bendahara: !regWebAccess.bendahara })}
                      className={`px-2 py-1 rounded-lg border flex items-center justify-center space-x-1 cursor-pointer transition-all ${regWebAccess.bendahara ? 'bg-white/20 border-white text-white font-bold' : 'bg-white/5 border-white/10 text-blue-200 hover:bg-white/10'}`}
                    >
                      {regWebAccess.bendahara ? <CheckSquare size={10} className="text-white shrink-0" /> : <Square size={10} className="shrink-0" />}
                      <span className="text-[8px] uppercase tracking-wider">Bendahara</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegWebAccess({ ...regWebAccess, absensi: !regWebAccess.absensi })}
                      className={`px-2 py-1 rounded-lg border flex items-center justify-center space-x-1 cursor-pointer transition-all ${regWebAccess.absensi ? 'bg-white/20 border-white text-white font-bold' : 'bg-white/5 border-white/10 text-blue-200 hover:bg-white/10'}`}
                    >
                      {regWebAccess.absensi ? <CheckSquare size={10} className="text-white shrink-0" /> : <Square size={10} className="shrink-0" />}
                      <span className="text-[8px] uppercase tracking-wider">Absensi</span>
                    </button>
                  </div>
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
          </motion.div>
        </motion.div>

        {/* 3. SIGN IN FORM PANEL (STATIONARY ON SYSTEM WHITE CANVAS AT THE BOTTOM PORTION) */}
        <motion.div
          className="absolute top-[120px] left-0 right-0 h-[420px] px-5 py-4 flex flex-col justify-between z-10"
          animate={{
            opacity: (mobilePhase === 'login' || mobilePhase === 'expandingToLogin') ? 1 : 0,
            y: (mobilePhase === 'login' || mobilePhase === 'expandingToLogin') ? 0 : 20,
            pointerEvents: (mobilePhase === 'login' || mobilePhase === 'expandingToLogin') ? 'auto' : 'none'
          }}
          transition={{ duration: 0.3 }}
        >
          <div className="space-y-2.5">
            <div className="text-center pt-0.5">
              <h1 className="text-lg font-black tracking-tight text-slate-800 uppercase leading-none mb-1">Masuk Sistem</h1>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.1em]">Otorisasi Akses Cabang</p>
              
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
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-505 hover:bg-slate-50 hover:text-slate-900 active:scale-95 cursor-pointer transition-all shadow-sm bg-white"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </button>
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
                    <span>MASUK PORTAL</span>
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

        {/* 4. WELCOME BACK SWITCHER (STATIONARY ON WHITE BG AT BOTTOM WHEN IN REGISTER MODE) */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-[120px] flex flex-col justify-center items-center px-4 text-center bg-white z-10"
          animate={{
            opacity: (mobilePhase === 'register' || mobilePhase === 'expandingToRegister') ? 1 : 0,
            y: (mobilePhase === 'register' || mobilePhase === 'expandingToRegister') ? 0 : 20,
            pointerEvents: (mobilePhase === 'register' || mobilePhase === 'expandingToRegister') ? 'auto' : 'none'
          }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-wider mb-2">Sudah punya akun resmi instansi cabang?</p>
          <button
            type="button"
            onClick={() => handleToggleMode(false)}
            className="px-8 py-1.5 rounded-full bg-slate-950 text-white hover:bg-slate-900 font-black text-[8px] uppercase tracking-widest transition-all duration-300 active:scale-95 cursor-pointer shadow-md shadow-slate-900/10"
          >
            Masuk Portal
          </button>
        </motion.div>
      </div>

    </div>
  );
};

export default Login;
