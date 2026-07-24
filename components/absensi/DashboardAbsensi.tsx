import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalendarCheck, 
  UserCheck, 
  AlertCircle, 
  FileText,
  CalendarDays,
  Filter,
  BarChart2,
  Trophy,
  Users,
  Zap
} from 'lucide-react';
import { AttendanceLog, EventData } from '../../types';
import { dbGetEventDashboardSummary, EventDashboardSummary, dbGetRecentEvents } from '../../supabase';
import { motion } from 'motion/react';

interface DashboardAbsensiProps {
  logs: AttendanceLog[];
  isLoading: boolean;
  username: string;
  summaries?: any[];
  ages?: any[];
  daerahs?: any[];
  desas?: any[];
  kelompoks?: any[];
  events?: EventData[];
}

// Helper function to format dates as DD MMM YYYY (e.g. 24 Jul 2026)
const formatDateDDMMMYYYY = (dateInput: string | Date | undefined | null) => {
  if (!dateInput) return '-';
  try {
    let str = String(dateInput);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      str += 'T12:00:00';
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return String(dateInput);
  }
};

const DashboardAbsensi: React.FC<DashboardAbsensiProps> = ({ 
  logs = [], 
  isLoading, 
  username,
  events = []
}) => {
  // 1. Detect Top 5 Most Recently Updated Events
  const [fetchedEvents, setFetchedEvents] = useState<EventData[]>([]);

  useEffect(() => {
    if (events && events.length > 0) {
      setFetchedEvents(events);
    } else {
      dbGetRecentEvents(5).then(res => {
        if (res && res.length > 0) setFetchedEvents(res);
      });
    }
  }, [events]);

  const recentEvents = useMemo(() => {
    const sorted = [...(fetchedEvents || [])].sort((a, b) => {
      const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });
    return sorted.slice(0, 5);
  }, [fetchedEvents]);

  // 2. Selected Event state (Defaults to the 1st most recently updated event)
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  // Auto-set default selected event when recentEvents loads/changes
  const activeEventId = useMemo(() => {
    if (selectedEventId && recentEvents.some(e => e.id === selectedEventId)) {
      return selectedEventId;
    }
    return recentEvents[0]?.id || '';
  }, [selectedEventId, recentEvents]);

  const activeEvent = useMemo(() => {
    return (fetchedEvents || []).find(e => e.id === activeEventId) || recentEvents[0] || null;
  }, [fetchedEvents, activeEventId, recentEvents]);

  // 3. Server-side Aggregated Summary State (STRICT FUNCTION REQUIREMENT, NO BACKUP/FALLBACK)
  const [dbSummary, setDbSummary] = useState<EventDashboardSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeEventId) {
      setDbSummary(null);
      setSummaryError(null);
      return;
    }
    let isMounted = true;
    setIsSummaryLoading(true);
    setSummaryError(null);

    dbGetEventDashboardSummary(activeEventId)
      .then(res => {
        if (isMounted) {
          setDbSummary(res);
          setIsSummaryLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error("Error fetching event dashboard summary via RPC:", err);
          setSummaryError(err?.message || 'Gagal memanggil Supabase Function get_event_dashboard_summary.');
          setDbSummary(null);
          setIsSummaryLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, [activeEventId]);

  // Combined Active Meeting Stats directly from dbSummary
  const meetingStats = useMemo(() => {
    return dbSummary?.meetingStats || [];
  }, [dbSummary]);

  // Combined Active 3-Meetings Summary directly from dbSummary
  const event3MeetingsSummary = useMemo(() => {
    if (dbSummary?.overall) {
      return dbSummary.overall;
    }
    return {
      totalLogs: 0,
      totalHadir: 0,
      totalIzin: 0,
      totalSakit: 0,
      totalAlpa: 0,
      presenceRate: 0,
      meetingCount: 0
    };
  }, [dbSummary]);

  // 5. Category filter for Top 5 members ('hadir' | 'izin' | 'alpa' | 'terlambat')
  const [topCategory, setTopCategory] = useState<'hadir' | 'izin' | 'alpa' | 'terlambat'>('hadir');

  // Active Top 5 Members List directly from dbSummary
  const top5Members = useMemo(() => {
    if (!dbSummary) return [];

    if (topCategory === 'hadir') {
      return (dbSummary.top5Hadir || []).map(m => ({
        memberId: m.memberId,
        memberName: m.memberName,
        kelompokName: m.kelompokName,
        hadirCount: m.count,
        izinCount: m.izinCount || 0,
        sakitCount: 0,
        alpaCount: 0,
        lateCount: 0,
        totalMinutes: 0,
        formattedLate: '',
        totalMeetings: m.totalMeetings,
        pct: m.pct
      }));
    }
    if (topCategory === 'izin') {
      return (dbSummary.top5Izin || []).map(m => ({
        memberId: m.memberId,
        memberName: m.memberName,
        kelompokName: m.kelompokName,
        hadirCount: 0,
        izinCount: m.izinCount,
        sakitCount: m.sakitCount,
        alpaCount: 0,
        lateCount: 0,
        totalMinutes: 0,
        formattedLate: '',
        totalMeetings: m.totalMeetings,
        pct: 0
      }));
    }
    if (topCategory === 'alpa') {
      return (dbSummary.top5Alpa || []).map(m => ({
        memberId: m.memberId,
        memberName: m.memberName,
        kelompokName: m.kelompokName,
        hadirCount: 0,
        izinCount: 0,
        sakitCount: 0,
        alpaCount: m.count,
        lateCount: 0,
        totalMinutes: 0,
        formattedLate: '',
        totalMeetings: m.totalMeetings,
        pct: m.pct
      }));
    }
    if (topCategory === 'terlambat') {
      return (dbSummary.top5Terlambat || []).map(m => ({
        memberId: m.memberId,
        memberName: m.memberName,
        kelompokName: m.kelompokName,
        hadirCount: 0,
        izinCount: 0,
        sakitCount: 0,
        alpaCount: 0,
        lateCount: m.count,
        totalMinutes: m.totalMinutes,
        formattedLate: m.formattedLate,
        totalMeetings: m.totalMeetings,
        pct: 0
      }));
    }
    return [];
  }, [dbSummary, topCategory]);

  // Summary cards setup (3 Containers: HADIR, IZIN / SAKIT, ALPA)
  const totalLogsCount = event3MeetingsSummary.totalLogs;
  const summaryCards = [
    {
      title: 'HADIR',
      icon: UserCheck,
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      total: event3MeetingsSummary.totalHadir,
      percentage: `${event3MeetingsSummary.presenceRate}%`,
      pctColor: 'text-emerald-600',
      transparentPctColor: 'text-emerald-300',
    },
    {
      title: 'IZIN / SAKIT',
      icon: CalendarCheck,
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-100',
      total: event3MeetingsSummary.totalIzin + event3MeetingsSummary.totalSakit,
      percentage: `${totalLogsCount > 0 ? Math.round(((event3MeetingsSummary.totalIzin + event3MeetingsSummary.totalSakit) / totalLogsCount) * 100) : 0}%`,
      pctColor: 'text-amber-600',
      transparentPctColor: 'text-amber-300',
    },
    {
      title: 'ALPA',
      icon: AlertCircle,
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-100',
      total: event3MeetingsSummary.totalAlpa,
      percentage: `${totalLogsCount > 0 ? Math.round((event3MeetingsSummary.totalAlpa / totalLogsCount) * 100) : 0}%`,
      pctColor: 'text-rose-600',
      transparentPctColor: 'text-rose-300',
    },
  ];

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 pb-32 space-y-6 sm:space-y-8">
        
        {/* Welcome Block & Quick Header - Exact Treasury Saldo Card Style */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#00A1E5] via-[#007CC2] to-[#004D90] p-5 sm:p-7 md:p-8 rounded-2xl sm:rounded-3xl shadow-xl text-white group">
          {/* WAVE & CELESTIAL BACKGROUND PATTERN (Unified Theme) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
            {/* STARLIGHTS & METEORS */}
            <svg className="absolute inset-0 w-full h-full opacity-35" viewBox="0 0 500 200" preserveAspectRatio="none" fill="none">
              <defs>
                <linearGradient id="dashAbsensiMeteorGrad" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle cx="45" cy="35" r="1.5" fill="#ffffff" opacity="0.8" />
              <circle cx="120" cy="65" r="1" fill="#ffffff" opacity="0.55" />
              <circle cx="160" cy="25" r="1.8" fill="#ffffff" opacity="0.9" />
              <circle cx="210" cy="55" r="1.2" fill="#ffffff" opacity="0.4" />
              <circle cx="270" cy="85" r="1.5" fill="#ffffff" opacity="0.75" />
              <circle cx="340" cy="45" r="1" fill="#ffffff" opacity="0.6" />
              <circle cx="390" cy="75" r="1.6" fill="#ffffff" opacity="0.85" />
              <circle cx="450" cy="35" r="1.2" fill="#ffffff" opacity="0.5" />
              <circle cx="480" cy="95" r="1.8" fill="#ffffff" opacity="0.8" />
              
              <line x1="90" y1="15" x2="40" y2="55" stroke="url(#dashAbsensiMeteorGrad)" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="260" y1="20" x2="210" y2="60" stroke="url(#dashAbsensiMeteorGrad)" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="420" y1="25" x2="370" y2="65" stroke="url(#dashAbsensiMeteorGrad)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>

            {/* OVERLAPPING CLOUDS & WAVES FLOW */}
            <svg className="absolute bottom-0 left-0 w-full h-[60%] opacity-20" viewBox="0 0 500 150" preserveAspectRatio="none" fill="none">
              <defs>
                <linearGradient id="dashAbsensiCloudL1" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00AEEF" />
                  <stop offset="100%" stopColor="#0054A6" />
                </linearGradient>
                <linearGradient id="dashAbsensiCloudL2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#009EE2" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#004D8C" />
                </linearGradient>
                <linearGradient id="dashAbsensiCloudL3" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0072BC" />
                  <stop offset="100%" stopColor="#003580" />
                </linearGradient>
              </defs>
              <path d="M-50,75 Q100,25 240,65 T550,55 L550,150 L-50,150 Z" fill="url(#dashAbsensiCloudL1)" opacity="0.8" />
              <path d="M-50,95 Q130,50 280,85 T550,70 L550,150 L-50,150 Z" fill="url(#dashAbsensiCloudL2)" opacity="0.85" />
              <path d="M-50,110 Q160,75 320,105 T550,85 L550,150 L-50,150 Z" fill="url(#dashAbsensiCloudL3)" />
            </svg>
          </div>

          {/* Subtle Background Watermark Icon */}
          <UserCheck className="absolute right-4 sm:right-8 top-8 text-white/10 w-28 h-28 sm:w-36 sm:h-36 pointer-events-none stroke-[1.2] group-hover:scale-110 transition-transform duration-500 z-10" />

          {/* Top Row: Pill Badge & Current Month */}
          <div className="flex items-center justify-between gap-4 relative z-20">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 border border-white/20 backdrop-blur-md text-[10px] sm:text-xs font-black tracking-wider uppercase text-white shadow-xs">
              <Zap size={13} className="text-amber-300 fill-amber-300" />
              <span>DASHBOARD ABSENSI</span>
            </div>
            <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-sky-100/90">
              {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase()}
            </span>
          </div>

          {/* Middle Row: Enlarged Welcome Greeting */}
          <div className="mt-4 sm:mt-6 relative z-20">
            <span className="text-[10px] sm:text-xs font-bold text-sky-200 uppercase tracking-widest">
              PANEL UTAMA ABSENSI
            </span>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mt-1">
              Selamat Datang, {username}
            </h1>
          </div>

          {/* Divider Line */}
          <div className="border-t border-white/20 my-4 sm:my-6 relative z-20" />

          {/* Bottom Row: 3 Summary Cards Matrix (HADIR, IZIN/SAKIT, ALPA) - Transparent Glass Style */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 relative z-20">
            {summaryCards.map((card, idx) => (
              <div 
                key={idx}
                className="bg-white/10 hover:bg-white/15 backdrop-blur-md text-white rounded-xl sm:rounded-2xl border border-white/20 overflow-hidden flex flex-col justify-between transition-all shadow-sm"
              >
                {/* Card Header */}
                <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-white/10 border-b border-white/15 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg border border-white/20 bg-white/20 text-white">
                      <card.icon size={14} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      {card.title}
                    </h3>
                  </div>
                  <span className="text-[8px] sm:text-[9px] font-extrabold text-sky-100/80 uppercase tracking-widest">
                    RINGKASAN 5 PERTEMUAN
                  </span>
                </div>

                {/* Card Body: Split TOTAL & PERSENTASE */}
                <div className="grid grid-cols-2 divide-x divide-white/15 text-center p-3 sm:p-4 bg-transparent">
                  {/* Total */}
                  <div className="flex flex-col justify-center items-center px-1">
                    <span className="text-[9px] font-black text-sky-100/80 uppercase tracking-widest mb-0.5">
                      TOTAL
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {isSummaryLoading ? '...' : card.total}
                    </span>
                  </div>

                  {/* Percentage */}
                  <div className="flex flex-col justify-center items-center px-1">
                    <span className="text-[9px] font-black text-sky-100/80 uppercase tracking-widest mb-0.5">
                      PERSENTASE
                    </span>
                    <span className={`text-xl sm:text-2xl font-black tracking-tight ${card.transparentPctColor}`}>
                      {isSummaryLoading ? '...' : card.percentage}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Most Recent Events Dropdown Filter Header */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 shrink-0">
              <CalendarDays size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 uppercase tracking-wider">
                  5 Event Update Terakhir
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight mt-0.5">
                Pilih Kegiatan Rutin
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter size={14} className="text-slate-400 shrink-0" />
            <select
              value={activeEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full md:w-[320px] bg-slate-50 border border-slate-200 text-xs font-black uppercase text-slate-800 rounded-xl px-3 py-2.5 shadow-sm focus:border-rose-500 focus:bg-white focus:outline-none transition-all cursor-pointer truncate"
            >
              {recentEvents.length === 0 ? (
                <option value="">Belum Ada Kegiatan Terdaftar</option>
              ) : (
                recentEvents.map((evt, idx) => {
                  const updateDateStr = evt.updated_at || evt.created_at;
                  const dateLabel = updateDateStr 
                    ? formatDateDDMMMYYYY(updateDateStr)
                    : '';
                  return (
                    <option key={evt.id} value={evt.id}>
                      {idx + 1}. {evt.nama_kegiatan.toUpperCase()} {dateLabel ? `(${dateLabel})` : ''}
                    </option>
                  );
                })
              )}
            </select>
          </div>
        </div>

        {/* Error Alert when Supabase RPC Function fails */}
        {summaryError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 text-rose-900 shadow-sm">
            <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-rose-800">
                Gagal Memanggil Function Agregasi Supabase
              </h3>
              <p className="text-xs text-rose-700 font-medium">
                {summaryError}
              </p>
              <p className="text-[10px] text-rose-600 font-semibold mt-1">
                Pastikan Anda telah menjalankan script SQL Stored Procedure <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">get_event_dashboard_summary</code> pada SQL Editor di Supabase Dashboard.
              </p>
            </div>
          </div>
        )}

        {/* Chart Panel: 5 Pertemuan Terakhir (Full Width) */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BarChart2 className="text-rose-600 shrink-0" size={16} />
                <h3 className="text-[10px] sm:text-[11px] font-black text-slate-800 uppercase tracking-wider">
                  Grafik 5 Pertemuan Terakhir
                </h3>
              </div>
              <p className="text-[9px] font-medium text-slate-400">
                {activeEvent ? `Evaluasi keaktifan presensi untuk kegiatan "${activeEvent.nama_kegiatan.toUpperCase()}"` : 'Pilih kegiatan untuk melihat grafik'}
              </p>
            </div>

            {activeEvent && (
              <div className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-[9px] font-black uppercase tracking-wider self-start sm:self-auto">
                {meetingStats.length} Pertemuan Terdata
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6">
            {meetingStats.length === 0 ? (
              <div className="py-12 border border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center px-4 bg-slate-50/50">
                <FileText className="text-slate-300 mb-2" size={24} />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Tidak Ada Data Presensi
                </p>
                <p className="text-[8px] text-slate-300 uppercase tracking-wide mt-1">
                  Silakan lakukan presensi untuk kegiatan ini agar grafik dapat ditampilkan.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                {/* Left Side: Compact 2-Line Cards List (Stacked vertically) */}
                <div className="lg:col-span-5 flex flex-col gap-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5 block">
                    Riwayat Pertemuan ({meetingStats.length})
                  </span>
                  {meetingStats.map((m) => (
                    <div 
                      key={m.dateStr} 
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-100 transition-colors flex flex-col gap-0.5"
                    >
                      {/* Baris 1: Pertemuan, Tanggal & % Hadir */}
                      <div className="flex items-center justify-between text-[10px] font-black uppercase">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-800 tracking-tight font-black">
                            P{m.meetingNumber}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">
                            📅 {formatDateDDMMMYYYY(m.dateStr || m.dateFormatted)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-black text-emerald-600">{m.pct}%</span>
                          <span className="text-[9px] font-semibold text-slate-500">
                            ({m.hadir}/{m.total})
                          </span>
                        </div>
                      </div>

                      {/* Baris 2: Detail status Izin, Sakit, Alpa terpisah */}
                      <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 border-t border-slate-200/50 pt-0.5 mt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-600">Izin: {m.izin}</span>
                          <span className="text-sky-600">Sakit: {m.sakit}</span>
                        </div>
                        <span className="text-rose-500 font-extrabold">Alpa: {m.alpa}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right Side: Trend SVG Chart */}
                <div className="lg:col-span-7 flex flex-col space-y-2">
                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider block">
                    Bagan Tren Persentase Kehadiran (% Hadir)
                  </span>

                  <div className="relative w-full overflow-hidden bg-slate-50/60 border border-slate-100 rounded-2xl p-3 sm:p-4">
                    <svg 
                      viewBox="0 0 500 200" 
                      className="w-full h-auto max-h-[220px] overflow-visible"
                    >
                      {/* Grid Lines */}
                      {[0, 25, 50, 75, 100].map((val) => {
                        const y = 15 + ((100 - val) / 100) * 147;
                        return (
                          <g key={val}>
                            <line 
                              x1={35} 
                              y1={y} 
                              x2={485} 
                              y2={y} 
                              stroke="#E2E8F0" 
                              strokeWidth="0.75"
                            />
                            <text 
                              x={28} 
                              y={y + 3.5} 
                              fill="#64748B" 
                              fontSize="9" 
                              fontWeight="800"
                              textAnchor="end"
                              className="font-mono"
                            >
                              {val}%
                            </text>
                          </g>
                        );
                      })}

                      {/* Chart Line & Area */}
                      {(() => {
                        const pts = meetingStats.map((pt, index) => {
                          const len = meetingStats.length;
                          const x = len === 1 ? 260 : 60 + (index / (len - 1)) * (460 - 60);
                          const y = 15 + ((100 - pt.pct) / 100) * (200 - 15 - 38);
                          return { x, y, ...pt };
                        });

                        const pathStr = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                        const bottomY = 200 - 38;
                        const fillPathStr = pts.length > 0 
                          ? `M ${pts[0].x} ${bottomY} L ${pts.map(p => `${p.x} ${p.y}`).join(' L ')} L ${pts[pts.length - 1].x} ${bottomY} Z`
                          : '';

                        return (
                          <>
                            <defs>
                              <linearGradient id="eventGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#E11D48" stopOpacity="0.15" />
                                <stop offset="100%" stopColor="#E11D48" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {fillPathStr && (
                              <path 
                                d={fillPathStr} 
                                fill="url(#eventGradient)" 
                              />
                            )}

                            {pathStr && (
                              <path 
                                d={pathStr} 
                                fill="none" 
                                stroke="#E11D48" 
                                strokeWidth="2.5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                              />
                            )}

                            {pts.map((p, idx) => (
                              <g key={idx}>
                                <circle 
                                  cx={p.x} 
                                  cy={p.y} 
                                  r="2.5" 
                                  fill="#FFFFFF" 
                                  stroke="#E11D48" 
                                  strokeWidth="1.5"
                                />
                                <text 
                                  x={p.x} 
                                  y={p.y - 8} 
                                  fill="#9F1239" 
                                  fontSize="9" 
                                  fontWeight="900"
                                  textAnchor="middle"
                                  className="font-mono font-black"
                                >
                                  {p.pct}%
                                </text>
                                <text 
                                  x={p.x} 
                                  y={200 - 12} 
                                  fill="#0F172A" 
                                  fontSize="8.5" 
                                  fontWeight="800"
                                  textAnchor="middle"
                                  className="uppercase tracking-wider font-sans"
                                >
                                  P{p.meetingNumber} ({formatDateDDMMMYYYY(p.dateStr || p.dateFormatted)})
                                </text>
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top 5 Members Attendance Section (3 Pertemuan Terakhir) */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-50/50 via-white to-white">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shrink-0">
                <Trophy size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  Top 5 {topCategory === 'hadir' ? 'Hadir' : topCategory === 'izin' ? 'Izin / Sakit' : topCategory === 'alpa' ? 'Alpa' : 'Terlambat'}
                  <span className="text-[10px] text-slate-400 font-normal">
                    {activeEvent ? `(${activeEvent.nama_kegiatan.toUpperCase()})` : ''}
                  </span>
                </h3>
                <p className="text-[9px] font-medium text-slate-400">
                  Peringkat berdasarkan 5 pertemuan terakhir
                </p>
              </div>
            </div>

            {/* Category Toggle Pills */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start sm:self-auto shrink-0 select-none">
              <button
                type="button"
                onClick={() => setTopCategory('hadir')}
                className={`py-1 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  topCategory === 'hadir'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Hadir
              </button>
              <button
                type="button"
                onClick={() => setTopCategory('izin')}
                className={`py-1 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  topCategory === 'izin'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Izin
              </button>
              <button
                type="button"
                onClick={() => setTopCategory('alpa')}
                className={`py-1 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  topCategory === 'alpa'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Alpa
              </button>
              <button
                type="button"
                onClick={() => setTopCategory('terlambat')}
                className={`py-1 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  topCategory === 'terlambat'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Terlambat
              </button>
            </div>
          </div>

          <div className="flex-1">
            {isLoading ? (
               <div className="flex flex-col items-center py-12 gap-2">
                  <div className="w-8 h-8 border-3 border-slate-100 border-t-amber-500 rounded-full animate-spin" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Menyelaraskan Data Top 5...</span>
               </div>
            ) : top5Members.length === 0 ? (
               <div className="flex flex-col items-center py-12 text-slate-400 gap-2">
                  <FileText size={32} className="opacity-20" />
                  <span className="font-bold uppercase text-[9px] tracking-widest">
                    Belum ada data member {topCategory} dalam 5 pertemuan terakhir
                  </span>
               </div>
            ) : (
              <>
                {/* Desktop View Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[8px] sm:text-[9px] font-black text-[#94A3B8] uppercase tracking-wider border-b border-slate-50 bg-slate-50/50">
                        <th className="px-5 py-3 text-center w-16">Peringkat</th>
                        <th className="px-5 py-3">Nama Anggota</th>
                        <th className="px-5 py-3">Kelompok</th>
                        <th className="px-5 py-3 text-center">
                          {topCategory === 'hadir' ? 'Kehadiran (5 Pertemuan)' : topCategory === 'izin' ? 'Izin/Sakit (5 Pertemuan)' : topCategory === 'alpa' ? 'Alpa (5 Pertemuan)' : 'Frekuensi Terlambat'}
                        </th>
                        <th className="px-5 py-3 text-center">
                          {topCategory === 'hadir' ? 'Tingkat Kehadiran' : topCategory === 'izin' ? 'Rincian' : topCategory === 'alpa' ? 'Persentase Alpa' : 'Total Durasi Terlambat'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-[10px] sm:text-xs font-semibold text-slate-600">
                      {top5Members.map((m, idx) => {
                        const totalMeetings = m.totalMeetings || meetingStats.length || 1;
                        const hadirPct = m.pct !== undefined ? m.pct : Math.round((m.hadirCount / totalMeetings) * 100);
                        const alpaPct = m.pct !== undefined ? m.pct : Math.round((m.alpaCount / totalMeetings) * 100);
                        const isRank1 = idx === 0;
                        const isRank2 = idx === 1;
                        const isRank3 = idx === 2;

                        return (
                          <tr key={m.memberId} className={`hover:bg-slate-50/50 transition-colors ${idx !== top5Members.length - 1 ? 'border-b border-slate-100' : ''}`}>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${
                                isRank1 ? 'bg-amber-100 text-amber-700 border border-amber-300 shadow-xs' :
                                isRank2 ? 'bg-slate-200 text-slate-700 border border-slate-300' :
                                isRank3 ? 'bg-orange-100 text-orange-700 border border-orange-300' :
                                'bg-slate-50 text-slate-500 border border-slate-200'
                              }`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-5 py-4 font-black uppercase text-slate-900 flex items-center gap-2">
                              {m.memberName}
                              {isRank1 && <span className="text-amber-500 text-xs">👑</span>}
                            </td>
                            <td className="px-5 py-4 uppercase text-slate-500 font-bold">{m.kelompokName}</td>
                            <td className="px-5 py-4 text-center">
                              {topCategory === 'hadir' && (
                                <>
                                  <span className="font-black text-emerald-700">
                                    {m.hadirCount} <span className="text-slate-400 font-normal">/ {totalMeetings} Hadir</span>
                                  </span>
                                  {m.izinCount > 0 && <span className="text-[9px] text-amber-600 block font-bold">{m.izinCount} Izin</span>}
                                </>
                              )}
                              {topCategory === 'izin' && (
                                <span className="font-black text-amber-700">
                                  {m.izinCount + m.sakitCount} <span className="text-slate-400 font-normal">/ {totalMeetings} Kali</span>
                                </span>
                              )}
                              {topCategory === 'alpa' && (
                                <span className="font-black text-rose-700">
                                  {m.alpaCount} <span className="text-slate-400 font-normal">/ {totalMeetings} Alpa</span>
                                </span>
                              )}
                              {topCategory === 'terlambat' && (
                                <span className="font-black text-purple-700">
                                  {m.lateCount} Kali <span className="text-slate-400 font-normal">/ {totalMeetings} Pertemuan</span>
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-center">
                              {topCategory === 'hadir' && (
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${hadirPct >= 80 ? 'bg-emerald-500' : hadirPct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                                      style={{ width: `${hadirPct}%` }} 
                                    />
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                    hadirPct >= 80 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                    hadirPct >= 50 ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                    'bg-rose-50 text-rose-600 border border-rose-100'
                                  }`}>
                                    {hadirPct}%
                                  </span>
                                </div>
                              )}
                              {topCategory === 'izin' && (
                                <div className="text-[9px] font-black uppercase text-amber-600">
                                  Izin: {m.izinCount} • Sakit: {m.sakitCount}
                                </div>
                              )}
                              {topCategory === 'alpa' && (
                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100">
                                  {alpaPct}% Alpa
                                </span>
                              )}
                              {topCategory === 'terlambat' && (
                                <span className="px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                                  ⏱️ {m.formattedLate} ({m.totalMinutes} m)
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards Grid View */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {top5Members.map((m, idx) => {
                    const totalMeetings = m.totalMeetings || meetingStats.length || 1;
                    const hadirPct = m.pct !== undefined ? m.pct : Math.round((m.hadirCount / totalMeetings) * 100);
                    const alpaPct = m.pct !== undefined ? m.pct : Math.round((m.alpaCount / totalMeetings) * 100);
                    const isRank1 = idx === 0;

                    return (
                      <div key={m.memberId} className="p-4 flex justify-between items-center bg-white">
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black shrink-0 ${
                            isRank1 ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="space-y-0.5 truncate">
                            <p className="text-[11px] font-black uppercase text-slate-950 truncate leading-none">
                              {m.memberName} {isRank1 && '👑'}
                            </p>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-wide truncate">
                              {m.kelompokName} • {
                                topCategory === 'hadir' ? `${m.hadirCount}/${totalMeetings} Hadir` :
                                topCategory === 'izin' ? `${m.izinCount + m.sakitCount}/${totalMeetings} Izin` :
                                topCategory === 'alpa' ? `${m.alpaCount}/${totalMeetings} Alpa` :
                                `Terlambat ${m.lateCount}x`
                              }
                            </p>
                          </div>
                        </div>

                        {topCategory === 'hadir' && (
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0 ${
                            hadirPct >= 80 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            hadirPct >= 50 ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                            'bg-rose-50 text-rose-600 border border-rose-100'
                          }`}>
                            {hadirPct}%
                          </span>
                        )}

                        {topCategory === 'izin' && (
                          <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0 bg-amber-50 text-amber-600 border border-amber-100">
                            {m.izinCount + m.sakitCount}x
                          </span>
                        )}

                        {topCategory === 'alpa' && (
                          <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0 bg-rose-50 text-rose-600 border border-rose-100">
                            {alpaPct}%
                          </span>
                        )}

                        {topCategory === 'terlambat' && (
                          <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0 bg-purple-50 text-purple-700 border border-purple-200">
                            ⏱️ {m.formattedLate}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardAbsensi;
