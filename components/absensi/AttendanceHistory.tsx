
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  CalendarDays, 
  Clock, 
  FileSpreadsheet, 
  Trash2, 
  Edit2, 
  Loader2, 
  X, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Calendar,
  User,
  Info
} from 'lucide-react';
import { AttendanceLog } from '../../types';
import ModernSelect from '../ui/ModernSelect';
import { motion, AnimatePresence } from 'motion/react';
import { dbAddAttendanceLog, dbDeleteAttendanceLog } from '../../firebase';

interface AttendanceHistoryProps {
  logs: AttendanceLog[];
  isLoading: boolean;
  logUrl: string;
  onRefresh: () => void;
  notify: (msg: string, type: 'success' | 'error') => void;
}

const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({ logs, isLoading, logUrl, onRefresh, notify }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterKelompok, setFilterKelompok] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<AttendanceLog | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNote, setEditNote] = useState('');

  const handleDelete = async (id: string) => {
    setIsProcessing(id);
    try {
      await dbDeleteAttendanceLog(id);
      notify("Berhasil menghapus absensi", "success");
      onRefresh();
    } catch (e) {
      notify("Gagal menghapus", "error");
    } finally {
      setIsProcessing(null);
      setDeleteConfirmId(null);
    }
  };

  const handleUpdate = async () => {
    if (!editingLog) return;
    setIsProcessing(editingLog.id);
    try {
      const updatedRecord: AttendanceLog = {
        ...editingLog,
        status: editStatus as any,
        note: editNote
      };
      await dbAddAttendanceLog(updatedRecord);
      notify("Berhasil update data absensi", "success");
      setEditingLog(null);
      onRefresh();
    } catch (e) {
      notify("Gagal update", "error");
    } finally {
      setIsProcessing(null);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchSearch = (l.memberName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = !filterStatus || l.status === filterStatus;
      const matchKelompok = !filterKelompok || l.kelompokName === filterKelompok;
      return matchSearch && matchStatus && matchKelompok;
    });
  }, [logs, searchTerm, filterStatus, filterKelompok]);

  const uniqueKelompoks = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => { if (l.kelompokName) set.add(l.kelompokName); });
    return Array.from(set).sort();
  }, [logs]);

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '-'; }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);
      return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) { return String(dateStr); }
  };

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-4 py-8 md:p-10 pb-32 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2 rounded-xl text-white shadow-lg">
                <CalendarDays size={24} />
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase">Riwayat Absensi</h1>
            </div>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest pl-11">Arsip dan Laporan Kehadiran Anggota</p>
          </div>
          
          <button className="flex items-center gap-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-200 active:scale-95">
            <FileSpreadsheet size={18} />
            <span>Ekspor Data</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
              <input 
                type="text" 
                placeholder="Cari nama anggota..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div className="md:col-span-3">
              <ModernSelect 
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: '', label: 'SEMUA STATUS' },
                  { value: 'Hadir', label: 'HADIR' },
                  { value: 'Izin', label: 'IZIN' },
                  { value: 'Sakit', label: 'SAKIT' },
                  { value: 'Alpa', label: 'ALPA' }
                ]}
                icon={Filter}
                placeholder="STATUS"
              />
            </div>
            <div className="md:col-span-3">
              <ModernSelect 
                value={filterKelompok}
                onChange={setFilterKelompok}
                options={[
                  { value: '', label: 'SEMUA UNIT' },
                  ...uniqueKelompoks.map(name => ({ value: name, label: name.toUpperCase() }))
                ]}
                icon={Users}
                placeholder="KELOMPOK"
              />
            </div>
          </div>
        </div>

        {/* Data Container */}
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto no-scrollbar">
            {isLoading ? (
               <div className="flex flex-col items-center py-40 space-y-4">
                  <div className="w-10 h-10 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memuat Arsip...</span>
               </div>
            ) : filteredLogs.length === 0 ? (
               <div className="flex flex-col items-center py-40 text-slate-300 gap-4">
                  <Calendar size={48} className="opacity-20" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Tidak ada data ditemukan</span>
               </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 pb-2">
                    <th className="px-8 py-5">Identitas</th>
                    <th className="px-8 py-5">Unit / Kelompok</th>
                    <th className="px-8 py-5 text-center">Status</th>
                    <th className="px-8 py-5">Keterangan</th>
                    <th className="px-8 py-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${
                            log.status === 'Hadir' ? 'bg-emerald-50 text-emerald-600' :
                            log.status === 'Alpa' ? 'bg-rose-50 text-rose-600' :
                            'bg-blue-50 text-blue-600'
                          }`}>
                            <User size={18} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-tight truncate leading-none mb-1.5">{log.memberName}</h4>
                            <div className="flex items-center gap-2 opacity-60">
                              <Calendar size={10} className="text-slate-400" />
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{formatDate(log.date)}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-700 uppercase leading-none tracking-tight">{log.kelompokName}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-0">{log.desaName}</p>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase inline-block min-w-[80px] ${
                          log.status === 'Hadir' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          log.status === 'Izin' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                          log.status === 'Sakit' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="max-w-[150px] truncate">
                          {log.note ? (
                            <span className="text-[10px] font-bold text-slate-500 italic uppercase tracking-tighter">{log.note}</span>
                          ) : (
                            <span className="text-[9px] text-slate-200">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setEditingLog(log); setEditStatus(log.status); setEditNote(log.note || ''); }}
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-90"
                          >
                             <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmId(log.id)}
                            className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-90"
                          >
                             <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="px-8 py-5 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
             <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total: {filteredLogs.length} Data</span>
             <div className="flex items-center gap-3">
                <button className="p-2 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 transition-all shadow-sm active:scale-90">
                  <ChevronLeft size={16}/>
                </button>
                <div className="px-3 py-1 bg-white border border-slate-100 rounded-lg text-[10px] font-black text-slate-600">1</div>
                <button className="p-2 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 transition-all shadow-sm active:scale-90">
                  <ChevronRight size={16}/>
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingLog && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingLog(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 space-y-8"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                      <Edit2 size={24} />
                   </div>
                   <div>
                     <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Koreksi Data</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[150px]">{editingLog.memberName}</p>
                   </div>
                </div>
                <button onClick={() => setEditingLog(null)} className="text-slate-300 hover:text-slate-500">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-2">
                  {['Hadir', 'Izin', 'Sakit', 'Alpa'].map(s => (
                    <button
                      key={s}
                      onClick={() => setEditStatus(s)}
                      className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        editStatus === s ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan</label>
                   <input 
                    type="text"
                    placeholder="Alasan..."
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-[12px] font-bold outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                   />
                </div>
              </div>

              <button 
                onClick={handleUpdate}
                disabled={!!isProcessing}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl"
              >
                {isProcessing === editingLog.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                Simpan Perubahan
              </button>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmId(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-[320px] rounded-[2rem] shadow-2xl p-8 space-y-6 text-center"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                <Trash2 size={40} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Hapus Data?</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase mt-2 tracking-widest leading-loose">
                  Tindakan ini permanen dan tidak dapat dibatalkan.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={!!isProcessing}
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-700 flex items-center justify-center gap-2 shadow-lg shadow-rose-100"
                >
                  {isProcessing === deleteConfirmId ? <Loader2 className="animate-spin" size={16} /> : <span>Ya, Hapus Data</span>}
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={!!isProcessing}
                  className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AttendanceHistory;

