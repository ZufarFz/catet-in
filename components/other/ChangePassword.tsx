
import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, Loader2, ArrowRight, CheckCircle2, XCircle, User } from 'lucide-react';
import { auth } from '../../firebase';
import { signInWithEmailAndPassword, updatePassword } from 'firebase/auth';

interface ChangePasswordProps {
  portalUrl: string;
  currentUsername: string;
  onLogout: () => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
  currentApp?: 'bendahara' | 'absensi';
  switchApp?: (app: 'bendahara' | 'absensi') => void;
  webAccessStrings?: string[];
}

const ChangePassword: React.FC<ChangePasswordProps> = ({ 
  currentUsername, 
  onLogout, 
  notify,
  currentApp,
  switchApp,
  webAccessStrings = []
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
      const user = auth.currentUser;
      if (!user || !user.email) {
        setError('Sesi autentikasi tidak valid. Silakan login kembali.');
        return;
      }
      // Re-autentikasi dengan sign-in menggunakan password lama
      await signInWithEmailAndPassword(auth, user.email, oldPassword);
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
      const user = auth.currentUser;
      if (!user) {
        setError('Sesi telah berakhir. Silakan login kembali.');
        return;
      }
      await updatePassword(user, newPassword);
      setIsSuccess(true);
      notify('Password Berhasil Diperbarui', 'success');
      setTimeout(() => {
        onLogout();
      }, 3000);
    } catch (err: any) {
      console.error("Update password error:", err);
      setError('Gagal mengubah password. Sesi mungkin kedaluwarsa, silakan login ulang.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 text-center space-y-4 max-w-sm animate-dialog-bounce">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-xl font-black uppercase text-slate-800 tracking-tight">Sukses!</h2>
          <p className="text-xs text-slate-400 font-bold leading-relaxed">Password Anda telah diperbarui di sistem pusat. Silakan login kembali dengan password baru Anda.</p>
          <div className="pt-4">
             <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 animate-[progress_3s_linear_forwards]" style={{width: '100%'}}></div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar p-4 md:p-10 pb-32">
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
                     className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-xl text-xs font-black text-slate-500 cursor-not-allowed outline-none"
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
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-slate-200 outline-none"
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
                     placeholder="Min. 4 karakter"
                     value={newPassword}
                     onChange={(e) => setNewPassword(e.target.value)}
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-100 outline-none"
                   />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Ulangi Password Baru</label>
                <div className="relative">
                   <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                   <input 
                     type="password" 
                     required
                     placeholder="Konfirmasi password baru"
                     value={confirmNewPassword}
                     onChange={(e) => setConfirmNewPassword(e.target.value)}
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-100 outline-none"
                   />
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center space-x-2 p-3 bg-rose-50 text-rose-500 rounded-xl animate-in fade-in">
              <XCircle size={14} className="flex-shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-tight">{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-xl flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:bg-slate-300 ${step === 'verify' ? 'bg-slate-800' : 'bg-blue-600'}`}
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : step === 'verify' ? <ShieldCheck size={18} /> : <ArrowRight size={18} />}
            <span>{isLoading ? 'MEMPROSES...' : step === 'verify' ? 'VERIFIKASI LANJUT' : 'GANTI PASSWORD SEKARANG'}</span>
          </button>

          {step === 'new' && !isLoading && (
             <button type="button" onClick={() => { setStep('verify'); setNewPassword(''); setConfirmNewPassword(''); }} className="w-full text-[9px] font-black text-slate-400 uppercase tracking-widest">Batal</button>
          )}
        </form>
      </div>

      {/* Switch Web Mobile Section */}
      {webAccessStrings.length > 1 && switchApp && currentApp && (
        <div className="md:hidden max-w-md mx-auto mt-4 bg-white rounded-3xl p-6 shadow-xl border border-slate-100 flex flex-col space-y-3">
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Navigasi Antar Web</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Pilih aplikasi yang ingin Anda buka</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => switchApp('bendahara')}
              className={`flex-1 py-3 px-4 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                currentApp === 'bendahara'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                  : 'text-slate-500 hover:bg-slate-200/50'
              }`}
            >
              <span>Bendahara</span>
            </button>
            <button
              type="button"
              onClick={() => switchApp('absensi')}
              className={`flex-1 py-3 px-4 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                currentApp === 'absensi'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                  : 'text-slate-500 hover:bg-slate-200/50'
              }`}
            >
              <span>Absensi</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChangePassword;
