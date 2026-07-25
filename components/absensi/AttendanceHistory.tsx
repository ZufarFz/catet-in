
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
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Calendar,
  User,
  Info
} from 'lucide-react';
import { AttendanceLog, EventData } from '../../types';
import ModernSelect from '../ui/ModernSelect';
import { motion, AnimatePresence } from 'motion/react';
import { dbAddAttendanceLog, dbDeleteAttendanceLog } from '../../supabase';

interface AttendanceHistoryProps {
  logs: AttendanceLog[];
  isLoading: boolean;
  logUrl: string;
  onRefresh: () => void;
  onFetchMoreLogs?: (additionalBatchSize?: number) => Promise<void>;
  notify: (msg: string, type: 'success' | 'error') => void;
  events?: EventData[];
}

const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({ logs, isLoading, logUrl, onRefresh, onFetchMoreLogs, notify, events = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterKelompok, setFilterKelompok] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [filterAgeCategory, setFilterAgeCategory] = useState('');
  const [filterDesa, setFilterDesa] = useState('');
  const [filterDaerah, setFilterDaerah] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<AttendanceLog | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNote, setEditNote] = useState('');
  const [selectedLog, setSelectedLog] = useState<AttendanceLog | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const handleNextPage = async () => {
    const nextPage = currentPage + 1;
    const requiredTotal = nextPage * itemsPerPage;
    
    if (onFetchMoreLogs && requiredTotal > logs.length) {
      setIsFetchingMore(true);
      try {
        await onFetchMoreLogs(100);
      } finally {
        setIsFetchingMore(false);
      }
    }
    setCurrentPage(nextPage);
  };

  const handleItemsPerPageChange = async (val: number) => {
    setItemsPerPage(val);
    setCurrentPage(1);
    if (onFetchMoreLogs && val > logs.length) {
      setIsFetchingMore(true);
      try {
        await onFetchMoreLogs(100);
      } finally {
        setIsFetchingMore(false);
      }
    }
  };

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
      const isKeteranganAllowed = ['Izin', 'Sakit'].includes(editStatus);
      const updatedRecord: AttendanceLog = {
        ...editingLog,
        status: editStatus as any,
        note: isKeteranganAllowed ? editNote : ''
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
    const matched = logs.filter(l => {
      const matchSearch = (l.memberName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = !filterStatus || l.status === filterStatus;
      const matchKelompok = !filterKelompok || l.kelompokName === filterKelompok;
      const matchEvent = !filterEvent || l.event_id === filterEvent;
      const matchAgeCategory = !filterAgeCategory || l.ageName === filterAgeCategory;
      const matchDesa = !filterDesa || l.desaName === filterDesa;
      const matchDaerah = !filterDaerah || l.daerahName === filterDaerah;
      return matchSearch && matchStatus && matchKelompok && matchEvent && matchAgeCategory && matchDesa && matchDaerah;
    });

    return matched.sort((a, b) => {
      const timeA = a.dateInput ? new Date(a.dateInput).getTime() : (a.date ? new Date(a.date.replace(' ', 'T')).getTime() : 0);
      const timeB = b.dateInput ? new Date(b.dateInput).getTime() : (b.date ? new Date(b.date.replace(' ', 'T')).getTime() : 0);
      return timeB - timeA;
    });
  }, [logs, searchTerm, filterStatus, filterKelompok, filterEvent, filterAgeCategory, filterDesa, filterDaerah]);

  // Paginated logs
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const uniqueKelompoks = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => { if (l.kelompokName) set.add(l.kelompokName); });
    return Array.from(set).sort();
  }, [logs]);

  const uniqueAges = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => { if (l.ageName) set.add(l.ageName); });
    return Array.from(set).sort();
  }, [logs]);

  const uniqueDesas = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => { if (l.desaName) set.add(l.desaName); });
    return Array.from(set).sort();
  }, [logs]);

  const uniqueDaerahs = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => { if (l.daerahName) set.add(l.daerahName); });
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

  // Group filtered logs by dateInput (Tanggal Input) preserving input order
  const groupedLogs = useMemo(() => {
    const groupList: { dateInputKey: string; dateInputDisplay: string; items: AttendanceLog[] }[] = [];
    const groupMap = new Map<string, AttendanceLog[]>();

    paginatedLogs.forEach(log => {
      const rawDate = log.dateInput || log.date;
      let dKey = 'no-date';
      if (rawDate) {
        try {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dKey = `${year}-${month}-${day}`;
          } else {
            dKey = String(rawDate).substring(0, 10);
          }
        } catch (e) {
          dKey = String(rawDate).substring(0, 10);
        }
      }

      if (!groupMap.has(dKey)) {
        const newItems: AttendanceLog[] = [];
        groupMap.set(dKey, newItems);
        groupList.push({
          dateInputKey: dKey,
          dateInputDisplay: rawDate || '',
          items: newItems
        });
      }
      groupMap.get(dKey)!.push(log);
    });

    return groupList;
  }, [paginatedLogs]);

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar bg-[#F8FAFC]">
      <div className="max-w-4xl mx-auto px-4 py-8 md:p-10 pb-32 space-y-8">
        
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
          
          <button className="flex items-center gap-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-200 active:scale-95">
            <FileSpreadsheet size={18} />
            <span>Ekspor Data</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          {/* Main search and toggle row */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
              <input 
                type="text" 
                placeholder="Cari nama anggota..." 
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-3 rounded-xl border font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-2 select-none active:scale-95 ${
                showFilters 
                  ? 'bg-slate-950 border-slate-950 text-white shadow-md' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter size={14} />
              <span className="hidden sm:inline">{showFilters ? 'Sembunyikan' : 'Filter'}</span>
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Compact 2-column filters grid with animation */}
          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-visible"
              >
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {/* Row 1, Filter 1: Nama Kegiatan */}
                  <div>
                    <span className="block text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Kegiatan</span>
                    <ModernSelect 
                      value={filterEvent}
                      onChange={(val) => {
                        setFilterEvent(val);
                        setCurrentPage(1);
                      }}
                      options={[
                        { value: '', label: 'SEMUA KEGIATAN' },
                        ...events.map(evt => ({ value: evt.id, label: evt.nama_kegiatan.toUpperCase() }))
                      ]}
                      icon={CalendarDays}
                      placeholder="KEGIATAN"
                    />
                  </div>

                  {/* Row 1, Filter 2: Status */}
                  <div>
                    <span className="block text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Status</span>
                    <ModernSelect 
                      value={filterStatus}
                      onChange={(val) => {
                        setFilterStatus(val);
                        setCurrentPage(1);
                      }}
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

                  {/* Row 2, Filter 1: Kategori Usia */}
                  <div>
                    <span className="block text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Kategori Usia</span>
                    <ModernSelect 
                      value={filterAgeCategory}
                      onChange={(val) => {
                        setFilterAgeCategory(val);
                        setCurrentPage(1);
                      }}
                      options={[
                        { value: '', label: 'SEMUA KATEGORI' },
                        ...uniqueAges.map(name => ({ value: name, label: name.toUpperCase() }))
                      ]}
                      icon={User}
                      placeholder="KATEGORI"
                    />
                  </div>

                  {/* Row 2, Filter 2: Kelompok */}
                  <div>
                    <span className="block text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Unit / Kelompok</span>
                    <ModernSelect 
                      value={filterKelompok}
                      onChange={(val) => {
                        setFilterKelompok(val);
                        setCurrentPage(1);
                      }}
                      options={[
                        { value: '', label: 'SEMUA UNIT' },
                        ...uniqueKelompoks.map(name => ({ value: name, label: name.toUpperCase() }))
                      ]}
                      icon={Users}
                      placeholder="KELOMPOK"
                    />
                  </div>

                  {/* Row 3, Filter 1: Desa */}
                  <div>
                    <span className="block text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Desa</span>
                    <ModernSelect 
                      value={filterDesa}
                      onChange={(val) => {
                        setFilterDesa(val);
                        setCurrentPage(1);
                      }}
                      options={[
                        { value: '', label: 'SEMUA DESA' },
                        ...uniqueDesas.map(name => ({ value: name, label: name.toUpperCase() }))
                      ]}
                      icon={Users}
                      placeholder="DESA"
                    />
                  </div>

                  {/* Row 3, Filter 2: Daerah */}
                  <div>
                    <span className="block text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Daerah</span>
                    <ModernSelect 
                      value={filterDaerah}
                      onChange={(val) => {
                        setFilterDaerah(val);
                        setCurrentPage(1);
                      }}
                      options={[
                        { value: '', label: 'SEMUA DAERAH' },
                        ...uniqueDaerahs.map(name => ({ value: name, label: name.toUpperCase() }))
                      ]}
                      icon={Users}
                      placeholder="DAERAH"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Data Container */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
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
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] md:tracking-[0.2em] border-b border-slate-100">
                    <th className="px-3 py-3.5 md:px-6 w-[58%] sm:w-[65%] md:w-[75%] whitespace-nowrap">Anggota & Kegiatan</th>
                    <th className="px-3 py-3.5 md:px-6 text-right w-[42%] sm:w-[35%] md:w-[25%] whitespace-nowrap">Status & Metode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedLogs.map((group) => (
                    <React.Fragment key={group.dateInputKey}>
                      {/* Date Group Header Row */}
                      <tr className="bg-slate-50/70 border-y border-slate-100">
                        <td colSpan={2} className="px-3 py-2.5 md:px-6">
                          <div className="flex items-center gap-2 text-slate-600">
                            <CalendarDays size={12} className="text-blue-500 shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 whitespace-nowrap">TGL INPUT: {formatDate(group.dateInputDisplay)}</span>
                          </div>
                        </td>
                      </tr>
                      {group.items.map((log) => {
                        const matchedEvent = (events || []).find(e => e.id === log.event_id);
                        const eventName = matchedEvent ? matchedEvent.nama_kegiatan : 'Umum (Default)';
                        const eventStartTime = log.jam_mulai || matchedEvent?.jam_mulai;
                        const logTimeStr = (log.date || '').split(' ')[1] || '';
                        
                        const isLate = (() => {
                          if (!eventStartTime || !logTimeStr || log.status !== 'Hadir') return false;
                          const [logH, logM] = logTimeStr.split(':').map(Number);
                          const [evtH, evtM] = (eventStartTime || '').split(':').map(Number);
                          if (isNaN(logH) || isNaN(logM) || isNaN(evtH) || isNaN(evtM)) return false;
                          return (logH * 60 + logM) > (evtH * 60 + evtM);
                        })();

                        const lateMinutes = (() => {
                          if (!isLate) return 0;
                          const [logH, logM] = logTimeStr.split(':').map(Number);
                          const [evtH, evtM] = (eventStartTime || '').split(':').map(Number);
                          return (logH * 60 + logM) - (evtH * 60 + evtM);
                        })();

                        return (
                          <tr 
                            key={log.id} 
                            onClick={() => setSelectedLog(log)}
                            className="group hover:bg-slate-50/40 active:bg-slate-100/50 transition-colors cursor-pointer"
                          >
                            {/* Column 1: Anggota & Kegiatan */}
                            <td className="px-3 py-3 md:px-6">
                              <div className="min-w-0 space-y-1">
                                {/* Baris 1: Nama Member */}
                                <h4 className="text-xs md:text-[13px] font-black text-slate-800 uppercase tracking-tight leading-tight truncate" title={log.memberName}>
                                  {log.memberName}
                                </h4>

                                {/* Baris 2: Nama Kegiatan (DD MMM YYYY) */}
                                <div className="text-[9.5px] md:text-[10.5px] font-bold uppercase tracking-tight leading-snug truncate whitespace-nowrap">
                                  <span className="text-slate-700 font-extrabold">{eventName}</span>{" "}
                                  <span className="text-blue-600 font-bold">({formatDate(log.date)})</span>
                                </div>

                                {/* Baris 3: Keterangan */}
                                {log.note && (
                                  <div>
                                    <span className="inline-block px-2 py-0.5 bg-slate-100 border border-slate-200/50 rounded text-[9px] md:text-[10px] font-medium text-slate-600 italic max-w-full truncate" title={log.note}>
                                      "{log.note}"
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Column 2: Status & Metode (Right Aligned) */}
                            <td className="px-3 py-3 md:px-6 text-right whitespace-nowrap">
                              <div className="flex flex-col items-end gap-1">
                                <span className={`px-2 py-0.5 rounded text-[8px] md:text-[9px] font-black uppercase inline-block text-center min-w-[48px] md:min-w-[65px] ${
                                  log.status === 'Hadir' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50' :
                                  log.status === 'Izin' ? 'bg-blue-50 text-blue-700 border border-blue-100/50' :
                                  log.status === 'Sakit' ? 'bg-amber-50 text-amber-700 border border-amber-100/50' :
                                  'bg-rose-50 text-rose-700 border border-rose-100/50'
                                }`}>
                                  {log.status}
                                </span>
                                <span className="text-[7.5px] md:text-[8.5px] font-extrabold text-slate-400 uppercase tracking-wider leading-none flex items-center justify-end gap-1 whitespace-nowrap">
                                  <span>{log.metode === 'rfid' ? 'RFID' : log.metode === 'scan' ? 'SCAN' : 'MANUAL'} {log.date ? `• ${formatTime(log.date)}` : ''}</span>
                                  {isLate && (
                                    <span className="text-rose-500 font-black animate-pulse bg-rose-50 border border-rose-100 px-1 rounded text-[7px] shrink-0">
                                      TELAT {lateMinutes}m
                                    </span>
                                  )}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex flex-row items-center justify-between">
             <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tampilkan:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[10px] font-black text-slate-700 text-center focus:border-blue-500 outline-none transition-all cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</span>
             </div>
             
             <div className="flex items-center gap-1">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1 || isFetchingMore}
                  className="p-1 bg-white border border-slate-200 rounded text-slate-400 hover:text-blue-600 disabled:opacity-40 disabled:hover:text-slate-400 transition-all shadow-sm active:scale-90"
                >
                   <ChevronLeft size={12}/>
                </button>
                <div className="text-[10px] font-black text-slate-600 bg-white border border-slate-100 px-2.5 py-0.5 rounded shadow-sm min-w-[24px] text-center flex items-center justify-center">
                   {isFetchingMore ? <Loader2 size={10} className="animate-spin text-blue-600" /> : currentPage}
                </div>
                <button 
                  onClick={handleNextPage}
                  disabled={isFetchingMore || (currentPage >= Math.ceil(filteredLogs.length / itemsPerPage) && !onFetchMoreLogs)}
                  className="p-1 bg-white border border-slate-200 rounded text-slate-400 hover:text-blue-600 disabled:opacity-40 disabled:hover:text-slate-400 transition-all shadow-sm active:scale-90"
                >
                   <ChevronRight size={12}/>
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-[140] flex items-start justify-center p-4 pt-12 md:pt-24 overflow-y-auto no-scrollbar">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedLog(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className={`px-6 py-5 md:px-8 flex justify-between items-start border-b transition-colors ${
                selectedLog.status === 'Hadir' ? 'bg-emerald-50 text-emerald-950 border-emerald-100' :
                selectedLog.status === 'Izin' ? 'bg-blue-50 text-blue-950 border-blue-100' :
                selectedLog.status === 'Sakit' ? 'bg-amber-50 text-amber-950 border-amber-100' :
                'bg-rose-50 text-rose-950 border-rose-100'
              }`}>
                <div className="space-y-1">
                  <span className={`text-[8.5px] font-black uppercase tracking-widest ${
                    selectedLog.status === 'Hadir' ? 'text-emerald-800' :
                    selectedLog.status === 'Izin' ? 'text-blue-800' :
                    selectedLog.status === 'Sakit' ? 'text-amber-800' :
                    'text-rose-800'
                  }`}>Detail Kehadiran</span>
                  <h3 className="text-base md:text-lg font-black uppercase tracking-tight text-slate-800 leading-tight">{selectedLog.memberName}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase leading-none border shadow-sm ${
                      selectedLog.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800 border-emerald-200/50' :
                      selectedLog.status === 'Izin' ? 'bg-blue-100 text-blue-800 border-blue-200/50' :
                      selectedLog.status === 'Sakit' ? 'bg-amber-100 text-amber-800 border-amber-200/50' :
                      'bg-rose-100 text-rose-800 border-rose-200/50'
                    }`}>
                      {selectedLog.status}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100/80 transition-colors mt-0.5">
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 md:p-6 space-y-3.5">
                <div className={`grid grid-cols-2 gap-x-2 gap-y-1.5 p-3 md:p-4 rounded-xl border text-xs tracking-tight transition-colors ${
                  selectedLog.status === 'Hadir' ? 'bg-emerald-50/10 border-emerald-100/30' :
                  selectedLog.status === 'Izin' ? 'bg-blue-50/10 border-blue-100/30' :
                  selectedLog.status === 'Sakit' ? 'bg-amber-50/10 border-amber-100/30' :
                  'bg-rose-50/10 border-rose-100/30'
                }`}>
                  <div className="col-span-2 space-y-0.5">
                    <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Kegiatan</p>
                    <p className="font-extrabold text-slate-800 uppercase tracking-tight leading-tight">
                      {(() => {
                        const matchedEvent = (events || []).find(e => e.id === selectedLog.event_id);
                        return matchedEvent ? matchedEvent.nama_kegiatan : 'Umum (Default)';
                      })()}
                    </p>
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Kategori Usia</p>
                    <p className="font-extrabold text-slate-700 uppercase tracking-tight leading-tight">{selectedLog.ageName || '—'}</p>
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Unit / Kelompok</p>
                    <p className="font-extrabold text-slate-700 uppercase tracking-tight leading-tight">{selectedLog.kelompokName || '—'}</p>
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Desa</p>
                    <p className="font-extrabold text-slate-700 uppercase tracking-tight leading-tight">{selectedLog.desaName || '—'}</p>
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Daerah</p>
                    <p className="font-extrabold text-slate-700 uppercase tracking-tight leading-tight">{selectedLog.daerahName || '—'}</p>
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Tanggal Absen</p>
                    <p className="font-extrabold text-slate-700 uppercase tracking-tight leading-tight">{formatDate(selectedLog.date)}</p>
                    <p className="text-[9px] font-extrabold text-slate-500 leading-tight mt-0.5">{formatTime(selectedLog.date)} WIB</p>
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Tanggal Input System</p>
                    <p className="font-extrabold text-slate-700 uppercase tracking-tight leading-tight">{formatDate(selectedLog.dateInput || selectedLog.date)}</p>
                    <p className="text-[9px] font-extrabold text-slate-500 leading-tight mt-0.5">{formatTime(selectedLog.dateInput || selectedLog.date)} WIB</p>
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Metode</p>
                    <p className={`font-black uppercase tracking-tight leading-none ${
                      selectedLog.metode === 'rfid' ? 'text-indigo-600' :
                      selectedLog.metode === 'scan' ? 'text-teal-600' :
                      'text-amber-600'
                    }`}>
                      {(selectedLog.metode || 'manual') === 'rfid' ? 'RFID / NFC' : (selectedLog.metode || 'manual') === 'scan' ? 'SCANNER QR' : 'MANUAL'}
                    </p>
                  </div>

                  {(() => {
                    const matchedEvent = (events || []).find(e => e.id === selectedLog.event_id);
                    const eventStartTime = selectedLog.jam_mulai || matchedEvent?.jam_mulai;
                    if (!eventStartTime) return null;

                    const logTimeStr = (selectedLog.date || '').split(' ')[1] || '';
                    const isLate = (() => {
                      if (selectedLog.status !== 'Hadir') return false;
                      const [logH, logM] = logTimeStr.split(':').map(Number);
                      const [evtH, evtM] = (eventStartTime || '').split(':').map(Number);
                      if (isNaN(logH) || isNaN(logM) || isNaN(evtH) || isNaN(evtM)) return false;
                      return (logH * 60 + logM) > (evtH * 60 + evtM);
                    })();

                    const lateMinutes = (() => {
                      if (!isLate) return 0;
                      const [logH, logM] = logTimeStr.split(':').map(Number);
                      const [evtH, evtM] = (eventStartTime || '').split(':').map(Number);
                      return (logH * 60 + logM) - (evtH * 60 + evtM);
                    })();

                    return (
                      <>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Mulai Acara</p>
                          <p className="font-extrabold text-indigo-600 uppercase tracking-tight leading-tight">{eventStartTime}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Keterlambatan</p>
                          {isLate ? (
                            <p className="font-black text-rose-600 uppercase tracking-tight leading-tight animate-pulse">
                              TELAT {lateMinutes} MENIT
                            </p>
                          ) : selectedLog.status === 'Hadir' ? (
                            <p className="font-black text-emerald-600 uppercase tracking-tight leading-tight">
                              TEPAT WAKTU
                            </p>
                          ) : (
                            <p className="font-extrabold text-slate-400 uppercase tracking-tight leading-tight">—</p>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {selectedLog.note && (
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Keterangan / Alasan</p>
                    <p className="text-xs font-bold text-slate-600 italic tracking-tight leading-normal">
                      "{selectedLog.note}"
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-2.5 pt-1">
                  {(selectedLog.metode || 'manual') === 'manual' ? (
                    <>
                      <button
                        onClick={() => {
                          setEditingLog(selectedLog);
                          setEditStatus(selectedLog.status);
                          setEditNote(selectedLog.note || '');
                          setSelectedLog(null);
                        }}
                        className="p-1.5 md:p-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm"
                        title="Ubah Status"
                      >
                        <Edit2 size={12} className="md:size-4" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirmId(selectedLog.id);
                          setSelectedLog(null);
                        }}
                        className="p-1.5 md:p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm"
                        title="Hapus"
                      >
                        <Trash2 size={12} className="md:size-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setDeleteConfirmId(selectedLog.id);
                        setSelectedLog(null);
                      }}
                      className="p-1.5 md:p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm"
                      title="Hapus"
                    >
                      <Trash2 size={12} className="md:size-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingLog && (
          <div className="fixed inset-0 z-[150] flex items-start justify-center p-4 pt-12 md:pt-24 overflow-y-auto no-scrollbar">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingLog(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8 space-y-8"
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
                {['Izin', 'Sakit'].includes(editStatus) ? (
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan</label>
                     <input 
                      type="text"
                      placeholder="Alasan..."
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-[12px] font-bold outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                     />
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/50 text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Keterangan tidak diperlukan untuk status {editStatus}</p>
                  </div>
                )}
              </div>

              <button 
                onClick={handleUpdate}
                disabled={!!isProcessing}
                className="w-full py-4 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl"
              >
                {isProcessing === editingLog.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                Simpan Perubahan
              </button>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[160] flex items-start justify-center p-4 pt-12 md:pt-24 overflow-y-auto no-scrollbar">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmId(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-[320px] rounded-2xl shadow-2xl p-8 space-y-6 text-center"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
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
                  className="w-full py-4 bg-rose-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-700 flex items-center justify-center gap-2 shadow-lg shadow-rose-100"
                >
                  {isProcessing === deleteConfirmId ? <Loader2 className="animate-spin" size={16} /> : <span>Ya, Hapus Data</span>}
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={!!isProcessing}
                  className="w-full py-4 bg-slate-50 text-slate-400 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
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

