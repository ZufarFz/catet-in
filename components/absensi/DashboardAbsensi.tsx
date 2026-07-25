import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalendarCheck, 
  UserCheck, 
  AlertCircle, 
  FileText,
  CalendarDays,
  BarChart2,
  Trophy,
  Users,
  Zap,
  ChevronDown,
  ChevronUp,
  Check,
  Search,
  X
} from 'lucide-react';
import { AttendanceLog, EventData } from '../../types';
import { dbGetEventDashboardSummary, EventDashboardSummary, dbGetRecentEvents } from '../../supabase';
import { motion, AnimatePresence } from 'motion/react';

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

  // Custom Event Dropdown UI state & handler
  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false);
  const [eventSearchTerm, setEventSearchTerm] = useState('');
  const eventDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (eventDropdownRef.current && !eventDropdownRef.current.contains(event.target as Node)) {
        setIsEventDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredRecentEvents = useMemo(() => {
    if (!eventSearchTerm.trim()) return recentEvents;
    return recentEvents.filter(evt =>
      evt.nama_kegiatan.toLowerCase().includes(eventSearchTerm.toLowerCase())
    );
  }, [recentEvents, eventSearchTerm]);

  // 3. Server-side Aggregated Summary State (STRICT FUNCTION REQUIREMENT, NO BACKUP/FALLBACK)
  const [dbSummary, setDbSummary] = useState<EventDashboardSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isGridStackedMobile, setIsGridStackedMobile] = useState<boolean>(false);
  const [isDetailsExpandedMobile, setIsDetailsExpandedMobile] = useState<boolean>(false);
  const [isTransitioningMobile, setIsTransitioningMobile] = useState<boolean>(false);

  // Trend Chart Metric Filter States (Default: Only Hadir is displayed)
  const [showHadirTrend, setShowHadirTrend] = useState<boolean>(true);
  const [showIzinSakitTrend, setShowIzinSakitTrend] = useState<boolean>(false);
  const [showAlpaTrend, setShowAlpaTrend] = useState<boolean>(false);

  const handleToggleMobileDetail = () => {
    if (isTransitioningMobile) return;
    setIsTransitioningMobile(true);

    if (!isGridStackedMobile) {
      // EXPAND FLOW (Bertahap & Smooth):
      // 1. Pindah posisi ke 1 kolom terlebih dahulu
      setIsGridStackedMobile(true);
      // 2. Setelah posisi berpindah (280ms), baru melebarkan & menampilkan detail
      setTimeout(() => {
        setIsDetailsExpandedMobile(true);
        setTimeout(() => {
          setIsTransitioningMobile(false);
        }, 320);
      }, 280);
    } else {
      // COLLAPSE FLOW (Bertahap & Smooth):
      // 1. Mengecilkan detail ke bentuk ringkas terlebih dahulu
      setIsDetailsExpandedMobile(false);
      // 2. Setelah selesai mengecil (280ms), baru mengembalikan grid ke 5 kolom (ke atas)
      setTimeout(() => {
        setIsGridStackedMobile(false);
        setTimeout(() => {
          setIsTransitioningMobile(false);
        }, 320);
      }, 280);
    }
  };

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
        <div className="relative overflow-hidden bg-gradient-to-br from-[#00A1E5] via-[#007CC2] to-[#004D90] p-3.5 sm:p-7 md:p-8 rounded-2xl sm:rounded-3xl shadow-xl text-white group">
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
          <UserCheck className="absolute right-3 sm:right-8 top-4 sm:top-8 text-white/10 w-20 h-20 sm:w-36 sm:h-36 pointer-events-none stroke-[1.2] group-hover:scale-110 transition-transform duration-500 z-10" />

          {/* Top Row: Pill Badge & Current Month */}
          <div className="flex items-center justify-between gap-2 relative z-20">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/20 border border-white/20 backdrop-blur-md text-[9px] sm:text-xs font-black tracking-wider uppercase text-white shadow-xs">
              <Zap size={11} className="text-amber-300 fill-amber-300 sm:w-3.5 sm:h-3.5" />
              <span>DASHBOARD ABSENSI</span>
            </div>
            <span className="text-[9px] sm:text-xs font-black tracking-widest uppercase text-sky-100/90">
              {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase()}
            </span>
          </div>

          {/* Middle Row: Enlarged Welcome Greeting */}
          <div className="mt-2.5 sm:mt-6 relative z-20">
            <span className="text-[9px] sm:text-xs font-bold text-sky-200 uppercase tracking-widest">
              SELAMAT DATANG
            </span>
            <h1 className="text-xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mt-0.5 sm:mt-1">
              {username?.toUpperCase()}
            </h1>
          </div>

          {/* Divider Line */}
          <div className="border-t border-white/20 my-2.5 sm:my-6 relative z-20" />

          {/* Section Label: Ringkasan 5 Pertemuan Terakhir - Nama Kegiatan */}
          <div className="flex items-center justify-between mb-1.5 sm:mb-3 relative z-20">
            <span className="text-[9px] sm:text-xs font-black text-sky-100 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 inline-block" />
              RINGKASAN 5 PERTEMUAN TERAKHIR{activeEvent?.nama_kegiatan ? ` - ${activeEvent.nama_kegiatan}` : ''}
            </span>
          </div>

          {/* Bottom Row: 3 Summary Cards Matrix (HADIR, IZIN/SAKIT, ALPA) - Transparent Glass Style - Always 1 Row (grid-cols-3) */}
          <div className="grid grid-cols-3 gap-1 sm:gap-4 relative z-20">
            {summaryCards.map((card, idx) => (
              <div 
                key={idx}
                className="bg-white/10 hover:bg-white/15 backdrop-blur-md text-white rounded-lg sm:rounded-2xl border border-white/20 overflow-hidden flex flex-col justify-between transition-all shadow-sm"
              >
                {/* Card Header */}
                <div className="px-1 py-1 sm:px-4 sm:py-2.5 bg-white/10 border-b border-white/15 flex items-center justify-center sm:justify-start gap-1.5">
                  <div className="hidden sm:flex p-1.5 rounded-lg border border-white/20 bg-white/20 text-white shrink-0">
                    <card.icon className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-[8px] sm:text-xs font-black text-white uppercase tracking-wider truncate text-center sm:text-left">
                    {card.title}
                  </h3>
                </div>

                {/* Card Body: Split TOTAL & PERSENTASE */}
                <div className="grid grid-cols-2 divide-x divide-white/15 text-center p-1 sm:p-4 bg-transparent">
                  {/* Total */}
                  <div className="flex flex-col justify-center items-center px-0.5">
                    <span className="text-[6px] sm:text-[9px] font-black text-sky-100/80 uppercase tracking-wider mb-0.5 truncate max-w-full">
                      TOTAL
                    </span>
                    <span className="text-xs sm:text-2xl font-black text-white tracking-tight">
                      {isSummaryLoading ? '...' : card.total}
                    </span>
                  </div>

                  {/* Percentage */}
                  <div className="flex flex-col justify-center items-center px-0.5">
                    <span className="text-[6px] sm:text-[9px] font-black text-sky-100/80 uppercase tracking-wider mb-0.5 truncate max-w-full">
                      PERSENTASE
                    </span>
                    <span className={`text-xs sm:text-2xl font-black tracking-tight ${card.transparentPctColor}`}>
                      {isSummaryLoading ? '...' : card.percentage}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Most Recent Events Dropdown Filter Header */}
        <div className="bg-white px-3 py-2.5 sm:px-5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-100 shadow-xs sm:shadow-sm flex items-center gap-2.5 sm:gap-3.5 relative z-30">
          {/* Icon Kalender di Kiri */}
          <div className="flex p-1.5 sm:p-2 bg-rose-50 text-rose-600 rounded-lg sm:rounded-xl border border-rose-100 shrink-0">
            <CalendarDays size={16} className="sm:w-[20px] sm:h-[20px]" />
          </div>

          {/* Di Kanan: Atas Judul, Bawah Kontainer Drop Down */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 sm:gap-2 flex-1 min-w-0">
            <div>
              <h2 className="text-[11px] sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                Pilih Kegiatan Rutin
              </h2>
            </div>

            {/* Custom Interactive Event Selector Dropdown Container */}
            <div className="relative w-full md:w-auto" ref={eventDropdownRef}>
              <button
                type="button"
                onClick={() => setIsEventDropdownOpen(prev => !prev)}
                className={`w-full md:w-[320px] flex items-center justify-between gap-2 bg-slate-50 hover:bg-slate-100/90 border transition-all duration-200 rounded-lg sm:rounded-xl px-2 py-1 sm:px-3 sm:py-2 text-left outline-none cursor-pointer ${
                  isEventDropdownOpen 
                    ? 'border-rose-500 bg-white ring-2 ring-rose-500/15 shadow-sm' 
                    : 'border-slate-200 shadow-2xs hover:border-slate-300'
                }`}
              >
                <span className="text-[10px] sm:text-xs font-black uppercase text-slate-800 truncate leading-tight flex-1 min-w-0">
                  {activeEvent ? activeEvent.nama_kegiatan : 'Pilih Kegiatan...'}
                </span>
                <ChevronDown 
                  size={14} 
                  className={`text-slate-400 shrink-0 transition-transform duration-300 ${isEventDropdownOpen ? 'rotate-180 text-rose-600' : ''}`} 
                />
              </button>

            {/* Custom Dropdown List Popover */}
            <AnimatePresence>
              {isEventDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="absolute right-0 top-full mt-1.5 w-full md:w-[360px] bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/10 overflow-hidden z-50 p-2"
                >
                  {/* Search Bar if events > 3 */}
                  {recentEvents.length > 3 && (
                    <div className="relative mb-1.5 px-0.5">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari kegiatan..."
                        value={eventSearchTerm}
                        onChange={(e) => setEventSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-[11px] font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-400 focus:bg-white transition-all"
                        autoFocus
                      />
                      {eventSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setEventSearchTerm('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Event List Items */}
                  <div className="max-h-[260px] overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                    {filteredRecentEvents.length === 0 ? (
                      <div className="py-5 text-center text-slate-400 text-xs font-bold">
                        Kegiatan tidak ditemukan
                      </div>
                    ) : (
                      filteredRecentEvents.map((evt) => {
                        const isSelected = evt.id === activeEventId;
                        const updateDateStr = evt.updated_at || evt.created_at;
                        const dateLabel = updateDateStr ? formatDateDDMMMYYYY(updateDateStr) : '';

                        return (
                          <button
                            key={evt.id}
                            type="button"
                            onClick={() => {
                              setSelectedEventId(evt.id);
                              setIsEventDropdownOpen(false);
                            }}
                            className={`w-full text-left p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all duration-150 flex items-center justify-between gap-2 cursor-pointer group ${
                              isSelected
                                ? 'bg-rose-50/90 border border-rose-200 text-rose-950 font-black shadow-2xs'
                                : 'hover:bg-slate-50 border border-transparent text-slate-700 hover:text-slate-900 font-bold'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] sm:text-xs uppercase tracking-tight truncate leading-tight">
                                {evt.nama_kegiatan}
                              </div>
                              {dateLabel && (
                                <div className={`text-[9px] font-semibold mt-0.5 flex items-center gap-1 ${isSelected ? 'text-rose-600' : 'text-slate-400'}`}>
                                  <span>Update: {dateLabel}</span>
                                </div>
                              )}
                            </div>

                            {isSelected && (
                              <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase bg-rose-500 text-white px-1.5 py-0.5 rounded-md shadow-2xs shrink-0">
                                <Check size={11} strokeWidth={3} />
                                <span className="hidden sm:inline">Terpilih</span>
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
          <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-gradient-to-r from-slate-50 to-white">
            <div className="space-y-0.5">
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

          <div className="p-3 sm:p-5">
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
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Side: Compact 2-Line Cards List (Stacked vertically, Collapsible on Mobile) */}
                <div className="lg:col-span-5 flex flex-col space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] font-black text-slate-700 uppercase tracking-wider block">
                      Riwayat Pertemuan ({meetingStats.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleMobileDetail}
                      disabled={isTransitioningMobile}
                      className="lg:hidden inline-flex items-center gap-1 text-[9px] font-extrabold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200/80 transition-colors disabled:opacity-50"
                    >
                      <span>{(isGridStackedMobile || isDetailsExpandedMobile) ? 'Sembunyikan' : 'Lihat Detail'}</span>
                      {(isGridStackedMobile || isDetailsExpandedMobile) ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  </div>

                  {/* Single Unified Container with Framer Motion Layout Animation */}
                  <motion.div 
                    layout
                    transition={{ layout: { duration: 0.28, ease: "easeInOut" } }}
                    className={`grid gap-1.5 lg:flex lg:flex-col lg:gap-2 ${isGridStackedMobile ? 'grid-cols-1' : 'grid-cols-5'}`}
                  >
                    {meetingStats.map((m) => (
                      <motion.div 
                        layout
                        key={m.dateStr}
                        transition={{ layout: { duration: 0.28, ease: "easeInOut" } }}
                        className="px-2 py-1.5 sm:px-2.5 sm:py-1.5 lg:px-3 lg:py-2 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100/80 transition-colors flex flex-col justify-between overflow-hidden w-full shadow-xs"
                      >
                        {/* Baris Utama / Top Row */}
                        <motion.div 
                          layout 
                          transition={{ layout: { duration: 0.28, ease: "easeInOut" } }}
                          className={`flex w-full ${
                            isDetailsExpandedMobile 
                              ? 'flex-row items-center justify-between text-[10px] font-black uppercase gap-1' 
                              : 'flex-col items-center justify-center text-center gap-0.5 lg:flex-row lg:items-center lg:justify-between lg:text-[10px] lg:font-black lg:uppercase lg:gap-1'
                          }`}
                        >
                          <motion.div layout transition={{ layout: { duration: 0.28, ease: "easeInOut" } }} className="flex items-center gap-1">
                            <motion.span layout transition={{ layout: { duration: 0.28, ease: "easeInOut" } }} className="text-slate-800 tracking-tight font-black text-[9px] sm:text-[10px]">
                              P{m.meetingNumber}
                            </motion.span>

                            {/* Tanggal badge - Always on Desktop, Animated on Mobile when expanded */}
                            <div className="hidden lg:inline-block">
                              <span className="text-[9px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">
                                📅 {formatDateDDMMMYYYY(m.dateStr || m.dateFormatted)}
                              </span>
                            </div>
                            <AnimatePresence>
                              {isDetailsExpandedMobile && (
                                <motion.div
                                  initial={{ opacity: 0, width: 0 }}
                                  animate={{ opacity: 1, width: 'auto' }}
                                  exit={{ opacity: 0, width: 0 }}
                                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                                  className="lg:hidden overflow-hidden"
                                >
                                  <span className="text-[8.5px] font-bold text-slate-400 bg-white px-1 py-0.5 rounded border border-slate-100 whitespace-nowrap inline-block">
                                    📅 {formatDateDDMMMYYYY(m.dateStr || m.dateFormatted)}
                                  </span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>

                          {/* Stat Total & Percentage */}
                          <motion.div layout transition={{ layout: { duration: 0.28, ease: "easeInOut" } }} className="flex items-center gap-0.5 text-[8.5px] sm:text-[10px]">
                            <motion.span layout transition={{ layout: { duration: 0.28, ease: "easeInOut" } }} className="font-black text-emerald-600">
                              {m.hadir}{isDetailsExpandedMobile ? ' Hadir' : ''}
                            </motion.span>
                            <motion.span layout transition={{ layout: { duration: 0.28, ease: "easeInOut" } }} className="font-semibold text-slate-500">
                              ({m.pct}%)
                            </motion.span>
                          </motion.div>
                        </motion.div>

                        {/* Baris 2: Detail status Izin, Sakit, Alpa terpisah */}
                        {/* Always visible on Desktop */}
                        <div className="hidden lg:flex items-center justify-between text-[9px] font-bold text-slate-400 border-t border-slate-200/50 pt-0.5 mt-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-amber-600">Izin: {m.izin}</span>
                            <span className="text-sky-600">Sakit: {m.sakit}</span>
                          </div>
                          <span className="text-rose-500 font-extrabold">Alpa: {m.alpa}</span>
                        </div>

                        {/* Mobile Animated Detail Row */}
                        <AnimatePresence>
                          {isDetailsExpandedMobile && (
                            <motion.div
                              initial={{ opacity: 0, height: 0, marginTop: 0 }}
                              animate={{ opacity: 1, height: 'auto', marginTop: 6 }}
                              exit={{ opacity: 0, height: 0, marginTop: 0 }}
                              transition={{ duration: 0.25, ease: 'easeInOut' }}
                              className="lg:hidden flex items-center justify-between text-[9px] font-bold text-slate-400 border-t border-slate-200/50 pt-1 overflow-hidden"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-amber-600">Izin: {m.izin}</span>
                                <span className="text-sky-600">Sakit: {m.sakit}</span>
                              </div>
                              <span className="text-rose-500 font-extrabold">Alpa: {m.alpa}</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>

                {/* Right Side: Trend SVG Chart */}
                <div className="lg:col-span-7 flex flex-col space-y-1.5">
                  <span className="text-[9.5px] font-black text-slate-700 uppercase tracking-wider block">
                    Bagan Tren Persentase Presensi
                  </span>

                  <div className="relative w-full overflow-hidden bg-slate-50/60 border border-slate-100 rounded-2xl p-2 sm:p-3 flex flex-col gap-1.5">
                    <svg 
                      viewBox="0 0 500 295" 
                      className="w-full h-auto max-h-[360px] overflow-visible"
                    >
                      <defs>
                        <linearGradient id="gradientHadir" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#E11D48" stopOpacity="0.20" />
                          <stop offset="100%" stopColor="#E11D48" stopOpacity="0.01" />
                        </linearGradient>
                        <linearGradient id="gradientIzinSakit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#D97706" stopOpacity="0.20" />
                          <stop offset="100%" stopColor="#D97706" stopOpacity="0.01" />
                        </linearGradient>
                        <linearGradient id="gradientAlpa" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#DC2626" stopOpacity="0.20" />
                          <stop offset="100%" stopColor="#DC2626" stopOpacity="0.01" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines (Expanded 55px vertical spacing in SVG coordinate space) */}
                      {[0, 25, 50, 75, 100].map((val) => {
                        const y = 20 + ((100 - val) / 100) * 220;
                        return (
                          <g key={val}>
                            <line 
                              x1={24} 
                              y1={y} 
                              x2={492} 
                              y2={y} 
                              stroke="#E2E8F0" 
                              strokeWidth="0.8"
                            />
                            <text 
                              x={18} 
                              y={y + 4} 
                              fill="#475569" 
                              fontSize="11" 
                              fontWeight="800"
                              textAnchor="end"
                              className="font-mono"
                            >
                              {val}%
                            </text>
                          </g>
                        );
                      })}

                      {/* Chart Lines & Data Points */}
                      {(() => {
                        const bottomY = 240;
                        const len = meetingStats.length;

                        const metricsToDraw = [];
                        if (showHadirTrend) {
                          metricsToDraw.push({
                            id: 'hadir',
                            label: 'Hadir',
                            stroke: '#E11D48',
                            gradientId: 'gradientHadir',
                            textFill: '#9F1239',
                            getPct: (pt: typeof meetingStats[0]) => pt.pct
                          });
                        }
                        if (showIzinSakitTrend) {
                          metricsToDraw.push({
                            id: 'izinSakit',
                            label: 'Izin/Sakit',
                            stroke: '#D97706',
                            gradientId: 'gradientIzinSakit',
                            textFill: '#B45309',
                            getPct: (pt: typeof meetingStats[0]) => pt.total > 0 ? Math.round(((pt.izin + pt.sakit) / pt.total) * 100) : 0
                          });
                        }
                        if (showAlpaTrend) {
                          metricsToDraw.push({
                            id: 'alpa',
                            label: 'Alpa',
                            stroke: '#DC2626',
                            gradientId: 'gradientAlpa',
                            textFill: '#991B1B',
                            getPct: (pt: typeof meetingStats[0]) => pt.total > 0 ? Math.round((pt.alpa / pt.total) * 100) : 0
                          });
                        }

                        return (
                          <>
                            <AnimatePresence>
                              {metricsToDraw.map((metric, metricIdx) => {
                                const pts = meetingStats.map((pt, index) => {
                                  const x = len === 1 ? 260 : 36 + (index / (len - 1)) * (484 - 36);
                                  const pctVal = metric.getPct(pt);
                                  const y = 20 + ((100 - Math.min(100, Math.max(0, pctVal))) / 100) * 220;
                                  return { x, y, pctVal, ...pt };
                                });

                                const pathStr = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                const fillPathStr = pts.length > 0 
                                  ? `M ${pts[0].x} ${bottomY} L ${pts.map(p => `${p.x} ${p.y}`).join(' L ')} L ${pts[pts.length - 1].x} ${bottomY} Z`
                                  : '';

                                // Offset label position if multiple lines active to avoid text collision
                                const labelOffsetY = metricsToDraw.length > 1 
                                  ? (metricIdx === 0 ? -9 : (metricIdx === 1 ? 16 : -20)) 
                                  : -8;

                                return (
                                  <motion.g 
                                    key={metric.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.35, ease: "easeInOut" }}
                                  >
                                    {fillPathStr && (
                                      <motion.path 
                                        d={fillPathStr} 
                                        fill={`url(#${metric.gradientId})`} 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 0.85 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.35, ease: "easeInOut" }}
                                      />
                                    )}

                                    {pathStr && (
                                      <motion.path 
                                        d={pathStr} 
                                        fill="none" 
                                        stroke={metric.stroke} 
                                        strokeWidth="3" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        className="stroke-[3px] sm:stroke-[1.75px]"
                                        initial={{ pathLength: 0, opacity: 0 }}
                                        animate={{ pathLength: 1, opacity: 1 }}
                                        exit={{ pathLength: 0, opacity: 0 }}
                                        transition={{ duration: 0.45, ease: "easeInOut" }}
                                      />
                                    )}

                                    {pts.map((p, idx) => (
                                      <motion.g 
                                        key={`${metric.id}-pt-${idx}`}
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, delay: idx * 0.03, ease: "easeOut" }}
                                        style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                                      >
                                        <circle 
                                          cx={p.x} 
                                          cy={p.y} 
                                          r="3.5" 
                                          fill="#FFFFFF" 
                                          stroke={metric.stroke} 
                                          strokeWidth="2.5"
                                          className="[r:3.5px] sm:[r:2.2px] stroke-[2.5px] sm:stroke-[1.5px]"
                                        />
                                        <text 
                                          x={p.x} 
                                          y={p.y + labelOffsetY} 
                                          fill={metric.textFill} 
                                          fontSize="11" 
                                          fontWeight="900"
                                          textAnchor="middle"
                                          className="font-mono font-black"
                                        >
                                          {p.pctVal}%
                                        </text>
                                      </motion.g>
                                    ))}
                                  </motion.g>
                                );
                              })}
                            </AnimatePresence>

                            {/* X-Axis Labels (Pertemuan & Tanggal) */}
                            {meetingStats.map((p, index) => {
                              const x = len === 1 ? 260 : 36 + (index / (len - 1)) * (484 - 36);
                              return (
                                <g key={`x-label-${index}`}>
                                  <text 
                                    x={x} 
                                    y={264} 
                                    fill="#0F172A" 
                                    fontSize="11" 
                                    fontWeight="900"
                                    textAnchor="middle"
                                    className="uppercase tracking-wider font-sans"
                                  >
                                    P{p.meetingNumber}
                                  </text>
                                  <text 
                                    x={x} 
                                    y={279} 
                                    fill="#475569" 
                                    fontSize="9" 
                                    fontWeight="800"
                                    textAnchor="middle"
                                    className="font-sans"
                                  >
                                    {formatDateDDMMMYYYY(p.dateStr || p.dateFormatted)}
                                  </text>
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>

                    {/* Filter Legend Controls (With colored dot indicator & reduced font size) */}
                    <div className="flex items-center justify-center gap-4 sm:gap-6 pt-1.5 border-t border-slate-200/50">
                      {/* Hadir Toggle Button */}
                      <button
                        type="button"
                        onClick={() => setShowHadirTrend(!showHadirTrend)}
                        className={`text-[10.5px] sm:text-xs tracking-wide transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                          showHadirTrend 
                            ? 'text-rose-600 font-extrabold scale-105' 
                            : 'text-slate-400/80 font-medium hover:text-slate-600'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-colors ${showHadirTrend ? 'bg-rose-600' : 'bg-slate-300'}`} />
                        Hadir
                      </button>

                      {/* Izin & Sakit Toggle Button */}
                      <button
                        type="button"
                        onClick={() => setShowIzinSakitTrend(!showIzinSakitTrend)}
                        className={`text-[10.5px] sm:text-xs tracking-wide transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                          showIzinSakitTrend 
                            ? 'text-amber-600 font-extrabold scale-105' 
                            : 'text-slate-400/80 font-medium hover:text-slate-600'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-colors ${showIzinSakitTrend ? 'bg-amber-500' : 'bg-slate-300'}`} />
                        Izin & Sakit
                      </button>

                      {/* Alpa Toggle Button */}
                      <button
                        type="button"
                        onClick={() => setShowAlpaTrend(!showAlpaTrend)}
                        className={`text-[10.5px] sm:text-xs tracking-wide transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                          showAlpaTrend 
                            ? 'text-red-600 font-extrabold scale-105' 
                            : 'text-slate-400/80 font-medium hover:text-slate-600'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-colors ${showAlpaTrend ? 'bg-red-600' : 'bg-slate-300'}`} />
                        Alpa
                      </button>
                    </div>
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
            <div className="w-full sm:w-auto grid grid-cols-4 sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 select-none relative">
              {[
                { id: 'hadir', label: 'Hadir', activeBg: 'bg-emerald-600' },
                { id: 'izin', label: 'Izin', activeBg: 'bg-amber-500' },
                { id: 'alpa', label: 'Alpa', activeBg: 'bg-rose-600' },
                { id: 'terlambat', label: 'Terlambat', activeBg: 'bg-purple-600' },
              ].map((tab) => {
                const isActive = topCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTopCategory(tab.id as any)}
                    className={`relative py-1.5 sm:py-1 px-1 sm:px-3 rounded-lg text-[9px] sm:text-[9.5px] font-black uppercase tracking-wider transition-colors cursor-pointer text-center z-10 ${
                      isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="top5CategoryActivePill"
                        className={`absolute inset-0 rounded-lg shadow-xs ${tab.activeBg}`}
                        transition={{ type: "spring", stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1">
            {isLoading ? (
               <div className="flex flex-col items-center py-12 gap-2">
                  <div className="w-8 h-8 border-3 border-slate-100 border-t-amber-500 rounded-full animate-spin" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Menyelaraskan Data Top 5...</span>
               </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={topCategory}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
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
                        {Array.from({ length: 5 }, (_, idx) => top5Members[idx] || null).map((m, idx) => {
                          const isRank1 = idx === 0;
                          const isRank2 = idx === 1;
                          const isRank3 = idx === 2;

                          if (!m) {
                            return (
                              <tr key={`empty-${idx}`} className={`hover:bg-slate-50/30 transition-colors ${idx !== 4 ? 'border-b border-slate-100' : ''}`}>
                                <td className="px-5 py-3.5 text-center">
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-slate-50 text-slate-300 border border-slate-100">
                                    {idx + 1}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 font-bold uppercase text-slate-300">-</td>
                                <td className="px-5 py-3.5 uppercase text-slate-300 font-bold">-</td>
                                <td className="px-5 py-3.5 text-center font-bold text-slate-300">-</td>
                                <td className="px-5 py-3.5 text-center font-bold text-slate-300">-</td>
                              </tr>
                            );
                          }

                          const totalMeetings = m.totalMeetings || meetingStats.length || 1;
                          const hadirPct = m.pct !== undefined ? m.pct : Math.round((m.hadirCount / totalMeetings) * 100);
                          const alpaPct = m.pct !== undefined ? m.pct : Math.round((m.alpaCount / totalMeetings) * 100);

                          return (
                            <tr key={m.memberId || idx} className={`hover:bg-slate-50/50 transition-colors ${idx !== 4 ? 'border-b border-slate-100' : ''}`}>
                              <td className="px-5 py-3.5 text-center">
                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${
                                  isRank1 ? 'bg-amber-100 text-amber-700 border border-amber-300 shadow-xs' :
                                  isRank2 ? 'bg-slate-200 text-slate-700 border border-slate-300' :
                                  isRank3 ? 'bg-orange-100 text-orange-700 border border-orange-300' :
                                  'bg-slate-50 text-slate-500 border border-slate-200'
                                }`}>
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-black uppercase text-slate-900 flex items-center gap-2">
                                {m.memberName}
                              </td>
                              <td className="px-5 py-3.5 uppercase text-slate-500 font-bold">{m.kelompokName}</td>
                              <td className="px-5 py-3.5 text-center">
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
                              <td className="px-5 py-3.5 text-center">
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
                    {Array.from({ length: 5 }, (_, idx) => top5Members[idx] || null).map((m, idx) => {
                      const isRank1 = idx === 0;

                      if (!m) {
                        return (
                          <div key={`empty-mob-${idx}`} className="px-3 py-2 flex justify-between items-center bg-white">
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <span className="inline-flex items-center justify-center w-5.5 h-5.5 rounded-full text-[10px] font-bold bg-slate-100/70 text-slate-300 shrink-0">
                                {idx + 1}
                              </span>
                              <div className="space-y-0.5 truncate">
                                <p className="text-[10.5px] font-bold text-slate-300 uppercase leading-tight">
                                  -
                                </p>
                                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-wide">
                                  -
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-300">-</span>
                          </div>
                        );
                      }

                      const totalMeetings = m.totalMeetings || meetingStats.length || 1;
                      const hadirPct = m.pct !== undefined ? m.pct : Math.round((m.hadirCount / totalMeetings) * 100);
                      const alpaPct = m.pct !== undefined ? m.pct : Math.round((m.alpaCount / totalMeetings) * 100);

                      return (
                        <div key={m.memberId || idx} className="px-3 py-2 flex justify-between items-center bg-white">
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className={`inline-flex items-center justify-center w-5.5 h-5.5 rounded-full text-[10px] font-black shrink-0 ${
                              isRank1 ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {idx + 1}
                            </span>
                            <div className="space-y-0.5 truncate">
                              <p className="text-[10.5px] font-black uppercase text-slate-950 truncate leading-tight">
                                {m.memberName}
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
                            <span className={`px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider shrink-0 ${
                              hadirPct >= 80 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                              hadirPct >= 50 ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                              'bg-rose-50 text-rose-600 border border-rose-100'
                            }`}>
                              {hadirPct}%
                            </span>
                          )}

                          {topCategory === 'izin' && (
                            <span className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider shrink-0 bg-amber-50 text-amber-600 border border-amber-100">
                              {m.izinCount + m.sakitCount}x
                            </span>
                          )}

                          {topCategory === 'alpa' && (
                            <span className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider shrink-0 bg-rose-50 text-rose-600 border border-rose-100">
                              {alpaPct}%
                            </span>
                          )}

                          {topCategory === 'terlambat' && (
                            <span className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider shrink-0 bg-purple-50 text-purple-700 border border-purple-200">
                              ⏱️ {m.formattedLate}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardAbsensi;
