import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, GlobalStats } from '../../types';
import { TrendingUp, TrendingDown, Wallet, BarChart3, Activity, Zap, Target, ArrowRight, X, Info, Calendar, Flame, HeartPulse, BrainCircuit, AlertTriangle, CheckCircle2, ShieldCheck, ArrowUpCircle, ArrowDownCircle, Lightbulb, Loader2 } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface DashboardProps {
  transactions: Transaction[];
  globalStats: GlobalStats | null;
  isLoading: boolean;
  isActive: boolean;
  username: string;
  role: string;
}

const SkeletonText = ({ className }: { className?: string }) => (
  <div className={`bg-slate-700/50 animate-pulse rounded ${className}`} />
);

const CustomTooltip = ({ active, payload, label, formatIDR }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm p-3 rounded-2xl border border-slate-100 shadow-xl ring-1 ring-slate-900/5">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 border-b border-slate-50 pb-1">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => {
            const isIncome = entry.dataKey === 'income';
            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <span className={`text-[10px] font-black uppercase tracking-widest ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isIncome ? 'M :' : 'K :'}
                </span>
                <span className={`text-[11px] font-black ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatIDR(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({ transactions, globalStats, isLoading, isActive, username, role }) => {
  const [hasEverBeenVisible, setHasEverBeenVisible] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isActive && !hasEverBeenVisible) {
      const timer = setTimeout(() => setHasEverBeenVisible(true), 300);
      return () => clearTimeout(timer);
    }
  }, [isActive, hasEverBeenVisible]);

  const isMobile = windowWidth < 768;
  const isSmallMobile = windowWidth < 380;

  const calculatedBarSize = useMemo(() => {
    if (isSmallMobile) return 6;
    if (isMobile) return 10;
    if (windowWidth < 1024) return Math.max(14, Math.min(20, windowWidth / 55));
    return Math.max(20, Math.min(32, windowWidth / 45));
  }, [windowWidth, isMobile, isSmallMobile]);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 1000000) return (tickItem / 1000000).toFixed(1).replace('.0', '') + 'jt';
    if (tickItem >= 1000) return (tickItem / 1000).toFixed(0) + 'rb';
    return tickItem.toString();
  };

  const parseSafeDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    if (String(dateStr).includes('-')) {
      const parts = String(dateStr).split('T')[0].split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
           return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
           return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const chartData = useMemo(() => {
    const monthsData: Record<string, any> = {};
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      monthsData[key] = { 
        name: d.toLocaleDateString('id-ID', { month: 'short' }), 
        income: 0, 
        expense: 0, 
        sort: key 
      };
    }

    transactions.forEach(t => {
      const d = parseSafeDate(t.date || t.formattedDate);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      if (monthsData[key]) {
        const amt = Number(t.amount || 0);
        if (t.type === 'masuk') monthsData[key].income += amt;
        else monthsData[key].expense += amt;
      }
    });

    return Object.values(monthsData).sort((a: any, b: any) => a.sort.localeCompare(b.sort));
  }, [transactions]);

  const analysis = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    let income30d = 0;
    let expense30d = 0;
    let count30d = 0;

    let currMIncome = 0;
    let currMExpense = 0;
    const currMonth = now.getMonth();
    const currYear = now.getFullYear();

    transactions.forEach(t => {
      const amt = Number(t.amount || 0);
      const d = parseSafeDate(t.date || t.formattedDate);
      
      if (d >= thirtyDaysAgo && d <= now) {
        count30d++;
        if (t.type === 'masuk') income30d += amt;
        else expense30d += amt;
      }

      if (d.getMonth() === currMonth && d.getFullYear() === currYear) {
        if (t.type === 'masuk') currMIncome += amt;
        else currMExpense += amt;
      }
    });

    const netFlow30d = income30d - expense30d;
    const efficiencyRatio = income30d > 0 ? (expense30d / income30d) * 100 : (expense30d > 0 ? 100 : 0);
    const savingsRatio = income30d > 0 ? (netFlow30d / income30d) * 100 : 0;
    
    let healthScore = 50;
    if (savingsRatio > 25) healthScore += 30;
    else if (savingsRatio > 0) healthScore += 10;
    else healthScore -= 20;
    
    if (efficiencyRatio < 40) healthScore += 20;
    else if (efficiencyRatio > 90) healthScore -= 15;
    
    healthScore = Math.max(0, Math.min(100, healthScore));

    const dailyAvg = expense30d / 30;
    const estimatedRunway = globalStats && dailyAvg > 0 ? Math.floor(globalStats.totalBalance / dailyAvg) : (globalStats && globalStats.totalBalance > 0 ? Infinity : 0);
    const projection30Days = globalStats ? globalStats.totalBalance + netFlow30d : 0;

    let statusTitle: string;
    let statusColor: string;
    let riskLevel = "Rendah";
    let riskColor = "text-emerald-500";
    let conclusion: string;
    let recommendations: string[];

    if (healthScore >= 80) {
      statusTitle = "Prima (Sangat Sehat)";
      statusColor = "text-emerald-600";
      conclusion = "Kondisi keuangan dalam 30 hari terakhir sangat solid with surplus yang signifikan.";
      recommendations = [
        "Pertimbangkan untuk mengalokasikan dana surplus ke dana abadi atau investasi operasional.",
        "Optimalkan sistem pelaporan untuk mempertahankan transparansi tinggi ini.",
        "Rencanakan pengeluaran besar di masa depan selagi likuiditas tinggi."
      ];
    } else if (healthScore >= 50) {
      statusTitle = "Cukup Stabil";
      statusColor = "text-blue-600";
      conclusion = "Keuangan berjalan normal dengan arus kas yang seimbang, meskipun efisiensi masih bisa ditingkatkan.";
      recommendations = [
        "Lakukan audit pada pengeluaran kecil yang bersifat repetitif.",
        "Pastikan tagihan atau piutang segera diproses untuk menjaga arus kas tetap positif.",
        "Siapkan dana darurat minimal 10% dari total saldo saat ini."
      ];
    } else {
      statusTitle = "Kritis (Perhatian Khusus)";
      statusColor = "text-rose-600";
      riskLevel = "Tinggi";
      riskColor = "text-rose-500";
      conclusion = "Terdapat defisit atau laju pengeluaran yang melebihi kapasitas pemasukan dalam periode ini.";
      recommendations = [
        "Hentikan sementara pengeluaran non-prioritas hingga saldo stabil.",
        "Evaluasi kembali anggaran bulanan dan pangkas biaya tetap yang tidak esensial.",
        "Segera cari sumber pemasukan tambahan atau lakukan penagihan tertunda."
      ];
    }

    const efficiencyInsight = efficiencyRatio <= 70 
      ? "Pengeluaran terkontrol. Memiliki ruang gerak finansial."
      : efficiencyRatio <= 90 
        ? "Efisiensi stabil, perhatikan pengeluaran kecil."
        : "Laju pengeluaran tinggi. Tinjau anggaran.";

    return {
      currMIncome,
      currMExpense,
      currMCount: count30d,
      netFlow: netFlow30d,
      savingsRatio,
      efficiencyRatio,
      healthScore,
      dailyAvg,
      estimatedRunway,
      projection30Days,
      efficiencyInsight,
      statusTitle,
      statusColor,
      riskLevel,
      riskColor,
      conclusion,
      recommendations,
      monthName: now.toLocaleDateString('id-ID', { month: 'long' })
    };
  }, [transactions, globalStats]);

  const isDataLoaded = transactions.length > 0 || globalStats !== null;

  return (
    <div className="h-full overflow-y-auto no-scrollbar p-3 sm:p-4 md:p-10 space-y-4 sm:space-y-6 pb-32">
      {/* Modal Analisis Mendalam */}
      {showAnalysis && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-900/95 backdrop-blur-2xl animate-backdrop">
          <div className="bg-white w-full max-w-4xl max-h-[85%] md:max-h-[90vh] rounded-xl sm:rounded-3xl shadow-2xl border border-white/20 overflow-hidden animate-dialog-bounce flex flex-col mx-auto">
            <div className="bg-gradient-to-br from-slate-900 to-blue-900 p-4 md:p-8 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3 md:space-x-4">
                <div className="bg-blue-500 p-2 md:p-3 rounded-xl shadow-lg shadow-blue-500/20"><BrainCircuit size={isMobile ? 18 : 26} /></div>
                <div>
                  <h3 className="text-[10px] md:text-lg font-black uppercase tracking-[0.15em]">Analisis Cerdas</h3>
                  <p className="text-[7px] md:text-[10px] text-blue-300 font-bold uppercase tracking-widest">Financial Report v3.1</p>
                </div>
              </div>
              <button onClick={() => setShowAnalysis(false)} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors"><X size={isMobile ? 18 : 26} /></button>
            </div>
            
            <div className="p-4 md:p-8 space-y-5 md:space-y-8 overflow-y-auto no-scrollbar flex-1 overscroll-contain">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-8 items-center">
                 <div className="lg:col-span-4 flex justify-center">
                    <div className="relative w-28 h-28 sm:w-36 md:w-48 sm:h-36 md:h-48 flex items-center justify-center">
                       <svg className="w-full h-full -rotate-90 overflow-visible" viewBox="0 0 192 192">
                         <circle cx="96" cy="96" r="82" fill="transparent" stroke="#f8fafc" strokeWidth="10" />
                         <circle 
                           cx="96" cy="96" r="82" fill="transparent" 
                           stroke={analysis.healthScore > 75 ? '#10b981' : analysis.healthScore > 45 ? '#3b82f6' : '#f43f5e'} 
                           strokeWidth="10" 
                           strokeDasharray="515" 
                           strokeDashoffset={515 - (515 * analysis.healthScore / 100)} 
                           strokeLinecap="round" 
                           className="transition-all duration-1000 ease-out" 
                         />
                       </svg>
                       <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl sm:text-3xl md:text-5xl font-black text-slate-800">{analysis.healthScore}</span>
                          <span className="text-[6px] md:text-[9px] font-black uppercase text-slate-400 tracking-[0.3em]">Score</span>
                       </div>
                    </div>
                 </div>
                 
                 <div className="lg:col-span-8 space-y-3">
                    <div className="space-y-1 text-center lg:text-left">
                       <div className="flex items-center justify-center lg:justify-start space-x-2">
                          <ShieldCheck className={analysis.statusColor} size={16} />
                          <h4 className={`text-[11px] md:text-lg font-black uppercase tracking-tight ${analysis.statusColor}`}>Status: {analysis.statusTitle}</h4>
                       </div>
                       <p className="text-[9px] md:text-sm font-bold text-slate-600 leading-relaxed px-2 lg:px-0">
                         "{analysis.conclusion}"
                       </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                       <div className="bg-slate-50 p-2 md:p-3 rounded-xl border border-slate-100">
                          <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Risk Level</span>
                          <span className={`text-[8px] md:text-[10px] font-black uppercase ${analysis.riskColor}`}>{analysis.riskLevel}</span>
                       </div>
                       <div className="bg-slate-50 p-2 md:p-3 rounded-xl border border-slate-100">
                          <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Proyeksi</span>
                          <span className="text-[8px] md:text-[10px] font-black text-slate-800 truncate block">{formatIDR(analysis.projection30Days)}</span>
                       </div>
                       <div className="bg-slate-50 p-2 md:p-3 rounded-xl border border-slate-100">
                          <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Burn Rate</span>
                          <span className="text-[8px] md:text-[10px] font-black text-rose-500 truncate block">{formatIDR(analysis.dailyAvg)}</span>
                       </div>
                       <div className="bg-slate-50 p-2 md:p-3 rounded-xl border border-slate-100">
                          <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Runway</span>
                          <span className="text-[8px] md:text-[10px] font-black text-emerald-500 truncate block">{analysis.estimatedRunway === Infinity ? '∞' : analysis.estimatedRunway} Hari</span>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                 <div className="space-y-3">
                    <h5 className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                       <CheckCircle2 size={12} className="text-emerald-500" /> Rencana Tindakan
                    </h5>
                    <div className="space-y-2">
                       {analysis.recommendations.map((rec, i) => (
                          <div key={i} className="flex items-start gap-2.5 bg-white p-2.5 md:p-3 rounded-xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all group">
                             <div className="w-5 h-5 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0 font-black text-[8px] group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                {i + 1}
                             </div>
                             <p className="text-[9px] md:text-xs font-bold text-slate-700 leading-tight">{rec}</p>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-3">
                    <h5 className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                       <Activity size={12} className="text-blue-500" /> Metrik Kinerja (30H)
                    </h5>
                    <div className="grid grid-cols-1 gap-2">
                       <div className="bg-slate-50 p-2.5 md:p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                             <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><ArrowUpCircle size={14} /></div>
                             <div>
                                <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest block">Savings Capacity</span>
                                <p className="text-[9px] md:text-sm font-black text-slate-800">{analysis.savingsRatio.toFixed(1)}%</p>
                             </div>
                          </div>
                       </div>

                       <div className="bg-slate-50 p-2.5 md:p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                             <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg"><ArrowDownCircle size={14} /></div>
                             <div>
                                <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest block">Efficiency Ratio</span>
                                <p className="text-[9px] md:text-sm font-black text-slate-800">{analysis.efficiencyRatio.toFixed(1)}%</p>
                             </div>
                          </div>
                       </div>

                       <div className="bg-blue-50/50 p-2.5 md:p-3 rounded-xl border border-blue-100/50 flex items-center gap-2.5">
                          <div className="p-1.5 bg-blue-600 text-white rounded-lg"><Lightbulb size={14} /></div>
                          <div>
                             <span className="text-[6px] font-black text-blue-400 uppercase tracking-widest block">Saran Sistem</span>
                             <p className="text-[8px] font-bold text-blue-700 italic">"{analysis.efficiencyInsight}"</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            </div>

            <div className="p-4 md:p-8 bg-slate-50 border-t border-slate-100 text-center flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 shrink-0">
              <button onClick={() => setShowAnalysis(false)} className="w-full md:w-auto px-10 py-3 bg-slate-900 text-white rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.25em] shadow-lg hover:bg-blue-600 transition-all active:scale-95">Tutup Laporan</button>
              <div className="flex items-center gap-1.5 text-[7px] font-black text-slate-400 uppercase tracking-widest">
                 <ShieldCheck size={10} className="text-emerald-500" />
                 Sistem Terverifikasi
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Saldo Global */}
      <div className="bg-slate-900 p-5 sm:p-6 md:p-12 rounded-2xl sm:rounded-3xl text-white shadow-2xl relative overflow-hidden group min-h-[160px] sm:min-h-[220px] flex flex-col justify-center">
        <div className="absolute top-0 right-0 p-8 opacity-5 sm:opacity-10 group-hover:scale-110 transition-transform">
          <Wallet size={isMobile ? 80 : 140} />
        </div>
        <div className="relative z-10 space-y-4 sm:space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-[8px] sm:text-[10px] md:text-sm font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-blue-400 bg-blue-500/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-blue-500/20 flex items-center gap-1.5 sm:gap-2">
              <Zap size={isMobile ? 12 : 14} /> Saldo Global
            </span>
            <span className="text-[8px] sm:text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">
              {analysis.monthName} {new Date().getFullYear()}
            </span>
          </div>
          
          <div className="h-10 sm:h-14 flex items-baseline">
            {isLoading && !globalStats ? (
              <div className="flex items-baseline space-x-2 animate-pulse">
                <span className="text-xl sm:text-2xl font-bold opacity-30">Rp</span>
                <div className="h-8 sm:h-12 w-40 sm:w-60 bg-white/10 rounded-xl" />
              </div>
            ) : (
              <h2 className={`font-black tracking-tight flex items-baseline leading-none transition-all duration-700 ${isSmallMobile ? 'text-2xl' : 'text-3xl sm:text-4xl md:text-5xl'}`}>
                {globalStats ? formatIDR(globalStats.totalBalance) : formatIDR(0)}
              </h2>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-white/5">
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-[7px] sm:text-[9px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Masuk Bulan Ini</p>
              {isLoading && !isDataLoaded ? (
                <SkeletonText className="h-5 sm:h-7 w-24 sm:w-32 mt-1 opacity-20" />
              ) : (
                <span className={`text-emerald-400 font-black ${isSmallMobile ? 'text-sm' : 'text-lg sm:text-xl md:text-2xl'}`}>{formatIDR(analysis.currMIncome)}</span>
              )}
            </div>
            <div className="space-y-0.5 sm:space-y-1 pl-3 sm:pl-6 border-l border-white/5">
              <p className="text-[7px] sm:text-[9px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Keluar Bulan Ini</p>
              {isLoading && !isDataLoaded ? (
                <SkeletonText className="h-5 sm:h-7 w-24 sm:w-32 mt-1 opacity-20" />
              ) : (
                <span className={`text-rose-400 font-black ${isSmallMobile ? 'text-sm' : 'text-lg sm:text-xl md:text-2xl'}`}>{formatIDR(analysis.currMExpense)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grafik Riwayat Kas */}
      <div className="bg-white p-5 sm:p-6 md:p-10 lg:p-12 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 space-y-6 sm:space-y-8 min-h-[300px] sm:min-h-[400px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-black text-[9px] sm:text-[11px] md:text-sm flex items-center space-x-2 sm:space-x-3 text-slate-800 uppercase tracking-widest">
              <BarChart3 className="text-blue-500" size={isMobile ? 16 : 18} />
              <span>Volume Arus Kas</span>
            </h3>
            <p className="text-[7px] sm:text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest sm:px-8">Riwayat 6 Bulan Terakhir</p>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 bg-slate-50 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-100 self-start sm:self-auto">
             <div className="flex items-center space-x-1.5"><div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-500 rounded-full" /><span className="text-[7px] sm:text-[8px] font-black uppercase text-slate-600">Masuk</span></div>
             <div className="flex items-center space-x-1.5"><div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-rose-500 rounded-full" /><span className="text-[7px] sm:text-[8px] font-black uppercase text-slate-600">Keluar</span></div>
          </div>
        </div>

        <div className="h-[220px] sm:h-[260px] md:h-[320px] lg:h-[400px] w-full flex items-center justify-center">
          {isDataLoaded && hasEverBeenVisible ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData} 
                margin={{ top: 10, right: 10, left: 10, bottom: 20 }} 
                barCategoryGap={isMobile ? "25%" : "15%"}
                barGap={isSmallMobile ? 2 : isMobile ? 4 : 8}
              >
                <defs>
                  <linearGradient id="barIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="barExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: isSmallMobile ? 8 : 10, fontWeight: 800}} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: isSmallMobile ? 8 : 10, fontWeight: 600}} 
                  tickFormatter={formatYAxis}
                  width={isSmallMobile ? 45 : 60} 
                />
                <Tooltip 
                  cursor={{fill: '#f8fafc', radius: 8}}
                  content={<CustomTooltip formatIDR={formatIDR} />}
                />
                <Bar 
                  dataKey="income" 
                  fill="url(#barIncome)" 
                  radius={[4, 4, 0, 0]} 
                  barSize={calculatedBarSize}
                  animationDuration={1500}
                />
                <Bar 
                  dataKey="expense" 
                  fill="url(#barExpense)" 
                  radius={[4, 4, 0, 0]} 
                  barSize={calculatedBarSize}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
               <div className="relative">
                 <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
                 <Activity size={32} className="relative animate-bounce text-blue-500" />
               </div>
               <div className="flex flex-col items-center space-y-2">
                 <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-300">Sinkronisasi Kas...</p>
                 <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full">
                    <Loader2 size={10} className="animate-spin text-blue-500" />
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Background Fetching</span>
                 </div>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Kartu Analisis Cepat */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
        {/* Efisiensi Kas */}
        <div className="bg-white p-5 sm:p-6 md:p-10 lg:p-12 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 space-y-6 sm:space-y-8">
          <h3 className="font-black text-[9px] sm:text-[11px] md:text-sm flex items-center space-x-2 sm:space-x-3 text-slate-400 uppercase tracking-widest">
            <Activity className="text-blue-500" size={isMobile ? 16 : 18} />
            <span>Efisiensi Kas</span>
          </h3>
          <div className="space-y-6 sm:space-y-8">
            <div className="flex items-end justify-between">
              <div className="space-y-0.5 sm:space-y-1">
                {isLoading && !isDataLoaded ? (
                   <SkeletonText className="h-8 sm:h-12 w-20 sm:w-28 mb-1" />
                ) : (
                  <p className={`font-black ${isSmallMobile ? 'text-2xl' : 'text-3xl md:text-4xl'} ${analysis.efficiencyRatio > 80 ? 'text-rose-500' : 'text-slate-800'}`}>
                    {analysis.efficiencyRatio.toFixed(1)}%
                  </p>
                )}
                <p className="text-[7px] sm:text-[9px] md:text-xs font-black text-slate-400 uppercase tracking-widest">Expense Ratio (30D)</p>
              </div>
              <div className="text-right space-y-0.5 sm:space-y-1">
                {isLoading && !isDataLoaded ? (
                   <SkeletonText className="h-4 sm:h-6 w-24 sm:w-32 mb-1 ml-auto" />
                ) : (
                  <p className={`font-black text-slate-700 ${isSmallMobile ? 'text-[11px]' : 'text-sm md:text-lg'}`}>{formatIDR(analysis.dailyAvg)}</p>
                )}
                <p className="text-[7px] sm:text-[9px] md:text-xs font-black text-slate-400 uppercase tracking-widest">Burn Rate / Day</p>
              </div>
            </div>
            <div className="h-2.5 sm:h-3 w-full bg-slate-50 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    isLoading && !isDataLoaded ? 'bg-slate-200 animate-pulse' :
                    analysis.efficiencyRatio <= 70 ? 'bg-emerald-500' : analysis.efficiencyRatio <= 90 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: isLoading && !isDataLoaded ? '40%' : `${Math.min(analysis.efficiencyRatio, 100)}%` }}
                />
            </div>
            <div className="p-4 sm:p-6 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100">
               {isLoading && !isDataLoaded ? (
                 <div className="space-y-2">
                    <SkeletonText className="h-2 w-full opacity-50" />
                    <SkeletonText className="h-2 w-[80%] opacity-50" />
                 </div>
               ) : (
                 <p className="text-[9px] sm:text-[11px] md:text-xs font-bold text-slate-500 italic leading-relaxed">
                   "{analysis.efficiencyInsight}"
                 </p>
               )}
            </div>
          </div>
        </div>

        {/* Kapasitas Surplus */}
        <div className="bg-white p-5 sm:p-6 md:p-10 lg:p-12 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 space-y-6 sm:space-y-8">
          <h3 className="font-black text-[9px] sm:text-[11px] md:text-sm flex items-center space-x-2 sm:space-x-3 text-slate-400 uppercase tracking-widest">
            <Target className="text-blue-500" size={isMobile ? 16 : 18} />
            <span>Kapasitas Surplus</span>
          </h3>
          <div className="space-y-6 sm:space-y-8">
            <div className="flex items-end justify-between">
              <div className="space-y-0.5 sm:space-y-1">
                {isLoading && !isDataLoaded ? (
                   <SkeletonText className="h-8 sm:h-12 w-20 sm:w-28 mb-1" />
                ) : (
                  <p className={`font-black ${isSmallMobile ? 'text-2xl' : 'text-3xl md:text-4xl'} ${analysis.netFlow >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {analysis.savingsRatio.toFixed(1)}%
                  </p>
                )}
                <p className="text-[7px] sm:text-[9px] md:text-xs font-black text-slate-400 uppercase tracking-widest">Saving Cap (30D)</p>
              </div>
              <div className="text-right space-y-0.5 sm:space-y-1">
                {isLoading && !isDataLoaded ? (
                   <SkeletonText className="h-4 sm:h-6 w-12 sm:w-16 mb-1 ml-auto" />
                ) : (
                  <p className={`font-black text-slate-700 ${isSmallMobile ? 'text-[11px]' : 'text-sm md:text-lg'}`}>{analysis.currMCount}</p>
                )}
                <p className="text-[7px] sm:text-[9px] md:text-xs font-black text-slate-400 uppercase tracking-widest">Trx / 30D</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="p-3 sm:p-5 bg-blue-50 rounded-xl sm:rounded-2xl flex flex-col border border-blue-100">
                 <span className="text-[6px] sm:text-[8px] md:text-[10px] font-black text-blue-400 uppercase mb-0.5 tracking-widest">Kondisi Kas</span>
                 {isLoading && !isDataLoaded ? (
                   <SkeletonText className="h-4 sm:h-5 w-16 sm:w-24 mt-0.5 opacity-30" />
                 ) : (
                   <span className={`text-[10px] sm:text-xs md:text-base font-black uppercase ${analysis.netFlow >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                      {analysis.netFlow >= 0 ? 'Surplus' : 'Defisit'}
                   </span>
                 )}
              </div>
              <div className="p-3 sm:p-5 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100 flex flex-col">
                 <span className="text-[6px] sm:text-[8px] md:text-[10px] font-black text-slate-400 uppercase mb-0.5 tracking-widest">Net Flow 30D</span>
                 {isLoading && !isDataLoaded ? (
                   <SkeletonText className="h-4 sm:h-5 w-20 sm:w-32 mt-0.5 opacity-30" />
                 ) : (
                   <span className="text-[10px] sm:text-xs md:text-base font-black text-slate-700 truncate">
                      {formatIDR(analysis.netFlow)}
                   </span>
                 )}
              </div>
            </div>
            
            {/* Tombol Analisis Mendalam */}
            <div className="pt-2">
                 <button 
                  onClick={() => setShowAnalysis(true)} 
                  disabled={isLoading && !isDataLoaded}
                  className="flex w-full py-4 sm:py-5 bg-slate-900 text-white rounded-xl sm:rounded-2xl font-black text-[9px] md:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.3em] items-center justify-center space-x-2 sm:space-x-3 hover:bg-blue-600 transition-all shadow-2xl hover:scale-[1.02] active:scale-95 group disabled:bg-slate-300 disabled:shadow-none disabled:scale-100"
                 >
                    <BrainCircuit size={14} className="group-hover:rotate-12 transition-transform" />
                    <span>Laporan Analisis Mendalam</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                 </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;