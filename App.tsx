
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LayoutDashboard, ReceiptText, Receipt, History, Wallet, RefreshCw, AlertCircle, FileText, Settings, Loader2, LogOut, ChevronsLeft, ChevronsRight, UserCircle, ShieldAlert, FileEdit, CheckCircle2, AlertTriangle, HelpCircle, User, Users, Fingerprint, Trash2, Layers, Filter, Info, X, Clock, ShieldCheck, Copy, Check, CalendarDays } from 'lucide-react';
import { Transaction, DeletedTransaction, EditHistory, AppTab, GlobalStats, ProjectMetadata, AppType, AbsensiMember, AttendanceLog, DesaData, KelompokData, AgeCategoryData, DaerahData, EventData, Family, FamilyRelationship } from './types';
import Dashboard from './components/bendahara/DashboardBendahara';
import TransactionForm from './components/bendahara/TransactionForm';
import HistoryView from './components/bendahara/HistoryView';
import LaporanView from './components/bendahara/LaporanView';
import Login from './components/other/Login';
import { SuperadminPanel } from './components/other/SuperadminPanel';
import SetupGuide from './components/other/SetupGuide';
import DeleteHistoryView from './components/bendahara/DeleteHistoryView';
import EditAuditView from './components/bendahara/EditAuditView';
import ChangePassword from './components/other/ChangePassword';
import { 
  dbGetTransactions, dbAddCategory, dbGetCategories, dbGetProjects, 
  dbGetApprovals, dbGetDeletedTransactions, dbGetEditHistory, 
  dbGetMembers, dbGetDesas, dbGetKelompoks, dbGetAgeCategories, 
  dbGetAttendanceLogs, dbGetDaerahs, initializeDynamicDb, activeAuth, db,
  dbSubscribeMembers, dbSubscribeDaerahs, dbSubscribeDesas, 
  dbSubscribeKelompoks, dbSubscribeAgeCategories, dbSubscribeAttendanceLogs,
  dbGetEvents, dbSubscribeEvents, dbAddEvent, dbDeleteEvent,
  dbGetFamilies, dbGetFamilyRelationships
} from './supabase';

// Absensi Components
import DashboardAbsensi from './components/absensi/DashboardAbsensi';
import AttendanceForm from './components/absensi/AttendanceForm';
import AttendanceHistory from './components/absensi/AttendanceHistory';
import MemberManagement from './components/absensi/MemberManagement';
import GroupManagement from './components/absensi/GroupManagement';

const PORTAL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzPAMEz3PFn2uCJ1qn6sVhuDd9Fb6vsJLyhQF-kfuc1f4GB9xJF0d15pLmDPmhdZPGtfg/exec';

const cleanNumber = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const dmyToIso = (dmy: string): string => {
  if (!dmy) return '';
  const parts = dmy.split('-');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    if (day.length === 2 && year.length === 4) return `${year}-${month}-${day}`;
  }
  return dmy;
};

const TabView: React.FC<{ id: AppTab; activeTab: AppTab; children: React.ReactNode }> = ({ id, activeTab, children }) => (
  <div className={`absolute inset-0 transition-all duration-500 ease-out ${activeTab === id ? 'opacity-100 translate-y-0 z-20 animate-tab-entry' : 'opacity-0 translate-y-8 pointer-events-none z-0'}`}>
    {children}
  </div>
);

const NavItem: React.FC<{ tab: AppTab, activeTab: AppTab, icon: any, label: string, sidebarCollapsed: boolean, setActiveTab: (tab: AppTab) => void }> = ({ tab, activeTab, icon: Icon, label, sidebarCollapsed, setActiveTab }) => (
  <button 
    onClick={() => setActiveTab(tab)} 
    className={`w-full flex items-center px-4 rounded-xl transition-all duration-500 relative z-10 h-[42px] justify-start ${activeTab === tab ? 'text-white' : 'text-slate-400 hover:text-white'}`}
  >
    <Icon size={18} className="flex-shrink-0" />
    <span 
      style={{
        maxWidth: sidebarCollapsed ? '0px' : '200px',
        opacity: sidebarCollapsed ? 0 : 1,
        marginLeft: sidebarCollapsed ? '0px' : '12px',
        transition: 'max-width 500ms cubic-bezier(0.4, 0, 0.2, 1), opacity 500ms, margin-left 500ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      className="text-[11px] md:text-xs font-black uppercase tracking-tight whitespace-nowrap overflow-hidden"
    >
      {label}
    </span>
  </button>
);

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => localStorage.getItem('isLoggedIn') === 'true');
  const [isAuthInitializing, setIsAuthInitializing] = useState<boolean>(true);
  const [currentUsername, setCurrentUsername] = useState<string>(() => localStorage.getItem('username') || '');
  const [fullName, setFullName] = useState<string>(() => localStorage.getItem('full_name') || '');
  const [currentRole, setCurrentRole] = useState<string>(() => localStorage.getItem('role') || 'Viewer');
  const [originalRole, setOriginalRole] = useState<string>(() => localStorage.getItem('original_role') || '');
  const [instansi, setInstansi] = useState<string>(() => localStorage.getItem('instansi') || 'Bendahara');
  const [activeScriptUrl, setActiveScriptUrl] = useState<string>(() => (localStorage.getItem('activeScriptUrl') || '').trim());
  const [absensiMasterUrl, setAbsensiMasterUrl] = useState<string>(() => (localStorage.getItem('absensiMasterUrl') || '').trim());
  const [absensiLogUrl, setAbsensiLogUrl] = useState<string>(() => (localStorage.getItem('absensiLogUrl') || '').trim());
  const [webAccessStrings, setWebAccessStrings] = useState<string[]>(() => (localStorage.getItem('web_access') || 'bendahara').split(',').map(s => s.trim()));
  const [currentApp, setCurrentApp] = useState<AppType>(() => (localStorage.getItem('currentApp') as AppType) || (localStorage.getItem('web_access')?.includes('absensi') && !localStorage.getItem('web_access')?.includes('bendahara') ? 'absensi' : 'bendahara'));
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [availableProjects, setAvailableProjects] = useState<ProjectMetadata[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>(['Konsumsi', 'Operasional', 'Peralatan', 'Transportasi', 'Sponsorship', 'Dana Hibah', 'Lain-lain']);
  const [deletedTransactions, setDeletedTransactions] = useState<DeletedTransaction[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistory[]>([]);
  const [approvalsList, setApprovalsList] = useState<any[]>([]); 
  const [auditSubTab, setAuditSubTab] = useState<'delete' | 'edit'>('delete');
  const [showAllAudit, setShowAllAudit] = useState(false);
  
  const [selectedDeleteAudit, setSelectedDeleteAudit] = useState<DeletedTransaction | null>(null);
  const [selectedEditAudit, setSelectedEditAudit] = useState<EditHistory | null>(null);
  const [copiedAuditId, setCopiedAuditId] = useState<string | null>(null);

  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [syncBaseBalance, setSyncBaseBalance] = useState<number>(0);
  const [historicalOpeningBalances, setHistoricalOpeningBalances] = useState<Record<string, number>>({});
  
  const [isLoading, setIsLoading] = useState(false);
  const [isAuditLoading, setIsLoadingAudit] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toast, setToast] = useState<{show: boolean, msg: string, type: 'success' | 'error'}>({ show: false, msg: '', type: 'success' });
  const [dialog, setDialog] = useState<{ show: boolean, title: string, msg: string, confirmText: string, onConfirm: () => void, isDanger?: boolean, isSubmitting: boolean, isSuccess: boolean }>({ show: false, title: '', msg: '', confirmText: '', onConfirm: () => {}, isDanger: false, isSubmitting: false, isSuccess: false });

  // Absensi State
  const [absensiMembers, setAbsensiMembers] = useState<AbsensiMember[]>(() => {
    try {
      const inst = localStorage.getItem('instansi') || '';
      if (inst) {
        const cached = localStorage.getItem(`absensi_members_${inst}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn("Cached absensi members read failed:", e);
    }
    return [];
  });
  const [rawMembers, setRawMembers] = useState<AbsensiMember[]>(() => {
    try {
      const inst = localStorage.getItem('instansi') || '';
      if (inst) {
        const cached = localStorage.getItem(`absensi_raw_members_${inst}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn("Cached raw members read failed:", e);
    }
    return [];
  });
  const [absensiLogs, setAbsensiLogs] = useState<AttendanceLog[]>(() => {
    try {
      const inst = localStorage.getItem('instansi') || '';
      if (inst) {
        const cached = localStorage.getItem(`absensi_logs_${inst}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (_) {
      console.warn("Failed to read absensi logs from cache.");
    }
    return [];
  });
  const absensiSummaries = useMemo(() => {
    const logsByDate: { [dateStr: string]: AttendanceLog[] } = {};
    for (const log of absensiLogs) {
      const rawDate = log.date || '';
      const dateStr = rawDate.split(' ')[0] || rawDate.split('T')[0];
      if (dateStr) {
        if (!logsByDate[dateStr]) logsByDate[dateStr] = [];
        logsByDate[dateStr].push(log);
      }
    }

    return Object.entries(logsByDate).map(([dateStr, dateLogs]) => {
      const totalCount = dateLogs.length;
      const statusCounts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 };
      const genderCounts: { [gender: string]: any } = {};
      const daerahCounts: { [daerahId: string]: any } = {};
      const desaCounts: { [desaId: string]: any } = {};
      const kelompokCounts: { [kelompokId: string]: any } = {};
      const ageCategoryCounts: { [ageCategoryId: string]: any } = {};

      for (const log of dateLogs) {
        const status = log.status;
        if (!status) continue;
        
        if (status === 'Hadir' || status === 'Izin' || status === 'Sakit' || status === 'Alpa') {
          statusCounts[status]++;
        }

        const member = rawMembers.find(m => String(m.id) === String(log.memberId));
        
        const gender = (member?.jenis_kelamin || (log as any).gender || 'L').toUpperCase().startsWith('P') ? 'P' : 'L';
        const ageId = member?.age_category_id || (log as any).ageCategoryId || log.ageName || 'Unknown';
        const kelompokId = member?.kelompok_id || (log as any).kelompokId || log.kelompokName || 'Unknown';
        const desaId = member?.desa_id || (log as any).desaId || log.desaName || 'Unknown';
        const daerahId = member?.daerah_id || (log as any).daerahId || log.daerahName || 'Unknown';

        const updateMap = (subMap: any, key: string) => {
          const checkKey = key || 'Unknown';
          if (!subMap[checkKey]) {
            subMap[checkKey] = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 };
          }
          if (subMap[checkKey][status] !== undefined) {
            subMap[checkKey][status]++;
          }
        };

        updateMap(genderCounts, gender);
        updateMap(daerahCounts, daerahId);
        updateMap(desaCounts, desaId);
        updateMap(kelompokCounts, kelompokId);
        updateMap(ageCategoryCounts, ageId);
      }

      return {
        id: dateStr,
        date: dateStr,
        totalCount,
        statusCounts,
        genderCounts,
        daerahCounts,
        desaCounts,
        kelompokCounts,
        ageCategoryCounts
      };
    });
  }, [absensiLogs, rawMembers]);
  const [absensiDaerahs, setAbsensiDaerahs] = useState<DaerahData[]>(() => {
    try {
      const inst = localStorage.getItem('instansi') || '';
      if (inst) {
        const cached = localStorage.getItem(`absensi_daerahs_${inst}`);
        if (cached) return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("Cached daerahs read failed:", e);
    }
    return [];
  });
  const [absensiDesas, setAbsensiDesas] = useState<DesaData[]>(() => {
    try {
      const inst = localStorage.getItem('instansi') || '';
      if (inst) {
        const cached = localStorage.getItem(`absensi_desas_${inst}`);
        if (cached) return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("Cached desas read failed:", e);
    }
    return [];
  });
  const [absensiKelompoks, setAbsensiKelompoks] = useState<KelompokData[]>(() => {
    try {
      const inst = localStorage.getItem('instansi') || '';
      if (inst) {
        const cached = localStorage.getItem(`absensi_kelompoks_${inst}`);
        if (cached) return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("Cached kelompoks read failed:", e);
    }
    return [];
  });
  const [absensiAges, setAbsensiAges] = useState<AgeCategoryData[]>(() => {
    try {
      const inst = localStorage.getItem('instansi') || '';
      if (inst) {
        const cached = localStorage.getItem(`absensi_ages_${inst}`);
        if (cached) return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("Cached ages read failed:", e);
    }
    return [];
  });
  const [absensiEvents, setAbsensiEvents] = useState<EventData[]>(() => {
    try {
      const inst = localStorage.getItem('instansi') || '';
      if (inst) {
        const cached = localStorage.getItem(`absensi_events_${inst}`);
        if (cached) return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("Cached events read failed:", e);
    }
    return [];
  });
  const [absensiFamilies, setAbsensiFamilies] = useState<Family[]>(() => {
    try {
      const inst = localStorage.getItem('userInstansi') || 'default';
      const cached = localStorage.getItem(`absensi_families_${inst}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [absensiRelationships, setAbsensiRelationships] = useState<FamilyRelationship[]>(() => {
    try {
      const inst = localStorage.getItem('userInstansi') || 'default';
      const cached = localStorage.getItem(`absensi_relationships_${inst}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isAbsensiLoading, setIsAbsensiLoading] = useState(false);

  const [hasLoadedBendahara, setHasLoadedBendahara] = useState<boolean>(false);
  const [hasLoadedAbsensi, setHasLoadedAbsensi] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    if (currentApp === 'absensi') return 'dashboard';
    return 'dashboard';
  });

  useEffect(() => {
    Promise.resolve().then(() => {
      setSelectedDeleteAudit(null);
      setSelectedEditAudit(null);
    });
  }, [activeTab]);

  // Reactive Join: Re-calculates and caches enriched members list whenever rawMembers or categories update
  useEffect(() => {
    if (rawMembers.length === 0) return;
    const enriched = rawMembers.map(m => {
      const desa = absensiDesas.find(d => String(d.id) === String(m.desa_id));
      const daerahId = m.daerah_id || desa?.daerah_id || '';
      const daerah = absensiDaerahs.find(reg => String(reg.id) === String(daerahId));
      
      const family = absensiFamilies.find(f => String(f.id) === String(m.family_id));
      const relationship = absensiRelationships.find(r => String(r.id) === String(m.relationship_id));
      
      // Compute parent/wali details from family members automatically!
      let computedNamaOrtu = m.nama_ortu || '';
      let computedNoHpOrtu = m.no_hp_ortu || '';
      let computedPekerjaanOrtu = m.pekerjaan_ortu || '';

      if (m.family_id) {
        const familyMembers = rawMembers.filter(other => other.id !== m.id && other.family_id === m.family_id);
        
        // Find Father (Ayah)
        const ayahMember = familyMembers.find(other => {
          const rel = absensiRelationships.find(r => String(r.id) === String(other.relationship_id));
          return rel?.name?.toLowerCase() === 'ayah';
        });

        // Find Mother (Ibu)
        const ibuMember = familyMembers.find(other => {
          const rel = absensiRelationships.find(r => String(r.id) === String(other.relationship_id));
          return rel?.name?.toLowerCase() === 'ibu';
        });

        // Find any guardian (is_wali === true)
        const waliMember = familyMembers.find(other => {
          const rel = absensiRelationships.find(r => String(r.id) === String(other.relationship_id));
          return rel?.is_wali;
        });

        const fatherName = ayahMember?.nama_lengkap || '';
        const motherName = ibuMember?.nama_lengkap || '';
        const waliName = waliMember?.nama_lengkap || '';

        if (fatherName && motherName) {
          computedNamaOrtu = `${fatherName} & ${motherName}`;
        } else if (fatherName) {
          computedNamaOrtu = fatherName;
        } else if (motherName) {
          computedNamaOrtu = motherName;
        } else if (waliName) {
          computedNamaOrtu = waliName;
        }

        // Parent phone number automatically from Father, Mother, or Guardian
        computedNoHpOrtu = ayahMember?.no_hp_anggota || ibuMember?.no_hp_anggota || waliMember?.no_hp_anggota || m.no_hp_ortu || '';

        // Parent occupation automatically from Father, Mother, or Guardian
        computedPekerjaanOrtu = ayahMember?.pekerjaan || ibuMember?.pekerjaan || waliMember?.pekerjaan || m.pekerjaan_ortu || '';
      }

      return {
        ...m,
        daerah_id: daerahId,
        daerah_name: daerah?.nama_daerah || 'Unknown',
        desa_name: desa?.nama_desa || 'Unknown',
        kelompok_name: absensiKelompoks.find(k => String(k.id) === String(m.kelompok_id))?.nama_kelompok || 'Unknown',
        age_category_name: absensiAges.find(a => String(a.id) === String(m.age_category_id))?.name || 'Unknown',
        family_name: family?.nama_keluarga || 'Tidak Ada',
        relationship_name: relationship?.name || 'Belum Diatur',
        is_wali: relationship?.is_wali || false,
        nama_ortu: computedNamaOrtu || m.nama_ortu || '-',
        no_hp_ortu: computedNoHpOrtu || m.no_hp_ortu || '-',
        pekerjaan_ortu: computedPekerjaanOrtu || m.pekerjaan_ortu || '-',
      };
    });
    Promise.resolve().then(() => {
      setAbsensiMembers(enriched);
    });
    const cacheKey = `absensi_members_${instansi}`;
    localStorage.setItem(cacheKey, JSON.stringify(enriched));
  }, [rawMembers, absensiDaerahs, absensiDesas, absensiKelompoks, absensiAges, absensiFamilies, absensiRelationships, instansi]);

  useEffect(() => {
    // Auth is instantly initialized as we rely on central Supabase accounts with secure passwords
    Promise.resolve().then(() => {
      setIsAuthInitializing(false);
    });
  }, []);

  const roleRaw = (currentRole || 'Viewer').toString().trim();
  const roleLower = roleRaw.toLowerCase();
  const displayRole = (originalRole || currentRole || 'Viewer').toString().trim();

  const isAdmin = roleLower === 'admin';
  const isKetua = roleLower === 'ketua';
  const isWakil = roleLower === 'wakil';
  const isBendahara = roleLower === 'bendahara';
  
  const canWrite = (isAdmin || isBendahara);
  const canSeeAudit = (isAdmin || isKetua || isWakil || isBendahara);
  const canChangePassword = roleLower !== 'viewer';
  const canApprove = (isAdmin || isKetua);
  const canExport = (isAdmin || isBendahara);
  const canSeeFullAuditFilter = (isAdmin || isKetua);

  const formatIDRGlobal = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num);
  };

  const formatIndoDateGlobal = (dateStr: string, includeTime: boolean = true) => {
    if (!dateStr) return '-';
    try {
      const cleanStr = String(dateStr).replace('T', ' ').replace(',', '');
      const parts = cleanStr.trim().split(/\s+/);
      let day = 0, month = 0, year = 0;
      let hour = 0, min = 0;
      if (parts.length >= 1) {
        const dParts = parts[0].split(parts[0].includes('-') ? '-' : '/');
        if (dParts.length === 3) {
          if (dParts[0].length === 4) {
            year = parseInt(dParts[0]); month = parseInt(dParts[1]); day = parseInt(dParts[2]);
          } else {
            day = parseInt(dParts[0]); month = parseInt(dParts[1]); year = parseInt(dParts[2]);
          }
        }
      }
      if (parts.length >= 2) {
        const tParts = parts[1].split(':');
        hour = parseInt(tParts[0] || '0');
        min = parseInt(tParts[1] || '0');
      }
      const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
      const dateOnly = `${String(day).padStart(2, '0')} ${months[month - 1]} ${year}`;
      if (!includeTime) return dateOnly;
      return `${dateOnly}, ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    } catch (e) { return dateStr; }
  };

  const handleCopyAuditId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedAuditId(id);
    setTimeout(() => setCopiedAuditId(null), 2000);
  };

  const navItems = useMemo(() => {
    if (currentApp === 'absensi') {
      return [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Beranda', show: true },
        { id: 'absensi_form', icon: Fingerprint, label: 'Absensi', show: canWrite || isAdmin },
        { id: 'absensi_members', icon: Users, label: 'Anggota', show: true },
        { id: 'absensi_groups', icon: Layers, label: 'Group', show: true },
        { id: 'absensi_history', icon: History, label: 'Riwayat', show: true },
        { id: 'settings', icon: UserCircle, label: 'Profil', show: canChangePassword },
      ].filter(t => t.show);
    }

    return [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Beranda', show: true },
      { id: 'transaksi', icon: ReceiptText, label: 'Input Data', show: canWrite },
      { id: 'history', icon: History, label: 'Riwayat', show: true },
      { id: 'audit', icon: ShieldAlert, label: 'Log Audit', show: canSeeAudit },
      { id: 'laporan', icon: FileText, label: 'PDF', show: true },
      { id: 'settings', icon: UserCircle, label: 'Profil', show: canChangePassword },
    ].filter(t => t.show);
  }, [canWrite, canSeeAudit, canChangePassword, currentApp, currentRole, isAdmin]);

  const activeNavIndex = useMemo(() => navItems.findIndex(item => item.id === activeTab), [navItems, activeTab]);

  const parseToLocalDate = (dateStr: string) => {
    if (!dateStr) return null;
    const clean = dateStr.split(/[ ,T]/)[0];
    const parts = clean.split(/[-/]/);
    let d: Date;
    if (parts.length === 3) {
      if (parts[0].length === 4) d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      else d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const checkIsPeriodApproved = useCallback((dateStr: string) => {
    if (!dateStr || approvalsList.length === 0) return false;
    const d = parseToLocalDate(dateStr);
    if (!d) return false;
    const targetValue = d.getFullYear() * 12 + d.getMonth();
    let maxApprovedValue = -1;
    approvalsList.forEach(a => {
      const parts = String(a.period_id).split('-');
      if (parts.length === 2) {
        const m = parseInt(parts[0]) - 1;
        const y = parseInt(parts[1]);
        const val = y * 12 + m;
        if (val > maxApprovedValue) maxApprovedValue = val;
      }
    });
    return targetValue <= maxApprovedValue;
  }, [approvalsList]);

  const filteredDeletedTransactions = useMemo(() => deletedTransactions.filter(log => !checkIsPeriodApproved(log.deleted_at)), [deletedTransactions, checkIsPeriodApproved]);
  const filteredEditHistory = useMemo(() => editHistory.filter(log => !checkIsPeriodApproved(log.edited_at)), [editHistory, checkIsPeriodApproved]);

  const displayDeletedLogs = useMemo(() => (canSeeFullAuditFilter && showAllAudit) ? deletedTransactions : filteredDeletedTransactions, [canSeeFullAuditFilter, showAllAudit, deletedTransactions, filteredDeletedTransactions]);
  const displayEditLogs = useMemo(() => (canSeeFullAuditFilter && showAllAudit) ? editHistory : filteredEditHistory, [canSeeFullAuditFilter, showAllAudit, editHistory, filteredEditHistory]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  useEffect(() => {
    // Define global NFC reader callback for native Android bridge
    (window as any).onNfcRead = (uid: string) => {
      console.log("RFID UID terdeteksi secara native: " + uid);
      
      // Dispatch custom event so active scanning components can react instantly
      const event = new CustomEvent("nfc-read", { detail: { uid } });
      window.dispatchEvent(event);
      
      // Play modern alert sound or notify user of successful read
      showToast(`Kartu NFC/RFID Terbaca: ${uid}`, 'success');
    };

    // Log native NFC interface status
    if ((window as any).AndroidNFC) {
      try {
        const status = (window as any).AndroidNFC.getStatus();
        console.log("Status NFC Native Android: " + status);
      } catch (e) {
        console.warn("Failed to get native NFC status", e);
      }
    }

    return () => {
      delete (window as any).onNfcRead;
    };
  }, []);

  const openConfirm = (title: string, msg: string, confirmText: string, onConfirm: () => void, isDanger = false) => {
    setDialog({ show: true, title, msg, confirmText, onConfirm, isDanger, isSubmitting: false, isSuccess: false });
  };

  const closeDialog = () => setDialog({ show: false, title: '', msg: '', confirmText: '', onConfirm: () => {}, isDanger: false, isSubmitting: false, isSuccess: false });

  const handleLogout = () => {
    localStorage.clear();
    initializeDynamicDb(null);
    setIsLoggedIn(false);
    setCurrentUsername('');
    setFullName('');
    setCurrentRole('Viewer');
    setOriginalRole('');
    setInstansi('Bendahara');
    setActiveScriptUrl('');
    setAbsensiMasterUrl('');
    setAbsensiLogUrl('');
    setCurrentApp('bendahara');
    setTransactions([]);
    setApprovalsList([]);
    setAbsensiMembers([]);
    setAbsensiLogs([]);
    setHasLoadedBendahara(false);
    setHasLoadedAbsensi(false);
    closeDialog();
    showToast("Berhasil keluar", "success");
  };

  const handleConfirmClick = async () => {
    if (dialog.isSuccess) { closeDialog(); return; }
    if ((dialog.title || '').toLowerCase().includes('keluar')) { dialog.onConfirm(); return; }
    setDialog(prev => ({ ...prev, isSubmitting: true }));
    try {
      await (dialog.onConfirm as any)();
      setDialog(prev => ({ ...prev, isSubmitting: false, isSuccess: true }));
    } catch (err) {
      setDialog(prev => ({ ...prev, isSubmitting: false }));
      showToast("Gagal merespon.", "error");
    }
  };

  const handleAddCategory = async (catName: string) => {
    if (!catName.trim()) return;
    try {
      await dbAddCategory(catName.trim());
      setAvailableCategories(prev => prev.includes(catName.trim()) ? prev : [...prev, catName.trim()]);
      showToast("Kategori baru disimpan", "success");
    } catch (e) { showToast("Gagal simpan kategori", "error"); }
  };

  const mapRawToTransaction = useCallback((item: any, approvals: any[]): Transaction => {
    const debit = cleanNumber(item.debit || item.Debit || 0);
    const credit = cleanNumber(item.credit || item.Credit || 0);
    const isIncome = String(item.type || item.Type || '').toLowerCase() === 'masuk';
    const rawDate = String(item.date || item.Date || '');
    const isoDate = rawDate.includes('-') ? rawDate : dmyToIso(rawDate);
    const d = parseToLocalDate(isoDate);
    const rawProjectName = String(item.project_name || item.Project_Name || 'KAS UMUM').trim();
    const isKasUmum = rawProjectName.toUpperCase() === 'KAS UMUM';
    let approvalData = null;
    if (d) {
      const pid = `${d.getMonth() + 1}-${d.getFullYear()}`;
      approvalData = (approvals || []).find(a => String(a.period_id).trim() === pid);
    }
    return {
      id: String(item.id || item.Id || `ID-${Math.random()}`),
      date: isoDate,
      formattedDate: rawDate,
      description: String(item.description || item.Description || 'Transaksi'),
      type: isIncome ? 'masuk' : 'keluar',
      category: String(item.category || item.Category || 'Lainnya'),
      project_name: rawProjectName,
      debit, credit, 
      balance: cleanNumber(item.balance || item.Balance || 0),
      amount: isIncome ? debit : credit,
      created_at: String(item.created_at || item.Created_At || ''),
      created_by: String(item.created_by || item.Created_By || 'Sistem'),
      created_by_role: String(item.created_by_role || item.Created_By_Role || ''),
      edit_version: parseInt(item.edit_version || item.Edit_Version) || 0,
      is_approve: !!approvalData,
      approve_by: approvalData ? approvalData.approved_by : '',
      approve_date: approvalData ? approvalData.approve_date : '',
      approver_role: approvalData ? approvalData.approver_role : ''
    };
  }, []);

  const fetchMetadata = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const [projs, cats] = await Promise.all([
        dbGetProjects(),
        dbGetCategories()
      ]);
      const activeProjs = projs.filter(p => p.status?.toLowerCase() === 'aktif' && p.name.toUpperCase() !== 'KAS UMUM');
      const inactiveProjs = projs.filter(p => p.status?.toLowerCase() === 'arsip');
      
      // Sort inactive descending
      inactiveProjs.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      
      const restrictedInactive = inactiveProjs.slice(0, 10);
      const combinedProjects = [
        ...activeProjs,
        ...restrictedInactive
      ];

      if (projs.length > 0) setAvailableProjects(combinedProjects);
      if (cats.length > 0) setAvailableCategories(cats);
    } catch (err) { console.error("Metadata fetch error:", err); }
  }, [isLoggedIn]);

  const fetchTransactions = useCallback(async (
    isSilent = false, 
    filterProject?: string,
    targetMonthYear?: { month: number; year: number },
    maxMonthYear?: { month: number; year: number }
  ) => {
    if (!isLoggedIn) return [];
    if (!isSilent) setIsLoading(true);
    try {
      // 1. Fetch approvals first because they are lightweight and define our balance boundaries
      const approvals = await dbGetApprovals();
      setApprovalsList(approvals);

      const openingBalancesMap: Record<string, number> = {};
      approvals.forEach(a => {
        const projRaw = String(a.project_name || 'KAS UMUM').trim();
        const projUpper = projRaw.toUpperCase();
        openingBalancesMap[`${a.period_id}-${projRaw}`] = Number(a.opening_balance || 0);
        openingBalancesMap[`${a.period_id}-${projUpper}`] = Number(a.opening_balance || 0);
      });
      setHistoricalOpeningBalances(openingBalancesMap);

      // Determine the limitDateStr and baseKasUmumBalance
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed

      // Target having at least 12 months history by default
      const defaultBoundary = new Date(currentYear, currentMonth - 12, 1);
      
      // If targetMonthYear is provided, we query starting from that target month
      // using the approval just before it as boundary
      const targetBoundary = targetMonthYear 
        ? new Date(targetMonthYear.year, targetMonthYear.month - 1 - 1, 1) // 1 month before target
        : defaultBoundary;

      // Find KAS UMUM approvals relative to our target boundary
      const kasUmumApprovals = approvals.filter(a => 
        String(a.project_name || 'KAS UMUM').trim().toUpperCase() === 'KAS UMUM'
      );

      const parsePeriodId = (periodId: string) => {
        const parts = periodId.split('-');
        const m = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        return new Date(y, m - 1, 1);
      };

      const eligibleApprovals = kasUmumApprovals.filter(a => {
        try {
          const d = parsePeriodId(a.period_id);
          return d <= targetBoundary;
        } catch (err) {
          return false;
        }
      });

      // Sort descending chronologically
      eligibleApprovals.sort((a, b) => {
        try {
          return parsePeriodId(b.period_id).getTime() - parsePeriodId(a.period_id).getTime();
        } catch (err) {
          return 0;
        }
      });

      let limitDateStr: string | undefined = undefined;
      let endDateStr: string | undefined = undefined;
      let baseKasUmumBalance = 0;

      if (eligibleApprovals.length > 0) {
        const boundaryApproval = eligibleApprovals[0];
        const bDate = parsePeriodId(boundaryApproval.period_id);
        // Start querying from 1st day of the next month
        const startQueryDate = new Date(bDate.getFullYear(), bDate.getMonth() + 1, 1);
        
        const yStr = startQueryDate.getFullYear();
        const mStr = String(startQueryDate.getMonth() + 1).padStart(2, '0');
        limitDateStr = `${yStr}-${mStr}-01`;
        baseKasUmumBalance = Number(boundaryApproval.closing_balance || 0);
        console.log(`[Query Balance Boundary] Using boundary period ${boundaryApproval.period_id} with closing balance ${baseKasUmumBalance}. Querying from date: ${limitDateStr}`);
      } else {
        console.log(`[Query Balance Boundary] No historical approvals found. Querying ALL transactions.`);
      }

      if (maxMonthYear) {
        const lastDay = new Date(maxMonthYear.year, maxMonthYear.month, 0).getDate();
        const yStr = maxMonthYear.year;
        const mStr = String(maxMonthYear.month).padStart(2, '0');
        const dStr = String(lastDay).padStart(2, '0');
        endDateStr = `${yStr}-${mStr}-${dStr}`;
        console.log(`[Query Balance Boundary] Restricting search range with endDate: ${endDateStr}`);
      }

      // Fetch projs to identify active/inactive
      const projs = await dbGetProjects();
      const activeProjs = projs.filter(p => p.status?.toLowerCase() === 'aktif' && p.name.toUpperCase() !== 'KAS UMUM');
      const inactiveProjs = projs.filter(p => p.status?.toLowerCase() === 'arsip');
      inactiveProjs.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      const lastInactiveProj = inactiveProjs[0];

      // Retrieve cached data for active prokers from localStorage
      const cachedActiveProjsTxs: Record<string, Transaction[]> = {};
      const activeProjsWithCache: string[] = [];
      const activeProjsWithoutCache: string[] = [];
      
      activeProjs.forEach(ap => {
        const key = `proker_txs_${instansi}_${ap.name.toUpperCase()}`;
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              cachedActiveProjsTxs[ap.name.toUpperCase()] = parsed;
              activeProjsWithCache.push(ap.name.toUpperCase());
              return;
            }
          }
        } catch (e) {
          console.error(e);
        }
        activeProjsWithoutCache.push(ap.name.toUpperCase());
        cachedActiveProjsTxs[ap.name.toUpperCase()] = [];
      });

      // Combine queries
      const fetchPromises: Promise<any>[] = [
        dbGetTransactions(limitDateStr, undefined, endDateStr).then(txs => ({
          type: 'kas_umum',
          txs
        }))
      ];

      // Fetch active prokers fully (all time) for ones NOT cached
      activeProjs.forEach(ap => {
        if (activeProjsWithoutCache.includes(ap.name.toUpperCase())) {
          console.log(`[Cache Miss] Fetching full transactions for active proker "${ap.name}"...`);
          fetchPromises.push(
            dbGetTransactions(undefined, ap.name).then(txs => ({
              type: 'full_project',
              projectName: ap.name,
              txs
            }))
          );
        }
      });

      // For ones WITH cache, we can query incrementally! What is the earliest of their maximum created_at fields?
      let minLatestCreatedAt = "";
      activeProjsWithCache.forEach(projName => {
        const txsList = cachedActiveProjsTxs[projName];
        const maxCreatedAt = txsList.reduce((max, t) => (t.created_at && t.created_at > max) ? t.created_at : max, "");
        if (maxCreatedAt) {
          if (!minLatestCreatedAt || maxCreatedAt < minLatestCreatedAt) {
            minLatestCreatedAt = maxCreatedAt;
          }
        }
      });

      if (activeProjsWithCache.length > 0 && minLatestCreatedAt) {
        console.log(`[Cache Hit] Fetching incremental updates created on or after ${minLatestCreatedAt}...`);
        fetchPromises.push(
          dbGetTransactions(undefined, undefined, undefined, minLatestCreatedAt).then(txs => ({
            type: 'incremental_updates',
            txs
          }))
        );
      }

      // Fetch the last 1 inactive proker fully (all time)
      if (lastInactiveProj) {
        fetchPromises.push(
          dbGetTransactions(undefined, lastInactiveProj.name).then(txs => ({
            type: 'final_inactive_project',
            projectName: lastInactiveProj.name,
            txs
          }))
        );
      }

      // If user is currently filtering/viewing another inactive project
      if (filterProject && filterProject.toUpperCase() !== 'KAS UMUM') {
        const isAlreadyFetched = 
          activeProjs.some(ap => ap.name.toUpperCase() === filterProject.toUpperCase()) ||
          (lastInactiveProj && lastInactiveProj.name.toUpperCase() === filterProject.toUpperCase());

        if (!isAlreadyFetched) {
          console.log(`[Lazy Load Project] Fetching selected inactive project "${filterProject}"...`);
          fetchPromises.push(
            dbGetTransactions(undefined, filterProject).then(txs => ({
              type: 'lazy_inactive_project',
              projectName: filterProject,
              txs
            }))
          );
        }
      }

      // Also let's run audit fetch in parallel to clean deleted items and apply edits
      const auditPromises: Promise<any>[] = [];
      if (canSeeAudit) {
        auditPromises.push(
          dbGetDeletedTransactions().catch(() => []).then(txs => ({ type: 'deleted_txs', txs }))
        );
        auditPromises.push(
          dbGetEditHistory().catch(() => []).then(txs => ({ type: 'edit_history', txs }))
        );
      }

      const [results, auditResults] = await Promise.all([
        Promise.all(fetchPromises),
        Promise.all(auditPromises)
      ]);

      const kasUmumObj = results.find(r => r && r.type === 'kas_umum');
      const kasUmumTxs = kasUmumObj ? kasUmumObj.txs : [];

      const activeProjsMergedTxs: Record<string, Transaction[]> = {};
      activeProjs.forEach(ap => {
        activeProjsMergedTxs[ap.name.toUpperCase()] = [...(cachedActiveProjsTxs[ap.name.toUpperCase()] || [])];
      });

      // Merge new/updates received
      results.forEach(res => {
        if (!res) return;
        if (res.type === 'full_project') {
          const projUpper = res.projectName.toUpperCase();
          activeProjsMergedTxs[projUpper] = res.txs;
          try {
            localStorage.setItem(`proker_txs_${instansi}_${projUpper}`, JSON.stringify(res.txs));
          } catch (e) {
            console.error(e);
          }
        } else if (res.type === 'incremental_updates') {
          const updatesList: Transaction[] = res.txs || [];
          updatesList.forEach(t => {
            const projUpper = (t.project_name || '').toUpperCase();
            if (activeProjsMergedTxs[projUpper] !== undefined) {
              const currentList = activeProjsMergedTxs[projUpper];
              const existingIdx = currentList.findIndex(item => item.id === t.id);
              if (existingIdx > -1) {
                currentList[existingIdx] = t;
              } else {
                currentList.push(t);
              }
            }
          });
        }
      });

      // Apply audit edits and deletions to activeProjsMergedTxs!
      let deletedTxsList: any[] = [];
      let editLogsList: any[] = [];

      auditResults.forEach(aRes => {
        if (!aRes) return;
        if (aRes.type === 'deleted_txs') {
          deletedTxsList = aRes.txs || [];
        } else if (aRes.type === 'edit_history') {
          editLogsList = aRes.txs || [];
        }
      });

      const deletedIds = new Set(deletedTxsList.map(t => t.id));

      activeProjs.forEach(ap => {
        const projUpper = ap.name.toUpperCase();
        let currentList = activeProjsMergedTxs[projUpper] || [];

        // 1. Evict any transaction that is in deletedIds!
        if (deletedIds.size > 0) {
          currentList = currentList.filter(item => !deletedIds.has(item.id));
        }

        // 2. Apply edits from editLogsList if there is a newer version!
        editLogsList.forEach(log => {
          if ((log.project_name || '').toUpperCase() === projUpper) {
            const itemIdx = currentList.findIndex(item => item.id === log.transaction_id);
            if (itemIdx > -1) {
              const item = currentList[itemIdx];
              if ((Number(item.edit_version) || 0) < log.version_number) {
                item.description = log.new_description;
                item.amount = log.new_value;
                if (item.type === 'masuk') {
                  item.debit = log.new_value;
                } else {
                  item.credit = log.new_value;
                }
                item.edit_version = log.version_number;
              }
            }
          }
        });

        // 3. Sort stablely in chronological order
        currentList.sort((a, b) => {
          const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return (a.created_at || '').localeCompare(b.created_at || '');
        });

        activeProjsMergedTxs[projUpper] = currentList;

        // Save back the fully synchronized cache!
        try {
          localStorage.setItem(`proker_txs_${instansi}_${projUpper}`, JSON.stringify(currentList));
        } catch (e) {
          console.error(e);
        }
      });

      // Now accumulate all final processed items into our main database Map
      const txMap = new Map<string, Transaction>();
      
      // 1. Add KAS UMUM
      kasUmumTxs.forEach((t: Transaction) => txMap.set(t.id, t));

      // 2. Add active proprojs
      activeProjs.forEach(ap => {
        const list = activeProjsMergedTxs[ap.name.toUpperCase()] || [];
        list.forEach(t => txMap.set(t.id, t));
      });

      // 3. Add other loaded elements
      results.forEach(res => {
        if (!res) return;
        if (res.type === 'final_inactive_project' || res.type === 'lazy_inactive_project') {
          const list: Transaction[] = res.txs || [];
          list.forEach(t => txMap.set(t.id, t));
        }
      });

      const txs = Array.from(txMap.values());
      
      const totalIncome = txs.filter(t => t.type === 'masuk').reduce((acc, t) => acc + (t.amount || 0), 0);
      const totalExpense = txs.filter(t => t.type === 'keluar').reduce((acc, t) => acc + (t.amount || 0), 0);
      const totalBalance = baseKasUmumBalance + totalIncome - totalExpense;
      setGlobalStats({
        totalBalance,
        totalIncome,
        totalExpense,
        overallCount: txs.length
      });

      // Compute correct running balance chronologically per project across ALL transactions!
      const sortedAllTxs = [...txs].sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        // Secondary sort to ensure stable order
        return (a.created_at || '').localeCompare(b.created_at || '') || (a.id || '').localeCompare(b.id || '');
      });

      const projectBalances: Record<string, number> = {};
      projectBalances["KAS UMUM"] = baseKasUmumBalance;

      const balanceComputedTxs = sortedAllTxs.map(t => {
        const proj = (t.project_name || 'KAS UMUM').trim().toUpperCase();
        if (projectBalances[proj] === undefined) {
          projectBalances[proj] = 0;
        }
        const amt = Number(t.amount || t.debit || t.credit || 0);
        if (t.type === 'masuk') {
          projectBalances[proj] += amt;
        } else {
          projectBalances[proj] -= amt;
        }
        return {
          ...t,
          balance: projectBalances[proj]
        };
      });

      let finalTxs = balanceComputedTxs;
      if (filterProject) {
        finalTxs = balanceComputedTxs.filter(t => (t.project_name || '').toUpperCase() === filterProject.toUpperCase());
      }
      
      const enriched = finalTxs.map(t => {
        const d = parseToLocalDate(t.date);
        let approvalData = null;
        if (d) {
          const pid = `${d.getMonth() + 1}-${d.getFullYear()}`;
          approvalData = approvals.find(a => String(a.period_id).trim() === pid);
        }
        return {
          ...t,
          is_approve: !!approvalData,
          approve_by: approvalData ? approvalData.approved_by : '',
          approve_date: approvalData ? approvalData.approve_date : '',
          approver_role: approvalData ? approvalData.approver_role : ''
        };
      });

      setTransactions(enriched);
      return approvals;
    } catch (err) { console.error(err); } finally { if (!isSilent) setIsLoading(false); }
    return [];
  }, [isLoggedIn]);

  const onFetchHistory = useCallback(async (
    month: number, 
    year: number, 
    project?: string,
    endMonth?: number,
    endYear?: number
  ) => {
    if (!isLoggedIn) return;
    setIsLoading(true);
    try {
      const targetMonthYear = { month, year };
      const maxMonthYear = (endMonth && endYear) ? { month: endMonth, year: endYear } : undefined;
      await fetchTransactions(true, project, targetMonthYear, maxMonthYear);
      showToast(`Data ${project || ''} disinkronkan.`, "success");
    } catch (err) { showToast("Gagal memuat data sejarah.", "error"); } finally { setIsLoading(false); }
  }, [isLoggedIn, fetchTransactions]);

  const fetchAuditLogs = useCallback(async (isSilent = false, manualApprovals?: any[]) => {
    if (!isLoggedIn || !canSeeAudit) return;
    if (!isSilent) setIsLoadingAudit(true);
    try {
      const [dels, edits] = await Promise.all([
        dbGetDeletedTransactions(),
        dbGetEditHistory()
      ]);
      setDeletedTransactions(dels);
      setEditHistory(edits);
    } catch (err) { console.error(err); } finally { setIsLoadingAudit(false); }
  }, [isLoggedIn, canSeeAudit]);

  useEffect(() => {
    if (activeTab === 'audit' && isLoggedIn) {
      const timer = setTimeout(() => {
        fetchAuditLogs(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, isLoggedIn, fetchAuditLogs]);

  // refreshAllData is moved below refreshAllAbsensi to avoid hoisting/initialization reference issues.

  const fetchAbsensiMaster = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsAbsensiLoading(true);
    try {
      const instansi = localStorage.getItem('userInstansi') || 'default';
      const [members, daerahs, desas, kelompoks, ages, events, families, relationships] = await Promise.all([
        dbGetMembers(),
        dbGetDaerahs(),
        dbGetDesas(),
        dbGetKelompoks(),
        dbGetAgeCategories(),
        dbGetEvents(),
        dbGetFamilies(),
        dbGetFamilyRelationships()
      ]);

      setRawMembers(members);
      localStorage.setItem(`absensi_raw_members_${instansi}`, JSON.stringify(members));

      setAbsensiDaerahs(daerahs);
      localStorage.setItem(`absensi_daerahs_${instansi}`, JSON.stringify(daerahs));

      setAbsensiDesas(desas);
      localStorage.setItem(`absensi_desas_${instansi}`, JSON.stringify(desas));

      setAbsensiKelompoks(kelompoks);
      localStorage.setItem(`absensi_kelompoks_${instansi}`, JSON.stringify(kelompoks));

      setAbsensiAges(ages);
      localStorage.setItem(`absensi_ages_${instansi}`, JSON.stringify(ages));

      setAbsensiEvents(events);
      localStorage.setItem(`absensi_events_${instansi}`, JSON.stringify(events));

      setAbsensiFamilies(families);
      localStorage.setItem(`absensi_families_${instansi}`, JSON.stringify(families));

      setAbsensiRelationships(relationships);
      localStorage.setItem(`absensi_relationships_${instansi}`, JSON.stringify(relationships));
    } catch (err) {
      console.error("fetchAbsensiMaster error:", err);
    } finally {
      if (!isSilent) setIsAbsensiLoading(false);
    }
  }, []);

  const fetchAbsensiLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsAbsensiLoading(true);
    try {
      const instansi = localStorage.getItem('userInstansi') || 'default';
      const membersCount = rawMembers.length || 100;
      const fetchLimit = Math.min(2500, Math.max(1000, membersCount * 12));
      const freshLogs = await dbGetAttendanceLogs(fetchLimit);

      setAbsensiLogs(freshLogs);
      localStorage.setItem(`absensi_logs_${instansi}`, JSON.stringify(freshLogs));
    } catch (err) {
      console.error("fetchAbsensiLogs error:", err);
    } finally {
      if (!isSilent) setIsAbsensiLoading(false);
    }
  }, [rawMembers]);

  const refreshAllAbsensi = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsAbsensiLoading(true);
    try {
      await Promise.all([
        fetchAbsensiMaster(true),
        fetchAbsensiLogs(true)
      ]);
    } catch (err) {
      console.error("refreshAllAbsensi error:", err);
    } finally {
      if (!isSilent) setIsAbsensiLoading(false);
    }
  }, [fetchAbsensiMaster, fetchAbsensiLogs]);

  const refreshAllData = useCallback(async () => {
    if (!isLoggedIn) return;
    if (currentApp === 'absensi') {
      setIsAbsensiLoading(true);
      try {
        await Promise.all([
          fetchAbsensiMaster(true),
          fetchAbsensiLogs(true)
        ]);
        showToast("Data absensi diperbarui", "success");
      } catch (err) {
        showToast("Gagal memperbarui data absensi", "error");
      } finally {
        setIsAbsensiLoading(false);
      }
      return;
    }

    setIsLoading(true);
    try {
      setTransactions([]);
      const freshApprovals = await fetchTransactions(true);
      await fetchMetadata();
      if (canSeeAudit) await fetchAuditLogs(true, freshApprovals);
      showToast("Data diperbarui", "success");
    } catch (err) { showToast("Gagal memperbarui data", "error"); } finally { setIsLoading(false); }
  }, [isLoggedIn, currentApp, canSeeAudit, fetchTransactions, fetchAuditLogs, fetchMetadata, fetchAbsensiMaster, fetchAbsensiLogs]);

  const handleLoginSuccess = (data: any) => {
    if (data.firebase_config) {
      localStorage.setItem('instansi_db_config', JSON.stringify(data.firebase_config));
      initializeDynamicDb(data.firebase_config);
    } else {
      localStorage.removeItem('instansi_db_config');
      initializeDynamicDb(null);
    }
    const serverRole = String(data.role || 'Viewer').trim();
    const webAccess = String(data.web_access || 'bendahara').toLowerCase();
    const accessList = webAccess.split(',').map(s => s.trim());
    
    // Choose default app
    const defaultApp: AppType = accessList.includes('bendahara') ? 'bendahara' : 'absensi';

    setCurrentUsername(data.username); 
    setFullName(data.full_name || data.username); 
    setCurrentRole(serverRole); 
    setOriginalRole(data.original_role); 
    setInstansi(data.instansi); 
    setActiveScriptUrl(data.appsscript || 'native');
    setAbsensiMasterUrl(data.appsscript_master || 'native');
    setAbsensiLogUrl(data.appsscript_attendance || 'native');
    setWebAccessStrings(accessList);
    setCurrentApp(defaultApp);
    localStorage.setItem('currentApp', defaultApp);
    setIsLoggedIn(true);
  };

  const switchApp = (app: AppType) => {
    setCurrentApp(app);
    localStorage.setItem('currentApp', app);
    setActiveTab('dashboard'); // Always go to dashboard when switching app
    showToast(`Berpindah ke Aplikasi ${app.toUpperCase()}`, "success");
  };

  useEffect(() => { 
    if (isLoggedIn) {
      if (currentRole === 'Superadmin') return;
      if (currentApp === 'bendahara' && !hasLoadedBendahara) {
        const initDataSequentially = async () => {
          const freshApprovals = await fetchTransactions();
          await fetchMetadata();
          if (canSeeAudit) await fetchAuditLogs(true, freshApprovals);
          setHasLoadedBendahara(true);
        };
        initDataSequentially();
      }
    }
  }, [isLoggedIn, currentApp, canSeeAudit, fetchTransactions, fetchMetadata, fetchAuditLogs, hasLoadedBendahara]); 

  // Real-time observer listener synchronization system
  useEffect(() => {
    if (!isLoggedIn || currentApp !== 'absensi') return;

    Promise.resolve().then(() => {
      setIsAbsensiLoading(true);
    });
    let masterLoadedCount = 0;
    const totalMasterToLoad = 6;

    const checkMasterReady = () => {
      masterLoadedCount++;
      if (masterLoadedCount >= totalMasterToLoad) {
        setIsAbsensiLoading(false);
        setHasLoadedAbsensi(true);
      }
    };

    console.log("Registering cost-optimized real-time Snapshot Listeners for Absensi app...");

    // 1. Subscribe rawMembers
    const unsubMembers = dbSubscribeMembers((mList) => {
      setRawMembers(mList);
      localStorage.setItem(`absensi_raw_members_${instansi}`, JSON.stringify(mList));
      checkMasterReady();
    }, (err) => {
      console.error("Real-time Members Sync Error:", err);
      setIsAbsensiLoading(false);
    });

    // 2. Subscribe daerahs
    const unsubDaerahs = dbSubscribeDaerahs((daerahList) => {
      setAbsensiDaerahs(daerahList);
      localStorage.setItem(`absensi_daerahs_${instansi}`, JSON.stringify(daerahList));
      checkMasterReady();
    }, (err) => {
      console.error("Real-time Daerahs Sync Error:", err);
    });

    // 3. Subscribe desas
    const unsubDesas = dbSubscribeDesas((dList) => {
      setAbsensiDesas(dList);
      localStorage.setItem(`absensi_desas_${instansi}`, JSON.stringify(dList));
      checkMasterReady();
    }, (err) => {
      console.error("Real-time Desas Sync Error:", err);
    });

    // 4. Subscribe kelompoks
    const unsubKelompoks = dbSubscribeKelompoks((kList) => {
      setAbsensiKelompoks(kList);
      localStorage.setItem(`absensi_kelompoks_${instansi}`, JSON.stringify(kList));
      checkMasterReady();
    }, (err) => {
      console.error("Real-time Kelompoks Sync Error:", err);
    });

    // 5. Subscribe age categories
    const unsubAges = dbSubscribeAgeCategories((aList) => {
      setAbsensiAges(aList);
      localStorage.setItem(`absensi_ages_${instansi}`, JSON.stringify(aList));
      checkMasterReady();
    }, (err) => {
      console.error("Real-time Ages Sync Error:", err);
    });

    // 5b. Subscribe events
    const unsubEvents = dbSubscribeEvents((eList) => {
      setAbsensiEvents(eList);
      localStorage.setItem(`absensi_events_${instansi}`, JSON.stringify(eList));
      checkMasterReady();
    }, (err) => {
      console.error("Real-time Events Sync Error:", err);
    });

    // 6. Subscribe attendance logs with a dynamic and smart safety limit
    const membersCount = rawMembers.length || 100;
    const fetchLimit = Math.min(2500, Math.max(1000, membersCount * 12));
    const unsubLogs = dbSubscribeAttendanceLogs(fetchLimit, (freshLogs) => {
      const cacheKey = `absensi_logs_${instansi}`;
      let cachedLogs: AttendanceLog[] = [];
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            cachedLogs = parsed;
          }
        }
      } catch (cacheErr) {
        console.error("Cache read error:", cacheErr);
      }

      // Merge log records: prioritize fresh logs from real-time Firestore synchronization
      const logMap = new Map<string, AttendanceLog>();
      cachedLogs.forEach(log => {
        if (log && log.id) logMap.set(log.id, log);
      });
      freshLogs.forEach(log => {
        if (log && log.id) logMap.set(log.id, log);
      });

      const mergedLogs = Array.from(logMap.values());
      // Sort them descending by date
      mergedLogs.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });

      setAbsensiLogs(mergedLogs);
      localStorage.setItem(cacheKey, JSON.stringify(mergedLogs));
    }, (err) => {
      console.error("Real-time Logs Sync Error:", err);
    });

    return () => {
      console.log("Unsubscribing and cleaning up Absensi real-time Snapshot Listeners...");
      unsubMembers();
      unsubDaerahs();
      unsubDesas();
      unsubKelompoks();
      unsubAges();
      unsubEvents();
      unsubLogs();
    };
  }, [isLoggedIn, currentApp, instansi]); 

  const [showSetupGuide, setShowSetupGuide] = useState(false);

  if (!isLoggedIn) {
    if (showSetupGuide) {
      return (
        <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden z-[500]">
          <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between shrink-0">
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white">CONFIG_PORTAL_MASTER</h1>
            <button 
              onClick={() => {
                setShowSetupGuide(false);
                window.location.reload();
              }} 
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all cursor-pointer"
            >
              Kembali ke Login
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <SetupGuide onLogout={() => { setShowSetupGuide(false); window.location.reload(); }} />
          </div>
        </div>
      );
    }
    return (
      <Login 
        portalUrl={PORTAL_SCRIPT_URL} 
        onLoginSuccess={handleLoginSuccess} 
        onOpenSetup={() => setShowSetupGuide(true)} 
      />
    );
  }

  if (currentRole === 'Superadmin') {
    return (
      <>
        <SuperadminPanel 
          onLogout={handleLogout} 
          notify={(msg, type) => showToast(msg, type)} 
          confirm={openConfirm} 
        />
        {dialog.show && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-backdrop">
            <div className="bg-white w-[calc(100%-2rem)] max-w-[340px] rounded-3xl shadow-2xl border border-white animate-dialog-bounce mx-auto">
              <div className="relative pt-14 pb-5 px-6 flex flex-col items-center text-center">
                <div className={`absolute -top-10 w-20 h-20 rounded-3xl shadow-2xl flex items-center justify-center transition-colors duration-300 ${dialog.isSuccess ? 'bg-emerald-600 text-white' : dialog.isDanger ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'}`}>
                  {dialog.isSuccess ? <CheckCircle2 size={36} /> : dialog.isDanger ? <AlertTriangle size={36} /> : <HelpCircle size={36} />}
                </div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-2">{dialog.isSuccess ? 'Berhasil' : dialog.title}</h3>
                <p className="text-[10px] font-bold text-slate-500 leading-relaxed px-2">{dialog.isSuccess ? 'Aksi telah berhasil dieksekusi.' : dialog.msg}</p>
              </div>
              <div className="p-5 pt-2 space-y-2">
                <button onClick={handleConfirmClick} disabled={dialog.isSubmitting} className={`w-full py-4 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest shadow-xl transition-all ${dialog.isSuccess ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : dialog.isDanger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}>
                  {dialog.isSubmitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : <span>{dialog.isSuccess ? 'MENGERTI' : dialog.confirmText}</span>}
                </button>
                {!dialog.isSuccess && !dialog.isSubmitting && <button onClick={closeDialog} className="w-full py-3 text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Batal</button>}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#DCEFFA] via-[#F3F9FD] to-[#C9E5F8] flex flex-col md:flex-row overflow-hidden">
      {/* BACKGROUND DEKORASI CELESTIAL VERSI 3 (Biru Lebih Terasa & Lembut) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
        {/* Soft Glowing Aurora Blobs */}
        <div className="absolute -top-[10%] -right-[15%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-[#00AEEF]/15 to-[#007CC2]/10 blur-[130px]" />
        <div className="absolute -bottom-[15%] left-[5%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-tr from-[#007CC2]/10 to-[#004D90]/5 blur-[140px]" />
        <div className="absolute top-[25%] -left-[10%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-r from-[#00AEEF]/12 to-indigo-200/10 blur-[120px]" />
        
        {/* Micro Dot Matrix Grid Overlay */}
        <svg className="w-full h-full opacity-[0.4]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="outerDotGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.4" fill="#007cc2" opacity="0.2" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#outerDotGrid)" />
        </svg>
      </div>

      {dialog.show && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-backdrop">
          <div className="bg-white w-[calc(100%-2rem)] max-w-[340px] rounded-3xl shadow-2xl border border-white animate-dialog-bounce mx-auto">
            <div className="relative pt-14 pb-5 px-6 flex flex-col items-center text-center">
              <div className={`absolute -top-10 w-20 h-20 rounded-3xl shadow-2xl flex items-center justify-center transition-colors duration-300 ${dialog.isSuccess ? 'bg-emerald-600 text-white' : dialog.isDanger ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'}`}>
                {dialog.isSuccess ? <CheckCircle2 size={36} /> : dialog.isDanger ? <AlertTriangle size={36} /> : <HelpCircle size={36} />}
              </div>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-2">{dialog.isSuccess ? 'Berhasil' : dialog.title}</h3>
              <p className="text-[10px] font-bold text-slate-500 leading-relaxed px-2">{dialog.isSuccess ? 'Aksi telah berhasil dieksekusi.' : dialog.msg}</p>
            </div>
            <div className="p-5 pt-2 space-y-2">
              <button onClick={handleConfirmClick} disabled={dialog.isSubmitting} className={`w-full py-4 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest shadow-xl transition-all ${dialog.isSuccess ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : dialog.isDanger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}>
                {dialog.isSubmitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : <span>{dialog.isSuccess ? 'MENGERTI' : dialog.confirmText}</span>}
              </button>
              {!dialog.isSuccess && !dialog.isSubmitting && <button onClick={closeDialog} className="w-full py-3 text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Batal</button>}
            </div>
          </div>
        </div>
      )}

      {selectedDeleteAudit && (
        <div className="fixed inset-0 z-[25] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-backdrop">
           <div className="bg-white w-full max-w-[310px] max-h-[75vh] rounded-[2rem] shadow-2xl overflow-hidden animate-dialog-bounce border border-white mx-auto flex flex-col">
              <div className="bg-rose-500 px-4 py-3 text-white flex items-center justify-between shrink-0">
                 <div className="flex items-center space-x-3 min-w-0">
                    <div className="bg-white/20 p-1 rounded-lg shrink-0"><Info size={14} /></div>
                    <div className="min-w-0">
                       <h3 className="text-[9px] font-black uppercase tracking-widest leading-none">Detail Hapus</h3>
                       <div className="flex items-center mt-1 space-x-1">
                          <span className="text-[7px] font-black bg-black/20 px-1 py-0.5 rounded uppercase tracking-tighter truncate">
                             ID: {selectedDeleteAudit.id}
                          </span>
                          <button onClick={() => handleCopyAuditId(selectedDeleteAudit.id)} className="text-white/60">
                             {copiedAuditId === selectedDeleteAudit.id ? <Check size={8} /> : <Copy size={8} />}
                          </button>
                       </div>
                    </div>
                 </div>
                 <button onClick={() => setSelectedDeleteAudit(null)} className="p-1 hover:bg-white/10 rounded-lg shrink-0"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-5">
                 <div className="py-2 border-b border-slate-100 mb-2">
                    <h4 className="text-[11px] font-black text-slate-800 text-center uppercase tracking-[0.15em] leading-tight">
                       {selectedDeleteAudit.project_name || 'KAS UMUM'}
                    </h4>
                 </div>

                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 shadow-inner">
                    <div className="flex items-center space-x-2 text-[9px] font-black uppercase tracking-tight">
                       <span className="text-slate-400 shrink-0">EDITOR :</span>
                       <span className="text-slate-800 truncate">{selectedDeleteAudit.delete_by}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-[9px] font-black uppercase tracking-tight">
                       <span className="text-slate-400 shrink-0">WAKTU :</span>
                       <span className="text-slate-800 truncate">{formatIndoDateGlobal(selectedDeleteAudit.deleted_at, true).split(',')[0]}</span>
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest px-1">Transaksi Terhapus</span>
                    <div className="bg-rose-50/30 p-3 rounded-xl border border-rose-100/30 space-y-2">
                       <div>
                          <span className="text-[6px] font-black text-rose-300 uppercase block">Kategori</span>
                          <p className="text-[8px] font-bold text-rose-400 uppercase leading-tight truncate">{selectedDeleteAudit.category}</p>
                       </div>
                       <div>
                          <span className="text-[6px] font-black text-rose-300 uppercase block">Keterangan</span>
                          <p className="text-[9px] font-bold text-rose-500 uppercase italic leading-tight truncate">"{selectedDeleteAudit.description}"</p>
                       </div>
                       <div className="pt-2 border-t border-rose-100/50 flex justify-between items-center">
                          <span className="text-[6px] font-black text-rose-300 uppercase">Nominal Akhir</span>
                          <p className="text-[12px] font-black text-rose-600">Rp {formatIDRGlobal(selectedDeleteAudit.amount || selectedDeleteAudit.debit || selectedDeleteAudit.credit)}</p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest px-1">Alasan Penghapusan</span>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                       <Receipt size={12} className="text-slate-300 mb-1.5" />
                       <p className="text-[9px] font-bold text-slate-600 italic leading-snug">
                          "{selectedDeleteAudit.delete_reason || 'Pesan alasan tidak disertakan'}"
                       </p>
                    </div>
                 </div>
              </div>

              <div className="px-4 pb-4 pt-1 bg-white shrink-0 mt-auto border-t border-slate-50">
                 <button onClick={() => setSelectedDeleteAudit(null)} className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all">MENGERTI</button>
              </div>
           </div>
        </div>
      )}

      {selectedEditAudit && (
        <div className="fixed inset-0 z-[25] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-backdrop">
           <div className="bg-white w-full max-w-[310px] max-h-[75vh] rounded-[2rem] shadow-2xl overflow-hidden animate-dialog-bounce border border-white mx-auto flex flex-col">
              <div className="bg-blue-600 px-4 py-3 text-white flex items-center justify-between shrink-0">
                 <div className="flex items-center space-x-2 min-w-0">
                    <div className="bg-white/20 p-1 rounded-lg shrink-0"><Info size={14} /></div>
                    <div className="min-w-0">
                       <h3 className="text-[9px] font-black uppercase tracking-widest leading-none">Audit REV #{selectedEditAudit.version_number}</h3>
                       <div className="flex items-center mt-1 space-x-1">
                          <span className="text-[7px] font-black bg-black/20 px-1 py-0.5 rounded uppercase tracking-tighter truncate">
                             ID: {selectedEditAudit.transaction_id}
                          </span>
                          <button onClick={() => handleCopyAuditId(selectedEditAudit.transaction_id)} className="text-white/60 p-1">
                             {copiedAuditId === selectedEditAudit.transaction_id ? <Check size={10} /> : <Copy size={10} />}
                          </button>
                       </div>
                    </div>
                 </div>
                 <button onClick={() => setSelectedEditAudit(null)} className="p-1 hover:bg-white/10 rounded-lg shrink-0"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-5 space-y-5">
                 <div className="pt-0 pb-3 border-b border-slate-100 mb-2">
                    <h4 className="text-[11px] font-black text-slate-800 text-center uppercase tracking-[0.15em] leading-tight">
                       {selectedEditAudit.project_name || 'KAS UMUM'}
                    </h4>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 shadow-inner">
                    <div className="flex items-center space-x-2 text-[9px] font-black uppercase tracking-tight">
                       <span className="text-slate-400 shrink-0">EDITOR :</span>
                       <span className="text-slate-800 truncate">{selectedEditAudit.edited_by}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-[9px] font-black uppercase tracking-tight">
                       <span className="text-slate-400 shrink-0">WAKTU :</span>
                       <span className="text-slate-800 truncate">{formatIndoDateGlobal(selectedEditAudit.edited_at).split(',')[0]}</span>
                    </div>
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center space-x-2 px-1">
                       <ShieldCheck size={10} className="text-slate-300" />
                       <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Keterangan Transaksi</span>
                    </div>
                    <div className="relative bg-rose-50/30 p-3 pt-4 rounded-xl border-2 border-rose-100/30">
                       <div className="absolute top-0 left-3 -translate-y-1/2"><span className="px-2 py-0.5 bg-rose-500 text-white text-[6px] font-black uppercase rounded shadow-sm whitespace-nowrap">SEBELUM</span></div>
                       <p className="text-[9px] font-bold text-rose-500 line-through uppercase italic leading-tight truncate">"{selectedEditAudit.old_description}"</p>
                    </div>
                    <div className="relative bg-emerald-50/40 p-3 pt-4 rounded-xl border-2 border-emerald-100/50">
                       <div className="absolute top-0 left-3 -translate-y-1/2"><span className="px-2 py-0.5 bg-emerald-600 text-white text-[6px] font-black uppercase rounded shadow-sm whitespace-nowrap">SESUDAH</span></div>
                       <p className="text-[10px] font-black text-emerald-700 uppercase leading-tight">"{selectedEditAudit.new_description}"</p>
                    </div>
                 </div>
                 <div className="space-y-3 pt-1">
                    <div className="flex items-center space-x-2 px-1">
                       <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                       <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Nominal Transaksi</span>
                    </div>
                    <div className="relative bg-rose-50/20 p-3 pt-4 rounded-xl border-2 border-rose-100/20">
                       <div className="absolute top-0 left-3 -translate-y-1/2"><span className="px-2 py-0.5 bg-rose-500 text-white text-[6px] font-black uppercase rounded shadow-sm whitespace-nowrap">SEBELUM</span></div>
                       <div className="flex justify-between items-center"><span className="text-[7px] font-black text-rose-300 uppercase tracking-tighter">Sebelum</span><p className="text-[10px] font-bold text-rose-400 line-through tracking-tight">Rp {formatIDRGlobal(selectedEditAudit.old_value)}</p></div>
                    </div>
                    <div className="relative bg-emerald-50/30 p-3 pt-4 rounded-xl border-2 border-emerald-100/30">
                       <div className="absolute top-0 left-3 -translate-y-1/2"><span className="px-2 py-0.5 bg-emerald-600 text-white text-[6px] font-black uppercase rounded shadow-sm whitespace-nowrap">SESUDAH</span></div>
                       <div className="flex justify-between items-center"><span className="text-[7px] font-black text-emerald-400 uppercase tracking-tighter">Sesudah</span><p className="text-[12px] font-black text-emerald-700 tracking-tight">Rp {formatIDRGlobal(selectedEditAudit.new_value)}</p></div>
                    </div>
                 </div>
              </div>

              <div className="px-5 pb-5 pt-1 bg-white shrink-0 mt-auto border-t border-slate-50">
                 <button onClick={() => setSelectedEditAudit(null)} className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all">MENGERTI</button>
              </div>
           </div>
        </div>
      )}

      {toast.show && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-2 ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{toast.msg}</span>
        </div>
      )}

      <div className={`hidden md:flex flex-col shrink-0 bg-gradient-to-b from-[#004D90] via-[#003B70] to-[#00254A] z-[50] transition-all duration-500 ease-in-out relative ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        {/* ABSOLUTE WRAPPER FOR SAFE CLIPPING (allowing outside elements like toggle button to render) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {/* STARLIGHTS & METEORS BACKGROUND (1 Tema dengan Login) */}
          <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 200 800" preserveAspectRatio="none" fill="none">
            <defs>
              <linearGradient id="sidebarMeteorGrad" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
              </linearGradient>
            </defs>
            <circle cx="30" cy="50" r="1.5" fill="#ffffff" opacity="0.8" />
            <circle cx="120" cy="90" r="1" fill="#ffffff" opacity="0.6" />
            <circle cx="80" cy="180" r="2" fill="#ffffff" opacity="0.9" />
            <circle cx="150" cy="240" r="1.5" fill="#ffffff" opacity="0.5" />
            <circle cx="45" cy="310" r="1" fill="#ffffff" opacity="0.7" />
            <circle cx="160" cy="380" r="2" fill="#ffffff" opacity="0.85" />
            <circle cx="70" cy="450" r="1" fill="#ffffff" opacity="0.4" />
            <circle cx="130" cy="520" r="1.5" fill="#ffffff" opacity="0.9" />
            <circle cx="50" cy="610" r="1.5" fill="#ffffff" opacity="0.6" />
            <circle cx="140" cy="680" r="2" fill="#ffffff" opacity="0.8" />
            <circle cx="85" cy="740" r="1" fill="#ffffff" opacity="0.5" />
            <circle cx="110" cy="780" r="1.5" fill="#ffffff" opacity="0.7" />
            <circle cx="35" cy="850" r="2" fill="#ffffff" opacity="0.9" />
            <line x1="150" y1="120" x2="90" y2="170" stroke="url(#sidebarMeteorGrad)" strokeWidth="2" strokeLinecap="round" />
            <line x1="170" y1="410" x2="110" y2="460" stroke="url(#sidebarMeteorGrad)" strokeWidth="2" strokeLinecap="round" />
            <line x1="130" y1="670" x2="80" y2="720" stroke="url(#sidebarMeteorGrad)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>

          {/* OVERLAPPING CLOUDS FLOW (1 Tema dengan Login) */}
          <svg className="absolute bottom-0 left-0 w-full h-[35%] opacity-20" viewBox="0 0 200 300" preserveAspectRatio="none" fill="none">
            <defs>
              <linearGradient id="sidebarCloudL1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#00AEEF" />
                <stop offset="100%" stopColor="#0054A6" />
              </linearGradient>
              <linearGradient id="sidebarCloudL2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#009EE2" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#004D8C" />
              </linearGradient>
              <linearGradient id="sidebarCloudL3" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0072BC" />
                <stop offset="100%" stopColor="#003580" />
              </linearGradient>
            </defs>
            <path d="M-50,180 Q40,100 120,150 T310,140 T550,160 L550,450 L-50,450 Z" fill="url(#sidebarCloudL1)" opacity="0.6" />
            <path d="M-50,210 Q60,130 180,180 T400,160 T550,200 L550,450 L-50,450 Z" fill="url(#sidebarCloudL2)" opacity="0.7" />
            <path d="M-50,240 Q100,180 250,230 T550,210 L550,450 L-50,450 Z" fill="url(#sidebarCloudL3)" opacity="0.8" />
          </svg>
        </div>

        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="absolute -right-3 top-24 w-6 h-6 bg-[#007CC2] text-white rounded-full flex items-center justify-center shadow-xl border-2 border-slate-50 hover:bg-[#009EE2] hover:scale-110 transition-all z-[60] cursor-pointer">
          {sidebarCollapsed ? <ChevronsRight size={14} strokeWidth={3} /> : <ChevronsLeft size={14} strokeWidth={3} />}
        </button>
        <div className="flex flex-col transition-all duration-500 ease-in-out px-4 items-center py-8 relative z-10">
          <div className={`bg-[#007CC2] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-sky-500/20 transition-all duration-500 ${sidebarCollapsed ? 'w-10 h-10' : 'w-12 h-12'}`}>
            <Wallet size={sidebarCollapsed ? 20 : 24} />
          </div>
          <div 
            style={{
              display: 'grid',
              gridTemplateRows: sidebarCollapsed ? '0fr' : '1fr',
              transition: 'grid-template-rows 500ms cubic-bezier(0.4, 0, 0.2, 1), opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            className={`w-full overflow-hidden flex flex-col items-center ${sidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}
          >
            <div className="overflow-hidden w-full flex flex-col items-center">
              <div className="pt-4 flex flex-col items-center w-full">
                <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-white truncate text-center w-full">{instansi}</h1>
                
                {webAccessStrings.length > 1 && (
                  <div className="w-full px-2 mt-4 space-y-2">
                    <p className="text-[8px] font-black text-white/50 uppercase tracking-widest text-center">Ganti Aplikasi</p>
                    <div className="flex bg-[#00254A]/60 p-1 rounded-xl border border-white/5">
                      <button 
                        onClick={() => switchApp('bendahara')}
                        className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${currentApp === 'bendahara' ? 'bg-[#007CC2] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                      >
                        Bendahara
                      </button>
                      <button 
                        onClick={() => switchApp('absensi')}
                        className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${currentApp === 'absensi' ? 'bg-[#007CC2] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                      >
                        Absensi
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-3 pb-1 border-t border-white/5 mt-3 flex flex-col items-center space-y-2 w-full">
                  <div className="flex items-center space-x-2 text-white/70">
                    <User size={12} className="flex-shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-tight truncate">{fullName}</span>
                  </div>
                  <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-white/5 ${isAdmin ? 'bg-[#007CC2]/20 text-sky-300' : 'bg-emerald-600/20 text-emerald-400'}`}>
                     <Fingerprint size={10} />
                     <span className="text-[8px] font-black uppercase tracking-[0.1em]">{displayRole}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 py-2 px-4 space-y-1.5 overflow-y-auto no-scrollbar relative z-10">
          {activeNavIndex !== -1 && (
            <div 
              className="absolute left-4 right-4 h-[42px] top-2 bg-[#007CC2] rounded-xl shadow-lg shadow-sky-950/20 transition-all duration-500 ease-in-out z-0"
              style={{ transform: `translateY(${activeNavIndex * (42 + 6)}px)` }} 
            />
          )}
          {navItems.map((item) => (
            <NavItem 
              key={item.id}
              tab={item.id as AppTab} 
              activeTab={activeTab} 
              icon={item.icon} 
              label={item.label} 
              sidebarCollapsed={sidebarCollapsed} 
              setActiveTab={setActiveTab} 
              />
          ))}
        </div>
        <div className="border-t border-white/5 p-4 space-y-2 relative z-10">
          <button onClick={refreshAllData} className={`w-full flex items-center rounded-xl bg-white/5 text-sky-200 hover:bg-[#007CC2] hover:text-white transition-all duration-500 group h-[42px] px-4 justify-start`}>
            <RefreshCw size={18} className={`${(currentApp === 'absensi' ? isAbsensiLoading : isLoading) ? 'animate-spin' : ''} flex-shrink-0`} />
            <span 
              style={{
                maxWidth: sidebarCollapsed ? '0px' : '200px',
                opacity: sidebarCollapsed ? 0 : 1,
                marginLeft: sidebarCollapsed ? '0px' : '12px',
                transition: 'max-width 500ms cubic-bezier(0.4, 0, 0.2, 1), opacity 500ms, margin-left 500ms cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              className="text-[9px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap overflow-hidden"
            >
              Segarkan Data
            </span>
          </button>
          <button onClick={() => openConfirm("Keluar?", "Sesi akan diakhiri.", "Ya, Keluar", handleLogout, true)} className={`w-full flex items-center rounded-xl bg-rose-500/10 text-rose-300 hover:bg-rose-500 hover:text-white transition-all duration-500 group h-[42px] px-4 justify-start`}>
            <LogOut size={18} className="flex-shrink-0" />
            <span 
              style={{
                maxWidth: sidebarCollapsed ? '0px' : '200px',
                opacity: sidebarCollapsed ? 0 : 1,
                marginLeft: sidebarCollapsed ? '0px' : '12px',
                transition: 'max-width 500ms cubic-bezier(0.4, 0, 0.2, 1), opacity 500ms, margin-left 500ms cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              className="text-[9px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap overflow-hidden"
            >
              Keluar
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col min-w-0 h-full overflow-hidden">
        <div className="md:hidden flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 z-30 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#007CC2] rounded-xl flex items-center justify-center text-white shadow-md"><Wallet size={18}/></div>
            <div className="flex flex-col">
              <span className="font-black text-[11px] uppercase text-slate-800 truncate max-w-[140px] leading-tight">{instansi}</span>
              <span className="text-[9px] font-black text-[#007CC2] uppercase tracking-tight">{fullName} ({displayRole})</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={refreshAllData} className="p-2 text-[#007CC2] bg-sky-50 rounded-xl transition-all border border-sky-100">
              <RefreshCw size={18} className={(currentApp === 'absensi' ? isAbsensiLoading : isLoading) ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => openConfirm("Keluar?", "Sesi akan diakhiri.", "Ya, Keluar", handleLogout, true)} className="p-2 text-rose-500 bg-rose-50 rounded-xl transition-all border border-rose-100"><LogOut size={18} /></button>
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden bg-slate-50/20 pb-[50px] md:pb-0">
          {currentApp === 'bendahara' ? (
            <>
              <TabView id="dashboard" activeTab={activeTab}><Dashboard transactions={transactions} globalStats={globalStats} isLoading={isLoading} isActive={activeTab === 'dashboard'} username={fullName} role={roleRaw} /></TabView>
              {canWrite && <TabView id="transaksi" activeTab={activeTab}><TransactionForm scriptUrl={activeScriptUrl} currentUsername={fullName} currentUserRole={displayRole} instansi={instansi} setTransactions={setTransactions} setGlobalStats={setGlobalStats} onSuccess={() => { fetchTransactions(true); fetchMetadata(); }} confirm={openConfirm} notify={showToast} canWrite={canWrite} isDateLocked={checkIsPeriodApproved} allProjects={availableProjects} availableCategories={availableCategories} onAddCategory={handleAddCategory} /></TabView>}
              <TabView id="history" activeTab={activeTab}><HistoryView transactions={transactions} setTransactions={setTransactions} setGlobalStats={setGlobalStats} scriptUrl={activeScriptUrl} onLocalUpdate={() => { fetchTransactions(true); if (activeTab === 'audit') fetchAuditLogs(true); }} onLocalDelete={() => { fetchTransactions(true); if (activeTab === 'audit') fetchAuditLogs(true); }} isLoading={isLoading} notify={showToast} confirm={openConfirm} currentUsername={fullName} canWrite={canWrite} isAdmin={isAdmin} instansi={instansi} allProjects={availableProjects} /></TabView>
              <TabView id="laporan" activeTab={activeTab}><LaporanView transactions={transactions} isLoading={isLoading} instansi={instansi} currentUsername={fullName} scriptUrl={activeScriptUrl} canApprove={canApprove} canExport={canExport} notify={showToast} confirm={openConfirm} onApproveSuccess={async (proj) => { await fetchMetadata(); await fetchTransactions(true); }} onFetchHistory={onFetchHistory} historicalOpeningBalances={historicalOpeningBalances} syncBaseBalance={syncBaseBalance} approvalsList={approvalsList} setApprovalsList={setApprovalsList} isAdmin={isAdmin} approverRole={displayRole} allProjects={availableProjects} /></TabView>
              {canSeeAudit && (
                <TabView id="audit" activeTab={activeTab}>
                  <div className="h-full flex flex-col relative">
                      <div className="p-4 md:p-10 pb-4 space-y-4 shrink-0 z-20 bg-slate-50/10">
                        <div className="max-w-md md:max-w-2xl mx-auto bg-slate-200/50 p-1 rounded-2xl flex relative overflow-hidden shadow-inner border border-slate-200">
                          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-all duration-500 ease-out shadow-md ${auditSubTab === 'delete' ? 'left-1 bg-rose-600' : 'left-[calc(50%+1px)] bg-blue-600'}`} />
                          <button onClick={() => setAuditSubTab('delete')} className={`flex-1 py-3 z-10 font-black text-[9px] md:text-[11px] uppercase tracking-[0.2em] transition-colors duration-300 flex items-center justify-center space-x-2 ${auditSubTab === 'delete' ? 'text-white' : 'text-slate-400'}`}><Trash2 size={14} /><span>Audit Hapus</span></button>
                          <button onClick={() => setAuditSubTab('edit')} className={`flex-1 py-3 z-10 font-black text-[9px] md:text-[11px] uppercase tracking-[0.2em] transition-colors duration-300 flex items-center justify-center space-x-2 ${auditSubTab === 'edit' ? 'text-white' : 'text-slate-400'}`}><FileEdit size={14} /><span>Audit Edit</span></button>
                        </div>
                        {canSeeFullAuditFilter && (
                          <div className="max-w-md md:max-w-2xl mx-auto flex items-center justify-center">
                            <div className="bg-white border border-slate-100 p-1 rounded-xl shadow-sm flex items-center relative overflow-hidden h-10 w-[240px]">
                                <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-500 ease-out shadow-sm ${!showAllAudit ? 'left-1 bg-slate-900' : 'left-[calc(50%+1px)] bg-blue-600'}`} />
                                <button onClick={() => setShowAllAudit(false)} className={`flex-1 h-full z-10 text-[8px] font-black uppercase tracking-widest transition-colors duration-500 ${!showAllAudit ? 'text-white' : 'text-slate-400 hover:text-slate-500'}`}>Belum Approve</button>
                                <button onClick={() => setShowAllAudit(true)} className={`flex-1 h-full z-10 text-[8px] font-black uppercase tracking-widest transition-colors duration-500 ${showAllAudit ? 'text-white' : 'text-slate-400 hover:text-slate-500'}`}>Semua (6 Bulan)</button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 relative overflow-hidden">
                        <div className="flex h-full transition-transform duration-500 ease-out will-change-transform" style={{ width: '200%', transform: `translateX(${auditSubTab === 'delete' ? '0%' : '-50%'})` }}>
                          <div className="w-1/2 h-full flex-shrink-0 overflow-hidden"><DeleteHistoryView deletedTransactions={displayDeletedLogs} isLoading={isAuditLoading} activeTab={activeTab} onSelect={setSelectedDeleteAudit} isApproved={checkIsPeriodApproved} /></div>
                          <div className="w-1/2 h-full flex-shrink-0 overflow-hidden"><EditAuditView editHistory={displayEditLogs} isLoading={isAuditLoading} activeTab={activeTab} onSelect={setSelectedEditAudit} isApproved={checkIsPeriodApproved} /></div>
                        </div>
                      </div>
                  </div>
                </TabView>
              )}
            </>
          ) : (
            <>
              <TabView id="dashboard" activeTab={activeTab}><DashboardAbsensi logs={absensiLogs} isLoading={isAbsensiLoading} username={fullName} summaries={absensiSummaries} ages={absensiAges} daerahs={absensiDaerahs} desas={absensiDesas} kelompoks={absensiKelompoks} /></TabView>
              <TabView id="absensi_form" activeTab={activeTab}><AttendanceForm members={absensiMembers} logs={absensiLogs} logUrl={absensiLogUrl} username={fullName} notify={showToast} onSuccess={() => refreshAllAbsensi(true)} events={absensiEvents} /></TabView>
              <TabView id="absensi_members" activeTab={activeTab}><MemberManagement daerahs={absensiDaerahs} desas={absensiDesas} kelompoks={absensiKelompoks} ages={absensiAges} members={absensiMembers} setMembers={setAbsensiMembers} appScriptMaster={absensiMasterUrl} canWrite={canWrite} onRefresh={() => refreshAllAbsensi(true)} isLoading={isAbsensiLoading} families={absensiFamilies} relationships={absensiRelationships} /></TabView>
              <TabView id="absensi_groups" activeTab={activeTab}><GroupManagement daerahs={absensiDaerahs} setDaerahs={setAbsensiDaerahs} desas={absensiDesas} setDesas={setAbsensiDesas} kelompoks={absensiKelompoks} setKelompoks={setAbsensiKelompoks} ages={absensiAges} setAges={setAbsensiAges} events={absensiEvents} setEvents={setAbsensiEvents} families={absensiFamilies} setFamilies={setAbsensiFamilies} relationships={absensiRelationships} setRelationships={setAbsensiRelationships} appScriptMaster={absensiMasterUrl} canWrite={canWrite} onRefresh={() => refreshAllAbsensi(true)} isLoading={isAbsensiLoading} /></TabView>
              <TabView id="absensi_history" activeTab={activeTab}><AttendanceHistory logs={absensiLogs} isLoading={isAbsensiLoading} logUrl={absensiLogUrl} onRefresh={() => refreshAllAbsensi(true)} notify={showToast} events={absensiEvents} /></TabView>
            </>
          )}
          {canChangePassword && (
            <TabView id="settings" activeTab={activeTab}> 
              <ChangePassword 
                portalUrl={PORTAL_SCRIPT_URL} 
                currentUsername={currentUsername} 
                onLogout={handleLogout} 
                notify={showToast} 
                currentApp={currentApp}
                switchApp={switchApp}
                webAccessStrings={webAccessStrings}
                activeScriptUrl={activeScriptUrl}
                setActiveScriptUrl={setActiveScriptUrl}
              />
            </TabView>
          )}
        </div>
        <div className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-[#00254A]/95 backdrop-blur-xl flex justify-around items-center h-[50px] px-2 shadow-[0_-4px_16px_rgba(0,0,0,0.15)] z-[50] border-t border-white/10">
          {navItems.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as AppTab)} className={`flex flex-col items-center justify-center space-y-0.5 transition-all flex-1 h-full relative ${activeTab === t.id ? 'text-[#00AEEF]' : 'text-slate-400'}`}>
              <div className={`transition-all duration-300 ${activeTab === t.id ? 'scale-105' : ''}`}>
                <t.icon size={16} />
              </div>
              <span className={`text-[8px] font-extrabold uppercase tracking-tight transition-opacity duration-300 ${activeTab === t.id ? 'opacity-100' : 'opacity-60'}`}>{t.label}</span>
              {activeTab === t.id && <div className="absolute bottom-0 w-6 h-[2.5px] bg-[#00AEEF] rounded-full"></div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
