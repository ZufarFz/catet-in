
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Transaction, ProjectMetadata } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Download, TrendingUp, TrendingDown, Wallet, ChevronDown, Loader2, ShieldCheck, AlertTriangle, FileText, ArrowRight, CalendarSearch, UserCheck, Lock, Unlock, Inbox, RefreshCw, Clock, AlertCircle, X, Check, Filter, CheckCircle, Info } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { dbAddApproval, dbUpdateProjectStatus, dbAddTransaction } from '../../firebase';

interface LaporanViewProps {
  transactions: Transaction[];
  isLoading: boolean;
  instansi: string;
  currentUsername: string;
  scriptUrl: string;
  canApprove: boolean;
  canExport: boolean;
  notify: (msg: string, type?: 'success' | 'error') => void;
  confirm: (title: string, msg: string, confirmText: string, onConfirm: () => Promise<void> | void, isDanger?: boolean) => void;
  onApproveSuccess: (projectName?: string) => void;
  onFetchHistory: (month: number, year: number, project?: string, endMonth?: number, endYear?: number) => Promise<void>;
  historicalOpeningBalances: Record<string, number>;
  syncBaseBalance: number;
  approvalsList: any[];
  setApprovalsList: React.Dispatch<React.SetStateAction<any[]>>;
  isAdmin: boolean;
  approverRole: string;
  allProjects: ProjectMetadata[];
}

const LaporanView: React.FC<LaporanViewProps> = ({ 
  transactions, 
  isLoading, 
  instansi, 
  currentUsername, 
  scriptUrl, 
  canApprove, 
  canExport, 
  notify, 
  confirm, 
  onApproveSuccess, 
  onFetchHistory, 
  historicalOpeningBalances, 
  syncBaseBalance, 
  approvalsList, 
  setApprovalsList, 
  isAdmin: _isAdmin, 
  approverRole,
  allProjects 
}) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [viewMode, setViewMode] = useState<'monthly' | 'quarterly' | 'caturwulan' | 'semester' | 'annual' | 'custom'>('monthly');
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(currentMonth / 3) + 1);
  const [selectedCaturwulan, setSelectedCaturwulan] = useState(Math.floor(currentMonth / 4) + 1);
  const [selectedSemester, setSelectedSemester] = useState(currentMonth < 6 ? 1 : 2);
  
  // Custom range states
  const [customStartMonth, setCustomStartMonth] = useState(currentMonth);
  const [customStartYear, setCustomStartYear] = useState(currentYear);
  const [customEndMonth, setCustomEndMonth] = useState(currentMonth);
  const [customEndYear, setCustomEndYear] = useState(currentYear);

  const [selectedProject, setSelectedProject] = useState('KAS UMUM');

  // Draft Filter States
  const [selectedMonthDraft, setSelectedMonthDraft] = useState(currentMonth);
  const [selectedYearDraft, setSelectedYearDraft] = useState(currentYear);
  const [viewModeDraft, setViewModeDraft] = useState<'monthly' | 'quarterly' | 'caturwulan' | 'semester' | 'annual' | 'custom'>('monthly');
  const [selectedQuarterDraft, setSelectedQuarterDraft] = useState(Math.floor(currentMonth / 3) + 1);
  const [selectedCaturwulanDraft, setSelectedCaturwulanDraft] = useState(Math.floor(currentMonth / 4) + 1);
  const [selectedSemesterDraft, setSelectedSemesterDraft] = useState(currentMonth < 6 ? 1 : 2);
  const [customStartMonthDraft, setCustomStartMonthDraft] = useState(currentMonth);
  const [customStartYearDraft, setCustomStartYearDraft] = useState(currentYear);
  const [customEndMonthDraft, setCustomEndMonthDraft] = useState(currentMonth);
  const [customEndYearDraft, setCustomEndYearDraft] = useState(currentYear);
  const [selectedProjectDraft, setSelectedProjectDraft] = useState('KAS UMUM');

  const [isExporting, setIsExporting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isClosingProject, setIsClosingProject] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isStartMonthPickerOpen, setIsStartMonthPickerOpen] = useState(false);
  const [isEndMonthPickerOpen, setIsEndMonthPickerOpen] = useState(false);
  const [isQuarterPickerOpen, setIsQuarterPickerOpen] = useState(false);
  const [isCaturwulanPickerOpen, setIsCaturwulanPickerOpen] = useState(false);
  const [isSemesterPickerOpen, setIsSemesterPickerOpen] = useState(false);
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [isModePickerOpen, setIsModePickerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const startMonthRef = useRef<HTMLDivElement>(null);
  const endMonthRef = useRef<HTMLDivElement>(null);
  const quarterRef = useRef<HTMLDivElement>(null);
  const caturwulanRef = useRef<HTMLDivElement>(null);
  const semesterRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);

  const kasUmumConfigRef = useRef({
    viewMode: 'monthly' as 'monthly' | 'quarterly' | 'caturwulan' | 'semester' | 'annual' | 'custom',
    viewModeDraft: 'monthly' as 'monthly' | 'quarterly' | 'caturwulan' | 'semester' | 'annual' | 'custom',
    selectedMonth: currentMonth,
    selectedMonthDraft: currentMonth,
    selectedYear: currentYear,
    selectedYearDraft: currentYear,
    selectedQuarter: Math.floor(currentMonth / 3) + 1,
    selectedQuarterDraft: Math.floor(currentMonth / 3) + 1,
    selectedCaturwulan: Math.floor(currentMonth / 4) + 1,
    selectedCaturwulanDraft: Math.floor(currentMonth / 4) + 1,
    selectedSemester: currentMonth < 6 ? 1 : 2,
    selectedSemesterDraft: currentMonth < 6 ? 1 : 2,
    customStartMonth: currentMonth,
    customStartMonthDraft: currentMonth,
    customStartYear: currentYear,
    customStartYearDraft: currentYear,
    customEndMonth: currentMonth,
    customEndMonthDraft: currentMonth,
    customEndYear: currentYear,
    customEndYearDraft: currentYear,
  });

  const currentProjectData = useMemo(() => {
    return allProjects.find(p => p.name.toUpperCase() === selectedProject.toUpperCase());
  }, [selectedProject, allProjects]);

  const isProjectArchived = useMemo(() => {
    return currentProjectData?.status?.toLowerCase() === 'arsip';
  }, [currentProjectData]);

  const handleSelectProker = async (projName: string) => {
    const targetProj = allProjects.find(p => p.name.toUpperCase() === projName.toUpperCase());
    const isAlreadyLoaded = targetProj?.status?.toLowerCase() === 'aktif';

    if (selectedProjectDraft === 'KAS UMUM' || selectedProject === 'KAS UMUM') {
      kasUmumConfigRef.current = {
        viewMode,
        viewModeDraft,
        selectedMonth,
        selectedMonthDraft,
        selectedYear,
        selectedYearDraft,
        selectedQuarter,
        selectedQuarterDraft,
        selectedCaturwulan,
        selectedCaturwulanDraft,
        selectedSemester,
        selectedSemesterDraft,
        customStartMonth,
        customStartMonthDraft,
        customStartYear,
        customStartYearDraft,
        customEndMonth,
        customEndMonthDraft,
        customEndYear,
        customEndYearDraft,
      };
    }

    setSelectedProjectDraft(projName);
    setSelectedProject(projName);
    setViewModeDraft('annual');
    setViewMode('annual');
    setIsProjectPickerOpen(false);

    if (isAlreadyLoaded) {
      notify(`Selesai memuat data proker "${projName}".`, "success");
      return;
    }

    setIsRefreshing(true);
    try {
      // Fetch full transactions for this archived proker or other needed proker
      await onFetchHistory(1, selectedYearDraft, projName, 12, selectedYearDraft);
      notify(`Selesai menyinkronkan data proker "${projName}".`, "success");
    } catch (err) {
      console.error("Gagal menyinkronkan data proker:", err);
      notify("Gagal memuat transaksi proker dari server.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectKasUmum = () => {
    const backup = kasUmumConfigRef.current;

    setViewMode(backup.viewMode);
    setViewModeDraft(backup.viewModeDraft);
    setSelectedMonth(backup.selectedMonth);
    setSelectedMonthDraft(backup.selectedMonthDraft);
    setSelectedYear(backup.selectedYear);
    setSelectedYearDraft(backup.selectedYearDraft);
    setSelectedQuarter(backup.selectedQuarter);
    setSelectedQuarterDraft(backup.selectedQuarterDraft);
    setSelectedCaturwulan(backup.selectedCaturwulan);
    setSelectedCaturwulanDraft(backup.selectedCaturwulanDraft);
    setSelectedSemester(backup.selectedSemester);
    setSelectedSemesterDraft(backup.selectedSemesterDraft);
    setCustomStartMonth(backup.customStartMonth);
    setCustomStartMonthDraft(backup.customStartMonthDraft);
    setCustomStartYear(backup.customStartYear);
    setCustomStartYearDraft(backup.customStartYearDraft);
    setCustomEndMonth(backup.customEndMonth);
    setCustomEndMonthDraft(backup.customEndMonthDraft);
    setCustomEndYear(backup.customEndYear);
    setCustomEndYearDraft(backup.customEndYearDraft);

    setSelectedProjectDraft('KAS UMUM');
    setSelectedProject('KAS UMUM');
    setIsProjectPickerOpen(false);
  };



  const isFilterChanged = useMemo(() => {
    return (
      selectedMonthDraft !== selectedMonth ||
      selectedYearDraft !== selectedYear ||
      viewModeDraft !== viewMode ||
      selectedQuarterDraft !== selectedQuarter ||
      selectedCaturwulanDraft !== selectedCaturwulan ||
      selectedSemesterDraft !== selectedSemester ||
      customStartMonthDraft !== customStartMonth ||
      customStartYearDraft !== customStartYear ||
      customEndMonthDraft !== customEndMonth ||
      customEndYearDraft !== customEndYear ||
      selectedProjectDraft !== selectedProject
    );
  }, [
    selectedMonthDraft, selectedMonth,
    selectedYearDraft, selectedYear,
    viewModeDraft, viewMode,
    selectedQuarterDraft, selectedQuarter,
    selectedCaturwulanDraft, selectedCaturwulan,
    selectedSemesterDraft, selectedSemester,
    customStartMonthDraft, customStartMonth,
    customStartYearDraft, customStartYear,
    customEndMonthDraft, customEndMonth,
    customEndYearDraft, customEndYear,
    selectedProjectDraft, selectedProject
  ]);

  const draftTargetMonths = useMemo(() => {
    let rawMonths: {month: number, year: number}[] = [];
    if (viewModeDraft === 'monthly') rawMonths = [{month: selectedMonthDraft + 1, year: selectedYearDraft}];
    else if (viewModeDraft === 'quarterly') {
      rawMonths = [
        {month: (selectedQuarterDraft - 1) * 3 + 1, year: selectedYearDraft},
        {month: (selectedQuarterDraft - 1) * 3 + 2, year: selectedYearDraft},
        {month: (selectedQuarterDraft - 1) * 3 + 3, year: selectedYearDraft}
      ];
    } else if (viewModeDraft === 'caturwulan') {
      rawMonths = [
        {month: (selectedCaturwulanDraft - 1) * 4 + 1, year: selectedYearDraft},
        {month: (selectedCaturwulanDraft - 1) * 4 + 2, year: selectedYearDraft},
        {month: (selectedCaturwulanDraft - 1) * 4 + 3, year: selectedYearDraft},
        {month: (selectedCaturwulanDraft - 1) * 4 + 4, year: selectedYearDraft}
      ];
    } else if (viewModeDraft === 'semester') {
      rawMonths = [
        {month: (selectedSemesterDraft - 1) * 6 + 1, year: selectedYearDraft},
        {month: (selectedSemesterDraft - 1) * 6 + 2, year: selectedYearDraft},
        {month: (selectedSemesterDraft - 1) * 6 + 3, year: selectedYearDraft},
        {month: (selectedSemesterDraft - 1) * 6 + 4, year: selectedYearDraft},
        {month: (selectedSemesterDraft - 1) * 6 + 5, year: selectedYearDraft},
        {month: (selectedSemesterDraft - 1) * 6 + 6, year: selectedYearDraft}
      ];
    } else if (viewModeDraft === 'annual') {
      for (let m = 1; m <= 12; m++) rawMonths.push({month: m, year: selectedYearDraft});
    } else if (viewModeDraft === 'custom') {
      const startVal = customStartYearDraft * 12 + customStartMonthDraft;
      const endVal = customEndYearDraft * 12 + customEndMonthDraft;
      for (let v = startVal; v <= endVal; v++) {
        rawMonths.push({month: (v % 12) + 1, year: Math.floor(v / 12)});
      }
    }

    if (selectedYearDraft === currentYear) {
       return rawMonths.filter(m => m.year < currentYear || (m.year === currentYear && m.month <= currentMonth + 1));
    }
    return rawMonths;
  }, [viewModeDraft, selectedMonthDraft, selectedQuarterDraft, selectedCaturwulanDraft, selectedSemesterDraft, selectedYearDraft, currentYear, currentMonth, customStartMonthDraft, customStartYearDraft, customEndMonthDraft, customEndYearDraft]);

  const handleApplyFilter = async () => {
    setIsRefreshing(true);
    let fetchCount = 0;
    try {
      // Find the latest approved KAS UMUM period to determine live-query range start
      const kasUmumApprovals = (approvalsList || []).filter(a => 
        String(a.project_name || 'KAS UMUM').trim().toUpperCase() === 'KAS UMUM'
      );
      
      let startQueryDate: Date | null = null;
      if (kasUmumApprovals.length > 0) {
        const parsedApprovals = kasUmumApprovals.map(a => {
          const parts = String(a.period_id).split('-');
          const mVal = parseInt(parts[0], 10);
          const yVal = parseInt(parts[1], 10);
          return {
            date: new Date(yVal, mVal - 1, 1),
            approval: a
          };
        }).filter(item => !isNaN(item.date.getTime()));
        
        if (parsedApprovals.length > 0) {
          parsedApprovals.sort((a, b) => b.date.getTime() - a.date.getTime());
          startQueryDate = new Date(parsedApprovals[0].date.getFullYear(), parsedApprovals[0].date.getMonth() + 1, 1);
        }
      }

      // Check which of the target months are missing from local cache
      const missingMonths = draftTargetMonths.filter(m => {
        if (selectedProjectDraft !== 'KAS UMUM') return false;
        
        const projKey = selectedProjectDraft.toUpperCase();
        const isSnapVerified = 
          historicalOpeningBalances[`${m.month}-${m.year}-${selectedProjectDraft}`] !== undefined ||
          historicalOpeningBalances[`${m.month}-${m.year}-${projKey}`] !== undefined;
        
        if (isSnapVerified) return false;
        if (!startQueryDate) return false;
        
        const mDate = new Date(m.year, m.month - 1, 1);
        return mDate < startQueryDate;
      });

      if (missingMonths.length > 0) {
        // Find the earliest and latest missing month/year to fetch specific range
        let earliestMatch = missingMonths[0];
        let latestMatch = missingMonths[0];
        for (const m of missingMonths) {
          const currentDate = new Date(m.year, m.month - 1, 1);
          const earliestDate = new Date(earliestMatch.year, earliestMatch.month - 1, 1);
          const latestDate = new Date(latestMatch.year, latestMatch.month - 1, 1);
          if (currentDate < earliestDate) {
            earliestMatch = m;
          }
          if (currentDate > latestDate) {
            latestMatch = m;
          }
        }
        
        console.log(`[Auto Sync Batch] Missing months:`, missingMonths.map(m => `${m.month}/${m.year}`).join(', '));
        console.log(`[Auto Sync Batch] Fetching range from ${earliestMatch.month}/${earliestMatch.year} to ${latestMatch.month}/${latestMatch.year}`);
        
        // Trigger a single synchronized fetch for this range
        await onFetchHistory(earliestMatch.month, earliestMatch.year, selectedProjectDraft, latestMatch.month, latestMatch.year);
        fetchCount = missingMonths.length;
      }

      setSelectedMonth(selectedMonthDraft);
      setSelectedYear(selectedYearDraft);
      setViewMode(viewModeDraft);
      setSelectedQuarter(selectedQuarterDraft);
      setSelectedCaturwulan(selectedCaturwulanDraft);
      setSelectedSemester(selectedSemesterDraft);
      setCustomStartMonth(customStartMonthDraft);
      setCustomStartYear(customStartYearDraft);
      setCustomEndMonth(customEndMonthDraft);
      setCustomEndYear(customEndYearDraft);
      setSelectedProject(selectedProjectDraft);

      if (fetchCount > 0) {
        notify(`Filter diterapkan. ${fetchCount} bulan berhasil disinkronkan dari server secara otomatis.`, "success");
      } else {
        notify("Filter laporan berhasil diterapkan.", "success");
      }
    } catch (err) {
      console.error("Gagal menerapkan filter:", err);
      notify("Gagal menyelaraskan data filter dengan server.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMonthPickerOpen(false);
      }
      if (startMonthRef.current && !startMonthRef.current.contains(event.target as Node)) {
        setIsStartMonthPickerOpen(false);
      }
      if (endMonthRef.current && !endMonthRef.current.contains(event.target as Node)) {
        setIsEndMonthPickerOpen(false);
      }
      if (quarterRef.current && !quarterRef.current.contains(event.target as Node)) {
        setIsQuarterPickerOpen(false);
      }
      if (caturwulanRef.current && !caturwulanRef.current.contains(event.target as Node)) {
        setIsCaturwulanPickerOpen(false);
      }
      if (semesterRef.current && !semesterRef.current.contains(event.target as Node)) {
        setIsSemesterPickerOpen(false);
      }
      if (projectRef.current && !projectRef.current.contains(event.target as Node)) {
        setIsProjectPickerOpen(false);
      }
      if (modeRef.current && !modeRef.current.contains(event.target as Node)) {
        setIsModePickerOpen(false);
      }
    }
    if (isMonthPickerOpen || isProjectPickerOpen || isQuarterPickerOpen || isCaturwulanPickerOpen || isSemesterPickerOpen || isModePickerOpen || isStartMonthPickerOpen || isEndMonthPickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMonthPickerOpen, isProjectPickerOpen, isQuarterPickerOpen, isCaturwulanPickerOpen, isSemesterPickerOpen, isModePickerOpen, isStartMonthPickerOpen, isEndMonthPickerOpen]);

  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const viewModeLabels: Record<string, string> = {
    monthly: 'Bulanan',
    quarterly: 'Triwulan',
    caturwulan: 'Caturwulan',
    semester: 'Semester',
    annual: 'Tahunan',
    custom: 'Custom'
  };
  const quarters = [
    { id: 1, label: 'Kuartal 1', range: 'Januari – Maret' },
    { id: 2, label: 'Kuartal 2', range: 'April – Juni' },
    { id: 3, label: 'Kuartal 3', range: 'Juli – September' },
    { id: 4, label: 'Kuartal 4', range: 'Oktober – Desember' }
  ];
  const caturwulans = [
    { id: 1, label: 'Caturwulan 1', range: 'Januari – April' },
    { id: 2, label: 'Caturwulan 2', range: 'Mei – Agustus' },
    { id: 3, label: 'Caturwulan 3', range: 'September – Desember' }
  ];
  const semesters = [
    { id: 1, label: 'Semester 1', range: 'Januari – Juni' },
    { id: 2, label: 'Semester 2', range: 'Juli – Desember' }
  ];

  const parseSafeDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    if (String(dateStr).includes('-')) {
      const parts = String(dateStr).split('T')[0].split('-');
      if (parts.length === 3 && parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(dateStr);
  };

  const formatDateTimePdf = (dateObjOrStr: Date | string, includeTime: boolean = true) => {
    if (!dateObjOrStr) return '-';
    let d: Date;
    
    if (dateObjOrStr instanceof Date) {
      d = dateObjOrStr;
    } else {
      const cleanStr = String(dateObjOrStr).replace('T', ' ').replace(',', '');
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

      if (year === 0) return String(dateObjOrStr);
      d = new Date(year, month - 1, day, hour, min);
    }

    if (isNaN(d.getTime())) return String(dateObjOrStr);

    const resDate = `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
    if (!includeTime) return resDate;
    return `${resDate}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const isPeriodPast = useMemo(() => {
    if (selectedProject !== 'KAS UMUM') return true;
    if (viewMode === 'monthly') {
      if (selectedYear < currentYear) return true;
      if (selectedYear === currentYear && selectedMonth < currentMonth) return true;
    } else if (viewMode === 'quarterly') {
      const currentQuarter = Math.floor(currentMonth / 3) + 1;
      if (selectedYear < currentYear) return true;
      if (selectedYear === currentYear && selectedQuarter < currentQuarter) return true;
    } else if (viewMode === 'caturwulan') {
      const currentCW = Math.floor(currentMonth / 4) + 1;
      if (selectedYear < currentYear) return true;
      if (selectedYear === currentYear && selectedCaturwulan < currentCW) return true;
    } else if (viewMode === 'semester') {
      const currentSM = currentMonth < 6 ? 1 : 2;
      if (selectedYear < currentYear) return true;
      if (selectedYear === currentYear && selectedSemester < currentSM) return true;
    } else if (viewMode === 'annual') {
      if (selectedYear < currentYear) return true;
    } else if (viewMode === 'custom') {
      if (customEndYear < currentYear) return true;
      if (customEndYear === currentYear && customEndMonth < currentMonth) return true;
    }
    return false;
  }, [selectedMonth, selectedYear, currentMonth, currentYear, viewMode, selectedQuarter, selectedCaturwulan, selectedSemester, selectedProject, customEndMonth, customEndYear]);

  const isCurrentPeriod = useMemo(() => {
    if (selectedProject !== 'KAS UMUM') return false;
    if (viewMode === 'monthly') {
      return selectedYear === currentYear && selectedMonth === currentMonth;
    } else if (viewMode === 'quarterly') {
      const currentQuarter = Math.floor(currentMonth / 3) + 1;
      return selectedYear === currentYear && selectedQuarter === currentQuarter;
    } else if (viewMode === 'caturwulan') {
      const currentCW = Math.floor(currentMonth / 4) + 1;
      return selectedYear === currentYear && selectedCaturwulan === currentCW;
    } else if (viewMode === 'semester') {
      const currentSM = currentMonth < 6 ? 1 : 2;
      return selectedYear === currentYear && selectedSemester === currentSM;
    } else if (viewMode === 'annual') {
      return selectedYear === currentYear;
    } else if (viewMode === 'custom') {
      const currentVal = currentYear * 12 + currentMonth;
      const startVal = customStartYear * 12 + customStartMonth;
      const endVal = customEndYear * 12 + customEndMonth;
      return currentVal >= startVal && currentVal <= endVal;
    }
    return false;
  }, [selectedMonth, selectedYear, currentMonth, currentYear, viewMode, selectedQuarter, selectedCaturwulan, selectedSemester, selectedProject, customStartMonth, customStartYear, customEndMonth, customEndYear]);
  
  const isFuturePeriod = useMemo(() => {
    if (selectedProject !== 'KAS UMUM') return false;
    if (viewMode === 'monthly') {
      if (selectedYear > currentYear) return true;
      if (selectedYear === currentYear && selectedMonth > currentMonth) return true;
    } else if (viewMode === 'quarterly') {
      const currentQuarter = Math.floor(currentMonth / 3) + 1;
      if (selectedYear > currentYear) return true;
      if (selectedYear === currentYear && selectedQuarter > currentQuarter) return true;
    } else if (viewMode === 'caturwulan') {
      const currentCW = Math.floor(currentMonth / 4) + 1;
      if (selectedYear > currentYear) return true;
      if (selectedYear === currentYear && selectedCaturwulan > currentCW) return true;
    } else if (viewMode === 'semester') {
      const currentSM = currentMonth < 6 ? 1 : 2;
      if (selectedYear > currentYear) return true;
      if (selectedYear === currentYear && selectedSemester > currentSM) return true;
    } else if (viewMode === 'annual') {
      if (selectedYear > currentYear) return true;
    } else if (viewMode === 'custom') {
      if (customStartYear > currentYear) return true;
      if (customStartYear === currentYear && customStartMonth > currentMonth) return true;
    }
    return false;
  }, [selectedMonth, selectedYear, currentMonth, currentYear, viewMode, selectedQuarter, selectedCaturwulan, selectedSemester, selectedProject, customStartMonth, customStartYear]);

  const isBoundaryMonth = useMemo(() => {
    if (selectedProject !== 'KAS UMUM' || isFuturePeriod || isCurrentPeriod) return false;
    if (viewMode === 'monthly') {
      const diffMonths = (currentYear - selectedYear) * 12 + (currentMonth - selectedMonth);
      return diffMonths >= 5;
    }
    return false;
  }, [selectedMonth, selectedYear, currentMonth, currentYear, isFuturePeriod, isCurrentPeriod, viewMode, selectedProject]);

  const isDeepScanMode = useMemo(() => selectedProject !== 'KAS UMUM', [selectedProject]);
  const targetMonths = useMemo(() => {
    let rawMonths: {month: number, year: number}[] = [];
    if (viewMode === 'monthly') rawMonths = [{month: selectedMonth + 1, year: selectedYear}];
    else if (viewMode === 'quarterly') {
      rawMonths = [
        {month: (selectedQuarter - 1) * 3 + 1, year: selectedYear},
        {month: (selectedQuarter - 1) * 3 + 2, year: selectedYear},
        {month: (selectedQuarter - 1) * 3 + 3, year: selectedYear}
      ];
    } else if (viewMode === 'caturwulan') {
      rawMonths = [
        {month: (selectedCaturwulan - 1) * 4 + 1, year: selectedYear},
        {month: (selectedCaturwulan - 1) * 4 + 2, year: selectedYear},
        {month: (selectedCaturwulan - 1) * 4 + 3, year: selectedYear},
        {month: (selectedCaturwulan - 1) * 4 + 4, year: selectedYear}
      ];
    } else if (viewMode === 'semester') {
      rawMonths = [
        {month: (selectedSemester - 1) * 6 + 1, year: selectedYear},
        {month: (selectedSemester - 1) * 6 + 2, year: selectedYear},
        {month: (selectedSemester - 1) * 6 + 3, year: selectedYear},
        {month: (selectedSemester - 1) * 6 + 4, year: selectedYear},
        {month: (selectedSemester - 1) * 6 + 5, year: selectedYear},
        {month: (selectedSemester - 1) * 6 + 6, year: selectedYear}
      ];
    } else if (viewMode === 'annual') {
      for (let m = 1; m <= 12; m++) rawMonths.push({month: m, year: selectedYear});
    } else if (viewMode === 'custom') {
      const startVal = customStartYear * 12 + customStartMonth;
      const endVal = customEndYear * 12 + customEndMonth;
      for (let v = startVal; v <= endVal; v++) {
        rawMonths.push({month: (v % 12) + 1, year: Math.floor(v / 12)});
      }
    }

    if (selectedYear === currentYear) {
      rawMonths = rawMonths.filter(m => m.year < currentYear || (m.year === currentYear && m.month <= currentMonth + 1));
    }

    if (viewMode !== 'monthly') {
      const filtered = rawMonths.filter(m => {
        const isVerified = historicalOpeningBalances[`${m.month}-${m.year}-${selectedProject}`] !== undefined;
        if (!isVerified) return true; // keep unsynced/unverified months so they can be synced
        const hasTx = transactions.some(t => {
          if (t.project_name?.toUpperCase() !== selectedProject.toUpperCase()) return false;
          const d = parseSafeDate(t.date);
          return d.getMonth() === m.month - 1 && d.getFullYear() === m.year;
        });
        return hasTx;
      });
      if (filtered.length > 0) {
        return filtered;
      }
    }

    return rawMonths;
  }, [viewMode, selectedMonth, selectedQuarter, selectedCaturwulan, selectedSemester, selectedYear, currentYear, currentMonth, customStartMonth, customStartYear, customEndMonth, customEndYear, transactions, selectedProject, historicalOpeningBalances]);

  const isDataVerifiedByServer = useMemo(() => {
    if (selectedProject !== 'KAS UMUM') return true; 
    
    // Find KAS UMUM approvals
    const kasUmumApprovals = (approvalsList || []).filter(a => 
      String(a.project_name || 'KAS UMUM').trim().toUpperCase() === 'KAS UMUM'
    );
    
    let earliestApprovedDate: Date | null = null;
    let latestApprovedDate: Date | null = null;
    
    if (kasUmumApprovals.length > 0) {
      const parsedDates = kasUmumApprovals.map(a => {
        const parts = String(a.period_id).split('-');
        const m = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        return new Date(y, m - 1, 1);
      }).filter(d => !isNaN(d.getTime()));
      
      if (parsedDates.length > 0) {
        parsedDates.sort((a, b) => a.getTime() - b.getTime());
        earliestApprovedDate = parsedDates[0];
        latestApprovedDate = parsedDates[parsedDates.length - 1];
      }
    }

    return targetMonths.every(m => {
      const mDate = new Date(m.year, m.month - 1, 1);
      
      // 1. Any month before the earliest approved month is automatically verified (pre-ledger boundary)
      if (earliestApprovedDate && mDate < earliestApprovedDate) {
        return true;
      }
      
      // 2. Any month after the latest approved month is in the live query zone, so it is verified
      if (latestApprovedDate) {
        const liveQueryStart = new Date(latestApprovedDate.getFullYear(), latestApprovedDate.getMonth() + 1, 1);
        if (mDate >= liveQueryStart) {
          return true;
        }
      } else {
        // If there are no approvals at all, everything is live-queried and therefore verified
        return true;
      }
      
      // 3. For any month within the approved boundaries, check if it is verified or approved
      const isSnapVerified = historicalOpeningBalances[`${m.month}-${m.year}-${selectedProject}`] !== undefined;
      if (isSnapVerified) return true;
      
      const hasSpecificApproval = (approvalsList || []).some(a => 
        String(a.project_name || 'KAS UMUM').trim().toUpperCase() === 'KAS UMUM' &&
        String(a.period_id) === `${m.month}-${m.year}`
      );
      
      return hasSpecificApproval;
    });
  }, [targetMonths, selectedProject, historicalOpeningBalances, approvalsList]);

  const isCustomRangeValid = useMemo(() => {
    if (viewMode !== 'custom') return true;
    const startVal = customStartYear * 12 + customStartMonth;
    const endVal = customEndYear * 12 + customEndMonth;
    if (endVal < startVal) return false;
    return (endVal - startVal + 1) <= 12;
  }, [viewMode, customStartMonth, customStartYear, customEndMonth, customEndYear]);

  const reportData = useMemo(() => {
    const isKasUmum = selectedProject.toUpperCase() === 'KAS UMUM';
    
    let firstDay: Date;
    let lastDay: Date;

    if (viewMode === 'monthly' || !isKasUmum) {
      firstDay = new Date(selectedYear, selectedMonth, 1);
      lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    } else if (viewMode === 'quarterly') {
      const startMonth = (selectedQuarter - 1) * 3;
      firstDay = new Date(selectedYear, startMonth, 1);
      lastDay = new Date(selectedYear, startMonth + 3, 0);
    } else if (viewMode === 'caturwulan') {
      const startMonth = (selectedCaturwulan - 1) * 4;
      firstDay = new Date(selectedYear, startMonth, 1);
      lastDay = new Date(selectedYear, startMonth + 4, 0);
    } else if (viewMode === 'semester') {
      const startMonth = (selectedSemester - 1) * 6;
      firstDay = new Date(selectedYear, startMonth, 1);
      lastDay = new Date(selectedYear, startMonth + 6, 0);
    } else if (viewMode === 'annual') {
      firstDay = new Date(selectedYear, 0, 1);
      lastDay = new Date(selectedYear, 12, 0);
    } else {
      // Custom mode
      firstDay = new Date(customStartYear, customStartMonth, 1);
      lastDay = new Date(customEndYear, customEndMonth + 1, 0);
    }
    
    const firstMonthInPeriod = targetMonths[0];
    const serverOpeningBalance = firstMonthInPeriod ? historicalOpeningBalances[`${firstMonthInPeriod.month}-${firstMonthInPeriod.year}-${selectedProject}`] : undefined;
    
    const projectTransactions = transactions
      .filter(t => t.project_name?.toUpperCase() === selectedProject.toUpperCase())
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return (a.created_at || '').localeCompare(b.created_at || '');
      });

    let totalIncome = 0;
    let totalExpense = 0;
    const incomeDetails: Transaction[] = [];
    const expenseDetails: Transaction[] = [];
    const monthlyTransactions: Transaction[] = [];
    
    let lastTxBeforePeriod: Transaction | null = null;
    let lastTxInPeriod: Transaction | null = null;

    projectTransactions.forEach(t => {
      const d = parseSafeDate(t.date);
      const amt = Number(t.amount || 0);

      if (d < firstDay) {
        lastTxBeforePeriod = t;
      }

      if (isDeepScanMode) {
        monthlyTransactions.push(t);
        lastTxInPeriod = t;
        if (t.type === 'masuk') { totalIncome += amt; incomeDetails.push(t); } 
        else { totalExpense += amt; expenseDetails.push(t); }
      } else {
        if (d >= firstDay && d <= lastDay) {
          monthlyTransactions.push(t);
          lastTxInPeriod = t;
          if (t.type === 'masuk') { totalIncome += amt; incomeDetails.push(t); } 
          else { totalExpense += amt; expenseDetails.push(t); }
        }
      }
    });

    const firstMonthOfPeriod = firstDay.getMonth() + 1;
    const firstYearOfPeriod = firstDay.getFullYear();
    const rangeFirstPeriodKey = `${firstMonthOfPeriod}-${firstYearOfPeriod}`;
    const rangeFirstApproval = (approvalsList || []).find(a => String(a.period_id) === String(rangeFirstPeriodKey));

    const prevMonthDate = new Date(firstDay.getFullYear(), firstDay.getMonth() - 1, 1);
    const prevMonth = prevMonthDate.getMonth();
    const prevYear = prevMonthDate.getFullYear();
    const prevPeriodKey = `${prevMonth + 1}-${prevYear}`;
    const prevApproval = (approvalsList || []).find(a => String(a.period_id) === String(prevPeriodKey));

    const lastMonthOfPeriod = lastDay.getMonth() + 1;
    const lastYearOfPeriod = lastDay.getFullYear();
    const rangeLastPeriodKey = `${lastMonthOfPeriod}-${lastYearOfPeriod}`;
    const rangeLastApproval = (approvalsList || []).find(a => String(a.period_id) === String(rangeLastPeriodKey));

    let isApproved: boolean;
    let validator = '';
    let validDate = '';
    let validRole = '';
    let periodMonthStatuses: { monthName: string; isApproved: boolean; approvedBy: string; approveDate: string; approverRole: string; }[] = [];

    if (isDeepScanMode) {
      isApproved = isProjectArchived;
      validator = currentProjectData?.approved_by || '';
      validDate = currentProjectData?.approved_at || '';
      validRole = currentProjectData?.approver_role || '';
    } else if (viewMode === 'monthly') {
      const globalPeriodKey = `${selectedMonth + 1}-${selectedYear}`;
      const monthlyApproval = (approvalsList || []).find(a => String(a.period_id) === String(globalPeriodKey));
      isApproved = !!monthlyApproval;
      validator = monthlyApproval?.approved_by || '';
      validDate = monthlyApproval?.approve_date || '';
      validRole = monthlyApproval?.approver_role || '';
    } else {
      // Period Approval Check: All months in the selected range must be approved
      // We only include the months that actually have transactions in targetMonths
      const targetMonthsLocal = targetMonths;

      const approvals = targetMonthsLocal.map(m => (approvalsList || []).find(a => String(a.period_id) === `${m.month}-${m.year}`));
      isApproved = approvals.length > 0 && approvals.every(a => !!a);
      
      periodMonthStatuses = targetMonthsLocal.map((m, idx) => {
        const appr = approvals[idx];
        return {
          monthName: months[m.month - 1],
          isApproved: !!appr,
          approvedBy: appr?.approved_by || '',
          approveDate: appr?.approve_date || '',
          approverRole: appr?.approver_role || ''
        };
      });

      if (isApproved && approvals.length > 0) {
        // Use the last month's approval info for period-level summary
        const lastAppr = approvals[approvals.length - 1];
        validator = lastAppr?.approved_by || '';
        validDate = lastAppr?.approve_date || '';
        validRole = lastAppr?.approver_role || '';
      }
    }

    let saldoAwal: number;
    let saldoAkhir: number;
    let saldoAwalSource = 'live_calculation';

    if (isKasUmum) {
      if (rangeFirstApproval && rangeFirstApproval.opening_balance !== undefined) {
        saldoAwal = Number(rangeFirstApproval.opening_balance);
        saldoAwalSource = 'closed_snapshot';
      } else {
        if (prevApproval && prevApproval.closing_balance !== undefined) {
          saldoAwal = Number(prevApproval.closing_balance);
          saldoAwalSource = 'prev_closing_snapshot';
        } else {
          const firstTx: Transaction | undefined = monthlyTransactions[0];
          if (firstTx) {
            const netChange = (Number(firstTx.debit || 0) - Number(firstTx.credit || 0));
            saldoAwal = Number(firstTx.balance || 0) - netChange;
          } else {
            if (lastTxBeforePeriod) {
              saldoAwal = (lastTxBeforePeriod as Transaction).balance;
            } else if (serverOpeningBalance !== undefined) {
              saldoAwal = serverOpeningBalance;
            } else {
              saldoAwal = syncBaseBalance;
            }
          }
          saldoAwalSource = 'live_calculation';
        }
      }

      // Compute saldoAkhir
      if (viewMode === 'monthly' && rangeFirstApproval && rangeFirstApproval.closing_balance !== undefined) {
        saldoAkhir = Number(rangeFirstApproval.closing_balance);
      } else if (viewMode !== 'monthly' && isApproved && rangeLastApproval && rangeLastApproval.closing_balance !== undefined) {
        saldoAkhir = Number(rangeLastApproval.closing_balance);
      } else if (lastTxInPeriod) {
        saldoAkhir = (lastTxInPeriod as Transaction).balance;
      } else if (lastTxBeforePeriod) {
        saldoAkhir = (lastTxBeforePeriod as Transaction).balance;
      } else {
        saldoAkhir = saldoAwal + (totalIncome - totalExpense);
      }
    } else {
      saldoAwal = 0; 
      saldoAkhir = totalIncome - totalExpense;
    }

    if (viewMode !== 'monthly' && !isDeepScanMode) {
      return { 
        saldoAwal, 
        incomeDetails: incomeDetails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), 
        expenseDetails: expenseDetails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), 
        totalIncome, 
        totalExpense, 
        saldoAkhir, 
        saldoAwalSource,
        surplusDefisit: totalIncome - totalExpense,
        allApproved: isApproved,
        quarterlyMonthStatuses: periodMonthStatuses,
        hasData: isDeepScanMode ? projectTransactions.length > 0 : monthlyTransactions.length > 0,
        validator,
        validDate,
        validRole,
        monthlyTransactions: monthlyTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      };
    }

    return { 
      saldoAwal, 
      incomeDetails: incomeDetails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), 
      expenseDetails: expenseDetails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), 
      totalIncome, 
      totalExpense, 
      saldoAkhir, 
      saldoAwalSource,
      surplusDefisit: totalIncome - totalExpense,
      allApproved: isApproved,
      hasData: isDeepScanMode ? projectTransactions.length > 0 : monthlyTransactions.length > 0,
      validator,
      validDate,
      validRole,
      monthlyTransactions: monthlyTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    };
  }, [transactions, selectedMonth, selectedYear, viewMode, selectedQuarter, selectedCaturwulan, selectedSemester, selectedProject, historicalOpeningBalances, syncBaseBalance, targetMonths, approvalsList, isDeepScanMode, isProjectArchived, currentProjectData]);

  const formatIDR = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  const shouldShowReport = useMemo(() => {
    if (isDeepScanMode) return reportData.hasData; 
    if (isFuturePeriod) return false;
    if (viewMode === 'custom' && !isCustomRangeValid) return false;
    if (!reportData.hasData) return false;
    if (isBoundaryMonth || viewMode !== 'monthly') return isDataVerifiedByServer;
    return true;
  }, [isFuturePeriod, isBoundaryMonth, isDataVerifiedByServer, reportData.hasData, isDeepScanMode, viewMode, isCustomRangeValid]);

  const handleApprove = () => {
    confirm("Approve Laporan?", `Semua transaksi periode ${months[selectedMonth]} ${selectedYear} akan dikunci.`, "Setujui Sekarang", async () => {
        setIsApproving(true);
        try {
          const globalPeriodKey = `${selectedMonth + 1}-${selectedYear}`;
          const appr = {
            period_id: globalPeriodKey,
            project_name: "KAS UMUM",
            approved_by: currentUsername,
            approve_date: new Date().toISOString(),
            approver_role: approverRole || 'User',
            opening_balance: reportData.saldoAwal,
            closing_balance: reportData.saldoAkhir
          };
          
          await dbAddApproval(appr);
          setApprovalsList(prev => [...prev.filter(a => String(a.period_id) !== String(globalPeriodKey)), appr]);
          notify("Laporan Berhasil Disetujui", "success");
          onApproveSuccess();
        } catch (e) {
          notify("Gagal menyetujui laporan.", "error");
        } finally {
          setIsApproving(false);
        }
      }
    );
  };



  const handleCloseProject = () => {
    if (selectedProject === 'KAS UMUM') return;
    const finalBalance = reportData.saldoAkhir;
    const projToArchive = selectedProject;
    confirm(
      "Selesaikan Proker?", 
      `Proker "${selectedProject}" akan diarsipkan. Sisa saldo sebesar ${formatIDR(finalBalance)} akan ditransfer otomatis ke KAS UMUM. Tindakan ini tidak dapat dibatalkan.`,
      "Ya, Selesaikan",
      async () => {
        setIsClosingProject(true);
        try {
          // 1. Update project status in Firestore to "Arsip"
          await dbUpdateProjectStatus(projToArchive, 'Arsip');
          
          // 2. Write automatic transfer entries if non-zero balance
          if (finalBalance !== 0) {
            const todayStr = new Date().toISOString().split('T')[0];
            const dParts = todayStr.split('-');
            const formattedDate = `${dParts[2]}-${dParts[1]}-${dParts[0]}`;

            // Payout from custom project
            const payoutTx: Transaction = {
              id: `SP-${Date.now().toString(36).toUpperCase()}A`,
              date: todayStr,
              formattedDate: formattedDate,
              description: `Penyelesaian Proker ${projToArchive} - Sisa Saldo ditransfer ke KAS UMUM`,
              type: 'keluar',
              category: 'Transfer Saldo',
              project_name: projToArchive,
              debit: 0,
              credit: finalBalance,
              balance: 0,
              amount: finalBalance,
              created_at: new Date().toISOString(),
              created_by: currentUsername,
              created_by_role: approverRole || 'User',
              edit_version: 0,
              is_approve: false,
              approve_by: '',
              approve_date: ''
            };

            // Inflow to KAS UMUM
            const inflowTx: Transaction = {
              id: `SP-${Date.now().toString(36).toUpperCase()}B`,
              date: todayStr,
              formattedDate: formattedDate,
              description: `Penerimaan Sisa Saldo Proker "${projToArchive}"`,
              type: 'masuk',
              category: 'Transfer Saldo',
              project_name: 'KAS UMUM',
              debit: finalBalance,
              credit: 0,
              balance: 0,
              amount: finalBalance,
              created_at: new Date().toISOString(),
              created_by: currentUsername,
              created_by_role: approverRole || 'User',
              edit_version: 0,
              is_approve: false,
              approve_by: '',
              approve_date: ''
            };

            await Promise.all([
              dbAddTransaction(payoutTx),
              dbAddTransaction(inflowTx)
            ]);
          }

          notify(`Proker ${projToArchive} berhasil diselesaikan.`, "success");
          setIsRefreshing(true);
          await onApproveSuccess(projToArchive);
          setIsRefreshing(false);
        } catch (e) { 
          notify("Gagal menyelesaikan proker.", "error"); 
          setIsRefreshing(false);
        } finally { 
          setIsClosingProject(false); 
        }
      }
    );
  };

  const exportToPDF = async () => {
    if (!canExport || (!isDeepScanMode && isFuturePeriod) || !shouldShowReport) return;
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(18); doc.setTextColor(51, 65, 85); doc.setFont('helvetica', 'bold');
      doc.text(instansi.toUpperCase(), 14, 20);
      doc.setFontSize(11); doc.setTextColor(100); doc.setFont('helvetica', 'normal');
      doc.text(`LAPORAN SURPLUS / DEFISIT - ${selectedProject}`, 14, 28);
      
      const periodLabel = isDeepScanMode 
        ? "History Penuh" 
        : viewMode === 'monthly' 
          ? `${months[selectedMonth]} ${selectedYear}` 
          : viewMode === 'quarterly'
            ? `Kuartal ${selectedQuarter} (${quarters.find(q => q.id === selectedQuarter)?.range}) ${selectedYear}`
            : viewMode === 'caturwulan'
              ? `Caturwulan ${selectedCaturwulan} (${caturwulans.find(c => c.id === selectedCaturwulan)?.range}) ${selectedYear}`
              : viewMode === 'semester'
                ? `Semester ${selectedSemester} (${semesters.find(s => s.id === selectedSemester)?.range}) ${selectedYear}`
                : viewMode === 'annual'
                  ? `Laporan Tahunan ${selectedYear}`
                  : `${months[customStartMonth]} ${customStartYear} - ${months[customEndMonth]} ${customEndYear}`;
      
      doc.text(`Periode: ${periodLabel}`, 14, 34);
      
      const stampColor = reportData.allApproved ? [5, 150, 105] : [225, 29, 72]; 
      const boxWidth = 38; const boxHeight = 11; const boxX = pageWidth - boxWidth - 14; const boxY = 12;
      const fontSize = 7.5;
      
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({opacity: 0.9}));
      
      doc.setDrawColor(stampColor[0], stampColor[1], stampColor[2]);
      doc.setLineWidth(0.8);
      doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 0.5, 0.5, 'D');
      
      doc.setLineWidth(0.2);
      doc.roundedRect(boxX + 0.8, boxY + 0.8, boxWidth - 1.6, boxHeight - 1.6, 0.3, 0.3, 'D');
 
      doc.setTextColor(stampColor[0], stampColor[1], stampColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      
      const stampText = reportData.allApproved ? 'TERVALIDASI' : 'WAITING AUDIT';
      doc.text(stampText, boxX + (boxWidth / 2), boxY + (boxHeight / 2) + 1.2, { align: 'center' });
      
      doc.restoreGraphicsState();
      
      let nextY = 48; // Adjusted start Y after removing header info
      
      (doc as any).autoTable({
        startY: nextY, head: [['RINGKASAN REKAPITULASI KAS', 'NOMINAL']],
        body: [
          ['Saldo Awal (Periode Sebelumnya)', formatIDR(reportData.saldoAwal)], 
          ['Total Penerimaan (+)', formatIDR(reportData.totalIncome)], 
          ['Total Pengeluaran (-)', formatIDR(reportData.totalExpense)], 
          [{ content: 'Saldo Akhir', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: formatIDR(reportData.saldoAkhir), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]
        ],
        theme: 'grid', headStyles: { fillColor: [51, 65, 85], textColor: 255 }, columnStyles: { 1: { halign: 'right' } }
      });
      
      const lastY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text('II. INFORMASI SEMUA TRANSAKSI', 14, lastY);
      
      let currentRunningBalance = reportData.saldoAwal;
      const combinedBody = reportData.monthlyTransactions.map(t => {
        const amt = Number(t.amount || 0);
        const debit = t.type === 'masuk' ? amt : 0;
        const kredit = t.type === 'keluar' ? amt : 0;
        currentRunningBalance += (debit - kredit);
        
        return [
          formatDateTimePdf(t.date, false),
          t.id,
          t.description,
          debit > 0 ? formatIDR(debit) : '-',
          kredit > 0 ? formatIDR(kredit) : '-',
          formatIDR(currentRunningBalance)
        ];
      });

      // Tambahkan baris saldo awal jika KAS UMUM
      if (selectedProject.toUpperCase() === 'KAS UMUM') {
        let openingBalanceDate: Date;
        if (viewMode === 'monthly') {
          openingBalanceDate = new Date(selectedYear, selectedMonth, 0);
        } else if (viewMode === 'quarterly') {
          openingBalanceDate = new Date(selectedYear, (selectedQuarter - 1) * 3, 0);
        } else if (viewMode === 'caturwulan') {
          openingBalanceDate = new Date(selectedYear, (selectedCaturwulan - 1) * 4, 0);
        } else if (viewMode === 'semester') {
          openingBalanceDate = new Date(selectedYear, (selectedSemester - 1) * 6, 0);
        } else if (viewMode === 'annual') {
          openingBalanceDate = new Date(selectedYear, 0, 0);
        } else {
          // custom viewMode
          openingBalanceDate = new Date(customStartYear, customStartMonth, 0);
        }

        combinedBody.unshift([
          formatDateTimePdf(openingBalanceDate, false),
          'TM-SALDOAWAL',
          'Saldo dari periode sebelumnya',
          '-',
          '-',
          formatIDR(reportData.saldoAwal)
        ]);
      }

      if (combinedBody.length === 0) {
        combinedBody.push(['-', '-', 'NIHIL', '-', '-', formatIDR(reportData.saldoAwal)]);
      }

      (doc as any).autoTable({ 
        startY: lastY + 5, 
        head: [['TANGGAL', 'ID REF', 'KETERANGAN', 'DEBIT', 'KREDIT', 'SALDO']], 
        body: combinedBody, 
        theme: 'striped', 
        headStyles: { fillColor: [51, 65, 85], fontSize: 9, halign: 'center' }, 
        bodyStyles: { fontSize: 8 },
        columnStyles: { 
          0: { cellWidth: 22, noWrap: true, halign: 'center' }, 
          1: { cellWidth: 26, noWrap: true }, 
          2: { cellWidth: 'auto' },           
          3: { cellWidth: 28, halign: 'right', noWrap: true },
          4: { cellWidth: 28, halign: 'right', noWrap: true },
          5: { cellWidth: 32, halign: 'right', noWrap: true }
        },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 1) {
            // Kecilkan semua ID REF agar seragam dan rapi (mengikuti request user)
            data.cell.styles.fontSize = 6.0;
          }
        }
      });

      const pageHeight = doc.internal.pageSize.getHeight();
      let footerY = (doc as any).lastAutoTable.finalY + 12;

      // Jika sisa halaman tidak cukup untuk catatan dan tanda tangan, pindah ke halaman baru
      if (footerY + 60 > pageHeight) {
        doc.addPage();
        footerY = 20;
      }

      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(51, 65, 85);
      doc.text('Catatan Laporan :', 14, footerY);
      
      let nextFooterY = footerY + 6;
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      
      doc.text(`Dicetak oleh : ${currentUsername} - ${approverRole}`, 14, nextFooterY); nextFooterY += 4;
      doc.text(`Tanggal Cetak : ${formatDateTimePdf(new Date())}`, 14, nextFooterY); nextFooterY += 6;
      
      if (!isDeepScanMode && viewMode !== 'monthly' && (reportData as any).quarterlyMonthStatuses) {
        doc.setFont('helvetica', 'bold');
        doc.text('STATUS VERIFIKASI PERIODE:', 14, nextFooterY);
        nextFooterY += 5;
        doc.setFont('helvetica', 'normal');
        (reportData as any).quarterlyMonthStatuses.forEach((ms: any) => {
          const statusText = ms.isApproved ? '[ TERVERIFIKASI ]' : '[ BELUM VALIDASI ]';
          doc.setTextColor(ms.isApproved ? 34 : 225, ms.isApproved ? 197 : 29, ms.isApproved ? 94 : 72);
          doc.text(`- ${ms.monthName.toUpperCase()} : ${statusText}`, 20, nextFooterY);
          nextFooterY += 4.5;
          
          if (ms.isApproved) {
            doc.setFontSize(7);
            doc.setTextColor(120);
            doc.text(`  Oleh: ${ms.approvedBy} (${ms.approverRole}) pada ${formatDateTimePdf(ms.approveDate)}`, 20, nextFooterY);
            nextFooterY += 4;
            doc.setFontSize(8);
          }
        });
        doc.setTextColor(100);
        nextFooterY += 2;
      }
      
      if (viewMode === 'monthly' || isDeepScanMode) {
        if (reportData.allApproved) {
          doc.text(`Divalidasi oleh : ${reportData.validator} - ${reportData.validRole}`, 14, nextFooterY); nextFooterY += 4;
          doc.text(`Tanggal Validasi : ${formatDateTimePdf(reportData.validDate)}`, 14, nextFooterY); nextFooterY += 6;
        } else {
          doc.setTextColor(225, 29, 72);
          doc.text(`STATUS : BELUM VALIDASI`, 14, nextFooterY); nextFooterY += 4;
          doc.setFontSize(7);
          doc.text(`Laporkan keuangan ke Ketua/Pimpinan dan validasi laporan bulan ini di akhir periode`, 14, nextFooterY); nextFooterY += 6;
          doc.setFontSize(8);
          doc.setTextColor(100);
        }
      } else {
        if (!reportData.allApproved) {
          doc.setTextColor(225, 29, 72);
          doc.text(`STATUS PERIODE : BELUM SEMUA BULAN TERVERIFIKASI`, 14, nextFooterY); nextFooterY += 6;
          doc.setTextColor(100);
        }
      }
      
      const fileNameSuffix = viewMode === 'monthly' 
        ? `${months[selectedMonth]}_${selectedYear}` 
        : viewMode === 'quarterly'
          ? `Q${selectedQuarter}_${selectedYear}`
          : viewMode === 'caturwulan'
            ? `CW${selectedCaturwulan}_${selectedYear}`
            : viewMode === 'semester'
              ? `SM${selectedSemester}_${selectedYear}`
              : viewMode === 'annual'
                ? `Annual_${selectedYear}`
                : `Custom_${customStartMonth+1}${customStartYear}_to_${customEndMonth+1}${customEndYear}`;

      doc.save(`Laporan_${selectedProject.replace(/\s+/g, '_')}_${instansi}_${fileNameSuffix}.pdf`);
      notify("Ekspor PDF Berhasil", "success");
    } catch (e) { notify("Gagal ekspor PDF.", "error"); } finally { setIsExporting(false); }
  };

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar p-3 sm:p-6 md:p-10 space-y-4 sm:space-y-8 pb-40">
      <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="relative mb-3 sm:mb-4" ref={projectRef}>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Pilih Proker (Arsip & Aktif)</label>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsProjectPickerOpen(!isProjectPickerOpen); setIsModePickerOpen(false); setIsMonthPickerOpen(false); setIsQuarterPickerOpen(false); setIsCaturwulanPickerOpen(false); setIsSemesterPickerOpen(false); }} 
              className={`w-full px-5 py-4 bg-blue-50 text-blue-600 rounded-xl text-[10px] sm:text-xs font-black text-left border flex items-center justify-between transition-all active:scale-[0.98] ${isProjectPickerOpen ? 'border-blue-300 ring-2 ring-blue-50' : 'border-blue-100'}`}
            >
              <div className="flex items-center space-x-3"><Filter size={16} /><span className="uppercase">{selectedProjectDraft}</span></div>
              <ChevronDown size={14} className={`shrink-0 transition-transform duration-300 ${isProjectPickerOpen ? 'rotate-180' : ''}`} />
            </button>
            {isProjectPickerOpen && (
              <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[110] bg-white/80 backdrop-blur-xl border border-white/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="p-3 max-h-[300px] overflow-y-auto no-scrollbar space-y-1">
                  <div className="px-3 py-1.5 text-[8px] font-black text-blue-400 uppercase tracking-[0.2em] border-b border-slate-100/50 mb-1">KAS HARIAN</div>
                  <button 
                    onClick={handleSelectKasUmum} 
                    className={`w-full px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-tight text-left transition-all flex items-center justify-between ${selectedProjectDraft === 'KAS UMUM' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <span>KAS UMUM</span>{selectedProjectDraft === 'KAS UMUM' && <Check size={12} />}
                  </button>
                    <div className="px-3 py-1.5 text-[8px] font-black text-blue-400 uppercase tracking-[0.2em] border-b border-slate-100/50 my-1 mt-2">PROKER AKTIF</div>
                  {allProjects.filter(p => p.status?.toLowerCase() === 'aktif' && p.name.toUpperCase() !== 'KAS UMUM').map((p) => (
                    <button key={p.name} onClick={() => handleSelectProker(p.name)} className={`w-full px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-tight text-left transition-all flex items-center justify-between ${selectedProjectDraft === p.name ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                      <span>{p.name}</span>{selectedProjectDraft === p.name && <Check size={12} />}
                    </button>
                  ))}
                  
                  {allProjects.some(p => p.status?.toLowerCase() === 'arsip') && (
                    <>
                      <div className="px-3 py-1.5 text-[8px] font-black text-rose-400 uppercase tracking-[0.2em] border-b border-rose-100/50 my-1 mt-2">PROKER SELESAI (ARSIP)</div>
                      {allProjects.filter(p => p.status?.toLowerCase() === 'arsip').map((p) => (
                        <button key={p.name} onClick={() => handleSelectProker(p.name)} className={`w-full px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-tight text-left transition-all flex items-center justify-between ${selectedProjectDraft === p.name ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:bg-rose-50'}`}>
                          <span>{p.name}</span>{selectedProjectDraft === p.name && <Check size={12} />}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
        </div>

        <AnimatePresence>
          {selectedProjectDraft === 'KAS UMUM' && (
            <motion.div 
              key="mode-selection"
              initial={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 12, transitionEnd: { overflow: 'visible' } }}
              exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="relative" ref={modeRef}>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Mode Laporan</label>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsModePickerOpen(!isModePickerOpen); setIsProjectPickerOpen(false); setIsMonthPickerOpen(false); setIsQuarterPickerOpen(false); setIsCaturwulanPickerOpen(false); setIsSemesterPickerOpen(false); }} 
                  className={`w-full px-5 py-4 bg-white border-2 rounded-xl text-[10px] sm:text-xs font-black text-left flex items-center justify-between transition-all active:scale-[0.98] ${isModePickerOpen ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-slate-100 shadow-sm'}`}
                >
                  <div className="flex items-center space-x-3 text-blue-600">
                    <CalendarSearch size={16} />
                    <span className="uppercase tracking-widest">{viewModeLabels[viewModeDraft]}</span>
                  </div>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isModePickerOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isModePickerOpen && (
                  <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[150] bg-white/95 backdrop-blur-xl border border-blue-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 p-2">
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { id: 'monthly', label: 'Bulanan', desc: 'Laporan per satu bulan kalender' },
                        { id: 'quarterly', label: 'Triwulan', desc: 'Laporan per 3 bulan (Kuartal)' },
                        { id: 'caturwulan', label: 'Caturwulan', desc: 'Laporan per 4 bulan (Caturwulan)' },
                        { id: 'semester', label: 'Semester', desc: 'Laporan per 6 bulan (Semester)' },
                        { id: 'annual', label: 'Tahunan', desc: 'Laporan per satu tahun penuh' },
                        { id: 'custom', label: 'Custom', desc: 'Laporan rentang bulan (Maks 12 Bln)' }
                      ].map((opt) => (
                        <button 
                          key={opt.id}
                          onClick={() => { setViewModeDraft(opt.id as any); setIsModePickerOpen(false); }}
                          className={`w-full px-4 py-3 rounded-xl text-left transition-all flex items-center justify-between group ${viewModeDraft === opt.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'hover:bg-slate-50'}`}
                        >
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest">{opt.label}</span>
                            <span className={`text-[8px] font-bold ${viewModeDraft === opt.id ? 'text-blue-100' : 'text-slate-400'}`}>{opt.desc}</span>
                          </div>
                          {viewModeDraft === opt.id && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(selectedProject !== 'KAS UMUM' || isRefreshing) && (
            <motion.div
              key="riwayat-indicator"
              initial={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className={`px-5 py-4 rounded-2xl flex items-center space-x-4 border shadow-sm ${isRefreshing ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                 <div className={`p-2 rounded-lg ${isRefreshing ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                    <RefreshCw size={16} className={(isLoading || isRefreshing) ? 'animate-spin' : ''} />
                 </div>
                 <div className="flex flex-col">
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                      {isRefreshing ? 'Sinkronisasi Aktif' : 'Mode Riwayat Penuh'}
                    </p>
                    <p className="text-[9px] font-bold opacity-70 leading-tight">
                      {isRefreshing 
                        ? (viewModeDraft === 'quarterly' ? `Mengambil data Kuartal ${selectedQuarterDraft} ${selectedYearDraft}` : 
                           viewModeDraft === 'caturwulan' ? `Mengambil data Caturwulan ${selectedCaturwulanDraft} ${selectedYearDraft}` :
                           viewModeDraft === 'semester' ? `Mengambil data Semester ${selectedSemesterDraft} ${selectedYearDraft}` :
                           viewModeDraft === 'annual' ? `Mengambil data Tahunan ${selectedYearDraft}` :
                           'Memuat data riwayat...') 
                        : 'Menampilkan seluruh transaksi sejak awal proker.'}
                    </p>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedProjectDraft === 'KAS UMUM' && (
            <motion.div 
              key="period-pickers"
              initial={{ opacity: 0, height: 0, scale: 0.95, marginBottom: 0, overflow: 'hidden' }}
              animate={{ opacity: 1, height: 'auto', scale: 1, marginBottom: 12, transitionEnd: { overflow: 'visible' } }}
              exit={{ opacity: 0, height: 0, scale: 0.95, marginBottom: 0, overflow: 'hidden' }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6 relative"
            >
              {viewModeDraft === 'monthly' && (
                <div className="relative" ref={dropdownRef}>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Bulan</label>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsMonthPickerOpen(!isMonthPickerOpen); setIsProjectPickerOpen(false); setIsModePickerOpen(false); setIsQuarterPickerOpen(false); setIsCaturwulanPickerOpen(false); setIsSemesterPickerOpen(false); }} 
                    className={`w-full px-3 sm:px-5 py-3 sm:py-4 bg-slate-50 rounded-xl text-[10px] sm:text-xs md:text-sm font-black text-left border flex items-center justify-between transition-all active:scale-[0.98] ${isMonthPickerOpen ? 'border-blue-300 ring-2 ring-blue-50' : 'border-slate-100'}`}
                  >
                    <span className="truncate">{months[selectedMonthDraft]}</span>
                    <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${isMonthPickerOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isMonthPickerOpen && (
                      <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[100] bg-white/80 backdrop-blur-xl border border-white/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="p-2 sm:p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 sm:gap-2">
                          {months.map((m, i) => (
                            <button key={m} onClick={() => { setSelectedMonthDraft(i); setIsMonthPickerOpen(false); }} className={`px-4 py-2.5 sm:py-3 rounded-lg text-[9px] sm:text-[11px] font-black uppercase tracking-tight text-left transition-all flex items-center justify-between group ${selectedMonthDraft === i ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'}`}><span>{m}</span>{selectedMonthDraft === i && <Check size={12} />}</button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}
              {viewModeDraft === 'quarterly' && (
                <div className="relative" ref={quarterRef}>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Kuartal</label>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsQuarterPickerOpen(!isQuarterPickerOpen); setIsProjectPickerOpen(false); setIsModePickerOpen(false); setIsMonthPickerOpen(false); setIsCaturwulanPickerOpen(false); setIsSemesterPickerOpen(false); }} 
                    className={`w-full px-3 sm:px-5 py-3 sm:py-4 bg-slate-50 rounded-xl text-[10px] sm:text-xs md:text-sm font-black text-left border flex items-center justify-between transition-all active:scale-[0.98] ${isQuarterPickerOpen ? 'border-blue-300 ring-2 ring-blue-50' : 'border-slate-100'}`}
                  >
                    <span className="truncate">Q{selectedQuarterDraft}</span>
                    <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${isQuarterPickerOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isQuarterPickerOpen && (
                    <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[100] bg-white/80 backdrop-blur-xl border border-white/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="p-2 sm:p-3 grid grid-cols-1 gap-1">
                        {quarters.map((q) => (
                          <button 
                            key={q.id} 
                            onClick={() => { setSelectedQuarterDraft(q.id); setIsQuarterPickerOpen(false); }} 
                            className={`px-4 py-2.5 sm:py-3 rounded-lg text-[9px] sm:text-[11px] font-black uppercase tracking-tight text-left transition-all flex items-center justify-between group ${selectedQuarterDraft === q.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'}`}
                          >
                            <div className="flex flex-col">
                              <span>{q.label}</span>
                              <span className={`text-[8px] font-bold ${selectedQuarterDraft === q.id ? 'text-blue-100' : 'text-slate-400'}`}>{q.range}</span>
                            </div>
                            {selectedQuarterDraft === q.id && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {viewModeDraft === 'caturwulan' && (
                <div className="relative" ref={caturwulanRef}>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Caturwulan</label>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsCaturwulanPickerOpen(!isCaturwulanPickerOpen); setIsProjectPickerOpen(false); setIsModePickerOpen(false); setIsMonthPickerOpen(false); setIsQuarterPickerOpen(false); setIsSemesterPickerOpen(false); }} 
                    className={`w-full px-3 sm:px-5 py-3 sm:py-4 bg-slate-50 rounded-xl text-[10px] sm:text-xs md:text-sm font-black text-left border flex items-center justify-between transition-all active:scale-[0.98] ${isCaturwulanPickerOpen ? 'border-blue-300 ring-2 ring-blue-50' : 'border-slate-100'}`}
                  >
                    <span className="truncate">C{selectedCaturwulanDraft}</span>
                    <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${isCaturwulanPickerOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isCaturwulanPickerOpen && (
                    <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[100] bg-white/80 backdrop-blur-xl border border-white/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="p-2 sm:p-3 grid grid-cols-1 gap-1">
                        {caturwulans.map((c) => (
                          <button 
                            key={c.id} 
                            onClick={() => { setSelectedCaturwulanDraft(c.id); setIsCaturwulanPickerOpen(false); }} 
                            className={`px-4 py-2.5 sm:py-3 rounded-lg text-[9px] sm:text-[11px] font-black uppercase tracking-tight text-left transition-all flex items-center justify-between group ${selectedCaturwulanDraft === c.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'}`}
                          >
                            <div className="flex flex-col">
                              <span>{c.label}</span>
                              <span className={`text-[8px] font-bold ${selectedCaturwulanDraft === c.id ? 'text-blue-100' : 'text-slate-400'}`}>{c.range}</span>
                            </div>
                            {selectedCaturwulanDraft === c.id && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {viewModeDraft === 'semester' && (
                <div className="relative" ref={semesterRef}>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Semester</label>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsSemesterPickerOpen(!isSemesterPickerOpen); setIsProjectPickerOpen(false); setIsModePickerOpen(false); setIsMonthPickerOpen(false); setIsQuarterPickerOpen(false); setIsCaturwulanPickerOpen(false); }} 
                    className={`w-full px-3 sm:px-5 py-3 sm:py-4 bg-slate-50 rounded-xl text-[10px] sm:text-xs md:text-sm font-black text-left border flex items-center justify-between transition-all active:scale-[0.98] ${isSemesterPickerOpen ? 'border-blue-300 ring-2 ring-blue-50' : 'border-slate-100'}`}
                  >
                    <span className="truncate">S{selectedSemesterDraft}</span>
                    <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${isSemesterPickerOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isSemesterPickerOpen && (
                    <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[100] bg-white/80 backdrop-blur-xl border border-white/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="p-2 sm:p-3 grid grid-cols-1 gap-1">
                        {semesters.map((s) => (
                          <button 
                            key={s.id} 
                            onClick={() => { setSelectedSemesterDraft(s.id); setIsSemesterPickerOpen(false); }} 
                            className={`px-4 py-2.5 sm:py-3 rounded-lg text-[9px] sm:text-[11px] font-black uppercase tracking-tight text-left transition-all flex items-center justify-between group ${selectedSemesterDraft === s.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'}`}
                          >
                            <div className="flex flex-col">
                              <span>{s.label}</span>
                              <span className={`text-[8px] font-bold ${selectedSemesterDraft === s.id ? 'text-blue-100' : 'text-slate-400'}`}>{s.range}</span>
                            </div>
                            {selectedSemesterDraft === s.id && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {viewModeDraft === 'annual' && (
                <div className="relative">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Periode</label>
                  <div className="w-full px-3 sm:px-5 py-3 sm:py-4 bg-slate-100 rounded-xl text-[10px] sm:text-xs md:text-sm font-black text-slate-500 border border-slate-100 flex items-center space-x-2">
                    <CheckCircle className="text-emerald-500" size={14} />
                    <span>Seluruh Tahun</span>
                  </div>
                </div>
              )}
              {viewModeDraft === 'custom' && (
                <>
                  <div className="relative" ref={startMonthRef}>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Mulai Bulan</label>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsStartMonthPickerOpen(!isStartMonthPickerOpen); setIsEndMonthPickerOpen(false); setIsProjectPickerOpen(false); setIsModePickerOpen(false); setIsMonthPickerOpen(false); setIsQuarterPickerOpen(false); setIsCaturwulanPickerOpen(false); setIsSemesterPickerOpen(false); }} 
                      className={`w-full px-3 sm:px-5 py-3 sm:py-4 bg-slate-50 rounded-xl text-[10px] sm:text-xs md:text-sm font-black text-left border flex items-center justify-between transition-all active:scale-[0.98] ${isStartMonthPickerOpen ? 'border-blue-300 ring-2 ring-blue-50' : 'border-slate-100'}`}
                    >
                      <span className="truncate">{months[customStartMonthDraft]} {customStartYearDraft}</span>
                      <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${isStartMonthPickerOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isStartMonthPickerOpen && (
                        <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[100] bg-white/90 backdrop-blur-xl border border-white/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase text-slate-400">Tahun Mulai</span>
                            <input type="number" value={customStartYearDraft} onChange={(e) => setCustomStartYearDraft(parseInt(e.target.value))} className="w-16 px-2 py-1 bg-white rounded-md text-[10px] font-black outline-none border border-slate-200" />
                          </div>
                          <div className="p-2 sm:p-3 grid grid-cols-2 lg:grid-cols-3 gap-1">
                            {months.map((m, i) => (
                              <button key={m} onClick={() => { setCustomStartMonthDraft(i); setIsStartMonthPickerOpen(false); }} className={`px-4 py-2 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-tight text-left transition-all flex items-center justify-between group ${customStartMonthDraft === i ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'}`}>
                                <span className="hidden sm:inline">{m}</span>
                                <span className="sm:hidden">{m.substring(0, 3)}</span>
                                {customStartMonthDraft === i && <Check size={12} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                  <div className="relative" ref={endMonthRef}>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Sampai Bulan</label>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsEndMonthPickerOpen(!isEndMonthPickerOpen); setIsStartMonthPickerOpen(false); setIsProjectPickerOpen(false); setIsModePickerOpen(false); setIsMonthPickerOpen(false); setIsQuarterPickerOpen(false); setIsCaturwulanPickerOpen(false); setIsSemesterPickerOpen(false); }} 
                      className={`w-full px-3 sm:px-5 py-3 sm:py-4 bg-slate-50 rounded-xl text-[10px] sm:text-xs md:text-sm font-black text-left border flex items-center justify-between transition-all active:scale-[0.98] ${isEndMonthPickerOpen ? 'border-blue-300 ring-2 ring-blue-50' : 'border-slate-100'}`}
                    >
                      <span className="truncate">{months[customEndMonthDraft]} {customEndYearDraft}</span>
                      <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${isEndMonthPickerOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isEndMonthPickerOpen && (
                        <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[100] bg-white/90 backdrop-blur-xl border border-white/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase text-slate-400">Tahun Akhir</span>
                            <input type="number" value={customEndYearDraft} onChange={(e) => setCustomEndYearDraft(parseInt(e.target.value))} className="w-16 px-2 py-1 bg-white rounded-md text-[10px] font-black outline-none border border-slate-200" />
                          </div>
                          <div className="p-2 sm:p-3 grid grid-cols-2 lg:grid-cols-3 gap-1">
                            {months.map((m, i) => (
                              <button key={m} onClick={() => { setCustomEndMonthDraft(i); setIsEndMonthPickerOpen(false); }} className={`px-4 py-2 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-tight text-left transition-all flex items-center justify-between group ${customEndMonthDraft === i ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'}`}>
                                <span className="hidden sm:inline">{m}</span>
                                <span className="sm:hidden">{m.substring(0, 3)}</span>
                                {customEndMonthDraft === i && <Check size={12} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </>
              )}
              {viewModeDraft !== 'custom' && (
                <div className="relative">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Tahun</label>
                  <input type="number" value={selectedYearDraft} onChange={(e) => setSelectedYearDraft(parseInt(e.target.value))} className="w-full px-3 sm:px-5 py-3 sm:py-4 bg-slate-50 rounded-xl text-[10px] sm:text-xs md:text-sm font-black outline-none border border-slate-100 focus:bg-white focus:border-blue-100 transition-all" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedProjectDraft === 'KAS UMUM' && (
            <motion.div 
              key="apply-filter"
              className="pt-2 border-t border-slate-100 overflow-hidden"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                onClick={handleApplyFilter}
                disabled={!isFilterChanged || isRefreshing}
                className={`w-full py-3 sm:py-4 rounded-xl font-black text-[clamp(9px,2.5vw,12px)] uppercase tracking-widest transition-all duration-300 shadow-md flex items-center justify-center space-x-2 ${
                  isFilterChanged && !isRefreshing
                    ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-blue-500/10 cursor-pointer' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                }`}
              >
                {isRefreshing ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-white" />
                    <span>Menyelaraskan Data...</span>
                  </>
                ) : (
                  <>
                    <Filter size={16} className={isFilterChanged ? 'text-white font-black' : 'text-slate-400'} />
                    <span>Terapkan Filter Laporan</span>
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!isLoading && !shouldShowReport && !isFuturePeriod && !isRefreshing && (
          <div className="mb-4 sm:mb-6 p-6 sm:p-8 border rounded-2xl flex flex-col items-center text-center space-y-3 sm:space-y-4 animate-in fade-in zoom-in bg-slate-50 border-slate-200">
             <Inbox size={24} className="sm:size-8 text-slate-400" />
             <div className="space-y-1">
                <p className="text-[clamp(8px,2vw,10px)] font-black uppercase tracking-widest text-center text-slate-600">
                  Tidak Ada Transaksi
                </p>
                <p className="text-[clamp(7px,1.8vw,9px)] font-bold leading-relaxed text-center text-slate-400">
                  {viewMode === 'monthly'
                    ? `tidak ada transaksi bulan ${months[selectedMonth]} ${selectedYear}`
                    : viewMode === 'quarterly'
                      ? `tidak ada transaksi pada kuartal ${selectedQuarter} ${selectedYear}`
                      : viewMode === 'caturwulan'
                        ? `tidak ada transaksi pada caturwulan ${selectedCaturwulan} ${selectedYear}`
                        : viewMode === 'semester'
                          ? `tidak ada transaksi pada semester ${selectedSemester} ${selectedYear}`
                          : viewMode === 'annual'
                            ? `tidak ada transaksi pada tahun ${selectedYear}`
                            : `tidak ada transaksi pada rentang periode ini`
                  }
                </p>
             </div>
          </div>
        )}

        {viewMode === 'custom' && !isCustomRangeValid && (
          <div className="mb-4 sm:mb-6 p-6 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col items-center text-center space-y-3 animate-in fade-in zoom-in">
            <AlertTriangle size={32} className="text-rose-500" />
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">Rentang Tidak Valid</p>
              <p className="text-[9px] font-bold text-rose-500 leading-relaxed">
                {(customEndYear * 12 + customEndMonth) < (customStartYear * 12 + customStartMonth) 
                  ? "Bulan akhir tidak boleh lebih kecil dari bulan awal." 
                  : "Maksimal rentang laporan adalah 12 bulan."}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:gap-4">
          {canExport && (
            <button onClick={exportToPDF} disabled={isExporting || isLoading || !canExport || (!isDeepScanMode && isFuturePeriod) || !shouldShowReport || isRefreshing} className="w-full flex items-center justify-center space-x-2 sm:space-x-3 py-3 sm:py-4 bg-blue-500 text-white rounded-xl font-black text-[clamp(9px,2.5vw,12px)] uppercase tracking-widest disabled:bg-slate-300 transition-all shadow-lg">
              {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              <span>UNDUH PDF LAPORAN</span>
            </button>
          )}
          
          {canApprove && viewMode === 'monthly' && !reportData.allApproved && shouldShowReport && !isDeepScanMode && isPeriodPast && (
            <button onClick={handleApprove} disabled={isApproving || isLoading || isRefreshing} className="w-full flex items-center justify-center space-x-2 sm:space-x-3 py-3 sm:py-4 bg-emerald-600 text-white rounded-xl font-black text-[clamp(9px,2.5vw,12px)] uppercase tracking-widest shadow-lg transition-all active:scale-95">
              {isApproving ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              <span>APPROVE PERIODE INI</span>
            </button>
          )}

          {canApprove && selectedProject !== 'KAS UMUM' && selectedProjectDraft !== 'KAS UMUM' && shouldShowReport && !isProjectArchived && (
            <button 
              onClick={handleCloseProject} 
              disabled={isClosingProject || isLoading || isRefreshing} 
              className="w-full flex items-center justify-center space-x-2 sm:space-x-3 py-3 rounded-xl font-black text-[clamp(9px,2.5vw,12px)] uppercase tracking-widest shadow-lg transition-all active:scale-95 bg-slate-900 text-white disabled:bg-slate-300"
            >
              {(isClosingProject || isLoading || isRefreshing) ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCircle size={18} />
              )}
              <span>
                {isClosingProject ? 'PENGARSIPAN...' : 
                 (isLoading || isRefreshing) ? 'MENYINKRONKAN...' :
                 'SELESAIKAN & ARSIPKAN PROKER'}
              </span>
            </button>
          )}

          {reportData.allApproved && shouldShowReport && (
            <div className="bg-emerald-50 p-3 sm:p-5 rounded-xl flex items-center justify-between text-emerald-700 border border-emerald-100">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <ShieldCheck size={20} className="sm:size-7 flex-shrink-0" />
                  <div className="flex flex-col">
                      <span className="text-[clamp(8px,2vw,11px)] font-black uppercase tracking-widest">{isProjectArchived ? 'Proker Telah Selesai' : 'Periode Terkunci'}</span>
                      <div className="flex items-center space-x-1.5 sm:space-x-2 text-[clamp(6px,1.5vw,9px)] font-bold opacity-70 mt-0.5"><UserCheck size={10} /><span className="uppercase truncate max-w-[80px] md:max-w-none">Oleh: {reportData.validator}</span><span className="mx-1">•</span><span>{formatDateTimePdf(reportData.validDate)}</span></div>
                  </div>
                </div>
            </div>
          )}
        </div>
      </div>

      {(isLoading || isRefreshing) ? (
        <div className="py-24 text-center flex flex-col items-center justify-center space-y-6">
          <div className="relative"><div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" /><FileText size={40} className="relative animate-bounce text-blue-500" /></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            {isRefreshing ? 'Memperbarui Saldo Akhir...' : 'Menyinkronkan Data Proker...'}
          </p>
        </div>
      ) : shouldShowReport && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4 sm:space-y-8"
        >
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-[clamp(8px,2vw,11px)] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 sm:gap-3"><Wallet size={14} /> Ringkasan {selectedProject}</h4>
              {!isDeepScanMode && (
                <div className={`px-2 sm:px-4 py-1.5 rounded-full text-[clamp(6px,1.5vw,9px)] font-black uppercase tracking-widest flex items-center space-x-1.5 ${reportData.allApproved ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>{reportData.allApproved ? <Lock size={10} /> : <Unlock size={10} />}<span>{reportData.allApproved ? 'LOCKED' : 'OPEN'}</span></div>
              )}
              {isDeepScanMode && (
                <div className="px-2 sm:px-4 py-1.5 rounded-full text-[clamp(6px,1.5vw,9px)] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600 border border-emerald-200">HISTORI PENUH</div>
              )}
            </div>
            <div className="divide-y divide-slate-50">
              <div className="p-4 sm:p-6 flex justify-between items-center">
                <div className="flex flex-col space-y-1">
                  <span className="text-[clamp(9px,2.2vw,13px)] font-bold text-slate-500">{isDeepScanMode ? 'Saldo Awal (Dana Pertama)' : 'Saldo Awal'}</span>
                  {!isDeepScanMode && (
                    <span className="text-[8px] font-black uppercase tracking-wider flex items-center">
                      {reportData.saldoAwalSource === 'closed_snapshot' ? (
                        <span className="text-emerald-500 flex items-center gap-1">● Saldo Terkunci (Tutup Buku)</span>
                      ) : reportData.saldoAwalSource === 'prev_closing_snapshot' ? (
                        <span className="text-blue-500 flex items-center gap-1">● Peralihan Tutup Buku Bulan Lalu</span>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1">● Kalkulasi Berjalan</span>
                      )}
                    </span>
                  )}
                </div>
                <span className="text-[clamp(10px,2.5vw,15px)] font-black">{formatIDR(reportData.saldoAwal)}</span>
              </div>
              <div className="p-4 sm:p-6 flex justify-between items-center bg-emerald-50/20"><span className="text-[clamp(9px,2.2vw,13px)] font-bold text-emerald-600">Total Penerimaan</span><span className="text-[clamp(10px,2.5vw,15px)] font-black text-emerald-500">{formatIDR(reportData.totalIncome)}</span></div>
              <div className="p-4 sm:p-6 flex justify-between items-center bg-rose-50/20"><span className="text-[clamp(9px,2.2vw,13px)] font-bold text-rose-600">Total Pengeluaran</span><span className="text-[clamp(10px,2.5vw,15px)] font-black text-rose-500">{formatIDR(reportData.totalExpense)}</span></div>
              <div className={`p-5 sm:p-6 flex justify-between items-center ${reportData.saldoAkhir >= 0 ? 'bg-slate-900' : 'bg-rose-600'} text-white`}><span className="text-[clamp(10px,2.5vw,14px)] font-black uppercase tracking-widest">Saldo Akhir</span><span className="text-[clamp(14px,4vw,24px)] font-black">{formatIDR(reportData.saldoAkhir)}</span></div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-100"><h4 className="text-[clamp(8px,2vw,11px)] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 sm:gap-3"><FileText size={14} /> Jurnal Transaksi {isDeepScanMode && '(Semua Histori)'}</h4></div>
            <div className="p-4 sm:p-8 md:p-10 space-y-6 sm:space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-14">
                <div className="flex flex-col space-y-3 sm:space-y-6">
                  <div className="flex items-center space-x-2 text-emerald-600"><TrendingUp size={14} /><span className="text-[clamp(9px,2.2vw,12px)] font-black uppercase tracking-widest">Penerimaan</span></div>
                  <div className="max-h-60 overflow-y-auto no-scrollbar border-l-2 border-emerald-50 space-y-3 pl-3">
                    {reportData.incomeDetails.length === 0 ? <p className="text-[clamp(8px,1.8vw,10px)] font-bold text-slate-400 italic">Nihil</p> : reportData.incomeDetails.map(item => (<div key={item.id} className="flex justify-between items-start text-[clamp(8px,1.8vw,11px)] border-b border-slate-50 pb-2"><div className="flex flex-col max-w-[60%]"><span className="font-bold text-slate-700 uppercase truncate leading-tight">{item.description}</span><span className="text-[clamp(6px,1.5vw,8px)] text-slate-400">{item.category} • {item.id}</span></div><span className="font-black text-emerald-500">{formatIDR(item.amount)}</span></div>))}
                  </div>
                </div>
                <div className="flex flex-col space-y-3 sm:space-y-6">
                  <div className="flex items-center space-x-2 text-rose-600"><TrendingDown size={14} /><span className="text-[clamp(9px,2.2vw,12px)] font-black uppercase tracking-widest">Pengeluaran</span></div>
                  <div className="max-h-60 overflow-y-auto no-scrollbar border-l-2 border-rose-50 space-y-3 pl-3">
                    {reportData.expenseDetails.length === 0 ? <p className="text-[clamp(8px,1.8vw,10px)] font-bold text-slate-400 italic">Nihil</p> : reportData.expenseDetails.map(item => (<div key={item.id} className="flex justify-between items-start text-[clamp(8px,1.8vw,11px)] border-b border-slate-100 pb-2"><div className="flex flex-col max-w-[60%]"><span className="font-bold text-slate-700 uppercase truncate leading-tight">{item.description}</span><span className="text-[clamp(6px,1.5vw,8px)] text-slate-400">{item.category} • {item.id}</span></div><span className="font-black text-rose-500">{formatIDR(item.amount)}</span></div>))}
                  </div>
                </div>
              </div>
              <div className={`p-4 sm:p-6 rounded-xl flex flex-col items-center justify-center ${reportData.surplusDefisit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                <span className="text-[clamp(7px,1.5vw,10px)] font-black uppercase tracking-[0.2em] opacity-60 mb-2">
                  {`Net ${reportData.surplusDefisit >= 0 ? 'Surplus' : 'Defisit'} ${selectedProject === 'KAS UMUM' ? 'Kas Harian' : `Proker ${selectedProject}`}`}
                </span>
                <div className="flex items-center space-x-3">
                   {reportData.surplusDefisit >= 0 ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
                   <span className="text-[clamp(14px,4vw,28px)] font-black">{formatIDR(reportData.surplusDefisit)}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default LaporanView;
