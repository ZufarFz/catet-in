import React, { useState, useEffect } from 'react';
import { 
  Layers, Lock, User, Eye, EyeOff, Loader2, ArrowRight, XCircle, 
  RefreshCw, CheckCircle, HelpCircle, Mail, Database, CheckSquare, Square,
  Briefcase
} from 'lucide-react';
import { auth, dbGetUserDoc, centralDb } from '../../firebase';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';

interface LoginProps {
  portalUrl: string;
  onLoginSuccess: (data: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  // Self-Registration States for Google User
  const [isRegistering, setIsRegistering] = useState(false);
  const [pendingRegUser, setPendingRegUser] = useState<any>(null);
  const [regFullName, setRegFullName] = useState('');
  const [regJabatan, setRegJabatan] = useState('');
  const [regWebAccess, setRegWebAccess] = useState({ bendahara: true, absensi: true });
  const [regFirebaseConfig, setRegFirebaseConfig] = useState('');
  const [configs, setConfigs] = useState<any[]>([]);
  
  // Custom Flow States
  const [isRegisteredCompleted, setIsRegisteredCompleted] = useState(false);
  const [isPendingUser, setIsPendingUser] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [isDomainError, setIsDomainError] = useState(false);

  // Load available Firebase Config databases for the dropdown
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const qSnap = await getDocs(collection(centralDb, 'instansi'));
        const list: any[] = [];
        qSnap.forEach(d => {
          const data = d.data();
          list.push({
            id: d.id,
            instansiName: data.instansiName || data.instansi || d.id,
            ...data
          });
        });
        setConfigs(list);
        if (list.length > 0) {
          setRegFirebaseConfig(list[0].id);
        }
      } catch (err) {
        console.error("Gagal memuat list instansi:", err);
      }
    };
    loadConfigs();
  }, []);

  const cleanBrowserCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    setError('Memori sesi dibersihkan. Silakan login ulang.');
    setTimeout(() => setError(''), 2000);
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError('');
    setIsPendingUser(false);
    setIsRegistering(false);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      if (!user.email) {
        throw new Error("Sesi Google tidak memberikan informasi email.");
      }

      // Check if user is already registered under their UID in centralDb
      let userDoc: any = await dbGetUserDoc(user.uid);

      // Check using email as document ID fallback
      if (!userDoc) {
        try {
          const emailDocRef = doc(centralDb, 'users', user.email.toLowerCase().trim());
          const emailSnap = await getDoc(emailDocRef);
          if (emailSnap.exists()) {
            userDoc = emailSnap.data();
            // sync Google UID
            await setDoc(doc(centralDb, 'users', user.uid), userDoc);
          }
        } catch (emailErr) {
          console.warn("Mail lookup failure skipped:", emailErr);
        }
      }

      // Query email from users collection fallback
      if (!userDoc) {
        try {
          const { query, where, getDocs, collection } = await import('firebase/firestore');
          const q = query(collection(centralDb, 'users'), where('email', '==', user.email.toLowerCase().trim()));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            userDoc = querySnap.docs[0].data();
            await setDoc(doc(centralDb, 'users', user.uid), userDoc);
          }
        } catch (queryErr) {
          console.warn("Query mail search failure skipped:", queryErr);
        }
      }

      // If registered but still Pending, show Pending status page
      if (userDoc) {
        const roleStr = String(userDoc.role || '').toLowerCase();
        const statusStr = String(userDoc.status || '').toLowerCase();
        if (roleStr === 'pending' || statusStr === 'pending') {
          setPendingEmail(user.email);
          setIsPendingUser(true);
          await auth.signOut();
          return;
        }

        // Proceed to load operational config and log them in
        let firebaseConfigMap = null;
        let instansiName = 'Unknown';

        const instansiIdForDb = userDoc.instansi || userDoc.firebase_config;
        if (instansiIdForDb) {
          if (typeof instansiIdForDb === 'string') {
            try {
              const configDocRef = doc(centralDb, 'instansi', instansiIdForDb);
              let configSnap = await getDoc(configDocRef);
              if (!configSnap.exists()) {
                // fallback to legacy firebase_config collection if needed
                const fallbackRef = doc(centralDb, 'firebase_config', instansiIdForDb);
                configSnap = await getDoc(fallbackRef);
              }
              if (configSnap.exists()) {
                const configData = configSnap.data();
                instansiName = configData.instansiName || configData.instansi || configSnap.id;
                firebaseConfigMap = {
                  apiKey: configData.apiKey || '',
                  appId: configData.appId || '',
                  authDomain: configData.authDomain || '',
                  messagingSenderId: configData.messagingSenderId || '',
                  projectId: configData.projectId || '',
                  storageBucket: configData.storageBucket || '',
                  firestoreDatabaseId: configData.firestoreDatabaseId || ''
                };
              }
            } catch (configErr) {
              console.error("Gagal mengambil konfigurasi database instansi:", configErr);
            }
          } else if (typeof instansiIdForDb === 'object') {
            firebaseConfigMap = instansiIdForDb;
            instansiName = userDoc.instansi_name || userDoc.instansi || 'Unknown';
          }
        }

        const serverRole = String(userDoc.role || 'Viewer').trim();
        const webAccess = String(userDoc.web_access || 'bendahara,absensi').toLowerCase();

        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', user.email);
        localStorage.setItem('full_name', userDoc.full_name || user.displayName || user.email || 'User Google');
        localStorage.setItem('role', serverRole);
        localStorage.setItem('original_role', userDoc.original_role || '');
        localStorage.setItem('instansi', instansiName);
        localStorage.setItem('web_access', webAccess);

        localStorage.setItem('activeScriptUrl', 'native');
        localStorage.setItem('absensiMasterUrl', 'native');
        localStorage.setItem('absensiLogUrl', 'native');

        const resolvedUserDoc = {
          ...userDoc,
          firebase_config: firebaseConfigMap,
          instansi: instansiName
        };

        if (firebaseConfigMap) {
          localStorage.setItem('instansi_db_config', JSON.stringify(firebaseConfigMap));
          try {
            console.log("Starting Google silent login for tenant app...");
            const { getAuthForConfig } = await import('../../firebase');
            const tenantAuth = getAuthForConfig(firebaseConfigMap);
            const credential = GoogleAuthProvider.credentialFromResult(userCredential);
            if (credential) {
              await signInWithCredential(tenantAuth, credential);
              console.log("Google silent login for tenant successful!");
            } else {
              console.warn("Could not retrieve Google credential from result.");
            }
          } catch (tenantGoogleErr) {
            console.warn("Google tenant silent login failed:", tenantGoogleErr);
          }
        } else {
          localStorage.removeItem('instansi_db_config');
        }

        onLoginSuccess(resolvedUserDoc);
      } else {
        // NOT REGISTERED: Direct to modern Registration form instead of auto-Viewer
        setPendingRegUser({
          uid: user.uid,
          email: user.email.toLowerCase().trim(),
          displayName: user.displayName || ''
        });
        setRegFullName(user.displayName || '');
        setRegJabatan('');
        setIsRegistering(true);
        // Keep the authenticated session active so that the Firestore security rule for create allows writing to 'users' collection.
        // We will sign out after registration is completed or reset.
      }
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      let errorMsg = 'Gagal masuk dengan Google.';
      if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        setIsDomainError(true);
        errorMsg = 'Error Autentikasi Google: Domain aplikasi Anda belum diizinkan oleh proyek Firebase.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMsg = 'Proses login dibatalkan karena jendela popup ditutup.';
      } else if (err.code === 'auth/popup-blocked') {
        errorMsg = 'Popup login diblokir oleh browser Anda.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingRegUser) return;
    if (!regFullName.trim()) {
      setError("Nama Lengkap wajib diisi!");
      return;
    }
    if (!regJabatan.trim()) {
      setError("Jabatan wajib diisi!");
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const webAccessArray: string[] = [];
      if (regWebAccess.bendahara) webAccessArray.push('bendahara');
      if (regWebAccess.absensi) webAccessArray.push('absensi');
      const webAccessStr = webAccessArray.join(',');

      if (webAccessArray.length === 0) {
        setError("Pilih minimal satu aplikasi web!");
        setIsLoading(false);
        return;
      }

      // Save as role 'Pending' and status 'Pending' to require Superadmin approval
      const newRequestUser = {
        email: pendingRegUser.email.toLowerCase().trim(),
        full_name: regFullName.trim(),
        role: 'Pending',
        original_role: regJabatan.trim(),
        status: 'Pending',
        instansi: regFirebaseConfig || null, // Point directly to the document in instansi collection
        web_access: webAccessStr,
        created_at: new Date().toISOString()
      };

      await setDoc(doc(centralDb, 'users', pendingRegUser.uid), newRequestUser);
      
      // Securely sign out now that the user creation is written successfully and awaiting admin approval
      await auth.signOut();
      
      // Complete registration process
      setPendingEmail(pendingRegUser.email);
      setIsRegisteredCompleted(true);
      setIsRegistering(false);
    } catch (err: any) {
      console.error("Self Registration failed:", err);
      setError("Pendaftaran gagal: " + (err.message || String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setIsPendingUser(false);

    const cleanUser = username.trim().toLowerCase();

    try {
      let emailToAuth = cleanUser;
      let directUserDoc: any = null;

      // Map "superadmin" username to firebase auth email representation
      if (cleanUser === 'superadmin') {
        emailToAuth = 'superadmin@catetin.com';
      }

      // Check if it is a username instead, search in central Users to get email mapping
      if (!cleanUser.includes('@') && cleanUser !== 'superadmin') {
        try {
          const usernameDocRef = doc(centralDb, 'users', cleanUser.toLowerCase().trim());
          const usernameSnap = await getDoc(usernameDocRef);
          if (usernameSnap.exists()) {
            directUserDoc = usernameSnap.data();
            if (directUserDoc?.email) {
              emailToAuth = directUserDoc.email;
            }
          }
        } catch (resolveErr) {
          console.warn("Failed lookup map to email:", resolveErr);
        }
      }

      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, emailToAuth, password);
      } catch (authErr: any) {
        // Automatically create the superadmin Auth user under Firebase Auth if it doesn't exist on first boot
        if (cleanUser === 'superadmin' && password === 'superadmin354' && 
            (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential')) {
          console.log("Programming superadmin credentials in Firebase Authentication...");
          try {
            userCredential = await createUserWithEmailAndPassword(auth, 'superadmin@catetin.com', 'superadmin354');
          } catch (createErr) {
            console.error("Failed to create superadmin Auth account:", createErr);
            throw authErr;
          }
        } else {
          throw authErr;
        }
      }

      const user = userCredential.user;
      
      let userDoc: any = directUserDoc || await dbGetUserDoc(user.uid);

      if (!userDoc && (cleanUser === 'superadmin' || emailToAuth === 'superadmin@catetin.com')) {
        // Initialize superadmin record in Firestore to link with this Firebase Auth UID
        const superData = {
          email: 'superadmin@catetin.com',
          full_name: 'Super Admin Portal',
          role: 'Superadmin',
          original_role: 'Superadmin',
          instansi: 'Catet-In (Master)',
          web_access: 'bendahara,absensi',
          created_at: new Date().toISOString()
        };
        await setDoc(doc(centralDb, 'users', user.uid), superData);
        await setDoc(doc(centralDb, 'users', 'superadmin'), superData);
        userDoc = superData;
      }

      // Sync UID to Firestore document if fetched via query
      if (!userDoc) {
        try {
          const emailDocRef = doc(centralDb, 'users', user.email?.toLowerCase().trim() || '');
          const emailSnap = await getDoc(emailDocRef);
          if (emailSnap.exists()) {
            userDoc = emailSnap.data();
            await setDoc(doc(centralDb, 'users', user.uid), userDoc);
          }
        } catch (emailErr) {
          console.warn("Email doc lookup failure in login:", emailErr);
        }
      }

      if (!userDoc) {
        try {
          const q = query(collection(centralDb, 'users'), where('email', '==', user.email?.toLowerCase().trim() || ''));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            userDoc = querySnap.docs[0].data();
            await setDoc(doc(centralDb, 'users', user.uid), userDoc);
          }
        } catch (queryErr) {
          console.warn("Email query search failure in login:", queryErr);
        }
      }

      if (userDoc) {
        const roleStr = String(userDoc.role || '').toLowerCase();
        const statusStr = String(userDoc.status || '').toLowerCase();
        if (roleStr === 'pending' || statusStr === 'pending') {
          setPendingEmail(user.email || cleanUser);
          setIsPendingUser(true);
          await auth.signOut();
          setIsLoading(false);
          return;
        }

        let firebaseConfigMap = null;
        let instansiName = 'Unknown';

        const instansiIdForDb = userDoc.instansi || userDoc.firebase_config;
        if (instansiIdForDb) {
          if (typeof instansiIdForDb === 'string') {
            try {
              const configDocRef = doc(centralDb, 'instansi', instansiIdForDb);
              let configSnap = await getDoc(configDocRef);
              if (!configSnap.exists()) {
                // fallback to legacy firebase_config collection if needed
                const fallbackRef = doc(centralDb, 'firebase_config', instansiIdForDb);
                configSnap = await getDoc(fallbackRef);
              }
              if (configSnap.exists()) {
                const configData = configSnap.data();
                instansiName = configData.instansiName || configData.instansi || configSnap.id;
                firebaseConfigMap = {
                  apiKey: configData.apiKey || '',
                  appId: configData.appId || '',
                  authDomain: configData.authDomain || '',
                  messagingSenderId: configData.messagingSenderId || '',
                  projectId: configData.projectId || '',
                  storageBucket: configData.storageBucket || '',
                  firestoreDatabaseId: configData.firestoreDatabaseId || ''
                };
              }
            } catch (configErr) {
              console.error("Gagal memuat konfigurasi database instansi:", configErr);
            }
          } else if (typeof instansiIdForDb === 'object') {
            firebaseConfigMap = instansiIdForDb;
            instansiName = userDoc.instansi_name || userDoc.instansi || 'Unknown';
          }
        }

        const serverRole = String(userDoc.role || 'Viewer').trim();
        const webAccess = String(userDoc.web_access || 'bendahara,absensi').toLowerCase();
        
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', user.email || cleanUser);
        localStorage.setItem('full_name', userDoc.full_name || userDoc.username || user.email || 'User');
        localStorage.setItem('role', serverRole);
        localStorage.setItem('original_role', userDoc.original_role || '');
        localStorage.setItem('instansi', instansiName);
        localStorage.setItem('web_access', webAccess);
        
        localStorage.setItem('activeScriptUrl', 'native');
        localStorage.setItem('absensiMasterUrl', 'native');
        localStorage.setItem('absensiLogUrl', 'native');

        const resolvedUserDoc = {
          ...userDoc,
          firebase_config: firebaseConfigMap,
          instansi: instansiName
        };

        if (firebaseConfigMap) {
          localStorage.setItem('instansi_db_config', JSON.stringify(firebaseConfigMap));
          try {
            console.log("Starting silent login for tenant database...");
            const { getAuthForConfig } = await import('../../firebase');
            const tenantAuth = getAuthForConfig(firebaseConfigMap);
            await signInWithEmailAndPassword(tenantAuth, emailToAuth, password);
            console.log("Tenant silent login successful!");
          } catch (tenantErr) {
            console.warn("Tenant silent login failed. Please ensure the user credentials exist in the Operational Database's Authentication module:", tenantErr);
          }
        } else {
          localStorage.removeItem('instansi_db_config');
        }

        onLoginSuccess(resolvedUserDoc);
      } else {
        setError('Data profil tidak ditemukan di database utama.');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      let errorMsg = 'Email atau Password salah atau tidak terdaftar.';
      if (err.code === 'auth/invalid-credential') {
        errorMsg = 'Email atau Password salah.';
      } else if (err.code === 'auth/user-not-found') {
        errorMsg = 'User tidak ditemukan.';
      } else if (err.code === 'auth/wrong-password') {
        errorMsg = 'Password salah.';
      }
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  const resetAllFlows = () => {
    // Ensure the temporary session is signed out if the user cancels
    auth.signOut().catch(err => console.warn("Sign out during reset skipped:", err));
    setIsRegistering(false);
    setPendingRegUser(null);
    setRegJabatan('');
    setIsRegisteredCompleted(false);
    setIsPendingUser(false);
    setIsDomainError(false);
    setError('');
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

  // --- RENDER SCREEN: 2. GOOGLE REGISTRATION SUBMISSION FORM ---
  if (isRegistering && pendingRegUser) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-4 sm:p-6 z-[500]">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-gradient-to-br from-blue-700 to-indigo-800 p-5 text-white flex flex-col items-center text-center space-y-2 shrink-0">
            <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-md border border-white/20">
              <Layers className="w-6 h-6 text-blue-200" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-md sm:text-lg font-black tracking-tight uppercase leading-none">Pengajuan Akses Akun</h2>
              <p className="text-blue-200 text-[8px] uppercase font-black tracking-widest leading-none mt-1">Lengkapi data Anda di bawah ini</p>
            </div>
          </div>

          <form onSubmit={handleRegisterSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[70vh] no-scrollbar">
            
            {/* Email (Read only) */}
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Google Terdaftar</label>
              <div className="bg-slate-100 border border-slate-150 px-4 py-3 rounded-xl text-xs font-bold text-slate-500 flex items-center space-x-2">
                <Mail size={12} className="text-slate-400 shrink-0" />
                <span className="truncate uppercase">{pendingRegUser.email}</span>
              </div>
            </div>

            {/* Nama Lengkap */}
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap Anda</label>
              <div className="relative">
                <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Masukkan nama lengkap Anda"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:font-normal uppercase"
                />
              </div>
            </div>

            {/* Jabatan Anda (Ketik Manual) */}
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Jabatan / Posisi Anda (Ketik Manual)</label>
              <div className="relative">
                <Briefcase size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bendahara Umum, Ketua Cabang, dll."
                  value={regJabatan}
                  onChange={(e) => setRegJabatan(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:font-normal uppercase"
                />
              </div>
            </div>

            {/* Instansi Dropdown fetched from firebase_configs */}
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Instansi / Yayasan</label>
              <div className="relative">
                <Database size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={regFirebaseConfig}
                  onChange={(e) => setRegFirebaseConfig(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all uppercase cursor-pointer"
                >
                  {configs.map(c => (
                    <option key={c.id} value={c.id}>
                      {String(c.instansiName || c.instansi || c.id).toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Web Access Checklist App Choices */}
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Aplikasi Yang Ingin Diakses</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRegWebAccess({ ...regWebAccess, bendahara: !regWebAccess.bendahara })}
                  className={`p-3 rounded-xl border flex items-center space-x-2 cursor-pointer transition-all ${regWebAccess.bendahara ? 'bg-blue-500/10 border-blue-400 text-blue-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400 font-normal'}`}
                >
                  {regWebAccess.bendahara ? <CheckSquare size={14} className="text-blue-600 shrink-0" /> : <Square size={14} className="shrink-0" />}
                  <span className="text-[9px] uppercase tracking-wider">Bendahara</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRegWebAccess({ ...regWebAccess, absensi: !regWebAccess.absensi })}
                  className={`p-3 rounded-xl border flex items-center space-x-2 cursor-pointer transition-all ${regWebAccess.absensi ? 'bg-blue-500/10 border-blue-400 text-blue-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400 font-normal'}`}
                >
                  {regWebAccess.absensi ? <CheckSquare size={14} className="text-blue-600 shrink-0" /> : <Square size={14} className="shrink-0" />}
                  <span className="text-[9px] uppercase tracking-wider">Absensi</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-600 p-3 rounded-xl flex items-start space-x-2.5 border border-rose-100 animate-in slide-in-from-top-1 text-left">
                <XCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span className="text-[9px] font-black uppercase tracking-tight leading-normal whitespace-pre-line">{error}</span>
              </div>
            )}

            <div className="space-y-2 pt-2 shrink-0">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <span>Ajukan Pendaftaran</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={resetAllFlows}
                className="w-full text-slate-400 hover:text-slate-600 py-2.5 text-[8.5px] font-black uppercase tracking-widest text-center cursor-pointer transition-all"
              >
                Batal & Kembali
              </button>
            </div>

          </form>
        </div>
      </div>
    );
  }

  // --- RENDER SCREEN: 3. DEFAULT LOGIN PORTAL ---
  return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-4 sm:p-6 z-[500]">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-gradient-to-br from-blue-700 to-indigo-800 p-6 sm:p-8 text-white flex flex-col items-center text-center space-y-3 sm:space-y-4">
          <div className="bg-white/10 p-3.5 sm:p-4 rounded-2xl backdrop-blur-md shadow-inner border border-white/20">
            <Layers className="w-8 h-8 sm:w-9 sm:h-9 text-blue-200" strokeWidth={2.5} />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg sm:text-2xl font-black tracking-tight uppercase leading-tight">CATET-IN</h1>
            <p className="text-blue-200 text-[10px] uppercase font-black tracking-widest leading-none">
              Portal Terintegrasi
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="p-5 sm:p-6 space-y-4">
          
          {/* GOOGLE SIGN IN BUTTON */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading || isLoading}
            className="w-full flex items-center justify-center space-x-3 bg-white border border-slate-200 hover:border-blue-500 font-black text-xs text-slate-700 py-3.5 rounded-xl uppercase tracking-wider transition-all hover:shadow-md disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            {isGoogleLoading ? (
              <>
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <span>Autentikasi Google...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>MASUK DENGAN GOOGLE</span>
              </>
            )}
          </button>

          {/* DIVIDER */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-3 text-[9px] font-black text-slate-400 uppercase tracking-widest scale-95">
              Atau Sesi Email
            </span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email / Username</label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Masukkan email atau username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-transparent rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
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
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-600 p-3 rounded-xl flex items-start space-x-2.5 border border-rose-100 animate-in slide-in-from-top-1 text-left">
              <XCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span className="text-[9px] font-black uppercase tracking-tight leading-normal whitespace-pre-line">{error}</span>
            </div>
          )}

          {isDomainError && (
            <div className="bg-amber-50 border border-amber-250 p-4 rounded-xl text-left space-y-3 animate-in slide-in-from-top-1">
              <div className="flex items-center space-x-2 text-amber-800">
                <HelpCircle size={14} className="shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-tight">Otorisasi Domain Diperlukan</span>
              </div>
              <p className="text-[9.5px] text-amber-700 leading-normal font-bold uppercase">
                Firebase memerlukan domain website ini didaftarkan di Firebase Console agar Google Sign-In dapat berfungsi secara aman.
              </p>
              <div className="space-y-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Domain Saat Ini:</span>
                <div className="bg-white border border-amber-100 flex items-center justify-between p-1.5 rounded-lg font-mono text-[9px] text-slate-600 font-bold">
                  <span className="truncate pr-1 uppercase">{window.location.hostname}</span>
                  <button
                    type="button"
                    id="copy-domain-btn"
                    onClick={(e) => {
                      navigator.clipboard.writeText(window.location.hostname);
                      const btn = e.currentTarget;
                      const originalText = btn.textContent;
                      btn.textContent = 'DISALIN!';
                      btn.classList.add('bg-green-150', 'text-green-800');
                      setTimeout(() => {
                        btn.textContent = originalText;
                        btn.classList.remove('bg-green-150', 'text-green-800');
                      }, 2000);
                    }}
                    className="text-amber-700 hover:text-amber-900 text-[8px] uppercase font-black tracking-wider px-2 py-1 bg-amber-100/50 hover:bg-amber-100 rounded shrink-0 cursor-pointer transition-all"
                  >
                    salin
                  </button>
                </div>
              </div>
              <div className="text-[9px] text-amber-800 space-y-1.5 font-bold uppercase leading-relaxed">
                <div><b>Langkah Penyelesaian:</b></div>
                <ul className="list-disc pl-4 space-y-1 text-[8.5px]">
                  <li>Buka <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline hover:text-blue-800 font-black">Firebase Console</a> Anda</li>
                  <li>Pilih project Anda (<span className="text-slate-900">catetin-354</span>)</li>
                  <li>Masuk ke <b>Authentication &gt; Settings &gt; Authorized Domains</b></li>
                  <li>Klik <b>Add Domain</b> lalu masukkan domain di atas</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setIsDomainError(false)}
                className="w-full text-center text-slate-400 hover:text-slate-600 text-[8.5px] font-black uppercase tracking-wider mt-1 transition-colors"
              >
                Tutup Petunjuk
              </button>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-blue-100 hover:bg-blue-700 hover:shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:bg-slate-300 disabled:shadow-none cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifikasi...</span>
                </>
              ) : (
                <>
                  <span>MASUK SISTEM</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={cleanBrowserCache}
              className="w-full flex items-center justify-center space-x-1.5 py-1 text-[8px] font-black text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest cursor-pointer"
            >
              <RefreshCw size={10} />
              <span>Reset Sesi Portal</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
