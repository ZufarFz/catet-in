
import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
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
  Info,
  Download,
  RotateCcw
} from 'lucide-react';
import { AttendanceLog, EventData } from '../../types';
import ModernSelect from '../ui/ModernSelect';
import { motion, AnimatePresence } from 'motion/react';
import { dbAddAttendanceLog, dbDeleteAttendanceLog, dbFetchExportDistinctDates, dbFetchExportAttendanceLogsForDates, dbGetAttendanceAnalysisSummary } from '../../supabase';

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
  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<'latest' | 'export'>('latest');

  // Existing History States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterKelompok, setFilterKelompok] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [filterAgeCategory, setFilterAgeCategory] = useState('');
  const [filterDesa, setFilterDesa] = useState('');
  const [filterDaerah, setFilterDaerah] = useState('');
  const [filterMyLogsOnly, setFilterMyLogsOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Export Filter States (Nama Event & Rentang Tanggal)
  const [exportEvent, setExportEvent] = useState('');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  // Export Distinct Meetings & Selection States
  const [isFetchingExport, setIsFetchingExport] = useState(false);
  const [distinctDates, setDistinctDates] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [isDatesFetched, setIsDatesFetched] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

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
      await dbAddAttendanceLog(updatedRecord, true);
      notify("Berhasil update data absensi", "success");
      setEditingLog(null);
      onRefresh();
    } catch (e) {
      notify("Gagal update", "error");
    } finally {
      setIsProcessing(null);
    }
  };

  const currentUserId = typeof window !== 'undefined' ? (localStorage.getItem('user_id') || '') : '';
  const currentUsername = typeof window !== 'undefined' ? (localStorage.getItem('username') || '') : '';
  const currentFullName = typeof window !== 'undefined' ? (localStorage.getItem('full_name') || '') : '';

  const filteredLogs = useMemo(() => {
    const uid = currentUserId.toLowerCase();
    const uname = currentUsername.toLowerCase();
    const fname = currentFullName.toLowerCase();

    const matched = logs.filter(l => {
      const matchSearch = (l.memberName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = !filterStatus || l.status === filterStatus;
      const matchKelompok = !filterKelompok || l.kelompokName === filterKelompok;
      const matchEvent = !filterEvent || l.event_id === filterEvent;
      const matchAgeCategory = !filterAgeCategory || l.ageName === filterAgeCategory;
      const matchDesa = !filterDesa || l.desaName === filterDesa;
      const matchDaerah = !filterDaerah || l.daerahName === filterDaerah;

      let matchMyLogs = true;
      if (filterMyLogsOnly) {
        const creator = (l.created_by || l.createdBy || '').toLowerCase();
        const rawUserId = (l.user_id || '').toLowerCase();
        matchMyLogs = (!!uid && (creator === uid || rawUserId === uid)) ||
                      (!!uname && (creator === uname || rawUserId === uname)) ||
                      (!!fname && creator === fname);
      }

      return matchSearch && matchStatus && matchKelompok && matchEvent && matchAgeCategory && matchDesa && matchDaerah && matchMyLogs;
    });

    return matched.sort((a, b) => {
      const timeA = a.dateInput ? new Date(a.dateInput).getTime() : (a.date ? new Date(a.date.replace(' ', 'T')).getTime() : 0);
      const timeB = b.dateInput ? new Date(b.dateInput).getTime() : (b.date ? new Date(b.date.replace(' ', 'T')).getTime() : 0);
      return timeB - timeA;
    });
  }, [logs, searchTerm, filterStatus, filterKelompok, filterEvent, filterAgeCategory, filterDesa, filterDaerah, filterMyLogsOnly, currentUserId, currentUsername, currentFullName]);

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

  // Export Presets Handlers
  const setPresetToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    setExportStartDate(today);
    setExportEndDate(today);
  };

  const setPresetThisWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const startDateStr = monday.toISOString().slice(0, 10);
    const endDateStr = now.toISOString().slice(0, 10);
    setExportStartDate(startDateStr);
    setExportEndDate(endDateStr);
  };

  const setPresetThisMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const firstDay = `${year}-${month}-01`;
    const today = now.toISOString().slice(0, 10);
    setExportStartDate(firstDay);
    setExportEndDate(today);
  };

  const handleResetExportFilters = () => {
    setExportEvent('');
    setExportStartDate('');
    setExportEndDate('');
    setDistinctDates([]);
    setSelectedDates(new Set());
    setIsDatesFetched(false);
  };

  // Helper: validate max 1 month range (31 days)
  const isDateRangeValidAndMax1Month = useMemo(() => {
    if (!exportStartDate || !exportEndDate) return false;
    const s = new Date(exportStartDate);
    const e = new Date(exportEndDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;
    if (e < s) return false;
    const diffDays = Math.ceil((e.getTime() - s.getTime()) / (1000 * 3600 * 24));
    return diffDays <= 31;
  }, [exportStartDate, exportEndDate]);

  const isGoSearchEnabled = useMemo(() => {
    return Boolean(exportEvent) && isDateRangeValidAndMax1Month;
  }, [exportEvent, isDateRangeValidAndMax1Month]);

  const validateDateRange = (startStr: string, endStr: string): { valid: boolean; message?: string } => {
    if (startStr && endStr) {
      const s = new Date(startStr);
      const e = new Date(endStr);
      if (e < s) {
        return { valid: false, message: 'Tanggal awal tidak boleh lebih besar dari tanggal akhir.' };
      }
      const diffDays = Math.ceil((e.getTime() - s.getTime()) / (1000 * 3600 * 24));
      if (diffDays > 31) {
        return { valid: false, message: 'Rentang tanggal maksimal 1 bulan (31 hari) untuk menjaga efisiensi data & egress.' };
      }
    }
    return { valid: true };
  };

  // GO button handler -> fetches DISTINCT DATES only (lightweight query)
  const handleGoFetchDates = async () => {
    if (!exportEvent) {
      notify("Silakan pilih salah satu kegiatan terlebih dahulu", "error");
      return;
    }

    if (exportStartDate && exportEndDate) {
      const check = validateDateRange(exportStartDate, exportEndDate);
      if (!check.valid) {
        notify(check.message!, "error");
        return;
      }
    }

    setIsFetchingExport(true);
    try {
      const dates = await dbFetchExportDistinctDates(
        exportEvent || undefined,
        exportStartDate || undefined,
        exportEndDate || undefined
      );

      if (dates.length === 0) {
        notify("Tidak ditemukan pertemuan pada kegiatan dan rentang tanggal yang dipilih", "error");
        setDistinctDates([]);
        setSelectedDates(new Set());
        setIsDatesFetched(false);
        return;
      }

      setDistinctDates(dates);
      // Pre-select up to top 7 dates automatically
      const initialSelected = new Set(dates.slice(0, 7));
      setSelectedDates(initialSelected);
      setIsDatesFetched(true);
      notify(`Ditemukan ${dates.length} tanggal pertemuan. Silakan centang maksimal 7 tanggal untuk di-export.`, "success");
    } catch (err) {
      console.error("Error fetching distinct dates:", err);
      notify("Gagal mengambil daftar tanggal pertemuan dari database", "error");
    } finally {
      setIsFetchingExport(false);
    }
  };

  // Toggle date checkbox with Max 7 limit
  const handleToggleDateSelection = (dateStr: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        if (next.size >= 7) {
          notify("Maksimal 7 tanggal pertemuan yang dapat dipilih untuk di-export", "error");
          return prev;
        }
        next.add(dateStr);
      }
      return next;
    });
  };

  const handleSelectTop7 = () => {
    if (selectedDates.size === Math.min(distinctDates.length, 7)) {
      setSelectedDates(new Set());
    } else {
      setSelectedDates(new Set(distinctDates.slice(0, 7)));
    }
  };

  // Execute Multi-Sheet Excel Export with Analysis & Rekap (ExcelJS Professional Print-Ready Format via Supabase RPC)
  const handleExecuteExportMultiSheetExcel = async (analysisOnly: boolean = false) => {
    if (selectedDates.size === 0) {
      notify("Silakan pilih minimal 1 tanggal pertemuan yang akan di-export", "error");
      return;
    }
    if (selectedDates.size > 7) {
      notify("Maksimal 7 tanggal pertemuan yang dapat dipilih", "error");
      return;
    }

    setIsExportingExcel(true);
    try {
      const selectedDatesArr = Array.from(selectedDates).sort();
      const selectedEventObj = events.find(e => e.id === exportEvent);
      const eventName = selectedEventObj ? selectedEventObj.nama_kegiatan : 'Semua Kegiatan';

      // 1. Fetch pre-aggregated analysis stats directly from Supabase RPC Stored Procedure
      const analysisSummary = await dbGetAttendanceAnalysisSummary(
        exportEvent || undefined,
        selectedDatesArr
      );

      // Create ExcelJS Workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Catet-In App';
      workbook.created = new Date();

      // Style Presets
      // Color Palette & Styling Constants (App Light Mode Theme)
      const TITLE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } }; // Deep Sky Blue (Brand Title Banner)
      const TITLE_FONT: Partial<ExcelJS.Font> = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };

      const SUBTITLE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }; // Light Sky-100 Subtitle Banner
      const SUBTITLE_FONT: Partial<ExcelJS.Font> = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0369A1' } };

      const SEC_HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }; // Bright Soft Sky Section Banner
      const SEC_HEADER_FONT: Partial<ExcelJS.Font> = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF0369A1' } };

      const TBL_HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } }; // Bright Sky-50 Light Table Header
      const TBL_HEADER_FONT: Partial<ExcelJS.Font> = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0284C7' } };

      const TBL_HEADER_DARK_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }; // Soft Sky-100 Detail Table Header
      const TBL_HEADER_DARK_FONT: Partial<ExcelJS.Font> = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0369A1' } };

      const EVEN_ROW_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      const ODD_ROW_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      const DATA_FONT: Partial<ExcelJS.Font> = { name: 'Arial', size: 9, color: { argb: 'FF1E293B' } };

      const TOTAL_ROW_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }; // Light Sky-100 Total Fill
      const TOTAL_ROW_FONT: Partial<ExcelJS.Font> = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0369A1' } }; // Sky-700 Text

      const THIN_BORDER: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      const TOTAL_BORDER: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FF0284C7' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'double', color: { argb: 'FF0284C7' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Helper to style range of cells
      const styleRange = (
        sheet: ExcelJS.Worksheet,
        startCol: number,
        startRow: number,
        endCol: number,
        endRow: number,
        style: {
          fill?: ExcelJS.Fill;
          font?: Partial<ExcelJS.Font>;
          alignment?: Partial<ExcelJS.Alignment>;
          border?: Partial<ExcelJS.Borders>;
        }
      ) => {
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const cell = sheet.getCell(r, c);
            if (style.fill) cell.fill = style.fill;
            if (style.font) cell.font = style.font;
            if (style.alignment) cell.alignment = style.alignment;
            if (style.border) cell.border = style.border;
          }
        }
      };

      // Helper function to build styled section tables
      const addSectionTableToSheet = (
        sheet: ExcelJS.Worksheet,
        startRow: number,
        sectionTitle: string,
        colHeaders: string[],
        rowsData: Array<{ label: string; h: number; i: number; s: number; a: number; tot: number; pct: string }>,
        totalLabel: string,
        totH: number,
        totI: number,
        totS: number,
        totA: number,
        totTot: number,
        totPct: string,
        showTotalRow: boolean = true
      ) => {
        let cRow = startRow;
        sheet.mergeCells(`A${cRow}:G${cRow}`);
        sheet.getCell(`A${cRow}`).value = sectionTitle;
        styleRange(sheet, 1, cRow, 7, cRow, {
          fill: SEC_HEADER_FILL,
          font: SEC_HEADER_FONT,
          alignment: { horizontal: 'left', vertical: 'middle', indent: 1 }
        });
        sheet.getRow(cRow).height = 25;
        cRow++;

        const headRow = sheet.getRow(cRow);
        headRow.height = 24;
        colHeaders.forEach((th, idx) => {
          const cell = headRow.getCell(idx + 1);
          cell.value = th;
        });
        styleRange(sheet, 1, cRow, 7, cRow, {
          fill: TBL_HEADER_FILL,
          font: TBL_HEADER_FONT,
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: THIN_BORDER
        });
        sheet.getCell(`A${cRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
        cRow++;

        rowsData.forEach((rd, rIdx) => {
          const dRow = sheet.getRow(cRow);
          dRow.height = 20;
          const fill = rIdx % 2 === 0 ? EVEN_ROW_FILL : ODD_ROW_FILL;

          const vals = [rd.label, rd.h, rd.i, rd.s, rd.a, rd.tot, rd.pct];
          vals.forEach((v, idx) => {
            const cell = dRow.getCell(idx + 1);
            cell.value = v;
          });

          styleRange(sheet, 1, cRow, 7, cRow, {
            fill,
            font: DATA_FONT,
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: THIN_BORDER
          });
          sheet.getCell(`A${cRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
          cRow++;
        });

        if (showTotalRow) {
          const totRow = sheet.getRow(cRow);
          totRow.height = 22;
          const totVals = [totalLabel, totH, totI, totS, totA, totTot, totPct];
          totVals.forEach((v, idx) => {
            const cell = totRow.getCell(idx + 1);
            cell.value = v;
          });

          styleRange(sheet, 1, cRow, 7, cRow, {
            fill: TOTAL_ROW_FILL,
            font: TOTAL_ROW_FONT,
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: TOTAL_BORDER
          });
          sheet.getCell(`A${cRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
          cRow++;
        }

        sheet.getRow(cRow).height = 12;
        cRow++;

        return cRow;
      };

      const META_LABEL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      const META_VAL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      const META_LABEL_FONT: Partial<ExcelJS.Font> = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF475569' } };
      const META_VAL_FONT: Partial<ExcelJS.Font> = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };

      const ov = analysisSummary.overall;
      const isSingleDateExport = selectedDatesArr.length === 1;

      if (isSingleDateExport) {
        // ==========================================
        // SINGLE DATE EXPORT: SINGLE ANALYSIS SHEET
        // ==========================================
        const analysisSheet = workbook.addWorksheet('Analisis Presensi', {
          views: [{ showGridLines: false }]
        });

        analysisSheet.columns = [
          { width: 34 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 18 },
          { width: 22 }
        ];

        const dateStr = selectedDatesArr[0];
        const singleDateItem = (analysisSummary.perDate && analysisSummary.perDate.length > 0)
          ? analysisSummary.perDate[0]
          : null;

        const h = singleDateItem ? singleDateItem.h : ov.totalHadir;
        const i = singleDateItem ? singleDateItem.i : ov.totalIzin;
        const s = singleDateItem ? singleDateItem.s : ov.totalSakit;
        const a = singleDateItem ? singleDateItem.a : ov.totalAlpa;
        const tot = singleDateItem ? singleDateItem.tot : ov.totalRecord;
        const pct = singleDateItem ? singleDateItem.pct : ov.percentHadir;
        const kelompokList = singleDateItem ? singleDateItem.perKelompok : ov.perKelompok;
        const ageList = singleDateItem ? singleDateItem.perAgeCategory : ov.perAgeCategory;

        // Title Banner
        analysisSheet.mergeCells('A1:G1');
        analysisSheet.getCell('A1').value = `LAPORAN ANALISIS PRESENSI - ${formatDateDisplay(dateStr).toUpperCase()}`;
        styleRange(analysisSheet, 1, 1, 7, 1, {
          fill: TITLE_FILL,
          font: TITLE_FONT,
          alignment: { horizontal: 'center', vertical: 'middle' }
        });
        analysisSheet.getRow(1).height = 34;

        // Subtitle Banner
        analysisSheet.mergeCells('A2:G2');
        analysisSheet.getCell('A2').value = 'Catet-In - Sistem Informasi Absensi & Keuangan Instansi';
        styleRange(analysisSheet, 1, 2, 7, 2, {
          fill: SUBTITLE_FILL,
          font: SUBTITLE_FONT,
          alignment: { horizontal: 'center', vertical: 'middle' }
        });
        analysisSheet.getRow(2).height = 22;

        analysisSheet.getRow(3).height = 10;

        // Metadata Block
        analysisSheet.getCell('A4').value = 'NAMA KEGIATAN:';
        analysisSheet.mergeCells('B4:D4');
        analysisSheet.getCell('B4').value = eventName.toUpperCase();
        analysisSheet.mergeCells('E4:F4');
        analysisSheet.getCell('E4').value = 'PERIODE LAPORAN:';
        analysisSheet.getCell('G4').value = `1 Hari Pertemuan (${formatDateDisplay(dateStr)})`;

        analysisSheet.getCell('A5').value = 'DAFTAR TANGGAL:';
        analysisSheet.mergeCells('B5:D5');
        analysisSheet.getCell('B5').value = formatDateDisplay(dateStr);
        analysisSheet.mergeCells('E5:F5');
        analysisSheet.getCell('E5').value = 'WAKTU EXPORT:';
        analysisSheet.getCell('G5').value = new Date().toLocaleString('id-ID');

        [4, 5].forEach(r => {
          analysisSheet.getRow(r).height = 20;
          styleRange(analysisSheet, 1, r, 1, r, { fill: META_LABEL_FILL, font: META_LABEL_FONT, alignment: { horizontal: 'right', vertical: 'middle' }, border: THIN_BORDER });
          styleRange(analysisSheet, 2, r, 4, r, { fill: META_VAL_FILL, font: META_VAL_FONT, alignment: { horizontal: 'left', vertical: 'middle' }, border: THIN_BORDER });
          styleRange(analysisSheet, 5, r, 6, r, { fill: META_LABEL_FILL, font: META_LABEL_FONT, alignment: { horizontal: 'right', vertical: 'middle' }, border: THIN_BORDER });
          styleRange(analysisSheet, 7, r, 7, r, { fill: META_VAL_FILL, font: META_VAL_FONT, alignment: { horizontal: 'left', vertical: 'middle' }, border: THIN_BORDER });
        });

        analysisSheet.getRow(6).height = 12;

        let currRow = 7;

        // 1. Rekap Keseluruhan (Tabel paling atas tanpa baris TOTAL)
        currRow = addSectionTableToSheet(
          analysisSheet,
          currRow,
          '1. REKAPITULASI KESELURUHAN PRESENSI',
          ['Ringkasan Metrics', 'Total Hadir', 'Total Izin', 'Total Sakit', 'Total Alpa', 'Total Peserta', 'Persentase Kehadiran'],
          [{ label: `TOTAL PRESENSI (${formatDateDisplay(dateStr)})`, h, i, s, a, tot, pct }],
          'TOTAL REKAPITULASI',
          h, i, s, a, tot, pct,
          false // Hide total row
        );

        // 2. Per Kelompok
        if (kelompokList && kelompokList.length > 0) {
          currRow = addSectionTableToSheet(
            analysisSheet,
            currRow,
            '2. REKAPITULASI PER KELOMPOK',
            ['Nama Kelompok', 'Total Hadir', 'Total Izin', 'Total Sakit', 'Total Alpa', 'Total Peserta', '% Kehadiran'],
            kelompokList,
            'TOTAL REKAP KELOMPOK',
            h, i, s, a, tot, pct
          );
        }

        // 3. Per Kategori Usia
        if (ageList && ageList.length > 0) {
          currRow = addSectionTableToSheet(
            analysisSheet,
            currRow,
            '3. REKAPITULASI PER KATEGORI USIA',
            ['Kategori Usia', 'Total Hadir', 'Total Izin', 'Total Sakit', 'Total Alpa', 'Total Peserta', '% Kehadiran'],
            ageList,
            'TOTAL REKAP KATEGORI USIA',
            h, i, s, a, tot, pct
          );
        }

      } else {
        // ==========================================
        // MULTI-DATE EXPORT: OVERALL & PER TANGGAL SHEETS
        // ==========================================
        const analysisOverallSheet = workbook.addWorksheet('Analisis Overall', {
          views: [{ showGridLines: false }]
        });

        analysisOverallSheet.columns = [
          { width: 34 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 18 },
          { width: 22 }
        ];

        // Title Banner Sheet 1
        analysisOverallSheet.mergeCells('A1:G1');
        analysisOverallSheet.getCell('A1').value = 'LAPORAN ANALISIS OVERALL PRESENSI';
        styleRange(analysisOverallSheet, 1, 1, 7, 1, {
          fill: TITLE_FILL,
          font: TITLE_FONT,
          alignment: { horizontal: 'center', vertical: 'middle' }
        });
        analysisOverallSheet.getRow(1).height = 34;

        // Subtitle Banner Sheet 1
        analysisOverallSheet.mergeCells('A2:G2');
        analysisOverallSheet.getCell('A2').value = 'Catet-In - Sistem Informasi Absensi & Keuangan Instansi';
        styleRange(analysisOverallSheet, 1, 2, 7, 2, {
          fill: SUBTITLE_FILL,
          font: SUBTITLE_FONT,
          alignment: { horizontal: 'center', vertical: 'middle' }
        });
        analysisOverallSheet.getRow(2).height = 22;

        analysisOverallSheet.getRow(3).height = 10;

        // Metadata Block (Rows 4 & 5)
        analysisOverallSheet.getCell('A4').value = 'NAMA KEGIATAN:';
        analysisOverallSheet.mergeCells('B4:D4');
        analysisOverallSheet.getCell('B4').value = eventName.toUpperCase();
        analysisOverallSheet.mergeCells('E4:F4');
        analysisOverallSheet.getCell('E4').value = 'PERIODE LAPORAN:';
        analysisOverallSheet.getCell('G4').value = `${selectedDatesArr.length} Hari Pertemuan`;

        analysisOverallSheet.getCell('A5').value = 'DAFTAR TANGGAL:';
        analysisOverallSheet.mergeCells('B5:D5');
        analysisOverallSheet.getCell('B5').value = selectedDatesArr.map(d => formatDateDisplay(d)).join(', ');
        analysisOverallSheet.mergeCells('E5:F5');
        analysisOverallSheet.getCell('E5').value = 'WAKTU EXPORT:';
        analysisOverallSheet.getCell('G5').value = new Date().toLocaleString('id-ID');

        [4, 5].forEach(r => {
          analysisOverallSheet.getRow(r).height = 20;
          styleRange(analysisOverallSheet, 1, r, 1, r, { fill: META_LABEL_FILL, font: META_LABEL_FONT, alignment: { horizontal: 'right', vertical: 'middle' }, border: THIN_BORDER });
          styleRange(analysisOverallSheet, 2, r, 4, r, { fill: META_VAL_FILL, font: META_VAL_FONT, alignment: { horizontal: 'left', vertical: 'middle' }, border: THIN_BORDER });
          styleRange(analysisOverallSheet, 5, r, 6, r, { fill: META_LABEL_FILL, font: META_LABEL_FONT, alignment: { horizontal: 'right', vertical: 'middle' }, border: THIN_BORDER });
          styleRange(analysisOverallSheet, 7, r, 7, r, { fill: META_VAL_FILL, font: META_VAL_FONT, alignment: { horizontal: 'left', vertical: 'middle' }, border: THIN_BORDER });
        });

        analysisOverallSheet.getRow(6).height = 12;

        let currRowOverall = 7;

        // 1. Overall Summary Table (Tabel paling atas tanpa baris TOTAL)
        currRowOverall = addSectionTableToSheet(
          analysisOverallSheet,
          currRowOverall,
          '1. OVERALL REKAPITULASI PRESENSI',
          ['Ringkasan Metrics', 'Total Hadir', 'Total Izin', 'Total Sakit', 'Total Alpa', 'Total Peserta', 'Persentase Kehadiran'],
          [{ label: 'TOTAL KESELURUHAN PRESENSI', h: ov.totalHadir, i: ov.totalIzin, s: ov.totalSakit, a: ov.totalAlpa, tot: ov.totalRecord, pct: ov.percentHadir }],
          'RINGKASAN TOTAL OVERALL',
          ov.totalHadir, ov.totalIzin, ov.totalSakit, ov.totalAlpa, ov.totalRecord, ov.percentHadir,
          false // Hide total row
        );

        // 2. Per Tanggal Pertemuan Table (Overall)
        if (analysisSummary.perDate && analysisSummary.perDate.length > 0) {
          const perDateRows = analysisSummary.perDate.map(d => ({
            label: formatDateDisplay(d.dateStr),
            h: d.h,
            i: d.i,
            s: d.s,
            a: d.a,
            tot: d.tot,
            pct: d.pct
          }));

          currRowOverall = addSectionTableToSheet(
            analysisOverallSheet,
            currRowOverall,
            '2. REKAPITULASI PRESENSI PER TANGGAL PERTEMUAN',
            ['Tanggal Pertemuan', 'Total Hadir', 'Total Izin', 'Total Sakit', 'Total Alpa', 'Total Peserta', '% Kehadiran'],
            perDateRows,
            'TOTAL REKAP PER TANGGAL',
            ov.totalHadir, ov.totalIzin, ov.totalSakit, ov.totalAlpa, ov.totalRecord, ov.percentHadir
          );
        }

        // 3. Per Kelompok Table (Overall)
        if (ov.perKelompok && ov.perKelompok.length > 0) {
          currRowOverall = addSectionTableToSheet(
            analysisOverallSheet,
            currRowOverall,
            '3. REKAPITULASI PER KELOMPOK (OVERALL)',
            ['Nama Kelompok', 'Total Hadir', 'Total Izin', 'Total Sakit', 'Total Alpa', 'Total Peserta', '% Kehadiran'],
            ov.perKelompok,
            'TOTAL REKAP KELOMPOK',
            ov.totalHadir, ov.totalIzin, ov.totalSakit, ov.totalAlpa, ov.totalRecord, ov.percentHadir
          );
        }

        // 4. Per Kategori Usia Table (Overall)
        if (ov.perAgeCategory && ov.perAgeCategory.length > 0) {
          currRowOverall = addSectionTableToSheet(
            analysisOverallSheet,
            currRowOverall,
            '4. REKAPITULASI PER KATEGORI USIA (OVERALL)',
            ['Kategori Usia', 'Total Hadir', 'Total Izin', 'Total Sakit', 'Total Alpa', 'Total Peserta', '% Kehadiran'],
            ov.perAgeCategory,
            'TOTAL REKAP KATEGORI USIA',
            ov.totalHadir, ov.totalIzin, ov.totalSakit, ov.totalAlpa, ov.totalRecord, ov.percentHadir
          );
        }

        // SHEET 2: ANALISIS PER TANGGAL (From RPC)
        const analysisPerDateSheet = workbook.addWorksheet('Analisis Per Tanggal', {
          views: [{ showGridLines: false }]
        });

        analysisPerDateSheet.columns = [
          { width: 34 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 18 },
          { width: 22 }
        ];

        analysisPerDateSheet.mergeCells('A1:G1');
        analysisPerDateSheet.getCell('A1').value = 'LAPORAN ANALISIS PRESENSI PER TANGGAL PERTEMUAN';
        styleRange(analysisPerDateSheet, 1, 1, 7, 1, {
          fill: TITLE_FILL,
          font: TITLE_FONT,
          alignment: { horizontal: 'center', vertical: 'middle' }
        });
        analysisPerDateSheet.getRow(1).height = 34;

        analysisPerDateSheet.mergeCells('A2:G2');
        analysisPerDateSheet.getCell('A2').value = 'Catet-In - Rincian Analisis Per Hari Pertemuan';
        styleRange(analysisPerDateSheet, 1, 2, 7, 2, {
          fill: SUBTITLE_FILL,
          font: SUBTITLE_FONT,
          alignment: { horizontal: 'center', vertical: 'middle' }
        });
        analysisPerDateSheet.getRow(2).height = 22;

        analysisPerDateSheet.getRow(3).height = 10;

        analysisPerDateSheet.getCell('A4').value = 'NAMA KEGIATAN:';
        analysisPerDateSheet.mergeCells('B4:D4');
        analysisPerDateSheet.getCell('B4').value = eventName.toUpperCase();
        analysisPerDateSheet.mergeCells('E4:F4');
        analysisPerDateSheet.getCell('E4').value = 'PERIODE LAPORAN:';
        analysisPerDateSheet.getCell('G4').value = `${selectedDatesArr.length} Hari Pertemuan`;

        analysisPerDateSheet.getCell('A5').value = 'DAFTAR TANGGAL:';
        analysisPerDateSheet.mergeCells('B5:D5');
        analysisPerDateSheet.getCell('B5').value = selectedDatesArr.map(d => formatDateDisplay(d)).join(', ');
        analysisPerDateSheet.mergeCells('E5:F5');
        analysisPerDateSheet.getCell('E5').value = 'WAKTU EXPORT:';
        analysisPerDateSheet.getCell('G5').value = new Date().toLocaleString('id-ID');

        [4, 5].forEach(r => {
          analysisPerDateSheet.getRow(r).height = 20;
          styleRange(analysisPerDateSheet, 1, r, 1, r, { fill: META_LABEL_FILL, font: META_LABEL_FONT, alignment: { horizontal: 'right', vertical: 'middle' }, border: THIN_BORDER });
          styleRange(analysisPerDateSheet, 2, r, 4, r, { fill: META_VAL_FILL, font: META_VAL_FONT, alignment: { horizontal: 'left', vertical: 'middle' }, border: THIN_BORDER });
          styleRange(analysisPerDateSheet, 5, r, 6, r, { fill: META_LABEL_FILL, font: META_LABEL_FONT, alignment: { horizontal: 'right', vertical: 'middle' }, border: THIN_BORDER });
          styleRange(analysisPerDateSheet, 7, r, 7, r, { fill: META_VAL_FILL, font: META_VAL_FONT, alignment: { horizontal: 'left', vertical: 'middle' }, border: THIN_BORDER });
        });

        analysisPerDateSheet.getRow(6).height = 12;

        let currRowPerDate = 7;
        const DATE_HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBAE6FD' } }; // Light Sky-200 Banner
        const DATE_HEADER_FONT: Partial<ExcelJS.Font> = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF0369A1' } };

        (analysisSummary.perDate || []).forEach((dateItem, dIdx) => {
          // Add extra row spacing before subsequent meeting date blocks
          if (dIdx > 0) {
            analysisPerDateSheet.getRow(currRowPerDate).height = 16;
            currRowPerDate++;
          }

          // Header Banner: Centered and highlighted
          analysisPerDateSheet.mergeCells(`A${currRowPerDate}:G${currRowPerDate}`);
          analysisPerDateSheet.getCell(`A${currRowPerDate}`).value = `PERTEMUAN ${dIdx + 1}: ${formatDateDisplay(dateItem.dateStr).toUpperCase()}`;
          styleRange(analysisPerDateSheet, 1, currRowPerDate, 7, currRowPerDate, {
            fill: DATE_HEADER_FILL,
            font: DATE_HEADER_FONT,
            alignment: { horizontal: 'center', vertical: 'middle' }
          });
          analysisPerDateSheet.getRow(currRowPerDate).height = 30;
          currRowPerDate++;

          // 1. Summary Tanggal Ini (Tabel paling atas tanpa baris TOTAL)
          currRowPerDate = addSectionTableToSheet(
            analysisPerDateSheet,
            currRowPerDate,
            `Ringkasan Presensi Pertemuan ${formatDateDisplay(dateItem.dateStr)}`,
            ['Ringkasan Metrics', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Total Peserta', '% Kehadiran'],
            [{ label: `TOTAL PRESENSI (${formatDateDisplay(dateItem.dateStr)})`, h: dateItem.h, i: dateItem.i, s: dateItem.s, a: dateItem.a, tot: dateItem.tot, pct: dateItem.pct }],
            `TOTAL HARIAN (${formatDateDisplay(dateItem.dateStr)})`,
            dateItem.h, dateItem.i, dateItem.s, dateItem.a, dateItem.tot, dateItem.pct,
            false // Hide total row
          );

          // 2. Per Kelompok Tanggal Ini
          if (dateItem.perKelompok && dateItem.perKelompok.length > 0) {
            currRowPerDate = addSectionTableToSheet(
              analysisPerDateSheet,
              currRowPerDate,
              `Rekap Per Kelompok - ${formatDateDisplay(dateItem.dateStr)}`,
              ['Nama Kelompok', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Total Peserta', '% Kehadiran'],
              dateItem.perKelompok,
              `TOTAL KELOMPOK HARIAN`,
              dateItem.h, dateItem.i, dateItem.s, dateItem.a, dateItem.tot, dateItem.pct
            );
          }

          // 3. Per Kategori Usia Tanggal Ini
          if (dateItem.perAgeCategory && dateItem.perAgeCategory.length > 0) {
            currRowPerDate = addSectionTableToSheet(
              analysisPerDateSheet,
              currRowPerDate,
              `Rekap Per Kategori Usia - ${formatDateDisplay(dateItem.dateStr)}`,
              ['Kategori Usia', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Total Peserta', '% Kehadiran'],
              dateItem.perAgeCategory,
              `TOTAL USIA HARIAN`,
              dateItem.h, dateItem.i, dateItem.s, dateItem.a, dateItem.tot, dateItem.pct
            );
          }

          analysisPerDateSheet.getRow(currRowPerDate).height = 18;
          currRowPerDate++;
        });
      }

      // ==========================================
      // SHEETS 3..N: INDIVIDUAL DAILY MEETING SHEETS (If full export)
      // ==========================================
      if (!analysisOnly) {
        const fetchedLogs = await dbFetchExportAttendanceLogsForDates(
          exportEvent || undefined,
          selectedDatesArr
        );

        const logsByDate: { [dateStr: string]: AttendanceLog[] } = {};
        selectedDatesArr.forEach(d => { logsByDate[d] = []; });

        fetchedLogs.forEach(log => {
          const rawDateStr = log.date || log.dateInput;
          if (!rawDateStr) return;
          try {
            const dObj = new Date(rawDateStr.includes(' ') ? rawDateStr.replace(' ', 'T') : rawDateStr);
            if (!isNaN(dObj.getTime())) {
              const year = dObj.getFullYear();
              const month = String(dObj.getMonth() + 1).padStart(2, '0');
              const day = String(dObj.getDate()).padStart(2, '0');
              const yyyymmdd = `${year}-${month}-${day}`;
              if (logsByDate[yyyymmdd]) {
                logsByDate[yyyymmdd].push(log);
              }
            }
          } catch (e) {
            // ignore
          }
        });

        selectedDatesArr.forEach(d => {
          const dateLogs = logsByDate[d] || [];
          const sheetName = sanitizeSheetName(d);

          const daySheet = workbook.addWorksheet(sheetName, {
            views: [{ showGridLines: false }]
          });

          daySheet.columns = [
            { width: 6 },  // A: No
            { width: 22 }, // B: Tanggal Input System
            { width: 20 }, // C: Tanggal Absen
            { width: 14 }, // D: Waktu Absen
            { width: 30 }, // E: Nama Anggota
            { width: 32 }, // F: Nama Kegiatan
            { width: 16 }, // G: Status Absensi
            { width: 32 }, // H: Keterangan
            { width: 16 }, // I: Metode
            { width: 22 }, // J: Kelompok
            { width: 22 }, // K: Desa
            { width: 22 }, // L: Daerah
            { width: 20 }, // M: Kategori Usia
            { width: 22 }  // N: Dicatat Oleh
          ];

          daySheet.mergeCells('A1:N1');
          daySheet.getCell('A1').value = `LAPORAN PRESENSI HARIAN - ${formatDateDisplay(d).toUpperCase()}`;
          styleRange(daySheet, 1, 1, 14, 1, {
            fill: TITLE_FILL,
            font: TITLE_FONT,
            alignment: { horizontal: 'center', vertical: 'middle' }
          });
          daySheet.getRow(1).height = 32;

          daySheet.mergeCells('A2:N2');
          daySheet.getCell('A2').value = `Kegiatan: ${eventName.toUpperCase()} | Waktu Export: ${new Date().toLocaleString('id-ID')}`;
          styleRange(daySheet, 1, 2, 14, 2, {
            fill: SUBTITLE_FILL,
            font: SUBTITLE_FONT,
            alignment: { horizontal: 'center', vertical: 'middle' }
          });
          daySheet.getRow(2).height = 22;

          daySheet.getRow(3).height = 10;

          const ths = [
            'No',
            'Tanggal Input System',
            'Tanggal Absen',
            'Waktu Absen',
            'Nama Anggota',
            'Nama Kegiatan',
            'Status Absensi',
            'Keterangan / Catatan',
            'Metode Absensi',
            'Kelompok',
            'Desa',
            'Daerah',
            'Kategori Usia',
            'Dicatat Oleh'
          ];

          const hRow = daySheet.getRow(4);
          hRow.height = 26;
          ths.forEach((thText, idx) => {
            hRow.getCell(idx + 1).value = thText;
          });

          styleRange(daySheet, 1, 4, 14, 4, {
            fill: TBL_HEADER_DARK_FILL,
            font: TBL_HEADER_DARK_FONT,
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
            border: THIN_BORDER
          });

          dateLogs.forEach((log, idx) => {
            const evObj = events.find(e => e.id === log.event_id);
            const evName = evObj?.nama_kegiatan || eventName;
            const tglInput = log.dateInput ? formatDate(log.dateInput) : formatDate(log.date);
            const tglAbsen = formatDate(log.date);
            const jamAbsen = log.date ? formatTime(log.date) : '-';
            const statusStr = log.status || '-';

            const rNum = idx + 5;
            const dRow = daySheet.getRow(rNum);
            dRow.height = 20;
            const rowFill = idx % 2 === 0 ? EVEN_ROW_FILL : ODD_ROW_FILL;

            const rowVals = [
              idx + 1,
              tglInput,
              tglAbsen,
              jamAbsen,
              log.memberName || '-',
              evName.toUpperCase(),
              statusStr,
              log.note || '-',
              (log.metode || 'manual').toUpperCase(),
              log.kelompokName || '-',
              log.desaName || '-',
              log.daerahName || '-',
              log.ageName || '-',
              (log as any).created_by_name || log.created_by || log.createdBy || '-'
            ];

            rowVals.forEach((val, cIdx) => {
              dRow.getCell(cIdx + 1).value = val;
            });

            styleRange(daySheet, 1, rNum, 14, rNum, {
              fill: rowFill,
              font: DATA_FONT,
              alignment: { horizontal: 'left', vertical: 'middle' },
              border: THIN_BORDER
            });

            [1, 2, 3, 4, 7, 9].forEach(colIdx => {
              daySheet.getCell(rNum, colIdx).alignment = { horizontal: 'center', vertical: 'middle' };
            });

            const stCell = daySheet.getCell(rNum, 7);
            const stLower = statusStr.toLowerCase();
            if (stLower === 'hadir') {
              stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
              stCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF15803D' } };
            } else if (stLower === 'izin') {
              stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
              stCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
            } else if (stLower === 'sakit') {
              stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
              stCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
            } else if (stLower === 'alpa') {
              stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
              stCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
            }
          });
        });
      }

      // Export Download File
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const cleanEventStr = eventName.replace(/[^a-zA-Z0-9]/g, '_');
      const prefix = analysisOnly ? 'Laporan_Analisis_Presensi' : 'Laporan_Lengkap_Presensi';
      const fileName = `${prefix}_${cleanEventStr}_${selectedDatesArr.length}_Pertemuan.xlsx`;
      
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);

      if (analysisOnly) {
        notify(`Export Analisis Presensi (RPC Only) Berhasil! Hemat Egress 100% tanpa fetch detail log.`, "success");
      } else {
        notify(`Berhasil meng-export Excel lengkap ${selectedDatesArr.length} pertemuan (2 Sheet Analisis RPC + Sheet Rincian Peserta)!`, "success");
      }
    } catch (err: any) {
      console.error("Error executing export multi-sheet excel:", err);
      notify(err?.message || "Gagal memproses file Excel", "error");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const sanitizeSheetName = (dateStr: string) => {
    return dateStr.slice(0, 31).replace(/[\\/?*:[\]]/g, '_');
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

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
        
        {/* Header with Sub-tab Toggle */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2 rounded-xl text-white shadow-lg">
                <CalendarDays size={24} />
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase">Riwayat Absensi</h1>
            </div>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest pl-11">Arsip dan Laporan Kehadiran Anggota</p>
          </div>
          
          {/* Sub Tab Toggle Switch */}
          <div className="flex p-1 bg-slate-200/80 rounded-2xl border border-slate-300/60 w-full sm:w-auto shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('latest')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all select-none active:scale-95 ${
                activeSubTab === 'latest'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={15} />
              <span>Riwayat Terbaru</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('export')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all select-none active:scale-95 ${
                activeSubTab === 'export'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet size={15} />
              <span>Export Data</span>
            </button>
          </div>
        </div>

        {/* SUB TAB 1: RIWAYAT ABSEN TERBARU */}
        {activeSubTab === 'latest' && (
          <>
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
              type="button"
              onClick={() => {
                setFilterMyLogsOnly(!filterMyLogsOnly);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-3 rounded-xl border font-black text-[11px] uppercase tracking-wider transition-all flex items-center gap-2 select-none active:scale-95 shrink-0 ${
                filterMyLogsOnly 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="Filter hanya catatan absensi yang saya buat"
            >
              <User size={14} />
              <span className="hidden sm:inline">Hanya Saya</span>
            </button>

            <button
              type="button"
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

                  {/* Row 4, Filter 1: Pencatat */}
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Pencatat Absensi</span>
                    <ModernSelect 
                      value={filterMyLogsOnly ? 'my_logs' : ''}
                      onChange={(val) => {
                        setFilterMyLogsOnly(val === 'my_logs');
                        setCurrentPage(1);
                      }}
                      options={[
                        { value: '', label: 'SEMUA PENCATAT' },
                        { value: 'my_logs', label: 'HANYA CATATAN SAYA' }
                      ]}
                      icon={User}
                      placeholder="PENCATAT"
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
        </>
        )}

        {/* SUB TAB 2: MENU EXPORT DATA */}
        {activeSubTab === 'export' && (
          <div className="space-y-6">
            {/* Step 1: Filter Parameter Card */}
            <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="flex items-center gap-2">
                  <Filter size={14} className="text-emerald-600" />
                  <span>Langkah 1: Filter Kegiatan & Rentang Tanggal</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Maks. Rentang 1 Bulan
                  </span>
                  <button
                    type="button"
                    onClick={handleResetExportFilters}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 shrink-0"
                  >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                  </button>
                </div>
              </h3>

              {/* Filter Nama Event (Kegiatan) */}
              <div>
                <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-1">
                  <span>Nama Kegiatan / Event</span>
                  <span className="text-rose-500 font-extrabold">(WAJIB)</span>
                </span>
                <ModernSelect
                  value={exportEvent}
                  onChange={(val) => {
                    setExportEvent(val);
                    setIsDatesFetched(false);
                    setDistinctDates([]);
                    setSelectedDates(new Set());
                  }}
                  options={events.map(evt => ({ value: evt.id, label: evt.nama_kegiatan.toUpperCase() }))}
                  icon={CalendarDays}
                  placeholder="PILIH SALAH SATU KEGIATAN (WAJIB)"
                />
              </div>

              {/* Rentang Tanggal Absensi */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    Rentang Tanggal Absensi (Max 31 Hari)
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => { setPresetToday(); setIsDatesFetched(false); }}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        exportStartDate === new Date().toISOString().slice(0, 10) && exportEndDate === new Date().toISOString().slice(0, 10)
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPresetThisWeek(); setIsDatesFetched(false); }}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        exportStartDate !== '' && exportStartDate === (() => {
                          const now = new Date();
                          const day = now.getDay();
                          const diff = (day === 0 ? -6 : 1) - day;
                          const monday = new Date(now);
                          monday.setDate(now.getDate() + diff);
                          return monday.toISOString().slice(0, 10);
                        })() && exportEndDate === new Date().toISOString().slice(0, 10)
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Minggu Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPresetThisMonth(); setIsDatesFetched(false); }}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        exportStartDate === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01` && exportEndDate === new Date().toISOString().slice(0, 10)
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Bulan Ini
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Dari Tanggal</span>
                    <input
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => { setExportStartDate(e.target.value); setIsDatesFetched(false); }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Sampai Tanggal</span>
                    <input
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => { setExportEndDate(e.target.value); setIsDatesFetched(false); }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Tombol GO */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGoFetchDates}
                  disabled={!isGoSearchEnabled || isFetchingExport}
                  className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-98 ${
                    isGoSearchEnabled && !isFetchingExport
                      ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-md hover:shadow-lg cursor-pointer'
                      : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                  }`}
                >
                  {isFetchingExport ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-emerald-400" />
                      <span>Mencari Pertemuan Dari Database...</span>
                    </>
                  ) : (
                    <>
                      <Search size={18} className={isGoSearchEnabled ? "text-emerald-400" : "text-slate-400"} />
                      <span>
                        {isGoSearchEnabled
                          ? "CARI PERTEMUAN (GO)"
                          : !exportEvent
                          ? "PILIH KEGIATAN DULU (CARI PERTEMUAN BELUM AKTIF)"
                          : !exportStartDate || !exportEndDate
                          ? "PILIH RENTANG TANGGAL MAX 1 BULAN (BELUM AKTIF)"
                          : new Date(exportEndDate) < new Date(exportStartDate)
                          ? "TANGGAL AKHIR LEBIH KECIL DARI TANGGAL AWAL"
                          : "RENTANG TANGGAL LEBIH DARI 1 BULAN (BELUM AKTIF)"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step 2: Date Checkbox Selection & Export Action */}
            {isDatesFetched && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-5 md:p-6 rounded-2xl border border-emerald-200/80 shadow-md space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span>Langkah 2: Pilih Hari Pertemuan yang Ingin Di-Export</span>
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                      Ditemukan {distinctDates.length} tanggal pertemuan. Silakan pilih hingga maksimal 7 tanggal.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className={`px-3 py-1 rounded-full text-[10.5px] font-black uppercase tracking-wider ${
                      selectedDates.size > 0 && selectedDates.size <= 7
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      Terpilih: {selectedDates.size} / 7
                    </span>

                    <button
                      type="button"
                      onClick={handleSelectTop7}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase transition-all"
                    >
                      {selectedDates.size === Math.min(distinctDates.length, 7) ? 'Kosongkan' : 'Pilih 7 Pertama'}
                    </button>
                  </div>
                </div>

                {/* List of Checkboxes */}
                {distinctDates.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto no-scrollbar p-1">
                    {distinctDates.map((dateStr) => {
                      const isChecked = selectedDates.has(dateStr);
                      return (
                        <label
                          key={dateStr}
                          onClick={() => handleToggleDateSelection(dateStr)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                            isChecked
                              ? 'bg-emerald-50/80 border-emerald-500 shadow-sm text-emerald-950 font-black'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 font-bold'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by parent onClick
                              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                            />
                            <div className="space-y-0.5">
                              <span className="text-xs block">
                                {formatDateDisplay(dateStr)}
                              </span>
                              <span className="text-[9.5px] text-slate-400 font-medium block">
                                {dateStr}
                              </span>
                            </div>
                          </div>

                          {isChecked && (
                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                    <p className="text-xs font-bold text-slate-500">Tidak ada tanggal pertemuan untuk filter ini.</p>
                  </div>
                )}

                {/* Info Note on Multi-Sheet Structure */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-3 text-slate-600 text-[11px] font-medium">
                  <Info size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    Setiap tanggal yang dicentang akan menjadi <span className="font-extrabold text-slate-900">Sheet terpisah</span> di file Excel, plus <span className="font-extrabold text-emerald-700">1 Sheet Analisis & Rekap</span> (hitung persentase kehadiran, rekap per tanggal, rekap kelompok, & rekap usia).
                  </div>
                </div>

                {/* Final Export Excel Buttons */}
                <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleExecuteExportMultiSheetExcel(true)}
                    disabled={selectedDates.size === 0 || isExportingExcel}
                    className={`py-4 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg active:scale-98 ${
                      selectedDates.size > 0 && !isExportingExcel
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 hover:shadow-blue-300 cursor-pointer'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    }`}
                  >
                    {isExportingExcel ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>MEMPROSES EXCEL...</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet size={18} />
                        <span>EXPORT ANALISIS ONLY (RPC - HEMAT EGRESS)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExecuteExportMultiSheetExcel(false)}
                    disabled={selectedDates.size === 0 || isExportingExcel}
                    className={`py-4 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg active:scale-98 ${
                      selectedDates.size > 0 && !isExportingExcel
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 hover:shadow-emerald-300 cursor-pointer'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    }`}
                  >
                    {isExportingExcel ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>MEMPROSES EXCEL...</span>
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        <span>EXPORT LENGKAP ({selectedDates.size} PERTEMUAN)</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

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

                  <div className="space-y-0.5">
                    <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Dicatat Oleh</p>
                    <p className="font-extrabold text-slate-700 tracking-tight leading-tight">
                      {selectedLog.created_by || selectedLog.createdBy || selectedLog.user_id || '—'}
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
    </div>
  );
};

export default AttendanceHistory;

