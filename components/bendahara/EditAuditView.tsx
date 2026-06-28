
import React, { useState, useEffect, useMemo } from 'react';
import { EditHistory } from '../../types';
import { FileEdit, User, History, Copy, Check, ShieldCheck, Clock, CalendarDays, TrendingUp, TrendingDown, ChevronRight, Inbox } from 'lucide-react';

interface EditAuditViewProps {
  editHistory: EditHistory[];
  isLoading: boolean;
  activeTab: string;
  onSelect: (log: EditHistory) => void;
  isApproved: (date: string) => boolean;
}

const EditAuditView: React.FC<EditAuditViewProps> = ({ editHistory, isLoading, activeTab, onSelect, isApproved }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const formatIDR = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num);
  };

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatIndoDate = (dateStr: string, includeTime: boolean = true) => {
    if (!dateStr) return '-';
    try {
      let d: Date;
      const parts = dateStr.split(' ');
      const dParts = parts[0].split(parts[0].includes('-') ? '-' : '/');
      const timeParts = parts[1]?.split(':') || ['0', '0'];
      if (dParts[0].length === 4) {
        d = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]), parseInt(timeParts[0]), parseInt(timeParts[1]));
      } else {
        d = new Date(parseInt(dParts[2]), parseInt(dParts[1]) - 1, parseInt(dParts[0]), parseInt(timeParts[0]), parseInt(timeParts[1]));
      }
      if (isNaN(d.getTime())) return dateStr;
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
      const dateOnly = `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
      return includeTime ? `${dateOnly}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : dateOnly;
    } catch (e) { return dateStr; }
  };

  const groupedLogs = useMemo(() => {
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    const groups: Record<string, EditHistory[]> = {};
    
    editHistory.forEach(log => {
      const dateParts = log.edited_at.split(' ')[0].split(/[-/]/);
      const year = dateParts[0].length === 4 ? parseInt(dateParts[0]) : parseInt(dateParts[2]);
      const monthIdx = parseInt(dateParts[1]) - 1;
      const key = `${months[monthIdx]} ${year}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });
    
    return groups;
  }, [editHistory]);

  const renderEditItem = (log: EditHistory, i: number) => {
    const isKasUmum = (log.project_name || "").toUpperCase() === 'KAS UMUM';
    // Hanya animasi jika periode edit sudah divalidasi/approve
    const shouldAnimate = isApproved(log.edited_at);
    
    return (
      <div key={log.id + i} className={`bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-8 items-stretch group hover:shadow-lg transition-all duration-500 ${shouldAnimate ? 'animate-list-reveal' : ''}`}>
        <div className="w-full md:w-52 shrink-0 flex flex-row md:flex-col justify-between md:justify-center border-b md:border-b-0 md:border-r border-slate-50 pb-3 md:pb-0 md:pr-8">
          <div className="space-y-1 flex-1 md:flex-none">
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">ID Transaksi / REV</span>
             <div className="flex items-center space-x-1.5">
                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[9px] font-black border border-slate-200 block truncate max-w-[120px]">
                  {log.transaction_id}
                </span>
                <span className="bg-[#007CC2] text-white px-1.5 py-0.5 rounded text-[8px] font-black">#{log.version_number}</span>
                <button onClick={(e) => handleCopyId(e, log.transaction_id)} className={`p-1.5 rounded-lg transition-all ${copiedId === log.transaction_id ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white'}`}>
                   {copiedId === log.transaction_id ? <Check size={10} /> : <Copy size={10} />}
                </button>
             </div>
          </div>
          <div className="space-y-1 flex-1 md:flex-none text-right md:text-left mt-0 md:mt-3">
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Editor & Waktu</span>
             <div className="flex flex-col space-y-0.5">
                <div className="flex items-center md:justify-start justify-end space-x-1.5 text-[#007CC2]">
                   <User size={10} />
                   <span className="text-[10px] font-black uppercase tracking-tight truncate max-w-[150px]">@{log.edited_by}</span>
                </div>
                <div className="flex items-center md:justify-start justify-end space-x-1.5 text-slate-500">
                   <Clock size={10} />
                   <span className="text-[9px] font-bold">{formatIndoDate(log.edited_at)}</span>
                </div>
             </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col space-y-3 py-1">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck size={10} className="text-slate-300" />
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Audit Keterangan</span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border ${isKasUmum ? 'bg-sky-50 text-[#007CC2] border-sky-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
              {isKasUmum ? 'KAS UMUM' : `EVENT: ${log.project_name}`}
            </span>
          </div>
          <div className="flex flex-col space-y-4">
            <div className="relative bg-rose-50/10 p-3 pt-4 rounded-xl border border-rose-100/20">
              <div className="absolute top-0 left-3 -translate-y-1/2">
                <span className="px-2 py-0.5 bg-rose-500 text-white text-[7px] font-black uppercase rounded shadow-sm">SEBELUM</span>
              </div>
              <p className="text-[10px] font-bold text-rose-400 line-through uppercase italic leading-tight">{log.old_description}</p>
            </div>
            <div className="relative bg-emerald-50/20 p-3 pt-4 rounded-xl border border-emerald-100/30">
              <div className="absolute top-0 left-3 -translate-y-1/2">
                <span className="px-2 py-0.5 bg-emerald-600 text-white text-[7px] font-black uppercase rounded shadow-sm">SESUDAH</span>
              </div>
              <p className="text-[11px] font-black text-emerald-700 uppercase leading-tight">{log.new_description}</p>
            </div>
          </div>
        </div>

        <div className="w-full md:w-60 shrink-0 flex flex-col justify-center space-y-4 border-t md:border-t-0 md:border-l border-slate-50 pt-4 md:pt-0 md:pl-8">
          <div className="flex items-center space-x-1.5">
             <div className="w-1 h-2.5 bg-[#007CC2] rounded-full"></div>
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Audit Nominal</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
             <div className="relative bg-rose-50/10 p-2.5 pt-3.5 rounded-lg border border-rose-100/10">
                <div className="absolute top-0 left-3 -translate-y-1/2">
                   <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[7px] font-black uppercase rounded shadow-sm">SEBELUM</span>
                </div>
                <p className="text-[11px] font-bold text-rose-400 line-through">Rp {formatIDR(log.old_value)}</p>
             </div>
             <div className="relative bg-emerald-50/10 p-2.5 pt-3.5 rounded-lg border border-emerald-100/20">
                <div className="absolute top-0 left-3 -translate-y-1/2">
                   <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[7px] font-black uppercase rounded shadow-sm">SESUDAH</span>
                </div>
                <p className="text-[14px] font-black text-emerald-600">Rp {formatIDR(log.new_value)}</p>
             </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      {isLoading && editHistory.length === 0 ? (
        <div className="flex-1 py-10 flex flex-col items-center justify-center space-y-6">
          <div className="relative"><div className="absolute inset-0 bg-[#007CC2]/20 rounded-full blur-xl animate-pulse" /><FileEdit size={40} className="relative animate-bounce text-[#007CC2]" /></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Memuat Log...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto no-scrollbar px-3 md:px-10 pb-40">
          <div className="pt-2">
            {editHistory.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <History className="mx-auto text-slate-100 mb-2" size={40} />
                <p className="text-slate-300 text-[8px] font-black uppercase tracking-widest">Tidak ada riwayat perubahan</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="hidden md:flex flex-col space-y-3 pt-10">
                   {(Object.entries(groupedLogs) as [string, EditHistory[]][]).map(([month, logs]) => (
                    <div key={month} className="space-y-4 pt-4 first:pt-0">
                      <div className="flex items-center space-x-4">
                         <div className="h-[1px] flex-1 bg-slate-200" />
                         <div className="flex items-center space-x-2 text-slate-400 bg-slate-100/50 px-4 py-1.5 rounded-full border border-slate-200">
                            <CalendarDays size={12} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{month}</span>
                         </div>
                         <div className="h-[1px] flex-1 bg-slate-200" />
                      </div>
                      {logs.map((log, i) => renderEditItem(log, i))}
                    </div>
                  ))}
                </div>

                <div className="md:hidden grid grid-cols-1 gap-2 pt-4">
                  {(Object.entries(groupedLogs) as [string, EditHistory[]][]).map(([month, logs]) => (
                    <div key={month} className="space-y-2 pt-4 first:pt-0">
                      <div className="px-2 pb-1"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{month}</span></div>
                      {logs.map((log, i) => {
                         const isKasUmum = (log.project_name || "").toUpperCase() === 'KAS UMUM';
                         return (
                          <button key={log.id + i} onClick={() => onSelect(log)} className={`flex items-center justify-between w-full bg-white border border-slate-100 rounded-xl px-3 py-3 active:scale-[0.98] transition-all shadow-sm ${isApproved(log.edited_at) ? 'animate-list-reveal' : ''}`}>
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${log.type === 'masuk' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                {log.type === 'masuk' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                              </div>
                              <div className="text-left min-w-0">
                                <p className="text-[10px] font-black text-slate-800 uppercase truncate leading-none">{log.new_description}</p>
                                <p className="text-[7px] font-bold text-slate-400 mt-1 uppercase tracking-tighter truncate">
                                  {isKasUmum ? 'KAS UMUM' : log.project_name} • By: {log.edited_by}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              <p className="text-[11px] font-black text-slate-800">Rp {formatIDR(log.new_value)}</p>
                            </div>
                          </button>
                         );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EditAuditView;
