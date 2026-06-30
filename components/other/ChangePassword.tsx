import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, Loader2, ArrowRight, CheckCircle2, XCircle, User } from 'lucide-react';
import { db, centralClient } from '../../supabase';

interface ChangePasswordProps {
  portalUrl: string;
  currentUsername: string;
  onLogout: () => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
  currentApp?: 'bendahara' | 'absensi';
  switchApp?: (app: 'bendahara' | 'absensi') => void;
  webAccessStrings?: string[];
  activeScriptUrl?: string;
  setActiveScriptUrl?: React.Dispatch<React.SetStateAction<string>>;
}

const ChangePassword: React.FC<ChangePasswordProps> = ({ 
  currentUsername, 
  onLogout, 
  notify,
  currentApp,
  switchApp,
  webAccessStrings = [],
}) => {
  const [step, setStep] = useState<'verify' | 'new'>('verify');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const lockedUsername = currentUsername;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const activeClient = centralClient || db;
      if (!activeClient) {
        throw new Error('Database server tidak siap atau belum dikonfigurasi.');
      }

      const { data: user, error: lookupErr } = await activeClient
        .from('users')
        .select('*')
        .or(`username.eq.${lockedUsername},email.eq.${lockedUsername}`)
        .maybeSingle();

      if (lookupErr || !user) {
        setError('Sesi autentikasi tidak valid atau akun tidak ditemukan.');
        return;
      }

      // Secure verification by attempting to sign in centrally using standard Supabase Auth
      const resolvedEmail = user.email || (lockedUsername.includes('@') ? lockedUsername : '');
      if (!resolvedEmail) {
        setError('Email Akun tidak valid. Gagal melakukan verifikasi password.');
        return;
      }

      const { error: authVerifyErr } = await activeClient.auth.signInWithPassword({
        email: resolvedEmail,
        password: oldPassword,
      });

      if (authVerifyErr) {
        setError('Password lama tidak sesuai atau gagal verifikasi.');
        return;
      }

      setStep('new');
    } catch (err: any) {
      console.error("Reauth error:", err);
      setError('Password lama tidak sesuai atau gagal verifikasi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setError('Konfirmasi password baru tidak cocok.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password baru terlalu pendek (min. 6 karakter).');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const activeClient = centralClient || db;
      if (!activeClient) {
        throw new Error('Database server tidak siap.');
      }

      // Securely update the password using Supabase Auth native API
      const { error: authUpdateErr } = await activeClient.auth.updateUser({
        password: newPassword
      });

      if (authUpdateErr) throw authUpdateErr;

      // Nullify plain-text password from the table entirely since we rely on Supabase Auth
      try {
        await activeClient
          .from('users')
          .update({ password: null })
          .or(`username.eq.${lockedUsername},email.eq.${lockedUsername}`);
      } catch (tableErr) {
        console.warn("Cleared public.users.password columns fallback skipped:", tableErr);
      }

      setIsSuccess(true);
      notify('Password Berhasil Diperbarui', 'success');
      setTimeout(() => {
        onLogout();
      }, 3000);
    } catch (err: any) {
      console.error("Update password error:", err);
      setError('Gagal mengubah password: ' + (err.message || String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-slate-50 min-h-screen">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 text-center space-y-4 max-w-sm animate-dialog-bounce">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-xl font-black uppercase text-slate-800 tracking-tight">Sukses!</h2>
          <p className="text-xs text-slate-400 font-bold leading-relaxed">Password Anda telah diperbarui di database pusat. Silakan login kembali dengan password baru Anda.</p>
          <div className="pt-4 animate-pulse">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wide">MENGORGANISIKASALAN PAGI...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar p-4 md:p-10 pb-32">
      {/* Mobile-Only App Switcher in Profile Tab */}
      {webAccessStrings.length > 1 && switchApp && currentApp && (
        <div className="max-w-md mx-auto mb-4 bg-white rounded-3xl p-4 shadow-xl border border-slate-100 md:hidden animate-in fade-in slide-in-from-top-3">
          <div className="flex flex-col space-y-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Pindah Aplikasi</span>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button 
                type="button"
                onClick={() => switchApp('bendahara')}
                className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center space-x-1.5 ${currentApp === 'bendahara' ? 'bg-[#007CC2] text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <span>💰 Bendahara</span>
              </button>
              <button 
                type="button"
                onClick={() => switchApp('absensi')}
                className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center space-x-1.5 ${currentApp === 'absensi' ? 'bg-[#007CC2] text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <span>📝 Absensi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className={`p-6 text-white flex items-center space-x-3 ${step === 'verify' ? 'bg-slate-800' : 'bg-blue-600'}`}>
           {step === 'verify' ? <ShieldCheck size={20} /> : <KeyRound size={20} />}
           <div>
              <h2 className="text-xs font-black uppercase tracking-widest">{step === 'verify' ? 'Verifikasi Identitas' : 'Atur Password Baru'}</h2>
              <p className="text-[9px] opacity-70 font-bold uppercase tracking-tight">Ganti Password Akun: {lockedUsername}</p>
           </div>
        </div>

        <form onSubmit={step === 'verify' ? handleVerify : handleUpdate} className="p-8 space-y-5">
          {step === 'verify' ? (
            <>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Akun Terdeteksi</label>
                <div className="relative">
                   <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input 
                     type="text" 
                     readOnly
                     value={lockedUsername}
                     className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-xl text-xs font-black text-slate-500 cursor-not-allowed outline-none uppercase"
                   />
                </div>
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tight ml-1">Username tidak dapat diubah</p>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Password Saat Ini</label>
                <div className="relative">
                   <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                   <input 
                     type="password" 
                     required
                     placeholder="••••••••"
                     value={oldPassword}
                     onChange={(e) => setOldPassword(e.target.value)}
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-slate-300 outline-none"
                   />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Password Baru</label>
                <div className="relative">
                   <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                   <input 
                     type="password" 
                     required
                     placeholder="MINIMAL 6 KARAKTER"
                     value={newPassword}
                     onChange={(e) => setNewPassword(e.target.value)}
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                   />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Konfirmasi Password Baru</label>
                <div className="relative">
                   <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                   <input 
                     type="password" 
                     required
                     placeholder="ULANGI PASSWORD BARU"
                     value={confirmNewPassword}
                     onChange={(e) => setConfirmNewPassword(e.target.value)}
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                   />
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="bg-rose-50 text-rose-600 p-3 rounded-xl flex items-start space-x-2.5 border border-rose-100 animate-in slide-in-from-top-1 text-left">
              <XCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span className="text-[9px] font-black uppercase tracking-tight leading-normal whitespace-pre-line">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-slate-100 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <span>{step === 'verify' ? 'Lanjut Verifikasi' : 'Perbarui Password'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
