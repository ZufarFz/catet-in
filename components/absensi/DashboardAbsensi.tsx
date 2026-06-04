import React, { useState } from 'react';
import { 
  Users, 
  CalendarCheck, 
  Clock, 
  UserCheck, 
  Activity, 
  Sparkles, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  FileText,
  Database
} from 'lucide-react';
import { AttendanceLog } from '../../types';
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
}

const DashboardAbsensi: React.FC<DashboardAbsensiProps> = ({ 
  logs, 
  isLoading, 
  username,
  summaries = [],
  ages = [],
  daerahs = [],
  desas = [],
  kelompoks = []
}) => {
  // States for historical multi-year records filters
  const [histYear, setHistYear] = useState<string>('All');
  const [histMonth, setHistMonth] = useState<string>('All');
  const [histGender, setHistGender] = useState<string>('All');
  const [histDaerah, setHistDaerah] = useState<string>('All');
  const [histDesa, setHistDesa] = useState<string>('All');
  const [histKelompok, setHistKelompok] = useState<string>('All');
  const [histAge, setHistAge] = useState<string>('All');

  // Constants
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.date && l.date.startsWith(today));

  // 1. Overall Presence Calculations
  const totalPresenceCount = logs.filter(l => l.status === 'Hadir').length;
  const overallPresenceRate = logs.length > 0 ? Math.round((totalPresenceCount / logs.length) * 100) : 0;

  // 2. Kelompok analytics (Computed on Render)
  const groups: { [name: string]: { total: number; hadir: number } } = {};
  logs.forEach(log => {
    const name = log.kelompokName || 'Umum';
    if (!groups[name]) {
      groups[name] = { total: 0, hadir: 0 };
    }
    groups[name].total++;
    if (log.status === 'Hadir') {
      groups[name].hadir++;
    }
  });

  const kelompokStats = Object.entries(groups)
    .map(([name, g]) => {
      const rate = g.total > 0 ? Math.round((g.hadir / g.total) * 100) : 0;
      return { name, rate, ...g };
    })
    .sort((a, b) => b.rate - a.rate || b.hadir - a.hadir)
    .slice(0, 5); // top 5

  // 3. Dynamic narrative insights generator (Computed on Render)
  const topActiveKelompok = kelompokStats[0]?.name || '-';
  const topActiveRate = kelompokStats[0]?.rate || 0;
  
  const totalIzinPlusSakit = logs.filter(l => l.status === 'Izin' || l.status === 'Sakit').length;
  const excuseRate = logs.length > 0 ? Math.round((totalIzinPlusSakit / logs.length) * 100) : 0;

  const totalAlpa = logs.filter(l => l.status === 'Alpa').length;
  const alpaRate = logs.length > 0 ? Math.round((totalAlpa / logs.length) * 100) : 0;

  const narrativeInsights = [
    {
      id: 'keaktifan',
      title: 'Tingkat Keaktifan Umum',
      desc: `Rata-rata keaktifan berada di angka ${overallPresenceRate}%. Tingkat partisipasi ini berada dalam kategori ${
        overallPresenceRate >= 85 ? 'Sangat Optimal (Mewah)' : overallPresenceRate >= 70 ? 'Stabil & Baik' : 'Perlu Perhatian Khusus'
      }.`,
      type: overallPresenceRate >= 85 ? 'success' : overallPresenceRate >= 70 ? 'info' : 'warning',
      icon: UserCheck
    },
    {
      id: 'kelompok-leader',
      title: 'Kelompok Teraktif',
      desc: topActiveKelompok !== '-' 
        ? `Kelompok ${topActiveKelompok} memimpin papan skor keaktifan dengan partisipasi rata-rata mencapai ${topActiveRate}%.`
        : 'Belum ada data kelompok yang berkontribusi pekan ini.',
      type: 'success',
      icon: Award
    }
  ];

  if (alpaRate > 10) {
    narrativeInsights.push({
      id: 'alpa-alert',
      title: 'Tingkat Alpa Meningkat',
      desc: `Perhatian: Ada sekitar ${alpaRate}% anggota tidak hadir tanpa keterangan (Alpa). Disarankan pimpinan menghubungi bersangkutan.`,
      type: 'warning',
      icon: AlertCircle
    });
  } else if (excuseRate > 0) {
    narrativeInsights.push({
      id: 'excused-trend',
      title: 'Rasio Izin & Medis',
      desc: `Sekitar ${excuseRate}% ketidakhadiran disebabkan oleh izin sakit atau keperluan mendesak yang terverifikasi secara sah.`,
      type: 'info',
      icon: Clock
    });
  }

  // Extract unique years from summaries
  const availableYears = React.useMemo(() => {
    const years = new Set<string>();
    (summaries || []).forEach(s => {
      if (s.date) {
        const y = s.date.split('-')[0];
        if (y) years.add(y);
      }
    });
    return Array.from(years).sort().reverse();
  }, [summaries]);

  const monthNames = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' }
  ];

  // Aggregate results based on active filters
  const historicalStats = React.useMemo(() => {
    const sorted = [...(summaries || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    
    let totalHadir = 0;
    let totalIzin = 0;
    let totalSakit = 0;
    let totalAlpa = 0;
    
    const trendPoints: { label: string; pct: number; date: string }[] = [];

    sorted.forEach(s => {
      if (!s.date) return;
      const [y, m] = s.date.split('-');
      
      // Filter year & month
      if (histYear !== 'All' && y !== histYear) return;
      if (histMonth !== 'All' && m !== histMonth) return;

      // Extract status counts depending on selected filter dimension
      let counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 };

      if (histKelompok !== 'All') {
        counts = s.kelompokCounts?.[histKelompok] || counts;
      } else if (histDesa !== 'All') {
        counts = s.desaCounts?.[histDesa] || counts;
      } else if (histDaerah !== 'All') {
        counts = s.daerahCounts?.[histDaerah] || counts;
      } else if (histAge !== 'All') {
        counts = s.ageCategoryCounts?.[histAge] || counts;
      } else if (histGender !== 'All') {
        counts = s.genderCounts?.[histGender] || counts;
      } else {
        counts = s.statusCounts || counts;
      }

      const h = counts.Hadir || 0;
      const i = counts.Izin || 0;
      const s_ = counts.Sakit || 0;
      const a = counts.Alpa || 0;

      totalHadir += h;
      totalIzin += i;
      totalSakit += s_;
      totalAlpa += a;

      const dayTotal = h + i + s_ + a;
      const pct = dayTotal > 0 ? Math.round((h / dayTotal) * 100) : 0;

      let dayLabel = s.date;
      try {
        const parts = s.date.split('-');
        if (parts.length === 3) {
          const mList = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
          dayLabel = `${parseInt(parts[2], 10)} ${mList[parseInt(parts[1], 10) - 1] || ''}`;
        }
      } catch (err) {
        console.warn("Failed to parse historical date:", err);
      }

      if (dayTotal > 0) {
        trendPoints.push({
          label: dayLabel,
          pct,
          date: s.date
        });
      }
    });

    const totalLogs = totalHadir + totalIzin + totalSakit + totalAlpa;
    const presenceRate = totalLogs > 0 ? Math.round((totalHadir / totalLogs) * 100) : 0;

    return {
      totalHadir,
      totalIzin,
      totalSakit,
      totalAlpa,
      totalLogs,
      presenceRate,
      trendPoints: trendPoints.slice(-15) // Show last 15 matching points
    };
  }, [summaries, histYear, histMonth, histGender, histDaerah, histDesa, histKelompok, histAge]);

  // Overall statistics cards layout setup
  const stats = [
    { label: 'Total Logs', value: logs.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', trend: `${overallPresenceRate}% Hadir` },
    { label: 'Hadir Hari Ini', value: todayLogs.filter(l => l.status === 'Hadir').length, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: 'Presensi' },
    { label: 'Izin / Sakit', value: todayLogs.filter(l => l.status === 'Izin' || l.status === 'Sakit').length, icon: CalendarCheck, color: 'text-amber-600', bg: 'bg-amber-50', trend: 'Medis/Izin' },
    { label: 'Update Akhir', value: logs[0]?.dateInput ? new Date(logs[0].dateInput).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-', icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50', trend: 'Sinkron' },
  ];

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 pb-32 space-y-6 sm:space-y-8">
        
        {/* Welcome Block: Elegant & Responsive */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-950 tracking-tight">
              Selamat Datang, {username}
            </h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              <p className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">
                Beranda Sekretaris & Analisis Dashboard
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 shrink-0 self-stretch sm:self-auto justify-center">
             <Activity className="text-emerald-500 shrink-0" size={14} />
             <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">MODUL AKTIF</span>
          </div>
        </div>

        {/* Dynamic Compact Numeric Stats Matrix (Scaled down for Mobile) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {stats.map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2.5">
                <div className={`${stat.bg} ${stat.color} p-2 rounded-lg shrink-0`}>
                  <stat.icon size={16} strokeWidth={2.5} />
                </div>
                <span className="text-[8px] sm:text-[9px] font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  {stat.trend}
                </span>
              </div>
              <div>
                <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                  {stat.label}
                </p>
                <p className="text-base sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  {isLoading ? '...' : stat.value}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Dashboard Analytics & Line Graphs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          
          {/* Arsip Analisis Sejarah (Daily Summaries Engine) */}
          <div className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Database className="text-blue-600 shrink-0" size={16} />
                  <h3 className="text-[10px] sm:text-[11px] font-black text-slate-800 uppercase tracking-wider">
                    Arsip Analisis Sejarah (Ringkasan Multi-Tahun)
                  </h3>
                </div>
                <p className="text-[9px] font-medium text-slate-400">
                  Pencarian instan arsip tanpa membebani kuota data. Diperbarui otomatis dari transaksi harian.
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              {/* Filter Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100">
                
                {/* Tahun */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Tahun</label>
                  <select
                    value={histYear}
                    onChange={(e) => setHistYear(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-[10px] sm:text-[11px] font-black uppercase text-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm focus:border-blue-500 focus:outline-none font-sans"
                  >
                    <option value="All">Semua Tahun</option>
                    {availableYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Bulan */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Bulan</label>
                  <select
                    value={histMonth}
                    onChange={(e) => setHistMonth(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-[10px] sm:text-[11px] font-black uppercase text-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm focus:border-blue-500 focus:outline-none font-sans"
                  >
                    <option value="All">Semua Bulan</option>
                    {monthNames.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Gender</label>
                  <select
                    value={histGender}
                    onChange={(e) => {
                      setHistGender(e.target.value);
                      setHistDaerah('All'); setHistDesa('All'); setHistKelompok('All'); setHistAge('All');
                    }}
                    className="w-full bg-white border border-slate-200 text-[10px] sm:text-[11px] font-black uppercase text-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm focus:border-blue-500 focus:outline-none font-sans"
                  >
                    <option value="All">Semua Gender</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                {/* Daerah */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Daerah</label>
                  <select
                    value={histDaerah}
                    onChange={(e) => {
                      setHistDaerah(e.target.value);
                      setHistGender('All'); setHistDesa('All'); setHistKelompok('All'); setHistAge('All');
                    }}
                    className="w-full bg-white border border-slate-200 text-[10px] sm:text-[11px] font-black uppercase text-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm focus:border-blue-500 focus:outline-none font-sans"
                  >
                    <option value="All">Semua Daerah</option>
                    {daerahs.map(d => (
                      <option key={d.id} value={d.id}>{d.nama_daerah}</option>
                    ))}
                  </select>
                </div>

                {/* Desa */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Desa</label>
                  <select
                    value={histDesa}
                    onChange={(e) => {
                      setHistDesa(e.target.value);
                      setHistGender('All'); setHistDaerah('All'); setHistKelompok('All'); setHistAge('All');
                    }}
                    className="w-full bg-white border border-slate-200 text-[10px] sm:text-[11px] font-black uppercase text-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm focus:border-blue-500 focus:outline-none font-sans"
                  >
                    <option value="All">Semua Desa</option>
                    {desas.map(d => (
                      <option key={d.id} value={d.id}>{d.nama_desa}</option>
                    ))}
                  </select>
                </div>

                {/* Kelompok */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Kelompok</label>
                  <select
                    value={histKelompok}
                    onChange={(e) => {
                      setHistKelompok(e.target.value);
                      setHistGender('All'); setHistDaerah('All'); setHistDesa('All'); setHistAge('All');
                    }}
                    className="w-full bg-white border border-slate-200 text-[10px] sm:text-[11px] font-black uppercase text-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm focus:border-blue-500 focus:outline-none font-sans"
                  >
                    <option value="All">Semua Kelompok</option>
                    {kelompoks.map(k => (
                      <option key={k.id} value={k.id}>{k.nama_kelompok}</option>
                    ))}
                  </select>
                </div>

                {/* Kategori Umur */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Umur</label>
                  <select
                    value={histAge}
                    onChange={(e) => {
                      setHistAge(e.target.value);
                      setHistGender('All'); setHistDaerah('All'); setHistDesa('All'); setHistKelompok('All');
                    }}
                    className="w-full bg-white border border-slate-200 text-[10px] sm:text-[11px] font-black uppercase text-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm focus:border-blue-500 focus:outline-none font-sans"
                  >
                    <option value="All">Semua Umur</option>
                    {ages.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Aggregated Numbers Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                
                {/* Total Summary Logs */}
                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between">
                  <div className="space-y-1 truncate">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Total Log Terarsip</span>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight font-sans">
                      {historicalStats.totalLogs}
                    </p>
                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest block font-sans">Ringkasan</span>
                  </div>
                  <div className="p-2 bg-blue-100/50 rounded-xl text-blue-600 shrink-0">
                    <Database size={16} />
                  </div>
                </div>

                {/* Average Presence Rate */}
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
                  <div className="space-y-1 truncate">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Persentase Hadir</span>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight font-sans">
                      {historicalStats.presenceRate}%
                    </p>
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest block font-sans">Partisipasi</span>
                  </div>
                  <div className="p-2 bg-emerald-100/50 rounded-xl text-emerald-600 shrink-0">
                    <UserCheck size={16} />
                  </div>
                </div>

                {/* Excuse / Medical Leave */}
                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 flex items-center justify-between">
                  <div className="space-y-1 truncate">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Izin & Sakit</span>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight font-sans">
                      {historicalStats.totalIzin + historicalStats.totalSakit}
                    </p>
                    <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest block font-sans">Terverifikasi</span>
                  </div>
                  <div className="p-2 bg-amber-100/50 rounded-xl text-amber-600 shrink-0">
                    <CalendarCheck size={16} />
                  </div>
                </div>

                {/* Alpa */}
                <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 flex items-center justify-between">
                  <div className="space-y-1 truncate">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Alpa (Absen)</span>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight font-sans">
                      {historicalStats.totalAlpa}
                    </p>
                    <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest block font-sans">Tanpa Keterangan</span>
                  </div>
                  <div className="p-2 bg-rose-100/50 rounded-xl text-rose-600 shrink-0">
                    <AlertCircle size={16} />
                  </div>
                </div>

              </div>

              {/* Multi-Year Chart Panel */}
              <div className="space-y-3">
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider block">
                  Visualisasi Tren Kemajuan Sesi Terpilih
                </span>

                {historicalStats.trendPoints.length === 0 ? (
                  <div className="py-12 border border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center px-4 bg-slate-50/50">
                    <Database className="text-slate-300 mb-2" size={24} />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Belum ada ringkasan summary terdaftar
                    </p>
                    <p className="text-[8px] text-slate-300 uppercase tracking-wide mt-1">
                      Silakan isi dan transaksikan absensi baru di form untuk otomatisasi bagan harian.
                    </p>
                  </div>
                ) : (
                  <div className="relative -mx-5 sm:-mx-6 w-[calc(100%+2.5rem)] sm:w-[calc(100%+3rem)] overflow-hidden bg-slate-50/40 border-y border-slate-100 px-2 sm:px-4 py-4">
                    <svg 
                      viewBox="0 0 500 200" 
                      className="w-full h-auto max-h-[140px] sm:max-h-[180px] overflow-visible"
                    >
                      {/* Grid Lines */}
                      {[0, 25, 50, 75, 100].map((val) => {
                        const y = 15 + ((100 - val) / 100) * 147;
                        return (
                          <g key={val}>
                            <line 
                              x1={24} 
                              y1={y} 
                              x2={496} 
                              y2={y} 
                              stroke="#E2E8F0" 
                              strokeWidth="0.75"
                            />
                            <text 
                              x={18} 
                              y={y + 3.5} 
                              fill="#0F172A" 
                              fontSize="10" 
                              fontWeight="900"
                              textAnchor="end"
                              className="font-mono font-black"
                              style={{ stroke: "#0F172A", strokeWidth: "0.2px" }}
                            >
                              {val}%
                            </text>
                          </g>
                        );
                      })}

                      {/* Chart Paths */}
                      {(() => {
                        const pts = historicalStats.trendPoints.map((pt, index) => {
                          const len = historicalStats.trendPoints.length;
                          const x = len > 1 ? 24 + (index / (len - 1)) * (496 - 24) : 250;
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
                              <linearGradient id="histGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
                                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {fillPathStr && (
                              <path 
                                d={fillPathStr} 
                                fill="url(#histGradient)" 
                              />
                            )}

                            {pathStr && (
                              <path 
                                d={pathStr} 
                                fill="none" 
                                stroke="#2563EB" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                            />
                          )}

                          {pts.map((p, idx) => (
                            <g key={idx}>
                              <circle 
                                cx={p.x} 
                                cy={p.y} 
                                r="3.5" 
                                fill="#FFFFFF" 
                                stroke="#2563EB" 
                                strokeWidth="1.75"
                              />
                              <text 
                                x={p.x} 
                                y={200 - 10} 
                                fill="#0F172A" 
                                fontSize="9" 
                                fontWeight="900"
                                textAnchor="middle"
                                className="uppercase tracking-wider font-sans font-black"
                                style={{ stroke: "#0F172A", strokeWidth: "0.2px" }}
                              >
                                {p.label}
                              </text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right Column: Narrative Analytics Insights & Alerts */}
          <div className="space-y-6">
            
            {/* Dynamic Insight Card Block (Insight Analisis Singkat) */}
            <div className="bg-slate-950 p-5 sm:p-6 rounded-2xl sm:rounded-3xl shadow-lg text-white relative overflow-hidden flex flex-col justify-between">
               <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-full blur-[40px] pointer-events-none" />
               <div className="absolute bottom-0 left-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-[40px] pointer-events-none" />
               
               <div>
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mb-4 flex items-center gap-2">
                   <Sparkles size={12} className="text-amber-400 shrink-0 animate-pulse" />
                   Insight Analisis Singkat
                 </h4>
                 
                 {/* Analytical deduction loops */}
                 {isLoading ? (
                   <p className="text-[9px] font-black text-slate-400 uppercase py-4">Memetakan pola data...</p>
                 ) : (
                   <div className="space-y-4">
                     {narrativeInsights.map((ins) => (
                       <div key={ins.id} className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/[0.06] transition-colors hover:bg-white/[0.08]">
                         <div className={`p-1.5 rounded-lg shrink-0 ${
                           ins.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                           ins.type === 'warning' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                           'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                         }`}>
                           <ins.icon size={13} strokeWidth={2.5} />
                         </div>
                         <div className="space-y-0.5 min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-300 leading-tight">
                              {ins.title}
                            </p>
                            <p className="text-[10px] font-semibold text-slate-400 leading-relaxed">
                              {ins.desc}
                            </p>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>

               {/* Recommendation Footer Badge based on rate */}
               <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                 <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Sistem Rekomendasi</span>
                 <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                    overallPresenceRate >= 85 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                 }`}>
                   {overallPresenceRate >= 85 ? 'Optimasi: Lanjutkan' : 'Optimasi: Monitor Kelompok'}
                 </span>
               </div>
            </div>

            {/* Announcement Box formatted beautifully for mobile/desktop */}
            <div className="bg-emerald-600 px-5 py-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm text-emerald-50 relative overflow-hidden">
               <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
                 <CheckCircle2 size={120} />
               </div>
               <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-200 mb-2 leading-none">
                 PENGUMUMAN PENTING
               </h4>
               <p className="text-xs sm:text-sm font-black tracking-tight leading-snug">
                 Jangan lupa untuk memverifikasi data dan menyinkronkan seluruh absensi kelompok sebelum tenggat pukul 21:00 WIB.
               </p>
            </div>

          </div>
        </div>

        {/* Activity feed containing the latest updates */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 sm:h-5 bg-blue-600 rounded-full" />
              <h3 className="text-[10px] sm:text-[11px] font-black text-slate-800 uppercase tracking-widest">
                Riwayat Aktivitas Presensi
              </h3>
            </div>
            
            <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black text-[#94A3B8] uppercase">
              <Clock size={12} />
              <span>Menampilkan up t. 8 Terakhir</span>
            </div>
          </div>

          {/* Desktop Table View & Mobile Content Switcher */}
          <div className="flex-1">
            {isLoading ? (
               <div className="flex flex-col items-center py-12 gap-2">
                  <div className="w-8 h-8 border-3 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Menyelaraskan Data...</span>
               </div>
            ) : logs.length === 0 ? (
               <div className="flex flex-col items-center py-12 text-slate-400 gap-2">
                  <FileText size={32} className="opacity-20" />
                  <span className="font-bold uppercase text-[9px] tracking-widest">Belum ada aktifitas hari ini</span>
               </div>
            ) : (
              <>
                {/* 1. Desktop Mode Layout Table (>= sm size) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[8px] sm:text-[9px] font-black text-[#94A3B8] uppercase tracking-wider border-b border-slate-50 bg-slate-50/50">
                        <th className="px-5 py-3">Waktu Input</th>
                        <th className="px-5 py-3">Nama Anggota</th>
                        <th className="px-5 py-3">Kelompok</th>
                        <th className="px-5 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-[10px] sm:text-xs font-semibold text-slate-600">
                      {logs.slice(0, 8).map((log, idx) => (
                        <tr key={log.id} className={`hover:bg-slate-50/50 transition-colors ${idx !== 7 ? 'border-b border-slate-100' : ''}`}>
                          <td className="px-5 py-4">
                            <span className="font-mono text-slate-400 font-bold uppercase">
                              {log.dateInput ? new Date(log.dateInput).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-black uppercase text-slate-900">{log.memberName}</td>
                          <td className="px-5 py-4 uppercase text-slate-500 font-bold">{log.kelompokName}</td>
                          <td className="px-5 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded bg-slate-100 text-[8px] font-black uppercase tracking-wider ${
                              log.status === 'Hadir' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                              log.status === 'Izin' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                              log.status === 'Sakit' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                              'bg-rose-50 text-rose-600 border border-rose-100'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 2. Mobile Cards Grid View (< sm size) */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {logs.slice(0, 8).map((log) => (
                    <div key={log.id} className="p-4 flex justify-between items-center bg-white">
                      <div className="space-y-1 truncate max-w-[70%]">
                        <p className="text-[11px] font-black uppercase text-slate-950 truncate leading-none">
                          {log.memberName}
                        </p>
                        <div className="flex items-center space-x-1.5 text-[8px] font-black text-slate-400 uppercase tracking-wide">
                          <span className="truncate">{log.kelompokName}</span>
                          <span>•</span>
                          <span className="font-mono">{log.dateInput ? new Date(log.dateInput).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shrink-0 ${
                        log.status === 'Hadir' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        log.status === 'Izin' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                        log.status === 'Sakit' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                  ))}
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
