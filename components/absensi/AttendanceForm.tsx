import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  UserCheck, 
  CheckCircle2, 
  Loader2, 
  Calendar, 
  Send, 
  RefreshCw, 
  MapPin, 
  Users,
  Check,
  Baby,
  User,
  SlidersHorizontal,
  Info,
  X
} from 'lucide-react';
import { AbsensiMember, AttendanceLog, EventData } from '../../types';
import ModernSelect from '../ui/ModernSelect';
import { dbAddAttendanceLog, dbAddAttendanceLogs, dbAddEvent } from '../../supabase';

interface AttendanceFormProps {
  members: AbsensiMember[];
  logs: AttendanceLog[];
  logUrl: string;
  username: string;
  notify: (msg: string, type: 'success' | 'error') => void;
  onSuccess: () => void;
  events?: EventData[];
}

const AttendanceForm: React.FC<AttendanceFormProps> = ({ 
  members, 
  logs, 
  logUrl, 
  username, 
  notify, 
  onSuccess,
  events = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKelompok, setFilterKelompok] = useState('');
  const [filterDesa, setFilterDesa] = useState('');
  const [filterDaerah, setFilterDaerah] = useState('');
  const [filterAgeCategory, setFilterAgeCategory] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [showInitialFilterModal, setShowInitialFilterModal] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchStatuses, setBatchStatuses] = useState<Record<string, 'Hadir' | 'Izin' | 'Sakit' | 'Alpa' | ''>>({});
  const [batchNotes, setBatchNotes] = useState<Record<string, string>>({});
  const [shakingMemberId, setShakingMemberId] = useState<string | null>(null);

  const handleAddNewEvent = async (name: string) => {
    if (!name.trim()) return;
    const newEvent: EventData = {
      id: 'EVT-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      nama_kegiatan: name.trim()
    };
    const success = await dbAddEvent(newEvent);
    if (success) {
      notify(`Kegiatan "${name}" berhasil ditambahkan!`, "success");
      setSelectedEventId(newEvent.id);
    } else {
      notify("Gagal menambahkan kegiatan baru.", "error");
    }
  };

  // Barcode Scan Mode States
  const [attendanceMode, setAttendanceMode] = useState<'manual' | 'scan'>('manual');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [localScannedIds, setLocalScannedIds] = useState<Set<string>>(new Set());
  const [recentScans, setRecentScans] = useState<Array<{
    id: string;
    memberName: string;
    timestamp: string;
    status: 'success' | 'duplicate' | 'error';
    message: string;
    memberDetails?: string;
  }>>([]);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [isScanningActive, setIsScanningActive] = useState(false);
<<<<<<< HEAD
=======
  const [nfcBrowserState, setNfcBrowserState] = useState<'idle' | 'scanning' | 'error'>('idle');
>>>>>>> 32a6d8fbb3b92b999e7fbe01485aac778753e9a0
  const submitTimeoutRef = useRef<any>(null);

  const changeAttendanceMode = (mode: 'manual' | 'scan') => {
    setAttendanceMode(mode);
    setIsScanningActive(false);
  };

  // Handle browser tab switching (stop scanning if tab is hidden to prevent focus issues)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsScanningActive(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Cleanup pending submit timeout on unmount
  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
    };
  }, []);

  // Auto-focus barcode input and maintain robust standby listening mode (only when active)
  useEffect(() => {
    if (attendanceMode !== 'scan' || showInitialFilterModal || !isScanningActive) return;

    // Focus input on initial module activation
    const focusTimeout = setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 150);

    // Keep focusing on input when clicking somewhere on the page that is not an interactive input/select/button
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, select, input, textarea, a, [role="button"]')) {
        return;
      }
      barcodeInputRef.current?.focus();
    };

    // If typing arrives and no input is focused, focus the barcode input so scanning is passive
    const handleGlobalKeyDown = (e: any) => {
      // Ignore functional controls like Ctrl, Alt, Meta, Tab
      if (e.ctrlKey || e.altKey || e.metaKey || e.key === 'Tab') return;
      
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }
      barcodeInputRef.current?.focus();
    };

    // Fast backup interval to secure focus
    const interval = window.setInterval(() => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
        barcodeInputRef.current?.focus();
      }
    }, 1000);

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      clearTimeout(focusTimeout);
      window.clearInterval(interval);
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [attendanceMode, showInitialFilterModal, isScanningActive]);

  // Get members who are already recorded for the selected date & selected event
  const recordedMemberIds = useMemo(() => {
    const recordedSet = new Set<string>();
    if (!selectedDate) return recordedSet;
    
    logs.forEach(log => {
      if (!log.date) return;
      
      try {
        const logDateStr = String(log.date).trim();
        let logDatePart = "";
        
        if (logDateStr.includes('T') || logDateStr.includes('Z')) {
          const d = new Date(logDateStr);
          if (!isNaN(d.getTime())) {
             const year = d.getFullYear();
             const month = String(d.getMonth() + 1).padStart(2, '0');
             const day = String(d.getDate()).padStart(2, '0');
             logDatePart = `${year}-${month}-${day}`;
          }
        } else {
          logDatePart = logDateStr.split(' ')[0];
        }

        const targetEventId = selectedEventId || null;
        const logEventId = log.event_id || null;

        if (logDatePart === selectedDate && logEventId === targetEventId) {
          recordedSet.add(String(log.memberId).trim().toUpperCase());
        }
      } catch {
        // Ignore invalid dates
      }
    });

    return recordedSet;
  }, [logs, selectedDate, selectedEventId]);

  // Synchronize localScannedIds when recordedMemberIds updates
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    let hasChange = false;
    localScannedIds.forEach(id => {
      if (recordedMemberIds.has(id)) {
        hasChange = true;
      }
    });

    if (hasChange) {
      Promise.resolve().then(() => {
        setLocalScannedIds(prev => {
          const next = new Set(prev);
          prev.forEach(id => {
            if (recordedMemberIds.has(id)) {
              next.delete(id);
            }
          });
          return next;
        });
      });
    }
  }, [recordedMemberIds, localScannedIds]);

  const processBarcode = useCallback(async (rawInput: string) => {
    const cleanInput = rawInput.trim().toUpperCase();
    if (!cleanInput) return;

    const today = new Date();
    const currentDateStr = selectedDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const currentEventId = selectedEventId || null;
    const eventName = (events.find(evt => evt.id === selectedEventId)?.nama_kegiatan || 'KEGIATAN').toUpperCase();

    // Find member by ID or by RFID or by RFID KTP (eKTP NFC)
    const member = members.find(m => 
      String(m.id).trim().toUpperCase() === cleanInput ||
      (m.rfid && String(m.rfid).trim().toUpperCase() === cleanInput) ||
      (m.rfid_ktp && String(m.rfid_ktp).trim().toUpperCase() === cleanInput)
    );
    
    if (!member) {
      const errorMsg = `KARTU/ID "${cleanInput}" TIDAK TERDAFTAR!`;
      notify(errorMsg, "error");
      setRecentScans(prev => [
        {
          id: cleanInput,
          memberName: 'TIDAK DIKETAHUI',
          timestamp: new Date().toLocaleTimeString('id-ID'),
          status: 'error',
          message: errorMsg
        },
        ...prev
      ]);
      return;
    }

    const memberId = String(member.id).trim().toUpperCase();
    const isDuplicateInDB = recordedMemberIds.has(memberId);
    const isDuplicateLocally = localScannedIds.has(memberId);

    if (isDuplicateInDB || isDuplicateLocally) {
      const dupMsg = `Gagal: ${member.nama_lengkap} sudah melakukan presensi hari ini pada ${eventName}!`;
      notify(dupMsg, "error");
      setRecentScans(prev => [
        {
          id: memberId,
          memberName: member.nama_lengkap,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          status: 'duplicate',
          message: `${member.nama_lengkap} sudah absen pada ${eventName}`,
          memberDetails: `${member.desa_name} / ${member.kelompok_name}`
        },
        ...prev
      ]);
      return;
    }

    setLocalScannedIds(prev => {
      const next = new Set(prev);
      next.add(memberId);
      return next;
    });

    const isRfidScan = (member.rfid && String(member.rfid).trim().toUpperCase() === cleanInput) ||
                       (member.rfid_ktp && String(member.rfid_ktp).trim().toUpperCase() === cleanInput);
    const scanMethod = isRfidScan ? 'rfid' : 'scan';

    try {
      const generatedLogId = `LOG-${Date.now().toString(36).toUpperCase()}-${memberId.slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const newLog = {
        id: generatedLogId,
        memberId: member.id,
        memberName: member.nama_lengkap,
        ageCategoryId: member.age_category_id || '',
        ageName: member.age_category_name || '',
        kelompokId: member.kelompok_id || '',
        kelompokName: member.kelompok_name || '',
        desaId: member.desa_id || '',
        desaName: member.desa_name || '',
        daerahId: member.daerah_id || '',
        daerahName: member.daerah_name || '',
        gender: member.jenis_kelamin || 'Unknown',
        date: currentDateStr + ' ' + new Date().toTimeString().split(' ')[0],
        dateInput: new Date().toISOString(),
        status: 'Hadir',
        note: '',
        createdBy: username,
        event_id: currentEventId,
        metode: scanMethod
      };

      await dbAddAttendanceLogs([newLog as any]);
      
      const successMsg = `Berhasil: ${member.nama_lengkap} tercatat HADIR via ${scanMethod.toUpperCase()} pada ${eventName}!`;
      notify(successMsg, "success");
      
      setRecentScans(prev => [
        {
          id: memberId,
          memberName: member.nama_lengkap,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          status: 'success',
          message: `${member.nama_lengkap} berhasil masuk absensi (${scanMethod.toUpperCase()})`,
          memberDetails: `${member.desa_name} / ${member.kelompok_name}`
        },
        ...prev
      ]);

      onSuccess();
    } catch (err: any) {
      let cleanMsg = err.message || "Kesalahan database tidak dikenal";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && parsed.error) {
          cleanMsg = parsed.error;
        }
      } catch {
        // Not a JSON error
      }
      notify(`Gagal menyimpan scan: ${cleanMsg}`, "error");
      setLocalScannedIds(prev => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
  }, [
    selectedDate,
    selectedEventId,
    events,
    members,
    recordedMemberIds,
    localScannedIds,
    username,
    onSuccess,
    notify
  ]);

<<<<<<< HEAD
  useEffect(() => {
    const handleNfcRead = (e: Event) => {
      const customEvent = e as CustomEvent<{ uid: string }>;
      const uid = customEvent.detail?.uid;
      if (!uid) return;

      if (isScanningActive && attendanceMode === 'scan') {
        console.log("NFC Read triggered in AttendanceForm:", uid);
        processBarcode(uid);
      }
    };

    window.addEventListener('nfc-read', handleNfcRead);
    return () => {
      window.removeEventListener('nfc-read', handleNfcRead);
    };
  }, [isScanningActive, attendanceMode, processBarcode]);
=======
  // WebNFC Scanner hook for native phone scanning
  useEffect(() => {
    let ndefCtrl: AbortController | null = null;
    let isMounted = true;

    async function autoNfcScan() {
      if (!isScanningActive || nfcBrowserState !== 'scanning') return;
      if (typeof window === 'undefined' || !('NDEFReader' in window)) return;

      try {
        ndefCtrl = new AbortController();
        const reader = new (window as any).NDEFReader();
        await reader.scan({ signal: ndefCtrl.signal });
        
        reader.addEventListener("reading", ({ serialNumber }: any) => {
          if (!isMounted) return;
          if (serialNumber) {
            const formattedSerial = serialNumber.replace(/:/g, '').toUpperCase();
            processBarcode(formattedSerial);
          }
        });

        reader.addEventListener("readingerror", () => {
          if (!isMounted) return;
          notify("Gagal membaca kartu NFC. Coba lagi.", "error");
        });
      } catch (error) {
        console.error("Failed WebNFC background scan:", error);
        if (isMounted) {
          setNfcBrowserState('error');
          notify("Gagal mengaktifkan WebNFC. Izinkan akses NFC pada Chrome.", "error");
        }
      }
    }

    autoNfcScan();

    return () => {
      isMounted = false;
      if (ndefCtrl) {
        ndefCtrl.abort();
      }
    };
  }, [isScanningActive, nfcBrowserState, processBarcode, notify]);
>>>>>>> 32a6d8fbb3b92b999e7fbe01485aac778753e9a0

  const handleBarcodeScanSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }
    const rawInput = barcodeInput;
    setBarcodeInput('');
    await processBarcode(rawInput);
  }, [barcodeInput, processBarcode]);

  const handleBarcodeInputChange = useCallback((val: string) => {
    setBarcodeInput(val);
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }

    const clean = val.trim().toUpperCase();
    if (!clean) return;

    // 1. Direct match: if the barcode input matches any member's ID perfectly, process instantly
    const matched = members.some(m => String(m.id).trim().toUpperCase() === clean);
    if (matched) {
      setBarcodeInput('');
      processBarcode(clean);
      return;
    }

    // 2. Debounced auto-submit fallback: as soon as typing stops for 350ms (scanning complete), auto-submit
    submitTimeoutRef.current = setTimeout(() => {
      setBarcodeInput('');
      processBarcode(clean);
    }, 350);
  }, [members, processBarcode]);

  const allFiltersSelected = useMemo(() => {
    return filterKelompok !== '' && filterDesa !== '' && filterDaerah !== '' && filterAgeCategory !== '' && filterGender !== '' && selectedDate !== '' && selectedEventId !== '';
  }, [filterKelompok, filterDesa, filterDaerah, filterAgeCategory, filterGender, selectedDate, selectedEventId]);

  // Combined Search & Multi-Filter Filtering
  const { notRecordedMembers, recordedMembers } = useMemo(() => {
    if (!filterKelompok || !filterDesa || !filterDaerah || !filterAgeCategory || !filterGender || !selectedDate || !selectedEventId) {
      return { notRecordedMembers: [], recordedMembers: [] };
    }

    const rawFiltered = members.filter(m => {
      const matchSearch = (m.nama_lengkap || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchKelompok = filterKelompok === 'ALL' || String(m.kelompok_id) === String(filterKelompok);
      const matchDesa = filterDesa === 'ALL' || String(m.desa_id) === String(filterDesa);
      const matchDaerah = filterDaerah === 'ALL' || String(m.daerah_id) === String(filterDaerah);
      const matchAge = filterAgeCategory === 'ALL' || String(m.age_category_id) === String(filterAgeCategory);
      const matchGender = filterGender === 'ALL' || (m.jenis_kelamin && m.jenis_kelamin.toLowerCase() === filterGender.toLowerCase());
      
      return matchSearch && matchKelompok && matchDesa && matchDaerah && matchAge && matchGender;
    });

    return {
      notRecordedMembers: rawFiltered.filter(m => {
        const id = String(m.id).trim().toUpperCase();
        return !recordedMemberIds.has(id);
      }),
      recordedMembers: rawFiltered.filter(m => {
        const id = String(m.id).trim().toUpperCase();
        return recordedMemberIds.has(id);
      })
    };
  }, [members, searchTerm, filterKelompok, filterDesa, filterDaerah, filterAgeCategory, filterGender, recordedMemberIds, selectedDate, selectedEventId]);

  // Dynamic Options pulled from live Members list
  const uniqueKelompoks = useMemo(() => {
    const map = new Map();
    members.forEach(m => { if (m.kelompok_id && m.kelompok_name) map.set(m.kelompok_id, m.kelompok_name); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [members]);

  const uniqueDesas = useMemo(() => {
    const map = new Map();
    members.forEach(m => { if (m.desa_id && m.desa_name) map.set(m.desa_id, m.desa_name); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [members]);

  const uniqueDaerahs = useMemo(() => {
    const map = new Map();
    members.forEach(m => { if (m.daerah_id && m.daerah_name) map.set(m.daerah_id, m.daerah_name); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [members]);

  const uniqueAgeCategories = useMemo(() => {
    const map = new Map();
    members.forEach(m => { if (m.age_category_id && m.age_category_name) map.set(m.age_category_id, m.age_category_name); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [members]);

  const kelompokOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'SEMUA KELOMPOK' },
      ...uniqueKelompoks.map(([id, name]) => ({ value: String(id), label: name.toUpperCase() }))
    ];
  }, [uniqueKelompoks]);

  const desaOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'SEMUA UNIT DESA' },
      ...uniqueDesas.map(([id, name]) => ({ value: String(id), label: name.toUpperCase() }))
    ];
  }, [uniqueDesas]);

  const daerahOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'SEMUA DAERAH' },
      ...uniqueDaerahs.map(([id, name]) => ({ value: String(id), label: name.toUpperCase() }))
    ];
  }, [uniqueDaerahs]);

  const ageOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'SEMUA KATEGORI USIA' },
      ...uniqueAgeCategories.map(([id, name]) => ({ value: String(id), label: name.toUpperCase() }))
    ];
  }, [uniqueAgeCategories]);

  const genderOptions = useMemo(() => [
    { value: 'ALL', label: 'SEMUA GENDER' },
    { value: 'Laki-laki', label: '♂ LAKI-LAKI' },
    { value: 'Perempuan', label: '♀ PEREMPUAN' }
  ], []);

  const eventOptions = useMemo(() => {
    return events.map(evt => ({ value: evt.id, label: evt.nama_kegiatan.toUpperCase() }));
  }, [events]);

  const setStatus = (memberId: string, status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa') => {
    setBatchStatuses(prev => ({
      ...prev,
      [memberId]: prev[memberId] === status ? '' : status
    }));
    // Clear note if status is cleared or changed to Hadir/Alpa
    if (status === 'Hadir' || status === 'Alpa' || batchStatuses[memberId] === status) {
      setBatchNotes(prev => {
        const next = { ...prev };
        delete next[memberId];
        return next;
      });
    }
  };

  const setAllStatus = (status: 'Hadir' | 'Alpa') => {
    const newStatuses = { ...batchStatuses };
    notRecordedMembers.forEach(m => {
      newStatuses[m.id] = status;
    });
    setBatchStatuses(newStatuses);
  };

  const clearBatch = () => {
    setBatchStatuses({});
    setBatchNotes({});
  };

  const submitBatchAttendance = async () => {
    const selectedMembers = notRecordedMembers.filter(m => batchStatuses[m.id]);
    
    if (selectedMembers.length === 0) {
      notify("Pilih minimal satu anggota untuk diabsen", "error");
      return;
    }

    // Validation for Izin/Sakit notes
    for (const m of selectedMembers) {
      const status = batchStatuses[m.id];
      if ((status === 'Sakit' || status === 'Izin') && !batchNotes[m.id]?.trim()) {
        notify(`Keterangan wajib diisi untuk ${m.nama_lengkap} (${status})`, "error");
        
        // Trigger shaking animation on the name
        setShakingMemberId(m.id);
        setTimeout(() => {
          setShakingMemberId(null);
        }, 700);

        // Smooth scroll to the specific row & focus the explanation input
        setTimeout(() => {
          const rowEl = document.getElementById(`member-row-${m.id}`);
          if (rowEl) {
            rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Focus the input inside this row
            const inputEl = rowEl.querySelector('input');
            if (inputEl) {
              (inputEl as HTMLInputElement).focus();
            }
          }
        }, 80);

        return;
      }
    }

    setIsSubmitting(true);
    try {
      const logsToSubmit: AttendanceLog[] = selectedMembers.map(m => {
        const memberSuffix = m.id.slice(-4);
        const generatedId = `LOG-${Date.now().toString(36).toUpperCase()}-${memberSuffix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        return {
          id: generatedId,
          memberId: m.id,
          memberName: m.nama_lengkap,
          ageCategoryId: m.age_category_id || '',
          ageName: m.age_category_name || '',
          kelompokId: m.kelompok_id || '',
          kelompokName: m.kelompok_name || '',
          desaId: m.desa_id || '',
          desaName: m.desa_name || '',
          daerahId: m.daerah_id || '',
          daerahName: m.daerah_name || '',
          gender: m.jenis_kelamin || 'Unknown',
          date: selectedDate + ' ' + new Date().toTimeString().split(' ')[0], 
          dateInput: new Date().toISOString(),
          status: batchStatuses[m.id],
          note: batchNotes[m.id] || '',
          createdBy: username,
          event_id: selectedEventId || null,
          metode: 'manual'
        } as any;
      });

      await dbAddAttendanceLogs(logsToSubmit);

      notify(`Berhasil mengirim ${logsToSubmit.length} data absensi`, "success");
      setBatchStatuses({});
      setBatchNotes({});
      onSuccess();
    } catch (e: any) {
      let cleanMsg = e.message || "Kesalahan database tidak dikenal";
      try {
        const parsed = JSON.parse(e.message);
        if (parsed && parsed.error) {
          cleanMsg = parsed.error;
        }
      } catch {
        // Not a JSON error
      }
      notify("Gagal simpan absensi: " + cleanMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = useMemo(() => {
    const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0, Total: 0 };
    notRecordedMembers.forEach(m => {
      const s = batchStatuses[m.id];
      if (s === 'Hadir') counts.Hadir++;
      else if (s === 'Izin') counts.Izin++;
      else if (s === 'Sakit') counts.Sakit++;
      else if (s === 'Alpa') counts.Alpa++;
      if (s) counts.Total++;
    });
    return counts;
  }, [notRecordedMembers, batchStatuses]);

  const progressPercentage = notRecordedMembers.length > 0 
    ? (stats.Total / notRecordedMembers.length) * 100 
    : 100;

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar bg-[#F8FAFC]">
      {/* INITIAL FILTER POPUP MODAL */}
      <AnimatePresence>
        {showInitialFilterModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            
            {/* Modal Body */}
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col space-y-4 overflow-visible"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-md shadow-blue-200 shrink-0">
                    <SlidersHorizontal size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-805 uppercase tracking-wider leading-none">Filter Absensi</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-1">Konfigurasi Parameter & Mode</p>
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <motion.div layout className="space-y-3.5 overflow-visible">
                {/* Mode Absensi Toggle Switch */}
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider leading-none">Pilih Mode Absensi *</span>
                  <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200/55 shadow-xs select-none">
                    <button
                      type="button"
                      onClick={() => changeAttendanceMode('manual')}
                      className={`py-2 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        attendanceMode === 'manual'
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <UserCheck size={12} />
                      <span>Checklist Manual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => changeAttendanceMode('scan')}
                      className={`py-2 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        attendanceMode === 'scan'
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <svg className="size-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 5H5V19H3V5Z" fill="currentColor"/>
                        <path d="M7 5H8V19H7V5Z" fill="currentColor"/>
                        <path d="M11 5H13V19H11V5Z" fill="currentColor"/>
                        <path d="M16 5H17V19H16V5Z" fill="currentColor"/>
                        <path d="M20 5H21V19H20V5Z" fill="currentColor"/>
                      </svg>
                      <span>Scan Barcode</span>
                    </button>
                  </div>
                </div>

                {/* 1. Date */}
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider leading-none">Tanggal Sesi *</span>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-blue-600" />
                    <input 
                      required
                      type="date" 
                      value={selectedDate}
                      onChange={(e) => { setSelectedDate(e.target.value); clearBatch(); }}
                      className="w-full pl-10 pr-3 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-[10px] sm:text-xs font-black uppercase outline-none transition-all cursor-pointer focus:border-blue-500 text-slate-705"
                    />
                  </div>
                </div>

                {/* 1b. Kegiatan/Event Name */}
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider leading-none">Kegiatan (Acara) *</span>
                  <ModernSelect 
                    value={selectedEventId}
                    onChange={(val) => { setSelectedEventId(val); }}
                    options={eventOptions}
                    icon={Calendar}
                    placeholder="PILIH NAMA KEGIATAN"
                    onAddNew={handleAddNewEvent}
                  />
                </div>

                {/* Only Show Filter Criteria for Manual Checklist Mode */}
                <AnimatePresence initial={false}>
                  {attendanceMode === 'manual' && (
                    <motion.div
                      key="manual-filters"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      className="space-y-3.5 overflow-hidden"
                    >
                      {/* Daerah & Unit Desa */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1 min-w-0">
                          <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider leading-none">Daerah</span>
                          <ModernSelect 
                            value={filterDaerah}
                            onChange={(val) => { setFilterDaerah(val); clearBatch(); }}
                            options={daerahOptions}
                            icon={MapPin}
                            placeholder="PILIH DAERAH"
                          />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider leading-none">Unit Desa</span>
                          <ModernSelect 
                            value={filterDesa}
                            onChange={(val) => { setFilterDesa(val); clearBatch(); }}
                            options={desaOptions}
                            icon={MapPin}
                            placeholder="PILIH DESA"
                          />
                        </div>
                      </div>

                      {/* Kelompok & Kategori Usia */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1 min-w-0">
                          <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider leading-none">Kelompok</span>
                          <ModernSelect 
                            value={filterKelompok}
                            onChange={(val) => { setFilterKelompok(val); clearBatch(); }}
                            options={kelompokOptions}
                            icon={Users}
                            placeholder="PILIH KELOMPOK"
                          />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider leading-none">Kategori Usia</span>
                          <ModernSelect 
                            value={filterAgeCategory}
                            onChange={(val) => { setFilterAgeCategory(val); clearBatch(); }}
                            options={ageOptions}
                            icon={Baby}
                            placeholder="PILIH USIA"
                          />
                        </div>
                      </div>

                      {/* Gender Toggle Buttons */}
                      <div className="space-y-1.5">
                        <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider leading-none">Gender</span>
                        <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl border border-slate-200/55 shadow-xs select-none">
                          <button
                            type="button"
                            onClick={() => { setFilterGender('ALL'); clearBatch(); }}
                            className={`py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                              filterGender === 'ALL'
                                ? 'bg-white text-blue-600 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <span>Semua</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setFilterGender('Laki-laki'); clearBatch(); }}
                            className={`py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                              filterGender === 'Laki-laki'
                                ? 'bg-white text-blue-600 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <span>Laki-laki</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setFilterGender('Perempuan'); clearBatch(); }}
                            className={`py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                              filterGender === 'Perempuan'
                                ? 'bg-white text-blue-600 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <span>Perempuan</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Actions Footer */}
              <div className="pt-2">
                {(() => {
                  const isMissingManualFilters = attendanceMode === 'manual' && (!filterKelompok || !filterDesa || !filterDaerah || !filterAgeCategory || !filterGender || !selectedDate || !selectedEventId);
                  const isMissingScanFilters = attendanceMode === 'scan' && (!selectedDate || !selectedEventId);
                  const isBtnDisabled = isMissingManualFilters || isMissingScanFilters;

                  return (
                    <button 
                      disabled={isBtnDisabled}
                      onClick={() => setShowInitialFilterModal(false)}
                      className={`w-full py-3 font-black text-xs uppercase tracking-widest text-white rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 duration-200 ${
                        isBtnDisabled
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                          : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20'
                      }`}
                    >
                      <CheckCircle2 size={14} />
                      <span>{isBtnDisabled ? 'Lengkapi Semua Filter' : 'Terapkan Filter'}</span>
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes custom-shake {
          0%, 100% { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-4px); }
          30%, 60%, 90% { transform: translateX(4px); }
        }
        .animate-custom-shake {
          animation: custom-shake 0.5s ease-in-out;
        }
      `}</style>
      <div className="max-w-6xl mx-auto px-2 py-3 md:px-8 md:py-6 pb-24 space-y-2 md:space-y-4">
        
        {/* TOP SECTION: Ultra Compact Header with Live Date selection */}
        <div className="sticky top-0 z-30 bg-[#F8FAFC] pb-1.5 md:pb-3">
          <div className="flex flex-row items-center justify-between bg-white p-2 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm gap-2">
            <div className="flex items-center gap-1.5 md:gap-2.5">
              <div className="bg-blue-600 p-1 md:p-1.5 rounded-lg text-white shadow-md shadow-blue-200 shrink-0">
                <UserCheck size={14} className="md:w-[18px] md:h-[18px]" />
              </div>
              <div>
                <h1 className="text-xs md:text-base font-black text-slate-900 uppercase tracking-tight leading-none">Absensi Kelas</h1>
                <span className="text-[7px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5 md:mt-1">Sesi Kehadiran</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="relative">
                <Calendar className={`absolute left-2.5 top-1/2 -translate-y-1/2 size-2.5 md:size-3 ${!selectedDate ? 'text-amber-500 animate-pulse' : 'text-blue-600'}`} />
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); clearBatch(); }}
                  className={`pl-7 pr-1.5 py-1 md:pl-8 md:pr-2.5 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-extrabold uppercase outline-none transition-all cursor-pointer
                    ${!selectedDate 
                      ? 'bg-amber-50/50 border border-amber-300 text-amber-600 focus:ring-amber-500/10 focus:border-amber-500 animate-pulse' 
                      : 'bg-slate-50 border border-slate-200 text-slate-700 focus:ring-blue-500/10 focus:border-blue-500'}`}
                />
              </div>
              <button 
                onClick={() => setShowInitialFilterModal(true)}
                className="p-1 md:p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95 text-[10px] font-black flex items-center gap-1 shrink-0"
                title="Sesuaikan Filter"
              >
                <SlidersHorizontal className="size-3 text-slate-500" />
                <span className="hidden sm:inline uppercase tracking-wider text-[8px]">Filter</span>
              </button>
              <button 
                onClick={() => onSuccess()}
                disabled={isSubmitting}
                className="p-1 md:p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95 disabled:opacity-50"
                title="Refresh Data"
              >
                <RefreshCw className={`${isSubmitting ? "animate-spin" : ""} md:w-[14px] md:h-[14px]`} size={11} />
              </button>
            </div>
          </div>
        </div>
        {/* Toggle Mode Tab */}
        <div className="grid grid-cols-2 bg-slate-100 p-1 md:p-1.5 rounded-xl md:rounded-2xl border border-slate-200/55 shadow-xs shrink-0 select-none">
          <button
            type="button"
            onClick={() => changeAttendanceMode('manual')}
            className={`py-2 px-4 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              attendanceMode === 'manual'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck size={14} />
            <span>Checklist Manual</span>
          </button>
          <button
            type="button"
            onClick={() => changeAttendanceMode('scan')}
            className={`py-2 px-4 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              attendanceMode === 'scan'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg className="size-3.5 md:size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 5H5V19H3V5Z" fill="currentColor"/>
              <path d="M7 5H8V19H7V5Z" fill="currentColor"/>
              <path d="M11 5H13V19H11V5Z" fill="currentColor"/>
              <path d="M16 5H17V19H16V5Z" fill="currentColor"/>
              <path d="M20 5H21V19H20V5Z" fill="currentColor"/>
            </svg>
            <span>Scan Barcode (Code 128)</span>
          </button>
        </div>

        {attendanceMode === 'manual' ? (
          <>
            {/* COMPACT MULTI-FILTER PANEL */}
            <div className="bg-white p-2 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm space-y-2 md:space-y-3">
              <div className="flex flex-col md:flex-row gap-2 md:gap-3 items-center">
                
                {/* SEARCH ELEMENT */}
                <div className="relative flex-1 w-full group">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 size-3 md:size-3.5" />
                  <input 
                    type="text" 
                    placeholder="Cari nama..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1 md:pl-9 md:pr-3 md:py-1.5 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-bold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                {/* DESKTOP PERMANENT INLINE FILTERS */}
                <div className="hidden md:flex flex-wrap items-center gap-2">
                  <div className="w-[140px]">
                    <ModernSelect 
                      value={filterDaerah}
                      onChange={(val) => { setFilterDaerah(val); clearBatch(); }}
                      options={daerahOptions}
                      icon={MapPin}
                      placeholder="PILIH DAERAH"
                    />
                  </div>

                  <div className="w-[140px]">
                    <ModernSelect 
                      value={filterDesa}
                      onChange={(val) => { setFilterDesa(val); clearBatch(); }}
                      options={desaOptions}
                      icon={MapPin}
                      placeholder="PILIH UNIT DESA"
                    />
                  </div>

                  <div className="w-[140px]">
                    <ModernSelect 
                      value={filterKelompok}
                      onChange={(val) => { setFilterKelompok(val); clearBatch(); }}
                      options={kelompokOptions}
                      icon={Users}
                      placeholder="PILIH KELOMPOK"
                    />
                  </div>

                  <div className="w-[140px]">
                    <ModernSelect 
                      value={filterAgeCategory}
                      onChange={(val) => { setFilterAgeCategory(val); clearBatch(); }}
                      options={ageOptions}
                      icon={Baby}
                      placeholder="PILIH USIA"
                    />
                  </div>

                  <div className="w-[130px]">
                    <ModernSelect 
                      value={filterGender}
                      onChange={(val) => { setFilterGender(val); clearBatch(); }}
                      options={genderOptions}
                      icon={User}
                      placeholder="PILIH GENDER"
                    />
                  </div>
                </div>
              </div>

              {/* MOBILE FILTERS (ALWAYS VISIBLE & HIGH-DENSITY GRID) */}
              <div className="md:hidden grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-50">
                <div className="col-span-1">
                  <span className="text-[7px] font-black uppercase text-slate-400 block mb-0.5 leading-none">Daerah</span>
                  <ModernSelect 
                    value={filterDaerah}
                    onChange={(val) => { setFilterDaerah(val); clearBatch(); }}
                    options={daerahOptions}
                    icon={MapPin}
                    placeholder="PILIH DAERAH"
                  />
                </div>
                <div className="col-span-1">
                  <span className="text-[7px] font-black uppercase text-slate-400 block mb-0.5 leading-none">Unit Desa</span>
                  <ModernSelect 
                    value={filterDesa}
                    onChange={(val) => { setFilterDesa(val); clearBatch(); }}
                    options={desaOptions}
                    icon={MapPin}
                    placeholder="PILIH DESA"
                  />
                </div>
                <div className="col-span-1">
                  <span className="text-[7px] font-black uppercase text-slate-400 block mb-0.5 leading-none">Kelompok</span>
                  <ModernSelect 
                    value={filterKelompok}
                    onChange={(val) => { setFilterKelompok(val); clearBatch(); }}
                    options={kelompokOptions}
                    icon={Users}
                    placeholder="PILIH KELOMPOK"
                  />
                </div>
                <div className="col-span-1">
                  <span className="text-[7px] font-black uppercase text-slate-400 block mb-0.5 leading-none">Kategori Usia</span>
                  <ModernSelect 
                    value={filterAgeCategory}
                    onChange={(val) => { setFilterAgeCategory(val); clearBatch(); }}
                    options={ageOptions}
                    icon={Baby}
                    placeholder="PILIH USIA"
                  />
                </div>
                <div className="col-span-2 mt-1">
                  <span className="text-[7px] font-black uppercase text-slate-400 block mb-1 leading-none">Gender</span>
                  <div className="grid grid-cols-3 bg-slate-100 p-0.5 rounded-lg border border-slate-200/50 shadow-xs select-none">
                    <button
                      type="button"
                      onClick={() => { setFilterGender('ALL'); clearBatch(); }}
                      className={`py-1.5 px-2 rounded-md text-[8px] font-black uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer ${
                        filterGender === 'ALL'
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>Semua</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFilterGender('Laki-laki'); clearBatch(); }}
                      className={`py-1.5 px-2 rounded-md text-[8px] font-black uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer ${
                        filterGender === 'Laki-laki'
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>Laki-laki</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFilterGender('Perempuan'); clearBatch(); }}
                      className={`py-1.5 px-2 rounded-md text-[8px] font-black uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer ${
                        filterGender === 'Perempuan'
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>Perempuan</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* INLINE ULTRA-COMPACT CONTROL CENTER (Low vertical height footprint) */}
            {notRecordedMembers.length > 0 && (
              <div className="sticky top-[48px] md:top-[76px] z-20 bg-[#F8FAFC] py-1 md:py-2 select-none">
                <div className="bg-slate-900 px-3 py-2 md:px-4 md:py-3 rounded-xl md:rounded-2xl shadow-sm text-white border border-slate-800">
                  <div className="flex flex-row items-center justify-between gap-2 md:gap-4">
                    
                    {/* Left Side: Stats and Small progress line */}
                    <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-lg shrink-0">
                        <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-[#94A3B8]">Antrean:</span>
                        <span className="text-[10px] md:text-[11px] font-black text-blue-400">{notRecordedMembers.length}</span>
                      </div>

                      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                        <div className="flex items-center gap-1">
                          <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-emerald-500"></div>
                          <span className="text-[8px] md:text-[9px] font-bold text-slate-400">H: {stats.Hadir}</span>
                        </div>
                        <div className="flex items-center gap-1 pl-1.5 border-l border-white/10">
                          <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-blue-400"></div>
                          <span className="text-[8px] md:text-[9px] font-bold text-slate-400">I+S: {stats.Izin + stats.Sakit}</span>
                        </div>
                        <div className="flex items-center gap-1 pl-1.5 border-l border-white/10">
                          <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-rose-500"></div>
                          <span className="text-[8px] md:text-[9px] font-bold text-slate-400">A: {stats.Alpa}</span>
                        </div>
                      </div>

                      {/* Progress Mini Line */}
                      <div className="flex-1 min-w-[80px] hidden sm:flex items-center gap-2">
                        <div className="h-1 bg-slate-800 rounded-full flex-1 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercentage}%` }}
                            className="h-full bg-blue-500 shadow-sm"
                          />
                        </div>
                        <span className="text-[8px] md:text-[9px] font-black text-slate-500">{stats.Total}/{notRecordedMembers.length}</span>
                      </div>
                    </div>

                    {/* Right Side: Fast Actions (Trigger set all & Reset status) */}
                    <div className="flex items-center gap-1 md:gap-2 shrink-0">
                      <button 
                        type="button"
                        onClick={() => setAllStatus('Hadir')}
                        className="px-2 md:px-3 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-extrabold uppercase tracking-wider transition-all"
                      >
                        Semua Hadir
                      </button>
                      <button 
                        type="button"
                        onClick={clearBatch}
                        className="px-1.5 md:px-2.5 py-1 bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 border border-white/10 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-extrabold uppercase tracking-wider transition-all text-slate-300"
                        title="Reset Sesi"
                      >
                        Reset
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* THE TABLE-STYLE COMPACT MEMBER QUEUE LIST */}
            <div className="space-y-2">
              
              {/* List Header */}
              <div className="flex items-center justify-between px-2 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-slate-800 rounded-full"></div>
                  <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Daftar Anggota Belum Diabsen</h3>
                </div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{notRecordedMembers.length} Personel</span>
              </div>

              {/* Compact Member Rows */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100/80">
                {notRecordedMembers.map((member) => {
                  const currentStatus = batchStatuses[member.id];
                  const isSelected = !!currentStatus;
                  
                  return (
                    <div 
                      key={member.id} 
                      id={`member-row-${member.id}`}
                      className={`p-1.5 px-2.5 md:p-2.5 md:px-4 transition-all duration-200 flex flex-col gap-1 
                        ${isSelected ? 'bg-blue-50/20' : 'hover:bg-slate-50/50'}`}
                    >
                      <div className="flex flex-row items-center justify-between gap-1.5 sm:gap-4">
                        
                        {/* Left details side (Name + Metadata badges) */}
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                          
                          {/* Short Gender ID Indicator Indicator Circle */}
                          <div className={`w-4 h-4 sm:w-6 sm:h-6 shrink-0 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-black uppercase
                            ${member.jenis_kelamin?.toLowerCase() === 'laki-laki' 
                              ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                              : 'bg-rose-50 text-rose-500 border border-rose-100'}`}
                            title={member.jenis_kelamin || 'Gender'}
                          >
                            {member.jenis_kelamin?.toLowerCase() === 'laki-laki' ? '♂' : '♀'}
                          </div>

                          {/* Name & Quick Metadata Badges */}
                          <div className="min-w-0 pr-1 flex-1">
                            <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 gap-y-0.5">
                              <h4 className={`text-[10px] sm:text-xs font-black uppercase tracking-tight truncate leading-none max-w-[110px] xs:max-w-[140px] sm:max-w-none transition-all duration-300
                                ${shakingMemberId === member.id ? 'animate-custom-shake text-rose-500 scale-102 font-black' : 'text-slate-800'}`}>
                                {member.nama_lengkap}
                              </h4>
                              
                              {/* Unit / Group badges inline for absolute maximum high-density space saving */}
                              <span className="hidden sm:inline-block text-[8px] font-extrabold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase">
                                {member.kelompok_name}
                              </span>
                              <span className="hidden sm:inline-block text-[8px] font-extrabold px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded uppercase">
                                {member.age_category_name || 'UMUM'}
                              </span>
                            </div>

                            {/* Mobile Metadata representation under name */}
                            <div className="flex sm:hidden items-center gap-1 mt-0.5 text-[7.5px] leading-none">
                              <span className="font-bold text-slate-400 uppercase truncate max-w-[45px]">
                                {member.kelompok_name}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-bold text-slate-400 uppercase truncate max-w-[45px]">
                                {member.age_category_name || 'UMUM'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right side: High Tac-tile compact Button Group beside the name */}
                        <div className="grid grid-cols-4 gap-0.5 w-[92px] sm:flex sm:items-center sm:gap-1.5 sm:w-auto shrink-0">
                          {[
                            { key: 'Hadir', disp: 'H', label: 'Hadir', col: 'emerald' },
                            { key: 'Izin', disp: 'I', label: 'Izin', col: 'blue' },
                            { key: 'Sakit', disp: 'S', label: 'Sakit', col: 'amber' },
                            { key: 'Alpa', disp: 'A', label: 'Alpa', col: 'rose' }
                          ].map((item) => {
                            const isBtnActive = currentStatus === item.key;
                            
                            return (
                              <button
                                type="button"
                                key={item.key}
                                onClick={() => setStatus(member.id, item.key as any)}
                                className={`h-[25px] sm:w-11 sm:h-7 rounded-md sm:rounded-lg text-[8px] sm:text-[9px] font-black uppercase transition-all duration-150 relative border flex items-center justify-center
                                  ${isBtnActive 
                                    ? (item.key === 'Hadir' ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs' :
                                       item.key === 'Izin' ? 'bg-blue-600 border-blue-600 text-white shadow-xs' :
                                       item.key === 'Sakit' ? 'bg-amber-500 border-amber-500 text-white shadow-xs' :
                                       'bg-rose-500 border-rose-500 text-white shadow-xs') 
                                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-100/60'}`}
                                title={item.label}
                              >
                                <span className="hidden sm:inline">{item.label}</span>
                                <span className="inline sm:hidden">{item.disp}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Inline Reason Input for Izin/Sakit (unfolds gracefully right beneath the row) */}
                      <AnimatePresence>
                        {(currentStatus === 'Sakit' || currentStatus === 'Izin') && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden bg-blue-50/30 p-1.5 rounded-lg border border-dashed border-blue-100 mt-1"
                          >
                            <div className="flex items-center gap-2">
                              <Info className="text-blue-500 shrink-0" size={11} />
                              <input 
                                type="text"
                                placeholder={`Mohon isi alasan / keterangan ${currentStatus.toUpperCase()} disini...`}
                                value={batchNotes[member.id] || ''}
                                onChange={(e) => setBatchNotes(prev => ({ ...prev, [member.id]: e.target.value }))}
                                className="w-full bg-transparent text-[10px] font-bold text-slate-700 placeholder:text-blue-300 outline-none uppercase"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  );
                })}

                {/* Empty queue representation */}
                {notRecordedMembers.length === 0 && (
                  <div className="bg-white p-10 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
                     {!allFiltersSelected ? (
                       <>
                         <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 shadow-xs border border-blue-100">
                            <SlidersHorizontal size={22} className="text-blue-500 animate-pulse" />
                         </div>
                         <div className="space-y-1">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">Pilih Tanggal & Semua Filter</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest max-w-[340px] leading-relaxed">
                              Silakan pilih Tanggal Absensi, Kelompok, Unit Desa, Kategori Usia, dan Gender terlebih dahulu untuk menampilkan daftar personel yang akan diabsen.
                            </p>
                         </div>
                       </>
                     ) : (
                       <>
                         <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 shadow-xs border border-emerald-100">
                            <CheckCircle2 size={24} />
                         </div>
                         <div className="space-y-1">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">Antrean Absensi Kosong</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest max-w-[280px]">
                              Seluruh Anggota berdasarkan filter yang terpilih telah terarsip kehadirannya hari ini.
                            </p>
                         </div>
                       </>
                     )}
                  </div>
                )}

              </div>

            </div>

            {/* SUBMIT BUTTON BETWEEN QUEUE LIST AND HISTORIC LIST */}
            {notRecordedMembers.length > 0 && (
              <div className="flex justify-end pt-1 md:pt-2">
                <button 
                  type="button"
                  onClick={submitBatchAttendance}
                  disabled={isSubmitting || stats.Total === 0}
                  className="w-full sm:w-auto px-6 py-2.5 md:py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-35 disabled:cursor-not-allowed rounded-xl flex items-center justify-center gap-2 transition-all text-white font-black text-[10px] md:text-xs uppercase tracking-widest shadow-md shadow-blue-500/20 active:scale-98"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin text-white" size={14} />
                  ) : (
                    <>
                      <Send size={12} className="shrink-0" />
                      <span>Kirim Data Absensi ({stats.Total} Orang)</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* COMPACT RECORDED HISTORY FOOTER (Shows who has already been submitted today) */}
            {recordedMembers.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200/50"></div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">Anggota Sudah Diabsen ({recordedMembers.length})</span>
                  <div className="h-px flex-1 bg-slate-200/50"></div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {recordedMembers.map((member) => (
                    <div key={member.id} className="bg-slate-50/60 px-2.5 py-1.5 rounded-xl border border-slate-100/80 flex items-center justify-between group transition-all">
                      <div className="flex items-center gap-2 min-w-0 pr-1">
                         <div className="bg-emerald-100 text-emerald-600 p-0.5 rounded-md shrink-0">
                           <Check size={9} strokeWidth={4} />
                         </div>
                         <span className="text-[10px] font-black text-slate-500 uppercase truncate leading-none">
                           {member.nama_lengkap}
                         </span>
                      </div>
                      <span className="text-[7px] font-extrabold text-slate-300 bg-slate-100 px-1 py-0.5 rounded uppercase shrink-0">OK</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* SCANNING CONTROLLER PANEL (Left column) */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Event & Date Context Card */}
              <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="text-blue-500 size-4" />
                  <h3 className="text-[10px] font-black uppercase text-slate-850 tracking-wider">Parameter Scan</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Kegiatan Sesi</span>
                    <ModernSelect 
                      value={selectedEventId}
                      onChange={(val) => { setSelectedEventId(val); }}
                      options={eventOptions}
                      icon={Calendar}
                      placeholder="PILIH KEGIATAN"
                      onAddNew={handleAddNewEvent}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Tanggal Sesi</span>
                    <input 
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] sm:text-xs font-black uppercase outline-none transition-all cursor-pointer focus:border-blue-500 text-slate-705"
                    />
                  </div>
                </div>
              </div>

              {/* Pemindai Input Form */}
              {isScanningActive ? (
                <div 
                  onClick={() => barcodeInputRef.current?.focus()}
                  className="bg-slate-900 text-white p-6 rounded-3xl border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)] flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[260px] cursor-pointer group transition-all"
                >
                  {/* CSS Scanner Laser Animation */}
                  <style>{`
                    @keyframes scanSweep {
                      0% { top: 10%; }
                      50% { top: 90%; }
                      100% { top: 10%; }
                    }
                    .laser-sweep {
                      animation: scanSweep 2s infinite linear;
                    }
                  `}</style>
                  
                  {/* Simulated laser line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_#10b981] opacity-75 laser-sweep pointer-events-none z-10" />

                  {/* Corner brackets simulating camera focus viewport */}
                  <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-emerald-400 pointer-events-none" />
                  <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-emerald-400 pointer-events-none" />
                  <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-emerald-400 pointer-events-none" />
                  <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-emerald-400 pointer-events-none" />

                  {/* Animated scanner icon or wave */}
                  <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center animate-pulse border border-emerald-500/20 mb-2 relative">
                    <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-75"></span>
                    <svg className="size-6 text-emerald-400 relative" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 5H5V19H3V5Z" fill="currentColor"/>
                      <path d="M7 5H8V19H7V5Z" fill="currentColor"/>
                      <path d="M11 5H13V19H11V5Z" fill="currentColor"/>
                      <path d="M16 5H17V19H16V5Z" fill="currentColor"/>
                      <path d="M20 5H21V19H20V5Z" fill="currentColor"/>
                    </svg>
                  </div>

                  <div className="space-y-1 z-20">
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">Sensor Standby Aktif</h3>
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tight max-w-[280px] leading-relaxed">
                      Sandingkan barcode atau tempelkan kartu RFID/NFC kapan saja. Nama anggota dan kehadiran akan otomatis langsung terdata.
                    </p>
                  </div>

<<<<<<< HEAD
=======
                  {/* Browser Native NFC Button for Phones */}
                  {typeof window !== 'undefined' && 'NDEFReader' in window && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (nfcBrowserState === 'scanning') {
                          setNfcBrowserState('idle');
                        } else {
                          setNfcBrowserState('scanning');
                        }
                      }}
                      className={`mt-4 z-30 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 border shadow-md ${
                        nfcBrowserState === 'scanning'
                          ? 'bg-violet-600 border-violet-500 text-white animate-pulse'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${nfcBrowserState === 'scanning' ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'}`}></span>
                      {nfcBrowserState === 'scanning' ? 'NFC HP Aktif: Dekatkan Kartu' : '📱 Aktifkan NFC HP (Browser)'}
                    </button>
                  )}

>>>>>>> 32a6d8fbb3b92b999e7fbe01485aac778753e9a0
                  {/* Silent input in background to catch scans */}
                  <form onSubmit={handleBarcodeScanSubmit} className="absolute left-[-9999px] opacity-0 pointer-events-none" onClick={(e) => e.stopPropagation()}>
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => handleBarcodeInputChange(e.target.value)}
                      autoComplete="off"
                    />
                    <button type="submit" className="hidden">Submit</button>
                  </form>

                  <div className="pt-2 z-20">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsScanningActive(false);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0"></span>
                      <span>Stop Pemindaian</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200 shadow-xs flex flex-col items-center justify-center text-center space-y-4 min-h-[260px] transition-all"
                >
                  <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center border border-slate-200">
                    <svg className="size-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                      <line x1="9" x2="15" y1="9" y2="15"/>
                      <line x1="15" x2="9" y1="9" y2="15"/>
                    </svg>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Sensor Pemindai Nonaktif</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight max-w-[285px] leading-relaxed">
                      Latar belakang siaga dinonaktifkan. Silakan klik tombol di bawah untuk mengaktifkan sensor.
                    </p>
                  </div>

                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsScanningActive(true);
                      setTimeout(() => barcodeInputRef.current?.focus(), 120);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/10 transition-all active:scale-95"
                  >
                    <svg className="size-4 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 5H5V19H3V5Z" fill="currentColor"/>
                      <path d="M7 5H8V19H7V5Z" fill="currentColor"/>
                      <path d="M11 5H13V19H11V5Z" fill="currentColor"/>
                      <path d="M16 5H17V19H16V5Z" fill="currentColor"/>
                      <path d="M20 5H21V19H20V5Z" fill="currentColor"/>
                    </svg>
                    <span>Mulai Pemindaian</span>
                  </button>
                </div>
              )}

            </div>

            {/* LIVE DASHBOARD AREA (Right column) */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Last Scan Showcase */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100/60 pb-2">
                  <h3 className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Pindaian Terbaru</h3>
                  <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">Berhasil Masuk</span>
                </div>

                {recentScans.length > 0 && recentScans[0].status !== 'error' ? (() => {
                  const lastScan = recentScans[0];
                  const matchedMember = members.find(m => String(m.id).trim().toUpperCase() === lastScan.id);
                  const isSuccess = lastScan.status === 'success';

                  return (
                    <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-center gap-4 transition-all duration-300 ${
                      isSuccess ? 'bg-emerald-50/40 border-emerald-100' : 'bg-amber-50/40 border-amber-100'
                    }`}>
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-black uppercase ${
                          matchedMember?.jenis_kelamin?.toLowerCase() === 'laki-laki'
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-rose-100 text-rose-500'
                        }`}>
                          {matchedMember?.jenis_kelamin?.toLowerCase() === 'laki-laki' ? '♂' : '♀'}
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-black uppercase tracking-tight text-slate-800">
                            {lastScan.memberName}
                          </h4>
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                            ID: {lastScan.id}
                          </p>
                          <div className="flex items-center gap-2 text-[8px] font-extrabold text-slate-400 uppercase mt-1">
                            <span>{matchedMember?.desa_name || '-'}</span>
                            <span>•</span>
                            <span>{matchedMember?.kelompok_name || '-'}</span>
                            <span>•</span>
                            <span>{matchedMember?.age_category_name || 'UMUM'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="w-full sm:w-auto text-center sm:text-right shrink-0">
                        <span className={`inline-block px-3 py-1 font-black text-[9px] uppercase tracking-wider rounded-lg ${
                          isSuccess ? 'bg-emerald-500 text-white shadow-xs' : 'bg-amber-500 text-white shadow-xs'
                        }`}>
                          {isSuccess ? 'HADIR' : 'SUDAH ABSEN'}
                        </span>
                        <span className="block text-[8px] font-bold text-slate-450 uppercase tracking-widest mt-1">
                          {lastScan.timestamp}
                        </span>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="h-[96px] border border-dashed border-slate-150 rounded-2xl flex flex-col items-center justify-center text-center p-4 bg-slate-50/20">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Silakan tembak barcode pada kartu anggota Anda.</p>
                  </div>
                )}
              </div>

              {/* Live Session Feed */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 flex flex-col h-[280px]">
                <div className="flex items-center justify-between border-b border-slate-50 pb-2 shrink-0">
                  <h3 className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Feed Pemindaian Terkini</h3>
                  <button
                    type="button"
                    onClick={() => { setRecentScans([]); setLocalScannedIds(new Set()); }}
                    className="text-[8px] font-black text-rose-500 hover:bg-rose-50 px-2.5 py-1 rounded-md uppercase tracking-wider transition-all"
                  >
                    Kosongkan Antrean
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                  {recentScans.map((scan, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/50 rounded-xl border border-slate-100/50 transition-all">
                      <div className="min-w-0 pr-2 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black text-slate-800 uppercase truncate">
                            {scan.memberName}
                          </span>
                          <span className="text-[7.5px] font-extrabold text-slate-400 bg-slate-200 px-1 py-0.5 rounded leading-none uppercase">
                            {scan.id}
                          </span>
                        </div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">
                          {scan.message}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`inline-block px-2 py-0.5 font-extrabold text-[8px] uppercase tracking-wider rounded ${
                          scan.status === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          scan.status === 'duplicate' ? 'bg-amber-50 text-amber-650 border border-amber-150' :
                          'bg-rose-50 text-rose-600 border border-rose-150'
                        }`}>
                          {scan.status === 'success' ? 'HADIR' : scan.status === 'duplicate' ? 'DUPLIKAT' : 'ERROR'}
                        </span>
                        <span className="block text-[7px] font-bold text-slate-350 uppercase tracking-widest mt-0.5">
                          {scan.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}

                  {recentScans.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                        Data scan baru akan mengalir ke pilar penempatan ini secara real-time.
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default AttendanceForm;
