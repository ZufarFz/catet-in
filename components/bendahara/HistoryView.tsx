import React, { useState, useMemo, useCallback } from 'react';
import { Transaction, GlobalStats, ProjectMetadata } from '../../types';
import { Search, Trash2, Edit2, Loader2, ArrowUpRight, ArrowDownLeft, X, Save, AlertCircle, Check, CornerDownRight, ShieldCheck, Clock, CalendarDays, ChevronDown, MoreVertical, UserCheck, ShieldAlert, Activity, RefreshCw, Copy, Info, Receipt, User, Wallet, Hash, Fingerprint, Layers, Filter, Lock } from 'lucide-react';
import { dbAddTransaction, dbAddEditHistory, dbAddDeletedTransaction, dbDeleteTransaction } from '../../firebase';

interface HistoryViewProps {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setGlobalStats: React.Dispatch<React.SetStateAction<GlobalStats | null>>;
  scriptUrl: string;
  onLocalUpdate: () => void;
  onLocalDelete: () => void;
  isLoading: boolean;
  notify: (msg: string, type?: 'success' | 'error') => void;
  confirm: (title: string, msg: string, confirmText: string, onConfirm: () => Promise<void> | void, isDanger?: boolean) => void;
  currentUsername: string;
  canWrite: boolean;
  isAdmin: boolean;
  instansi: string;
  allProjects: ProjectMetadata[];
}

const HistoryView: React.FC<HistoryViewProps> = ({ 
  transactions, 
  setTransactions, 
  setGlobalStats, 
  scriptUrl, 
  onLocalUpdate, 
  onLocalDelete, 
  isLoading, 
  notify, 
  confirm, 
  currentUsername, 
  canWrite, 
  isAdmin, 
  instansi,
  allProjects 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewDetail, setViewDetail] = useState<Transaction | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'DAILY' | 'EVENT'>('ALL');

  const formatIDR = (val: number) => new Intl.NumberFormat('id-ID').format(val);

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredData = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesSearch = (t.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.formattedDate || '').includes(searchTerm) ||
          (t.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.category?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const isDaily = t.project_name?.toUpperCase() === 'KAS UMUM';
        const matchesFilter = filterType === 'ALL' || 
                             (filterType === 'DAILY' && isDaily) || 
                             (filterType === 'EVENT' && !isDaily);
        
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        // Primary Sort: Transaction Date (Newest First)
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        
        // Secondary Sort: Input Timestamp (Newest First)
        // This ensures items created on the same day are ordered by the actual time they were recorded
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
  }, [transactions, searchTerm, filterType]);

  const displayData = useMemo(() => {
    return filteredData.slice(0, visibleCount);
  }, [filteredData, visibleCount]);

  const isRowLocked = (t: Transaction) => {
    if (t.is_approve) return true;
    
    // v16.8: Deteksi transaksi sistem berdasarkan ID Prefix ST- (Transfer) atau SP- (Project)
    const isSystem = t.id.startsWith('ST-') || t.id.startsWith('SP-');
    if (isSystem) return true;
    
    const project = allProjects.find(p => p.name.toUpperCase() === t.project_name.toUpperCase());
    if (project && project.status?.toLowerCase() === 'arsip') {
      return true;
    }
    return false;
  };

  const formatTableDate = (dateStr: string, isFull: boolean = false) => {
    if (!dateStr) return '-';
    const cleanStr = dateStr.split(/[ T]/)[0];
    const parts = cleanStr.split(/[-/]/);
    if (parts.length !== 3) return dateStr;

    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthsFull = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    let day: string, monthIdx: number, year: string;
    if (parts[0].length === 4) { 
      year = parts[0]; monthIdx = parseInt(parts[1]) - 1; day = parts[2];
    } else { 
      day = parts[0]; monthIdx = parseInt(parts[1]) - 1; year = parts[2];
    }
    const dStr = String(day).padStart(2, '0');
    if (isFull) return `${dStr} ${monthsFull[monthIdx] || '??'} ${year}`;
    const mStr = monthsShort[monthIdx] || '??';
    const yStr = String(year).slice(-2);
    return `${dStr} ${mStr} ${yStr}`;
  };

  const getVersionBadge = (rawVersion: number) => {
    const vv = (Number(rawVersion) || 0) + 1;
    if (vv <= 1) return null;
    let colorClass = vv <= 3 ? "bg-blue-50 text-blue-500 border-blue-100" : vv <= 5 ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-rose-50 text-rose-500 border-rose-100";
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[7px] md:text-[8px] font-black border uppercase tracking-tighter shrink-0 transition-all ${colorClass}`}>
        v{vv}
      </span>
    );
  };

  const closeEditModal = useCallback(() => {
    setEditingId(null);
    setIsUpdating(false);
    setEditForm({});
  }, [setEditingId, setIsUpdating, setEditForm]);

  const performUpdate = useCallback(async () => {
    if (!editingId) return;
    setIsUpdating(true);
    try {
      const oldTx = transactions.find(t => t.id === editingId);
      if (oldTx) {
        const newVersion = (Number(oldTx.edit_version) || 0) + 1;
        const updatedTx: Transaction = {
          ...oldTx,
          description: editForm.description || oldTx.description,
          amount: Number(editForm.amount),
          debit: oldTx.type === 'masuk' ? Number(editForm.amount) : 0,
          credit: oldTx.type === 'keluar' ? Number(editForm.amount) : 0,
          edit_version: newVersion,
        };
        
        const historyRecord = {
          history_id: `EDT-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          transaction_id: oldTx.id,
          project_name: oldTx.project_name,
          type: oldTx.type,
          old_description: oldTx.description,
          new_description: updatedTx.description,
          old_value: oldTx.amount,
          new_value: updatedTx.amount,
          edited_at: new Date().toISOString(),
          edited_by: currentUsername,
          version_number: newVersion
        };

        await Promise.all([
          dbAddTransaction(updatedTx),
          dbAddEditHistory(historyRecord)
        ]);

        const diff = Number(editForm.amount) - Number(oldTx.amount);
        setTransactions((prev: Transaction[]) => prev.map(t => t.id === editingId ? { ...t, description: editForm.description || '', amount: Number(editForm.amount), debit: t.type === 'masuk' ? Number(editForm.amount) : 0, credit: t.type === 'keluar' ? Number(editForm.amount) : 0, edit_version: (Number(t.edit_version) || 0) + 1 } : t));
        setGlobalStats((prev: GlobalStats | null) => {
          if (!prev) return null;
          const isIncome = oldTx.type === 'masuk';
          return { ...prev, totalBalance: prev.totalBalance + (isIncome ? diff : -diff), totalIncome: isIncome ? prev.totalIncome + diff : prev.totalIncome, totalExpense: !isIncome ? prev.totalExpense + diff : prev.totalExpense };
        });
      }
      setIsUpdating(false); onLocalUpdate(); closeEditModal();
    } catch (e) { setIsUpdating(false); notify('Gagal update data.', 'error'); }
  }, [editingId, editForm, transactions, currentUsername, setTransactions, setGlobalStats, onLocalUpdate, closeEditModal, notify]);

  const handleRequestUpdate = (e: React.FormEvent) => {
    e.preventDefault(); if (!editingId || isUpdating) return;
    confirm("Simpan Perubahan?", `Anda akan memperbarui keterangan dan nominal transaksi ini. Data audit akan mencatat versi baru.`, "Ya, Simpan", performUpdate);
  };


  const confirmDelete = () => {
    if (!deleteReason.trim()) { notify('Wajib isi alasan!', 'error'); return; }
    confirm("Hapus Permanen?", "Data akan dihapus selamanya dari database kas.", "Ya, Hapus", async () => {
      try {
        const txToDelete = transactions.find(t => t.id === deletingId);
        if (txToDelete) {
          const deletedTxPayload = {
            ...txToDelete,
            delete_reason: deleteReason,
            deleted_at: new Date().toISOString(),
            delete_by: currentUsername
          };

          await Promise.all([
            dbAddDeletedTransaction(deletedTxPayload),
            dbDeleteTransaction(txToDelete.id)
          ]);

          const amt = Number(txToDelete.amount); const isIncome = txToDelete.type === 'masuk';
          setTransactions((prev: Transaction[]) => prev.filter(t => t.id !== deletingId));
          setGlobalStats((prev: GlobalStats | null) => {
            if (!prev) return null;
            return { ...prev, totalBalance: prev.totalBalance - (isIncome ? amt : -amt), totalIncome: isIncome ? prev.totalIncome - amt : prev.totalIncome, totalExpense: !isIncome ? prev.totalExpense - amt : prev.totalExpense, overallCount: prev.overallCount - 1 };
          });
        }
        notify('Berhasil dihapus', 'success'); setDeletingId(null); setDeleteReason(''); onLocalDelete();
      } catch (err) { notify('Gagal menghapus data.', 'error'); }
    }, true);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="px-4 py-4 md:px-10 md:py-6 bg-white border-b border-slate-100 shadow-sm z-30 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
          <input 
            type="text" 
            placeholder="Cari keterangan, proker, kategori..." 
            value={searchTerm} 
            onChange={(e) => { setSearchTerm(e.target.value); setVisibleCount(50); }} 
            className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-xl text-[10px] md:text-xs font-bold border-none outline-none focus:ring-1 focus:ring-blue-100 transition-all shadow-inner" 
          />
        </div>
        
        {/* Toggle Filter Tombol Terpisah dengan Animasi Geser */}
        <div className="flex gap-2 md:gap-3 items-center relative w-full max-w-[320px] md:max-w-[420px]">
          {/* Floating Slider Background */}
          <div 
            className={`absolute top-0 bottom-0 rounded-xl transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) shadow-lg ${
              filterType === 'ALL' ? 'left-0 bg-slate-900' : 
              filterType === 'DAILY' ? 'left-[calc(33.33%+0px)] bg-blue-600' : 
              'left-[calc(66.66%+0px)] bg-emerald-600'
            }`}
            style={{ width: 'calc(33.33% - 5.33px)' }}
          />
          
          <button 
            onClick={() => setFilterType('ALL')} 
            className={`flex-1 py-2.5 md:py-3 z-10 text-[8px] md:text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-500 rounded-xl border ${
              filterType === 'ALL' ? 'text-white border-transparent' : 'text-slate-400 bg-slate-50 border-slate-100 hover:text-slate-600'
            }`}
          >
            Semua
          </button>
          
          <button 
            onClick={() => setFilterType('DAILY')} 
            className={`flex-1 py-2.5 md:py-3 z-10 text-[8px] md:text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-500 rounded-xl border ${
              filterType === 'DAILY' ? 'text-white border-transparent' : 'text-slate-400 bg-slate-50 border-slate-100 hover:text-slate-600'
            }`}
          >
            Harian
          </button>
          
          <button 
            onClick={() => setFilterType('EVENT')} 
            className={`flex-1 py-2.5 md:py-3 z-10 text-[8px] md:text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-500 rounded-xl border ${
              filterType === 'EVENT' ? 'text-white border-transparent' : 'text-slate-400 bg-slate-50 border-slate-100 hover:text-slate-600'
            }`}
          >
            Event
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-50/20 px-2 md:px-10 pb-32">
        <div className="h-2 md:h-6 w-full" />
        {isLoading && displayData.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center justify-center space-y-6">
            <div className="relative"><div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" /><Clock size={40} className="relative animate-bounce text-blue-500" /></div>
            <div className="flex flex-col items-center space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Sinkronisasi Kas...</p>
              <div className="flex items-center space-x-1.5 px-3 py-1 bg-white border border-slate-100 rounded-full shadow-sm">
                <RefreshCw size={10} className="animate-spin text-blue-500" />
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Memuat Riwayat</span>
              </div>
            </div>
          </div>
        ) : displayData.length === 0 ? (
          <div className="py-24 text-center opacity-40 flex flex-col items-center"><AlertCircle size={48} className="text-slate-200 mb-2" /><p className="font-black text-[10px] md:sm uppercase tracking-widest text-slate-400">Transaksi Tidak Ditemukan</p></div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-visible">
              <table className="w-full border-separate border-spacing-0 table-fixed">
                <thead>
                  <tr className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="hidden md:table-cell sticky top-0 z-20 bg-white p-3 md:p-5 md:w-[10%] text-left border-b border-slate-100 rounded-tl-xl">ID Ref</th>
                    <th className="sticky top-0 z-20 bg-white p-3 md:p-5 w-[20%] md:w-[12%] text-left border-b border-slate-100 rounded-tl-xl md:rounded-none">Tanggal</th>
                    <th className="sticky top-0 z-20 bg-white p-3 md:p-5 w-[20%] md:w-[12%] text-left border-b border-slate-100">Kategori</th>
                    <th className="sticky top-0 z-20 bg-white p-3 md:p-5 w-[35%] md:w-[46%] text-left border-b border-slate-100">Keterangan</th>
                    <th className="sticky top-0 z-20 bg-white p-3 md:p-5 w-[25%] md:w-[20%] text-right border-b border-slate-100 rounded-tr-xl">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayData.map((t, i) => {
                    const locked = isRowLocked(t);
                    // v16.8: Deteksi transaksi sistem
                    const isSystem = t.id.startsWith('ST-') || t.id.startsWith('SP-');
                    const isEven = i % 2 === 0;
                    const isKasUmum = t.project_name?.toUpperCase() === 'KAS UMUM';
                    const project = allProjects.find(p => p.name.toUpperCase() === t.project_name.toUpperCase());
                    const isArchived = project && project.status?.toLowerCase() === 'arsip';
                    return (
                      <React.Fragment key={t.id}>
                        <tr 
                          onClick={() => setSelectedId(selectedId === t.id ? null : t.id)} 
                          className={`transition-all active:scale-[0.99] cursor-pointer ${selectedId === t.id ? 'bg-blue-100/40' : isEven ? 'bg-white' : 'bg-slate-50/40'} hover:bg-blue-50/60`}
                        >
                          <td className="hidden md:table-cell p-3 md:p-5 text-[8px] md:text-[11px] font-black text-slate-400 uppercase tracking-tighter truncate">{t.id}</td>
                          <td className="p-3 md:p-5 text-[8px] md:text-[11px] font-black text-slate-500 truncate">
                            <span className="md:hidden">{formatTableDate(t.formattedDate, false)}</span>
                            <span className="hidden md:inline">{formatTableDate(t.formattedDate, true)}</span>
                          </td>
                          <td className="p-3 md:p-5 overflow-hidden">
                             <div className="flex flex-col min-w-0">
                               <span className={`px-1 py-0.5 rounded text-[7px] md:text-[9px] font-bold tracking-tight truncate w-fit ${isKasUmum ? 'bg-blue-50 text-blue-400' : 'bg-slate-100 text-slate-500'}`}>{t.category || 'Lainnya'}</span>
                             </div>
                          </td>
                          <td className="p-3 md:p-5 overflow-hidden">
                             <div className="flex flex-col min-w-0 w-full">
                               <div className="flex items-center gap-1.5 flex-nowrap w-full overflow-hidden">
                                 {/* v16.8: Hapus 'uppercase' agar teks penutupan tampil sesuai data database */}
                                 <span className={`text-[9px] md:text-sm font-bold truncate leading-tight flex-shrink min-w-0 ${isSystem ? 'text-blue-600 font-black' : 'text-slate-800'}`}>{t.description}</span>
                                 {getVersionBadge(t.edit_version)}
                               </div>
                               {!isKasUmum && (
                                 <span className="bg-slate-900 text-white px-1 py-0.5 rounded text-[6px] md:text-[7px] font-black uppercase tracking-tighter truncate max-w-full mt-1.5 w-fit shadow-sm">{t.project_name}</span>
                               )}
                             </div>
                          </td>
                          <td className={`p-3 md:p-5 text-right text-[10px] md:text-base font-black ${t.type === 'masuk' ? 'text-emerald-500' : 'text-rose-500'}`}>{t.type === 'masuk' ? '' : '- '}{formatIDR(t.amount)}</td>
                        </tr>
                        {selectedId === t.id && (
                          <tr className="bg-blue-100/30 border-b border-blue-100">
                            <td colSpan={5} className="p-4 md:p-6 animate-in slide-in-from-top-2 duration-300">
                               <div className="flex flex-row md:flex-row justify-between items-start gap-4">
                                  <div className="flex flex-col md:grid md:grid-cols-3 lg:grid-cols-4 gap-y-3 md:gap-x-8 md:gap-y-3 flex-1 min-w-0">
                                    <div className="space-y-0.5">
                                      <span className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest block text-left">Pencatat</span>
                                      <span className="text-[9px] md:text-xs font-black text-slate-700 uppercase block text-left">{t.created_by} <span className="text-blue-500 text-[8px] italic">({t.created_by_role || '-'})</span></span>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest block text-left">Status Audit</span>
                                      <div className="flex flex-col space-y-1 items-start">
                                        {t.is_approve ? (
                                          <>
                                            <div className="flex items-center space-x-1.5 text-emerald-600">
                                              <ShieldCheck size={12} />
                                              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-tight">Terverifikasi</span>
                                            </div>
                                            <div className="pl-4 border-l border-emerald-100 space-y-0.5 mt-1 text-left">
                                               <p className="text-[7px] md:text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Oleh: @{t.approve_by} ({t.approver_role})</p>
                                               <p className="text-[7px] md:text-[8px] font-medium text-slate-400 uppercase tracking-tighter">{formatTableDate(t.approve_date, true)}</p>
                                            </div>
                                          </>
                                        ) : isArchived ? (
                                          <>
                                            <div className="flex items-center space-x-1.5 text-emerald-600">
                                              <ShieldCheck size={12} />
                                              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-tight">Terverifikasi</span>
                                            </div>
                                            <div className="pl-4 border-l border-emerald-100 space-y-0.5 mt-1 text-left">
                                               <p className="text-[7px] md:text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Oleh: @{project?.approved_by || 'Admin'} ({project?.approver_role || 'Ketua'})</p>
                                               <p className="text-[7px] md:text-[8px] font-medium text-slate-400 uppercase tracking-tighter">{formatTableDate(project?.approved_at || '', true)}</p>
                                            </div>
                                          </>
                                        ) : locked ? (
                                          <div className="flex items-center space-x-1.5 text-rose-500">
                                            {isSystem ? <ShieldCheck size={12} className="text-blue-500" /> : <Lock size={12} />}
                                            <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-tight ${isSystem ? 'text-blue-600 font-black' : 'text-rose-500'}`}>
                                              {isSystem ? 'Sistem Terkunci' : 'Proker Diarsipkan'}
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center space-x-1.5 text-amber-500">
                                            <Clock size={12} />
                                            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-tight">Antrian Audit</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="md:hidden space-y-0.5 pt-1 border-t border-blue-100/50 mt-1">
                                       <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block text-left">ID Referensi</span>
                                       <div className="flex items-center space-x-2">
                                         <span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter">#{t.id}</span>
                                         <button onClick={(e) => handleCopyId(e, t.id)} className="p-1 text-blue-500 bg-blue-100/50 rounded hover:bg-blue-200 transition-colors"><Copy size={10} /></button>
                                       </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col md:flex-row gap-1.5 md:gap-2 shrink-0 items-end md:items-start w-24 md:w-auto">
                                    <button onClick={(e) => { e.stopPropagation(); setViewDetail(t); }} className="flex items-center justify-center space-x-1.5 md:space-x-2 px-2.5 md:px-4 py-1.5 md:py-2.5 bg-slate-900 text-white rounded-lg md:rounded-xl text-[7px] md:text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all w-full md:w-fit"><Receipt size={12} className="md:size-[14px]" /><span>Detail</span></button>
                                    {canWrite && (isAdmin || !locked) && (
                                      <>
                                        <button onClick={(e) => { e.stopPropagation(); setEditingId(t.id); setEditForm(t); }} className={`flex items-center justify-center space-x-1.5 md:space-x-2 px-2.5 md:px-4 py-1.5 md:py-2.5 rounded-lg md:rounded-xl text-[7px] md:text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all w-full md:w-fit ${t.is_approve ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'}`}><Edit2 size={12} className="md:size-[14px]" /><span>Edit</span></button>
                                        <button onClick={(e) => { e.stopPropagation(); setDeletingId(t.id); setDeleteReason(''); }} className="flex items-center justify-center space-x-1.5 md:space-x-2 px-2.5 md:px-4 py-1.5 md:py-2.5 bg-rose-500 text-white rounded-lg md:rounded-xl text-[7px] md:text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all w-full md:w-fit"><Trash2 size={12} className="md:size-[14px]" /><span>Hapus</span></button>
                                      </>
                                    )}
                                  </div>
                               </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredData.length > visibleCount && (<button onClick={() => setVisibleCount(prev => prev + 100)} className="w-full py-5 md:py-6 bg-white border border-slate-100 rounded-xl flex items-center justify-center space-x-3 text-blue-600 shadow-sm active:scale-95 transition-all hover:bg-blue-50/30"><ChevronDown size={20} /><span className="text-[10px] md:sm font-black uppercase tracking-widest">Muat data lebih lama ({filteredData.length - visibleCount} data lagi)</span></button>)}
          </div>
        )}
      </div>

      {viewDetail && (() => {
        const detailProject = allProjects.find(p => p.name.toUpperCase() === viewDetail.project_name.toUpperCase());
        const isDetailArchived = detailProject && detailProject.status?.toLowerCase() === 'arsip';
        const isVerified = viewDetail.is_approve || isDetailArchived;
        const validator = viewDetail.is_approve ? viewDetail.approve_by : (detailProject?.approved_by || '');
        const validationDate = viewDetail.is_approve ? viewDetail.approve_date : (detailProject?.approved_at || '');
        const validatorRole = viewDetail.is_approve ? (viewDetail.approver_role || 'Validator') : (detailProject?.approver_role || 'Ketua');
        const isKasUmum = viewDetail.project_name?.toUpperCase() === 'KAS UMUM';

        return (
          <div className="fixed inset-0 z-[10001] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-backdrop">
            <div className="hidden md:flex bg-white w-full max-w-4xl max-h-[85vh] rounded-[3rem] shadow-2xl overflow-hidden animate-dialog-bounce border border-white mx-auto flex flex-row">
                <div className={`${viewDetail.type === 'masuk' ? 'bg-emerald-600' : 'bg-rose-600'} w-[32%] p-8 lg:p-10 text-white flex flex-col justify-between shrink-0 relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-none transform rotate-12 scale-150"><Wallet size={160} /></div>
                    <div className="space-y-8 relative z-10">
                        <div className="bg-white/20 w-16 h-16 rounded-3xl flex items-center justify-center shadow-inner"><Receipt size={32} /></div>
                        <div className="space-y-2">
                          <h2 className="text-3xl font-black uppercase tracking-widest leading-none">Kwitansi</h2>
                          <p className="text-white/70 text-sm font-bold uppercase tracking-widest">Digital Archive</p>
                        </div>
                        <div className="pt-6 border-t border-white/20 space-y-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase opacity-60 tracking-widest block">Reference ID</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black bg-black/20 px-3 py-1 rounded-lg">#{viewDetail.id}</span>
                              <button onClick={(e) => handleCopyId(e, viewDetail.id)} className="hover:scale-110 transition-transform">{copiedId === viewDetail.id ? <Check size={16} /> : <Copy size={16} />}</button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            {isKasUmum ? (
                              <span className="text-2xl font-black uppercase bg-black/20 px-3 py-2 rounded-xl block w-fit shadow-inner">KAS UMUM</span>
                            ) : (
                              <>
                                <span className="text-[10px] font-black uppercase opacity-60 tracking-widest block">Proker</span>
                                <span className="text-xs font-black uppercase bg-white/10 px-2 py-1 rounded block w-fit">{viewDetail.project_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mt-10 truncate px-2">{instansi}</div>
                </div>

                <div className="flex-1 bg-white p-8 lg:p-10 flex flex-col min-w-0">
                  <div className="flex items-center justify-between mb-6 lg:mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm"><CalendarDays size={20} className="text-slate-400" /></div>
                        <div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Waktu Transaksi</span>
                          <span className="text-base lg:text-lg font-black text-slate-800">{formatTableDate(viewDetail.formattedDate, true)}</span>
                        </div>
                    </div>
                    <button onClick={() => setViewDetail(null)} className="p-3 bg-slate-50 text-slate-400 hover:bg-slate-100 rounded-2xl transition-all"><X size={28} /></button>
                  </div>

                  <div className="grid grid-cols-1 gap-6 mb-8 overflow-y-auto no-scrollbar flex-1">
                    <div className="space-y-3 shrink-0">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center space-x-2">
                            <Layers size={14} className="text-blue-500" />
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{viewDetail.category || 'Kategori'}</span>
                          </div>
                          {getVersionBadge(viewDetail.edit_version)}
                        </div>
                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center justify-center text-center relative min-h-[80px]">
                          <p className="text-base lg:text-lg font-bold text-slate-700 leading-relaxed break-words px-4 italic">"{viewDetail.description}"</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:gap-6 shrink-0">
                        <div className="bg-slate-50 p-4 lg:p-5 rounded-[1.5rem] border border-slate-100 flex flex-col items-center justify-center space-y-1 shadow-sm">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Nominal</span>
                          <div className="flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                            <span className={`text-sm lg:text-base font-bold opacity-60 ${viewDetail.type === 'masuk' ? 'text-emerald-600' : 'text-rose-600'}`}>Rp</span>
                            <p className={`text-xl lg:text-2xl font-black ${viewDetail.type === 'masuk' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {viewDetail.type === 'masuk' ? '' : '- '}{formatIDR(viewDetail.amount)}
                            </p>
                          </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-50 flex items-start justify-between gap-4 shrink-0">
                      <div className="flex items-center gap-6 overflow-hidden">
                          <div className="flex items-center gap-2.5 shrink-0">
                            <User size={18} className="text-slate-300" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pencatat ({viewDetail.created_by_role})</span>
                              <span className="text-xs font-black text-slate-700 uppercase truncate max-w-[120px]">{viewDetail.created_by}</span>
                            </div>
                          </div>
                          <div className="w-[1px] h-8 bg-slate-100 shrink-0" />
                          <div className="flex items-center gap-2.5 shrink-0">
                            <ShieldCheck size={18} className={isVerified ? 'text-emerald-500' : 'text-amber-500'} />
                            <div className="flex flex-col min-w-0">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Status Audit ({validatorRole})</span>
                              <span className={`text-xs font-black uppercase whitespace-nowrap ${isVerified ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {isVerified ? `Verified @${validator}` : 'Pending'}
                              </span>
                              {isVerified && (
                                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                                  {formatTableDate(validationDate, true)}
                                </span>
                              )}
                            </div>
                          </div>
                      </div>
                    </div>
                  </div>
                </div>
            </div>

            <div className="md:hidden bg-white w-full max-w-[290px] max-h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden animate-dialog-bounce border border-white mx-auto flex flex-col">
                <div className={`${viewDetail.type === 'masuk' ? 'bg-emerald-600' : 'bg-rose-600'} px-5 py-4 text-white flex items-center justify-between shrink-0`}>
                  <div className="flex items-center space-x-3 min-w-0">
                      <div className="bg-white/20 p-1 rounded-lg shrink-0"><Receipt size={14} /></div>
                      <div className="min-w-0">
                        <h3 className="text-[9px] font-black uppercase tracking-widest leading-none">Review Data</h3>
                        <div className="flex items-center mt-1 space-x-1">
                            <span className="text-[7px] font-black bg-black/20 px-1 py-0.5 rounded tracking-tighter truncate max-w-[80px]">#{viewDetail.id}</span>
                        </div>
                      </div>
                  </div>
                  <button onClick={() => setViewDetail(null)} className="p-1 hover:bg-white/10 rounded-lg shrink-0"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 space-y-4">
                  <div className="py-2 border-b border-slate-100 mb-2">
                      <h4 className="text-[11px] font-black text-slate-800 text-center uppercase tracking-[0.15em] leading-tight">
                        {isKasUmum ? 'KAS UMUM' : `PROKER: ${viewDetail.project_name}`}
                      </h4>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-start shadow-sm min-w-0">
                        <div className="flex items-center space-x-1 mb-1 opacity-60">
                            <CalendarDays size={10} className="text-slate-400" />
                            <span className="text-[6px] font-black text-slate-500 uppercase tracking-widest">Waktu</span>
                        </div>
                        <span className="text-[8px] font-black text-slate-800 truncate w-full tracking-tight">{formatTableDate(viewDetail.formattedDate, true)}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-start shadow-sm min-w-0">
                        <div className="flex items-center space-x-1 mb-1 opacity-60">
                            <User size={10} className="text-slate-400" />
                            <span className="text-[6px] font-black text-slate-500 uppercase tracking-widest">Pencatat</span>
                        </div>
                        <span className="text-[8px] font-black text-slate-800 uppercase truncate w-full tracking-tight">{viewDetail.created_by}</span>
                      </div>
                  </div>

                  <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{viewDetail.category || 'Kategori'}</span>
                        {getVersionBadge(viewDetail.edit_version)}
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-700 leading-relaxed text-center italic">"{viewDetail.description}"</p>
                      </div>
                  </div>

                  <div className="space-y-3 pt-1">
                      <div className="flex flex-col items-center space-y-0.5">
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Nominal</span>
                        <p className="text-[18px] font-black">
                          {viewDetail.type === 'masuk' ? '' : '- '}Rp {formatIDR(viewDetail.amount)}
                        </p>
                      </div>

                      {isVerified ? (
                        <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50 space-y-2">
                          <div className="flex items-center space-x-2">
                            <div className="p-1 bg-emerald-600 text-white rounded-md shadow-sm">
                              <ShieldCheck size={10} />
                            </div>
                            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Status Terverifikasi</span>
                          </div>
                          <div className="pl-5 border-l border-emerald-100 space-y-0.5">
                            <p className="text-[9px] font-black text-slate-700 uppercase leading-none">@{validator}</p>
                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">
                              {validatorRole} • {formatTableDate(validationDate, true)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100/50 flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="p-1 bg-amber-500 text-white rounded-md shadow-sm">
                              <Clock size={10} />
                            </div>
                            <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Status</span>
                          </div>
                          <span className="text-[10px] font-black text-amber-600 tracking-tight uppercase">Menunggu Audit</span>
                        </div>
                      )}
                  </div>
                </div>

                <div className="px-5 pb-5 pt-1 bg-white shrink-0 mt-auto border-t border-slate-50">
                  <button onClick={() => setViewDetail(null)} className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">MENGERTI</button>
                </div>
            </div>
          </div>
        );
      })()}

      {editingId && (
        <div className="fixed inset-0 z-[10001] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white w-[calc(100%-3rem)] max-w-[320px] rounded-2xl shadow-2xl overflow-hidden animate-dialog-bounce mx-auto">
            <div className="p-6 text-white flex items-center justify-between bg-blue-600">
               <div className="flex items-center space-x-3"><div className="bg-white/20 p-2 rounded-lg"><Edit2 size={18} /></div><h3 className="font-black uppercase text-[10px] tracking-widest">Edit Transaksi</h3></div>
               {!isUpdating && <button onClick={closeEditModal}><X size={20} /></button>}
            </div>
            <div className="p-6 space-y-5">
              {editForm.is_approve && <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-start space-x-3"><ShieldAlert size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" /><p className="text-[9px] font-bold text-indigo-700 leading-tight">Warning: Mengedit data yang sudah disetujui akan memengaruhi saldo kumulatif laporan divalidasi.</p></div>}
              <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan Baru</label><input type="text" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value.replace(/[\r\n]/gm, "")})} className="w-full p-4 bg-slate-50 border-none rounded-lg text-xs font-black outline-none focus:ring-1 focus:ring-blue-500" /></div>
              <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Nominal (IDR)</label><input type="number" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: Number(e.target.value)})} className="w-full p-4 bg-slate-50 border-none rounded-lg text-xl font-black outline-none focus:ring-1 focus:ring-blue-500" /></div>
            </div>
            <div className="p-6 bg-slate-50 flex space-x-2">
              {!isUpdating && <button onClick={closeEditModal} className="flex-1 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Batal</button>}
              <button onClick={handleRequestUpdate} disabled={isUpdating} className="flex-[2] py-4 rounded-lg text-[9px] font-black text-white uppercase tracking-widest bg-blue-600 shadow-xl shadow-blue-100 transition-all active:scale-95">{isUpdating ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'SIMPAN PERUBAHAN'}</button>
            </div>
          </div>
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 z-[10001] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white w-[calc(100%-3rem)] max-w-[320px] rounded-2xl shadow-2xl overflow-hidden animate-dialog-bounce border border-white mx-auto">
            <div className="p-6 bg-rose-500 text-white flex items-center justify-between">
               <div className="flex items-center space-x-3"><div className="bg-white/20 p-2 rounded-lg"><Trash2 size={18} /></div><h3 className="text-[10px] font-black uppercase tracking-widest">Hapus Permanen</h3></div>
               <button onClick={() => setDeletingId(null)}><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex items-start space-x-3"><AlertCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" /><p className="text-[9px] font-bold text-rose-700 leading-tight">Menghapus data akan memengaruhi saldo kumulatif secara permanen. Tindakan ini akan dicatat dalam Audit Log.</p></div>
              <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Alasan Penghapusan</label><input type="text" required value={deleteReason} onChange={(e) => setDeleteReason(e.target.value.replace(/[\r\n]/gm, ""))} placeholder="Contoh: Salah input nominal..." className="w-full p-4 bg-slate-50 border-none rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-rose-200" /></div>
            </div>
            <div className="p-6 bg-slate-50 flex space-x-2">
              <button onClick={() => setDeletingId(null)} className="flex-1 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Batal</button>
              <button onClick={confirmDelete} className="flex-[2] py-4 bg-rose-500 rounded-lg text-[9px] font-black text-white uppercase tracking-widest shadow-xl shadow-rose-100 active:scale-95 transition-all">KONFIRMASI HAPUS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryView;