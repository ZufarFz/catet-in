
import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserPlus, Search, Edit2, Trash2, Loader2, X, Save, 
  MapPin, Users, User, Smartphone, Calendar, 
  GraduationCap, Phone, Home, CheckCircle2,
  Briefcase, AlertCircle, RotateCcw, Upload, Download,
  LayoutGrid, SlidersHorizontal, CreditCard, Minimize2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { AbsensiMember, DesaData, KelompokData, AgeCategoryData, DaerahData, Family, FamilyRelationship } from '../../types';
import ModernSelect from '../ui/ModernSelect';
import { motion, AnimatePresence } from 'motion/react';
import { dbAddMember, dbDeleteMember } from '../../supabase';
import { downloadMemberCard } from '../utils/barcode128';

interface MemberManagementProps {
  daerahs: DaerahData[];
  members: AbsensiMember[];
  setMembers: React.Dispatch<React.SetStateAction<AbsensiMember[]>>;
  desas: DesaData[];
  kelompoks: KelompokData[];
  ages: AgeCategoryData[];
  families?: Family[];
  relationships?: FamilyRelationship[];
  appScriptMaster: string;
  canWrite: boolean;
  onRefresh: () => void;
  isLoading: boolean;
}

const MemberManagement: React.FC<MemberManagementProps> = ({ 
  daerahs, members, setMembers, desas, kelompoks, ages, 
  families = [], relationships = [],
  appScriptMaster, canWrite, onRefresh, isLoading 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingMember, setEditingMember] = useState<AbsensiMember | null>(null);
  const [selectedMember, setSelectedMember] = useState<AbsensiMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isScanningRfid, setIsScanningRfid] = useState(false);
  const [isScanningRfidKtp, setIsScanningRfidKtp] = useState(false);

  // States for importing via file
  const [showImportModal, setShowImportModal] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [importError, setImportError] = useState('');
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);

  // Filters
  const [filterDaerah, setFilterDaerah] = useState('All');
  const [filterDesa, setFilterDesa] = useState('All');
  const [filterKelompok, setFilterKelompok] = useState('All');
  const [filterAge, setFilterAge] = useState('All');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const isFilterActive = useMemo(() => {
    return filterDaerah !== 'All' || filterDesa !== 'All' || filterKelompok !== 'All' || filterAge !== 'All';
  }, [filterDaerah, filterDesa, filterKelompok, filterAge]);

  const [formData, setFormData] = useState<Partial<AbsensiMember>>(() => {
    try {
      const saved = localStorage.getItem('absensi_member_registration_draft');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load registration draft', e);
    }
    return {
      nama_lengkap: '',
      daerah_id: '',
      desa_id: '',
      kelompok_id: '',
      age_category_id: '',
      tempat_lahir: '',
      tanggal_lahir: '',
      no_hp_anggota: '',
      jenis_kelamin: 'Laki-laki',
      nama_ortu: '',
      no_hp_ortu: '',
      pekerjaan_ortu: '',
      alamat_rumah: '',
      pendidikan: '',
      kelas: '',
      rfid: '',
      rfid_ktp: '',
      family_id: '',
      relationship_id: '',
      pekerjaan: ''
    };
  });

  useEffect(() => {
    if (editingMember === null) {
      localStorage.setItem('absensi_member_registration_draft', JSON.stringify(formData));
    }
  }, [formData, editingMember]);

<<<<<<< HEAD
  useEffect(() => {
    const handleNfcRead = (e: Event) => {
      const customEvent = e as CustomEvent<{ uid: string }>;
      const uid = customEvent.detail?.uid;
      if (!uid) return;

      if (isScanningRfid) {
        setFormData(prev => ({ ...prev, rfid: uid }));
        setIsScanningRfid(false);
      } else if (isScanningRfidKtp) {
        setFormData(prev => ({ ...prev, rfid_ktp: uid }));
        setIsScanningRfidKtp(false);
      }
    };

    window.addEventListener('nfc-read', handleNfcRead);
    return () => {
      window.removeEventListener('nfc-read', handleNfcRead);
    };
  }, [isScanningRfid, isScanningRfidKtp]);

=======
>>>>>>> 32a6d8fbb3b92b999e7fbe01485aac778753e9a0
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesSearch = (m.nama_lengkap || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (m.id || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchedDesaDoc = desas.find(d => String(d.id) === String(m.desa_id));
      const finalDaerahId = m.daerah_id || matchedDesaDoc?.daerah_id || '';

      const matchesDaerah = filterDaerah === 'All' || String(finalDaerahId) === String(filterDaerah);
      const matchesDesa = filterDesa === 'All' || String(m.desa_id) === String(filterDesa);
      const matchesKelompok = filterKelompok === 'All' || String(m.kelompok_id) === String(filterKelompok);
      const matchesAge = filterAge === 'All' || String(m.age_category_id) === String(filterAge);
      return matchesSearch && matchesDaerah && matchesDesa && matchesKelompok && matchesAge;
    });
  }, [members, searchTerm, filterDaerah, filterDesa, filterKelompok, filterAge, desas]);

  const groupedMembers = useMemo(() => {
    const groups: { [daerah: string]: { [desa: string]: { [kelompok: string]: { [age: string]: AbsensiMember[] } } } } = {};
    
    // Sort members by name first to ensure alphabetical order within groups
    const sorted = [...filteredMembers].sort((a, b) => 
      (a.nama_lengkap || '').localeCompare(b.nama_lengkap || '')
    );

    sorted.forEach(m => {
      const matchedDesaDoc = desas.find(d => String(d.id) === String(m.desa_id));
      const matchedDaerahId = m.daerah_id || matchedDesaDoc?.daerah_id || '';
      const matchedDaerahDoc = (daerahs || []).find(d => String(d.id) === String(matchedDaerahId));

      const daerah = matchedDaerahDoc?.nama_daerah || 'Tanpa Daerah';
      const desa = m.desa_name || 'Tanpa Desa';
      const kelompok = m.kelompok_name || 'Tanpa Kelompok';
      const age = m.age_category_name || 'Tanpa Kategori Usia';
      
      if (!groups[daerah]) groups[daerah] = {};
      if (!groups[daerah][desa]) groups[daerah][desa] = {};
      if (!groups[daerah][desa][kelompok]) groups[daerah][desa][kelompok] = {};
      if (!groups[daerah][desa][kelompok][age]) groups[daerah][desa][kelompok][age] = [];
      
      groups[daerah][desa][kelompok][age].push(m);
    });
    
    return groups;
  }, [filteredMembers, daerahs, desas]);

  // Track currently scrolled-to Desa within each Daerah for sticky header display
  const [activeDesas, setActiveDesas] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!showModal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsScanningRfid(false);
      setIsScanningRfidKtp(false);
    }
  }, [showModal]);

<<<<<<< HEAD
=======
  // Web NFC Scan integration for Member Registration
  useEffect(() => {
    let ndefCtrl: AbortController | null = null;
    let isMounted = true;

    async function startNfcScan() {
      if (!isScanningRfid && !isScanningRfidKtp) return;
      if (typeof window === 'undefined' || !('NDEFReader' in window)) return;

      try {
        ndefCtrl = new AbortController();
        const reader = new (window as any).NDEFReader();
        await reader.scan({ signal: ndefCtrl.signal });
        
        reader.addEventListener("reading", ({ serialNumber }: any) => {
          if (!isMounted) return;
          if (serialNumber) {
            const formattedSerial = serialNumber.replace(/:/g, '').toUpperCase();
            if (isScanningRfid) {
              setFormData(prev => ({ ...prev, rfid: formattedSerial }));
              setIsScanningRfid(false);
            } else if (isScanningRfidKtp) {
              setFormData(prev => ({ ...prev, rfid_ktp: formattedSerial }));
              setIsScanningRfidKtp(false);
            }
          }
        });

        reader.addEventListener("readingerror", () => {
          console.warn("NFC Reading error - please try again");
        });
      } catch (error) {
        console.error("Failed to scan NFC via WebNFC API:", error);
      }
    }

    startNfcScan();

    return () => {
      isMounted = false;
      if (ndefCtrl) {
        ndefCtrl.abort();
      }
    };
  }, [isScanningRfid, isScanningRfidKtp]);

>>>>>>> 32a6d8fbb3b92b999e7fbe01485aac778753e9a0
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-120px 0px -80% 0px', // Focused around the top header sticky zone
      threshold: [0, 1],
    };

    const handleIntersection = (entries: any[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target as HTMLElement;
          const daerah = target.getAttribute('data-daerah');
          const desa = target.getAttribute('data-desa');
          if (daerah && desa) {
            setActiveDesas((prev) => ({
              ...prev,
              [daerah]: desa,
            }));
          }
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, observerOptions);

    // Dynamic selection of sentinel elements
    const elements = document.querySelectorAll('.desa-scroll-sentinel');
    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [groupedMembers]);

  const stats = useMemo(() => {
    return {
      total: members.length,
      male: members.filter(m => m.jenis_kelamin === 'Laki-laki').length,
      female: members.filter(m => m.jenis_kelamin === 'Perempuan').length,
    };
  }, [members]);

  const hasDraftContent = useMemo(() => {
    return editingMember === null && (
      !!formData.nama_lengkap || 
      !!formData.tempat_lahir || 
      !!formData.no_hp_anggota || 
      !!formData.rfid || 
      !!formData.alamat_rumah ||
      !!formData.nama_ortu ||
      !!formData.no_hp_ortu ||
      !!formData.pendidikan ||
      !!formData.family_id
    );
  }, [formData, editingMember]);

  const formatDisplayDate = (dateVal: any) => {
    if (!dateVal || dateVal === '-' || dateVal === '?') return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      
      const day = d.getDate();
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      
      return `${day} ${month} ${year}`;
    } catch {
      return String(dateVal);
    }
  };

  const formatDateForInput = (dateVal: any) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  const handleEdit = (member: AbsensiMember) => {
    setEditingMember(member);
    setFormData({ 
      ...member,
      tanggal_lahir: formatDateForInput(member.tanggal_lahir)
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    setIsSubmitting(true);
    try {
      await dbDeleteMember(id);
      setMembers(prev => prev.filter(m => m.id !== id));
      setDeleteConfirmId(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;

    if (!formData.nama_lengkap || !formData.desa_id || !formData.kelompok_id || !formData.age_category_id) {
       window.alert('Mohon lengkapi bagian bertanda bintang (*)');
       return;
    }

    setIsSubmitting(true);
    // High-density, compact Base-36 ID + 4 random characters (e.g., MBR-K8ZJ1B3FX9A)
    const generatedId = editingMember?.id || `MBR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    // Resolve daerah info from desa
    const matchedDesaDoc = desas.find(d => String(d.id) === String(formData.desa_id));
    const resolvedDaerahId = matchedDesaDoc?.daerah_id || formData.daerah_id || '';
    const resolvedDaerahName = (daerahs || []).find(d => String(d.id) === String(resolvedDaerahId))?.nama_daerah || '';

    const payloadData: AbsensiMember = { 
      ...formData as AbsensiMember,
      id: generatedId,
      daerah_id: resolvedDaerahId,
      daerah_name: resolvedDaerahName,
      desa_name: matchedDesaDoc?.nama_desa || '',
      kelompok_name: kelompoks.find(k => String(k.id) === String(formData.kelompok_id))?.nama_kelompok || '',
      age_category_name: ages.find(a => String(a.id) === String(formData.age_category_id))?.name || '',
    };

    try {
      await dbAddMember(payloadData);

      if (editingMember) {
        setMembers(prev => prev.map(m => m.id === editingMember.id ? payloadData : m));
      } else {
        setMembers(prev => [payloadData, ...prev]);
        try {
          localStorage.removeItem('absensi_member_registration_draft');
        } catch (e) {
          console.error(e);
        }
        setFormData({
          nama_lengkap: '', daerah_id: '', desa_id: '', kelompok_id: '', age_category_id: '',
          tempat_lahir: '', tanggal_lahir: '', no_hp_anggota: '', jenis_kelamin: 'Laki-laki',
          nama_ortu: '', no_hp_ortu: '', pekerjaan_ortu: '', alamat_rumah: '', pendidikan: '', kelas: '',
          rfid: '', rfid_ktp: '', family_id: '', relationship_id: '', pekerjaan: ''
        });
      }

      setShowModal(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      parseAndPreviewFile(file);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'Nama Lengkap',
      'Jenis Kelamin',
      'ID Daerah (Opsional)',
      'ID Desa',
      'ID Kelompok',
      'ID Kategori Usia',
      'Tempat Lahir',
      'Tanggal Lahir',
      'No HP Anggota',
      'Nama Orang Tua',
      'No HP Orang Tua',
      'Pekerjaan Orang Tua',
      'Alamat Rumah',
      'Pendidikan Terakhir',
      'Kelas atau Semester'
    ];

    const exampleRows = [
      [
        'Ahmad Fauzi',
        'Laki-laki',
        daerahs[0]?.id || 'DAE-CONTOH',
        desas[0]?.id || 'DES-CONTOH',
        kelompoks[0]?.id || 'KLP-CONTOH',
        ages[0]?.id || 'AGE-REMAJA',
        'Jakarta',
        '2005-08-12',
        '081234567890',
        'Bp. Supardi',
        '081298765432',
        'Wiraswasta',
        'Jl. Merdeka No. 10',
        'SMA',
        'Kelas 11'
      ],
      [
        'Siti Aminah',
        'Perempuan',
        daerahs[0]?.id || 'DAE-CONTOH',
        desas[0]?.id || 'DES-CONTOH',
        kelompoks[0]?.id || 'KLP-CONTOH',
        ages[1]?.id || 'AGE-CABON',
        'Bandung',
        '2010-04-20',
        '081223344556',
        'Ibu Khodijah',
        '081223344557',
        'Ibu Rumah Tangga',
        'Jl. Melati No. 5',
        'SMP',
        'Kelas 8'
      ]
    ];

    const worksheetData = [headers, ...exampleRows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Anggota');

    // Sheet 2: Referensi ID
    const refHeaders = ['Tipe Data', 'ID Database (Masukkan ke Kolom)', 'Nama / Keterangan'];
    const refRows: any[] = [];
    
    // Add Kategori Usia
    ages.forEach(a => {
      refRows.push(['Kategori Usia', a.id, a.name]);
    });
    // Add Daerah
    (daerahs || []).forEach(d => {
      refRows.push(['Daerah', d.id, d.nama_daerah]);
    });
    // Add Desa
    desas.forEach(d => {
      const matchDaerah = (daerahs || []).find(da => String(da.id) === String(d.daerah_id));
      refRows.push(['Desa', d.id, `${d.nama_desa} (${matchDaerah?.nama_daerah || '-'})`]);
    });
    // Add Kelompok
    kelompoks.forEach(k => {
      const matchDesa = desas.find(ds => String(ds.id) === String(k.desa_id));
      refRows.push(['Kelompok', k.id, `${k.nama_kelompok} (${matchDesa?.nama_desa || '-'})`]);
    });
    
    const rWorksheetData = [refHeaders, ...refRows];
    const rWorksheet = XLSX.utils.aoa_to_sheet(rWorksheetData);
    XLSX.utils.book_append_sheet(workbook, rWorksheet, 'Referensi ID');

    XLSX.writeFile(workbook, 'Template_Anggota_Absensi.xlsx');
  };

  const parseAndPreviewFile = (file: any) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error("Gagal membaca file.");
        
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const sheetData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        if (sheetData.length < 2) {
          throw new Error("File kosong atau tidak memiliki data baris.");
        }
        
        const headersRow = sheetData[0].map((h: any) => String(h || '').trim().toLowerCase());
        
        // Find mapping index for each desired field
        const findIndex = (keywords: string[]) => {
          return headersRow.findIndex((h: string) => 
            keywords.some(kw => {
              const fieldClean = h.toLowerCase().trim();
              const kwClean = kw.toLowerCase().trim();
              return fieldClean.includes(kwClean) || kwClean.includes(fieldClean);
            })
          );
        };
        
        const idxNama = findIndex(['nama lengkap', 'nama_lengkap', 'nama']);
        const idxJK = findIndex(['jenis kelamin', 'jenis_kelamin', 'gender', 'jk']);
        const idxDaerah = findIndex(['id daerah', 'daerah']);
        const idxDesa = findIndex(['id desa', 'desa']);
        const idxKelompok = findIndex(['id kelompok', 'kelompok']);
        const idxUsia = findIndex(['id kategori usia', 'kategori usia', 'kategori_usia', 'usia', 'kategori']);
        const idxTempat = findIndex(['tempat lahir', 'tempat_lahir', 'tempat']);
        const idxTanggal = findIndex(['tanggal lahir', 'tanggal_lahir', 'tgl lahir', 'tgl_lahir', 'tanggal']);
        const idxHPOrtu = findIndex(['no hp orang tua', 'nomor hp orang tua', 'hp orang tua', 'no hp ortu', 'no_hp_ortu', 'hp ortu', 'nomor hp ortu']);
        let idxHPAnggota = findIndex(['no hp anggota', 'no_hp_anggota', 'hp anggota', 'no hp', 'hp', 'no_hp']);
        const idxNamaOrtu = findIndex(['nama orang tua', 'nama ortu', 'nama_ortu', 'orang tua', 'ortu']);
        const idxPekerjaanOrtu = findIndex(['pekerjaan orang tua', 'pekerjaan_ortu', 'pekerjaan ortu', 'pekerjaan']);
        const idxAlamat = findIndex(['alamat rumah', 'alamat_rumah', 'alamat']);
        const idxPendidikan = findIndex(['pendidikan terkahir', 'pendidikan terakhir', 'pendidikan_terakhir', 'pendidikan']);
        const idxKelas = findIndex(['kelas atau semester', 'kelas_atau_semester', 'kelas', 'semester']);
        const idxRFID = findIndex(['rfid', 'nfc', 'kartu rfid', 'rfid_code', 'rfid code']);
        const idxRFIDKtp = findIndex(['rfid ktp', 'rfid_ktp', 'nfc ktp', 'nfc_ktp', 'e-ktp', 'ektp', 'kartu ktp', 'ktp rfid', 'nfc_ktp_code']);

        if (idxHPAnggota === idxHPOrtu && idxHPOrtu !== -1) {
          idxHPAnggota = headersRow.findIndex((h, idx) => idx !== idxHPOrtu && (h.includes('anggota') || h.includes('member') || h === 'hp' || h === 'no hp' || h === 'no_hp'));
        }
        let finalIdxNama = idxNama;
        if (idxNama === idxNamaOrtu && idxNamaOrtu !== -1) {
          finalIdxNama = headersRow.findIndex((h, idx) => idx !== idxNamaOrtu && (h.includes('lengkap') || h.includes('member') || h === 'nama' || h === 'name'));
        }

        const parsedRows: any[] = [];
        const errorsList: string[] = [];
        
        for (let i = 1; i < sheetData.length; i++) {
          const row = sheetData[i];
          if (!row || row.length === 0) continue;
          
          const isRowEmpty = row.every((val: any) => val === undefined || val === null || String(val).trim() === '');
          if (isRowEmpty) continue;
          
          const getValue = (idx: number, fallback = '') => {
            if (idx === -1 || idx >= row.length) return fallback;
            return row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : fallback;
          };
          
          const nama = getValue(finalIdxNama);
          const jk = getValue(idxJK);
          const daerahRaw = getValue(idxDaerah);
          const desaRaw = getValue(idxDesa);
          const kelompokRaw = getValue(idxKelompok);
          const usiaRaw = getValue(idxUsia);
          const tempat = getValue(idxTempat);
          const tanggalRaw = getValue(idxTanggal);
          const hpAnggota = getValue(idxHPAnggota);
          const namaOrtu = getValue(idxNamaOrtu);
          const hpOrtu = getValue(idxHPOrtu);
          const pekerjaanOrtu = getValue(idxPekerjaanOrtu);
          const alamat = getValue(idxAlamat);
          const pendidikan = getValue(idxPendidikan);
          const kelas = getValue(idxKelas);
          const rfid = getValue(idxRFID);
          const rfidKtp = getValue(idxRFIDKtp);
          
          if (!nama) {
            errorsList.push(`Baris ${i + 1}: Nama Lengkap kosong.`);
            continue;
          }
          
          // Normalkan Jenis Kelamin
          let finalJK = 'Laki-laki';
          if (jk) {
            const jkLower = jk.toLowerCase();
            if (jkLower.startsWith('p') || jkLower.includes('wanita') || jkLower.includes('perempuan')) {
              finalJK = 'Perempuan';
            }
          }
          
          // Match Desa (Prioritas match ID, fallback match Nama, fallback default)
          let matchedDesaId = '';
          let matchedDesaName = '';
          if (desaRaw) {
            const matched = desas.find(d => 
              d.id.toLowerCase().trim() === desaRaw.toLowerCase().trim()
            );
            if (matched) {
              matchedDesaId = matched.id;
              matchedDesaName = matched.nama_desa;
            } else {
              const matchedByName = desas.find(d => 
                d.nama_desa.toLowerCase().trim() === desaRaw.toLowerCase().trim() ||
                d.nama_desa.toLowerCase().trim().includes(desaRaw.toLowerCase().trim()) ||
                desaRaw.toLowerCase().trim().includes(d.nama_desa.toLowerCase().trim())
              );
              if (matchedByName) {
                matchedDesaId = matchedByName.id;
                matchedDesaName = matchedByName.nama_desa;
              } else if (desas.length > 0) {
                matchedDesaId = desas[0].id;
                matchedDesaName = desas[0].nama_desa;
                errorsList.push(`Baris ${i + 1} ("${nama}"): ID Desa "${desaRaw}" tidak terdaftar. Menggunakan default "${matchedDesaName}".`);
              } else {
                errorsList.push(`Baris ${i + 1} ("${nama}"): ID Desa "${desaRaw}" tidak ditemukan.`);
              }
            }
          } else {
            if (desas.length > 0) {
              matchedDesaId = desas[0].id;
              matchedDesaName = desas[0].nama_desa;
            } else {
              errorsList.push(`Baris ${i + 1} ("${nama}"): Kolom ID Desa kosong.`);
            }
          }
          
          // Match Kelompok (Prioritas match ID, fallback match Nama [dengan pencocokan desa], fallback default)
          let matchedKelompokId = '';
          let matchedKelompokName = '';
          if (kelompokRaw) {
            const matched = kelompoks.find(k => 
              k.id.toLowerCase().trim() === kelompokRaw.toLowerCase().trim()
            );
            if (matched) {
              matchedKelompokId = matched.id;
              matchedKelompokName = matched.nama_kelompok;
            } else {
              // Priority: match name belonging to the matchedDesaId
              let matchedByName = kelompoks.find(k => 
                String(k.desa_id) === String(matchedDesaId) && (
                  k.nama_kelompok.toLowerCase().trim() === kelompokRaw.toLowerCase().trim() ||
                  k.nama_kelompok.toLowerCase().trim().includes(kelompokRaw.toLowerCase().trim()) ||
                  kelompokRaw.toLowerCase().trim().includes(k.nama_kelompok.toLowerCase().trim())
                )
              );
              // Fallback: search generally
              if (!matchedByName) {
                matchedByName = kelompoks.find(k => 
                  k.nama_kelompok.toLowerCase().trim() === kelompokRaw.toLowerCase().trim() ||
                  k.nama_kelompok.toLowerCase().trim().includes(kelompokRaw.toLowerCase().trim()) ||
                  kelompokRaw.toLowerCase().trim().includes(k.nama_kelompok.toLowerCase().trim())
                );
              }

              if (matchedByName) {
                matchedKelompokId = matchedByName.id;
                matchedKelompokName = matchedByName.nama_kelompok;
              } else {
                const allowedKelompoks = kelompoks.filter(k => String(k.desa_id) === String(matchedDesaId));
                const fallbackKelompok = allowedKelompoks.length > 0 ? allowedKelompoks[0] : kelompoks[0];
                if (fallbackKelompok) {
                  matchedKelompokId = fallbackKelompok.id;
                  matchedKelompokName = fallbackKelompok.nama_kelompok;
                  errorsList.push(`Baris ${i + 1} ("${nama}"): ID Kelompok "${kelompokRaw}" tidak terdaftar. Menggunakan default "${matchedKelompokName}".`);
                } else {
                  errorsList.push(`Baris ${i + 1} ("${nama}"): ID Kelompok "${kelompokRaw}" tidak ditemukan.`);
                }
              }
            }
          } else {
            const allowedKelompoks = kelompoks.filter(k => String(k.desa_id) === String(matchedDesaId));
            const fallbackKelompok = allowedKelompoks.length > 0 ? allowedKelompoks[0] : kelompoks[0];
            if (fallbackKelompok) {
              matchedKelompokId = fallbackKelompok.id;
              matchedKelompokName = fallbackKelompok.nama_kelompok;
            } else {
              errorsList.push(`Baris ${i + 1} ("${nama}"): Kolom ID Kelompok kosong.`);
            }
          }
          
          // Match Kategori Usia (Prioritas match ID, fallback match Nama, fallback default)
          let matchedAgeId = '';
          let matchedAgeName = '';
          if (usiaRaw) {
            const matched = ages.find(a => 
              a.id.toLowerCase().trim() === usiaRaw.toLowerCase().trim()
            );
            if (matched) {
              matchedAgeId = matched.id;
              matchedAgeName = matched.name;
            } else {
              const matchedByName = ages.find(a => 
                a.name.toLowerCase().trim() === usiaRaw.toLowerCase().trim() ||
                a.name.toLowerCase().trim().includes(usiaRaw.toLowerCase().trim()) ||
                usiaRaw.toLowerCase().trim().includes(a.name.toLowerCase().trim())
              );
              if (matchedByName) {
                matchedAgeId = matchedByName.id;
                matchedAgeName = matchedByName.name;
              } else if (ages.length > 0) {
                matchedAgeId = ages[0].id;
                matchedAgeName = ages[0].name;
                errorsList.push(`Baris ${i + 1} ("${nama}"): ID Kategori Usia "${usiaRaw}" tidak terdaftar. Menggunakan default "${matchedAgeName}".`);
              } else {
                errorsList.push(`Baris ${i + 1} ("${nama}"): ID Kategori Usia "${usiaRaw}" tidak ditemukan.`);
              }
            }
          } else {
            if (ages.length > 0) {
              matchedAgeId = ages[0].id;
              matchedAgeName = ages[0].name;
            } else {
              errorsList.push(`Baris ${i + 1} ("${nama}"): Kolom ID Kategori Usia kosong.`);
            }
          }

          // Format Tanggal Lahir
          let finalTanggal = '';
          if (tanggalRaw) {
            if (!isNaN(Number(tanggalRaw)) && Number(tanggalRaw) > 20000) {
              try {
                const dt = new Date((Number(tanggalRaw) - 25569) * 86400 * 1000);
                const year = dt.getFullYear();
                const month = String(dt.getMonth() + 1).padStart(2, '0');
                const day = String(dt.getDate()).padStart(2, '0');
                finalTanggal = `${year}-${month}-${day}`;
              } catch {
                finalTanggal = String(tanggalRaw);
              }
            } else {
              const parts = String(tanggalRaw).split(/[-/.]/);
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  finalTanggal = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                } else if (parts[2].length === 4) {
                  finalTanggal = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                } else {
                  finalTanggal = String(tanggalRaw);
                }
              } else {
                finalTanggal = String(tanggalRaw);
              }
            }
          }

          const parsedDesa = desas.find(d => String(d.id) === String(matchedDesaId));
          let parsedDaerahId = daerahRaw;
          if (!parsedDaerahId) {
            parsedDaerahId = parsedDesa?.daerah_id || '';
          }
          const parsedDaerahName = (daerahs || []).find(da => String(da.id) === String(parsedDaerahId))?.nama_daerah || '';

          parsedRows.push({
            nama_lengkap: nama,
            jenis_kelamin: finalJK,
            daerah_id: parsedDaerahId,
            daerah_name: parsedDaerahName,
            desa_id: matchedDesaId,
            desa_name: matchedDesaName,
            kelompok_id: matchedKelompokId,
            kelompok_name: matchedKelompokName,
            age_category_id: matchedAgeId,
            age_category_name: matchedAgeName,
            tempat_lahir: tempat,
            tanggal_lahir: finalTanggal,
            no_hp_anggota: hpAnggota,
            nama_ortu: namaOrtu,
            no_hp_ortu: hpOrtu,
            pekerjaan_ortu: pekerjaanOrtu,
            alamat_rumah: alamat,
            pendidikan: pendidikan,
            kelas: kelas,
            rfid: rfid,
            rfid_ktp: rfidKtp
          });
        }

        setImportPreview(parsedRows);
        setImportWarnings(errorsList);
      } catch (err: any) {
        setImportError(err.message || "Gagal mengurai file. Pastikan format file sesuai.");
      } finally {
        setIsParsing(false);
      }
    };
    
    setIsParsing(true);
    setImportError('');
    setImportPreview([]);
    setImportWarnings([]);
    reader.readAsArrayBuffer(file);
  };

  const handleCommitImport = async () => {
    if (importPreview.length === 0) return;
    setIsSubmittingImport(true);
    try {
      let successCount = 0;
      for (const record of importPreview) {
        // High-density, compact Base-36 ID + 4 random characters (e.g., MBR-K8ZJ1B3FX9A)
        const generatedId = `MBR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const payload: AbsensiMember = {
          ...record,
          id: generatedId,
        };
        await dbAddMember(payload);
        setMembers(prev => [payload, ...prev]);
        successCount++;
      }
      
      setShowImportModal(false);
      setImportPreview([]);
      setImportWarnings([]);
      onRefresh();
      window.alert(`Berhasil mengimpor ${successCount} anggota!`);
    } catch (err) {
      console.error(err);
      window.alert(`Gagal mengimpor anggota: ${err instanceof Error ? err.message : 'Kesalahan Firestore'}`);
    } finally {
      setIsSubmittingImport(false);
    }
  };

  return (
    <div className="h-full bg-[#f8f9fa] overflow-y-auto custom-scrollbar">
      {/* Header & Quick Stats */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-2 md:py-3 relative">
        <div className="max-w-7xl mx-auto space-y-2 md:space-y-3">
          <div className="flex flex-row justify-between items-center gap-4">
            <div className="space-y-0">
              <h2 className="text-sm md:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 md:gap-3">
                <Users className="text-blue-600 w-4 h-4 md:w-5 md:h-5" />
                Direktori Anggota
              </h2>
              <p className="hidden md:block text-[10px] text-slate-400 font-medium">Kelola dan pantau seluruh data keanggotaan dalam satu platform</p>
            </div>
            {canWrite && (
              <div className="flex items-center gap-2 md:gap-3">
                {/* Desktop Import Button */}
                <button 
                  onClick={() => setShowImportModal(true)}
                  className="hidden md:flex px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-semibold items-center justify-center gap-2 transition-all"
                >
                  <Upload size={18} />
                  Import Anggota
                </button>

                {/* Mobile Import Button */}
                <button 
                  onClick={() => setShowImportModal(true)}
                  className="flex md:hidden px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-bold text-xs items-center justify-center gap-1 transition-all"
                >
                  <Upload size={14} />
                  Import
                </button>

                {/* Registrasi Anggota (Desktop) */}
                <button 
                  onClick={() => {
                    setEditingMember(null);
                    try {
                      const savedDraft = localStorage.getItem('absensi_member_registration_draft');
                      if (savedDraft) {
                        setFormData(JSON.parse(savedDraft));
                      } else {
                        setFormData({
                          nama_lengkap: '', daerah_id: '', desa_id: '', kelompok_id: '', age_category_id: '',
                          tempat_lahir: '', tanggal_lahir: '', no_hp_anggota: '', jenis_kelamin: 'Laki-laki',
                          nama_ortu: '', no_hp_ortu: '', pekerjaan_ortu: '', alamat_rumah: '', pendidikan: '', kelas: '',
                          rfid: '', rfid_ktp: '', family_id: '', relationship_id: '', pekerjaan: ''
                        });
                      }
                    } catch (e) {
                      console.error(e);
                    }
                    setShowModal(true);
                  }}
                  className="hidden md:flex px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200"
                >
                  <UserPlus size={20} />
                  Registrasi Anggota
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
            {[
              { label: 'Total Anggota', value: stats.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', showMobile: true },
              { label: 'Laki-laki', value: stats.male, icon: User, color: 'text-emerald-600', bg: 'bg-emerald-50', showMobile: true },
              { label: 'Perempuan', value: stats.female, icon: User, color: 'text-rose-600', bg: 'bg-rose-50', showMobile: true },
              { label: 'Total Desa', value: desas.length, icon: MapPin, color: 'text-purple-600', bg: 'bg-purple-50', showMobile: false },
              { label: 'Total Kelompok', value: kelompoks.length, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50', showMobile: false },
            ].map((stat, i) => (
              <div 
                key={i} 
                className={`
                  bg-white border border-slate-100 p-2 md:p-3 rounded-xl flex items-center gap-2 md:gap-2.5 transition-all shadow-sm shrink-0
                  ${stat.showMobile ? 'flex-1 min-w-[100px] md:min-w-0' : 'hidden md:flex flex-1'}
                `}
              >
                <div className={`${stat.bg} ${stat.color} w-8 md:w-10 h-8 md:h-10 rounded-lg flex items-center justify-center shrink-0`}>
                  <stat.icon className="w-4 md:w-5 h-4 md:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight truncate">{stat.label}</p>
                  <p className="text-xs md:text-lg font-black text-slate-900 leading-none mt-1">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 md:px-6 h-[56px] md:h-[72px] flex items-center cursor-default">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-2.5 md:gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative group">
            <Search className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors w-3.5 h-3.5 md:w-4 md:h-4" />
            <input 
              id="member-search-input"
              type="text"
              placeholder="CARI NAMA ATAU ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 md:pl-11 pr-3 md:pr-4 py-2 md:py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase text-slate-700 focus:border-blue-600 focus:bg-white outline-none transition-all shadow-xs"
            />
          </div>

          {/* Action Buttons: Filter Trigger + Reset */}
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {/* Filter Toggle Button */}
            <button 
              id="filter-trigger-btn"
              onClick={() => setShowFilterModal(true)}
              className={`
                relative p-2 md:p-3 rounded-xl md:rounded-2xl border-2 transition-all active:scale-95 flex items-center gap-1.5 md:gap-2 font-black text-[9px] md:text-[10px] uppercase tracking-wider
                ${isFilterActive 
                  ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-xs' 
                  : 'bg-slate-50 border-slate-100 text-slate-500 hover:text-blue-600 hover:border-blue-100'
                }
              `}
              title="Filter Anggota"
            >
              <SlidersHorizontal size={14} className={isFilterActive ? 'animate-pulse' : ''} />
              <span className="hidden sm:inline">Filter</span>
              {isFilterActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </button>

            {/* Reset Filter Button (Only show if filter is active) */}
            {isFilterActive && (
              <button 
                id="filter-reset-btn"
                onClick={() => { setSearchTerm(''); setFilterDaerah('All'); setFilterDesa('All'); setFilterKelompok('All'); setFilterAge('All'); }}
                title="Reset All Filters"
                className="p-2 md:p-3 bg-rose-50 border-2 border-rose-100 text-rose-500 hover:bg-rose-100 hover:border-rose-200 rounded-xl md:rounded-2xl transition-all active:scale-95 shrink-0"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>
      </div>


      {/* Content Area */}
      <div className="p-2 md:p-4">
        <div className="max-w-7xl mx-auto">
          {/* Desktop Table Header */}
          {!isLoading && filteredMembers.length > 0 && (
            <div className="hidden md:flex items-center gap-6 px-5 py-2.5 bg-slate-50/70 rounded-xl border border-slate-100/50 md:ml-10 mb-3 select-none">
              <div className="w-11 shrink-0"></div> {/* Space for icon */}
              <div className="flex-1 grid grid-cols-12 gap-4">
                <div className="col-span-4">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Informasi Anggota</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Jenis Kelamin</span>
                </div>
                <div className="col-span-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tanggal Lahir</span>
                </div>
                <div className="col-span-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tempat Lahir</span>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="relative">
                <div className="w-10 h-10 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
              <p className="text-xs text-slate-500 font-medium animate-pulse">Sinkronisasi data...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-8 md:p-16 text-center shadow-sm">
              <Search size={32} className="text-slate-200 mx-auto mb-4" />
              <h3 className="text-sm font-bold text-slate-800">Tidak ada hasil</h3>
              <button 
                onClick={() => { setSearchTerm(''); setFilterDesa('All'); setFilterKelompok('All'); setFilterAge('All'); }}
                className="mt-4 text-xs text-blue-600 font-bold hover:underline"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="space-y-6 md:space-y-8">
              {Object.entries(groupedMembers).sort().map(([daerah, desaGroup]) => {
                const currentActiveDesa = activeDesas[daerah] || Object.keys(desaGroup).sort()[0];
                return (
                  <div key={daerah} className="space-y-3 bg-white p-3 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm relative group-section">
                    {/* DAERAH HEADER - Sticky */}
                    <div className="sticky top-[56px] md:top-[72px] z-20 py-1.5 -mx-3 px-3 bg-white/95 backdrop-blur-sm rounded-t-xl transition-all duration-200">
                      <div className="flex flex-row items-center justify-between gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2.5 bg-purple-50 text-purple-700 rounded-xl border border-purple-100 shadow-xs w-full">
                        <div className="flex items-center gap-1.5 md:gap-2.5 min-w-0">
                          <LayoutGrid size={13} className="text-purple-600 animate-pulse shrink-0" />
                          <h3 className="text-[9px] md:text-xs font-black uppercase tracking-wider truncate leading-none">DAERAH: {daerah}</h3>
                          {currentActiveDesa && (
                            <div className="flex items-center gap-1 text-blue-700 border-l border-purple-200 pl-1.5 md:pl-2.5 shrink-0">
                              <MapPin size={11} className="text-blue-500 shrink-0" />
                              <span className="text-[9px] md:text-xs font-black uppercase tracking-wider leading-none truncate">DESA: {currentActiveDesa}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center shrink-0">
                          <span className="text-[8px] md:text-[10px] font-black text-purple-600 bg-white px-2 py-0.5 rounded-full border border-purple-100/30 whitespace-nowrap">
                            {Object.values(desaGroup).reduce((acc, curr) => 
                              acc + Object.values(curr).reduce((innerAcc, innerCurr) => innerAcc + Object.values(innerCurr).flat().length, 0), 0
                            )} JIWA
                          </span>
                        </div>
                      </div>
                    </div>
                  
                  <div className="space-y-4 pt-1">
                    {Object.entries(desaGroup).sort().map(([desa, kelompokGroup]) => (
                      <div key={desa} className="space-y-3 pl-2 md:pl-4 border-l-2 border-dashed border-purple-100 relative group-section-desa">
                        {/* DESA HEADER - Static, Acts as Scroll Sentinel */}
                        <div className="desa-scroll-sentinel py-1 bg-white" data-daerah={daerah} data-desa={desa}>
                          <div className="flex items-center gap-2 pl-3 md:pl-4 py-1.5 bg-blue-50/50 rounded-xl border border-blue-100/30">
                            <MapPin size={13} className="text-blue-500" />
                            <h4 className="text-[10px] md:text-[11px] font-black text-slate-700 uppercase tracking-wider leading-none">DESA: {desa}</h4>
                            <div className="h-px bg-blue-100/20 flex-1 mx-2"></div>
                            <span className="text-[9px] font-bold text-blue-500 mr-2">
                              {Object.values(kelompokGroup).reduce((acc, curr) => acc + Object.values(curr).flat().length, 0)} JIWA
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3 pl-2 md:pl-4">
                          {Object.entries(kelompokGroup).sort().map(([kelompok, ageGroups]) => (
                            <div key={kelompok} className="space-y-2 relative group-section-kelompok">
                              {/* KELOMPOK HEADER - Sticky right below the Daerah/Desa sticky zone */}
                              <div className="sticky top-[100px] md:top-[124px] z-10 py-1 bg-white/95 backdrop-blur-sm rounded-lg -mx-2 px-2">
                                <div className="flex items-center gap-2 pl-3 border-l-2 border-emerald-400 py-1 bg-emerald-50/20 rounded-r-lg">
                                  <Users size={11} className="text-emerald-500" />
                                  <h5 className="text-[9px] font-bold text-slate-600 uppercase tracking-wider leading-none">KELOMPOK: {kelompok}</h5>
                                  <div className="h-px bg-slate-100 flex-1 mx-2"></div>
                                  <span className="text-[8px] font-black text-slate-400 mr-3">{Object.values(ageGroups).flat().length} ANGGOTA</span>
                                </div>
                              </div>

                              <div className="space-y-4 pl-3 md:pl-6">
                                {Object.entries(ageGroups).sort().map(([age, members]) => (
                                  <div key={age} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Calendar size={10} className="text-slate-300" />
                                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{age}</span>
                                      <div className="h-px bg-slate-50 flex-1 ml-2"></div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2">
                                      {members.map((member) => (
                                        <motion.div 
                                          key={member.id}
                                          initial={{ opacity: 0, y: 5 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          onClick={() => { setSelectedMember(member); setShowDetailModal(true); }}
                                          className="group bg-slate-50/40 border border-slate-100 hover:bg-white rounded-xl p-2.5 md:py-3.5 md:px-5 hover:shadow-md hover:border-blue-100 transition-all duration-200 cursor-pointer active:scale-[0.995]"
                                        >
                                          <div className="flex items-center gap-3 md:gap-6 font-sans">
                                            {/* Primary Icon */}
                                            <div className={`shrink-0 w-8 h-8 md:w-11 md:h-11 rounded-lg flex items-center justify-center ${member.jenis_kelamin === 'Laki-laki' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                                              <User size={16} className="md:w-5 md:h-5" />
                                            </div>
                                            
                                            <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 items-center gap-1 md:gap-4">
                                              {/* Name & ID column */}
                                              <div className="md:col-span-4 min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <h4 className="text-[11px] md:text-sm font-bold text-slate-800 truncate uppercase">{member.nama_lengkap}</h4>
                                                  <span className="px-1.5 py-0.5 bg-slate-150/50 text-[8px] font-mono font-bold text-slate-400 rounded-md shrink-0 border border-slate-100">#{member.id.slice(-4)}</span>
                                                </div>
                                                {/* Mobile view only stacked info */}
                                                <div className="flex items-center gap-2 mt-0.5 md:hidden">
                                                  <span className={`text-[7px] font-medium uppercase tracking-widest ${member.jenis_kelamin === 'Laki-laki' ? 'text-blue-400' : 'text-rose-400'}`}>{member.jenis_kelamin}</span>
                                                  <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                  <span className="text-[7px] font-medium text-slate-400 uppercase">{formatDisplayDate(member.tanggal_lahir)}</span>
                                                  {member.tempat_lahir && (
                                                    <>
                                                      <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                      <span className="text-[7px] font-medium text-slate-400 uppercase italic truncate max-w-[80px]">{member.tempat_lahir}</span>
                                                    </>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Desktop columns */}
                                              <div className="hidden md:flex md:col-span-2 justify-center items-center">
                                                <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 ${member.jenis_kelamin === 'Laki-laki' ? 'bg-blue-50/50 text-blue-600' : 'bg-rose-50/50 text-rose-600'}`}>
                                                  <div className={`w-1.5 h-1.5 rounded-full ${member.jenis_kelamin === 'Laki-laki' ? 'bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
                                                  <span className="text-[10px] font-bold uppercase tracking-wider">{member.jenis_kelamin}</span>
                                                </div>
                                              </div>

                                              <div className="hidden md:flex md:col-span-3 items-center">
                                                <div className="flex items-center gap-2">
                                                  <Calendar size={12} className="text-slate-400" />
                                                  <span className="text-[11px] font-bold text-slate-600 uppercase tabular-nums">{formatDisplayDate(member.tanggal_lahir) || '-'}</span>
                                                </div>
                                              </div>

                                              <div className="hidden md:flex md:col-span-3 items-center">
                                                <div className="flex items-center gap-2">
                                                  <MapPin size={12} className="text-slate-400" />
                                                  <span className="text-[11px] font-bold text-slate-600 uppercase truncate">{member.tempat_lahir || '-'}</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </motion.div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ); })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence mode="wait">
        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => {
                setShowImportModal(false);
                setImportPreview([]);
                setImportWarnings([]);
                setImportError('');
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative bg-white w-full ${importPreview.length > 0 ? 'md:max-w-7xl md:max-h-[92vh]' : 'md:max-w-3xl md:max-h-[85vh]'} h-full md:h-auto rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300`}
            >
              {/* Header */}
              <div className="px-5 md:px-8 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-base md:text-xl font-black text-slate-900 leading-tight">Impor Massal Anggota</h3>
                  <p className="text-[9px] md:text-xs text-slate-400 mt-0.5 uppercase font-black tracking-widest leading-none">Unggah File Excel atau CSV Anda</p>
                </div>
                <button 
                  onClick={() => {
                    setShowImportModal(false);
                    setImportPreview([]);
                    setImportWarnings([]);
                    setImportError('');
                  }} 
                  className="w-8 h-8 md:w-10 md:h-10 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-full flex items-center justify-center transition-all active:scale-90"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 no-scrollbar">
                
                {/* PREVIEW OF SUCCESSFULLY PARSED RECORDS - HIGHEST PRIORITY AT THE TOP */}
                {importPreview.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/50 border border-emerald-100/50 p-3 rounded-xl">
                      <div>
                        <h4 className="text-xs md:text-sm font-black text-slate-800 flex items-center gap-2">
                          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          Pratinjau Data yang Terbaca ({importPreview.length} Anggota)
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Semua data kolom di bawah berhasil dibaca dari excel Anda. Silakan verifikasi kecocokannya.</p>
                      </div>
                      <span className="text-[9px] w-fit uppercase tracking-widest text-emerald-700 bg-emerald-100/70 font-black px-2.5 py-1 rounded-lg border border-emerald-200">
                        Siap Diimpor
                      </span>
                    </div>
                    
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto overflow-x-auto shadow-sm custom-scrollbar bg-slate-50">
                      <table className="w-full text-left text-xs border-collapse font-sans bg-white min-w-[1500px]">
                        <thead className="sticky top-0 bg-slate-100 text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-200 z-10 shadow-sm">
                          <tr>
                            <th className="p-3 text-center w-12 bg-slate-100">No</th>
                            <th className="p-3 whitespace-nowrap min-w-[200px] bg-slate-100">Nama Lengkap</th>
                            <th className="p-3 whitespace-nowrap min-w-[110px] text-center">Jenis Kelamin</th>
                            <th className="p-3 whitespace-nowrap min-w-[140px]">ID Daerah (Opsional)</th>
                            <th className="p-3 whitespace-nowrap min-w-[150px]">ID Desa</th>
                            <th className="p-3 whitespace-nowrap min-w-[150px]">ID Kelompok</th>
                            <th className="p-3 whitespace-nowrap min-w-[150px]">ID Kategori Usia</th>
                            <th className="p-3 whitespace-nowrap min-w-[130px]">No. HP Anggota</th>
                            <th className="p-3 whitespace-nowrap min-w-[150px]">Nama Orang Tua</th>
                            <th className="p-3 whitespace-nowrap min-w-[130px]">No. HP Orang Tua</th>
                            <th className="p-3 whitespace-nowrap min-w-[140px]">Pekerjaan Orang Tua</th>
                            <th className="p-3 whitespace-nowrap min-w-[130px]">Pendidikan Terakhir</th>
                            <th className="p-3 whitespace-nowrap min-w-[110px] text-center">Kelas/Sem</th>
                            <th className="p-3 whitespace-nowrap min-w-[130px]">Tempat Lahir</th>
                            <th className="p-3 whitespace-nowrap min-w-[110px] text-center">Tgl Lahir</th>
                            <th className="p-3 whitespace-nowrap min-w-[250px]">Alamat Rumah</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-700">
                          {importPreview.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-blue-50/20 transition-colors leading-relaxed">
                              <td className="p-3 text-center text-slate-400 font-mono text-[10px] border-r border-slate-100 bg-slate-50/50">{rIdx + 1}</td>
                              <td className="p-3 font-bold uppercase text-slate-900 border-r border-slate-100 sticky left-0 bg-white hover:bg-slate-50">{row.nama_lengkap}</td>
                              <td className="p-3 whitespace-nowrap text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${row.jenis_kelamin === 'Laki-laki' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                                  {row.jenis_kelamin}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="text-[10px] font-bold text-slate-700">{row.daerah_name || '-'}</div>
                                <div className="text-[8px] text-slate-400 font-mono">{row.daerah_id || '-'}</div>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="text-[10px] font-bold text-slate-850">{row.desa_name || '-'}</div>
                                <div className="text-[8px] text-slate-400 font-mono">{row.desa_id || '-'}</div>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="text-[10px] font-bold text-slate-850">{row.kelompok_name || '-'}</div>
                                <div className="text-[8px] text-slate-400 font-mono">{row.kelompok_id || '-'}</div>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="text-[10px] font-bold text-slate-850">{row.age_category_name || '-'}</div>
                                <div className="text-[8px] text-slate-400 font-mono">{row.age_category_id || '-'}</div>
                              </td>
                              <td className="p-3 font-mono text-[10.5px] text-slate-600 whitespace-nowrap">{row.no_hp_anggota || '-'}</td>
                              <td className="p-3 text-slate-800 whitespace-nowrap uppercase font-bold text-[10px]">{row.nama_ortu || '-'}</td>
                              <td className="p-3 font-mono text-[10.5px] text-slate-600 whitespace-nowrap bg-amber-50/30">{row.no_hp_ortu || '-'}</td>
                              <td className="p-3 text-slate-600 text-[10px] whitespace-nowrap">{row.pekerjaan_ortu || '-'}</td>
                              <td className="p-3 text-slate-600 text-[10px] whitespace-nowrap">{row.pendidikan || '-'}</td>
                              <td className="p-3 text-slate-600 text-[10px] text-center whitespace-nowrap">{row.kelas || '-'}</td>
                              <td className="p-3 text-slate-600 text-[10px] whitespace-nowrap">{row.tempat_lahir || '-'}</td>
                              <td className="p-3 font-mono text-[10px] text-center text-slate-600 whitespace-nowrap">{row.tanggal_lahir || '-'}</td>
                              <td className="p-3 text-slate-500 text-[10px] max-w-[250px] truncate" title={row.alamat_rumah}>{row.alamat_rumah || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* STEPS 1 & 2: Dynamic Layout (Collapsed if Preview has Data) */}
                {importPreview.length > 0 ? (
                  <div className="bg-slate-50 rounded-2xl border border-slate-150 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Opsi Tambahan / Unggah Ulang</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Step 1 download compact */}
                      <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex items-center justify-between hover:shadow-sm transition-shadow">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-slate-700 truncate">Template Format Excel</p>
                          <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Gunakan format standar agar tidak salah terbaca.</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadTemplate}
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-600 rounded-lg text-xs font-bold transition-all shrink-0"
                        >
                          <Download size={12} />
                          Unduh
                        </button>
                      </div>

                      {/* Step 2 upload again compact */}
                      <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex items-center justify-between hover:border-blue-300 hover:shadow-sm transition-all relative cursor-pointer group">
                        <input 
                          type="file" 
                          accept=".xlsx, .xls, .csv" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) parseAndPreviewFile(file);
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="min-w-0 pr-21">
                          <p className="text-xs font-bold text-slate-700 truncate">Unggah File Lain</p>
                          <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Ganti dengan file excel yang telah dikoordinir.</p>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                          <Upload size={12} />
                          Pilih File
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Step 1: Download Template */}
                    <div className="bg-blue-50/50 border border-blue-100/60 rounded-xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <Download size={16} className="text-blue-600" />
                          1. Unduh Template Format
                        </h4>
                        <p className="text-[10px] md:text-xs text-slate-500">Gunakan format Excel standar agar data terpetakan otomatis ke sistem database.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-xs font-bold shadow-sm shadow-blue-100 transition-all shrink-0 self-start md:self-auto"
                      >
                        <Download size={14} />
                        Unduh Template
                      </button>
                    </div>

                    {/* Step 2: Upload Area */}
                    <div className="space-y-2">
                      <h4 className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Upload size={16} className="text-blue-600" />
                        2. Pilih atau Seret File Anda
                      </h4>
                      
                      <div 
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-6 md:p-10 text-center cursor-pointer transition-colors relative bg-slate-50/30 group"
                      >
                        <input 
                          type="file" 
                          accept=".xlsx, .xls, .csv" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) parseAndPreviewFile(file);
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="space-y-2 pointer-events-none">
                          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-slate-100 text-slate-400 group-hover:text-blue-500 transition-all">
                            <Upload size={20} />
                          </div>
                          <p className="text-xs font-bold text-slate-700">Klik untuk memilih file, atau seret ke sini</p>
                          <p className="text-[10px] text-slate-400">Mendukung format .XLSX, .XLS, dan .CSV</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Parsing Status indicator */}
                {isParsing && (
                  <div className="flex items-center justify-center py-6 gap-3">
                    <Loader2 className="animate-spin text-blue-600" size={20} />
                    <p className="text-xs font-medium text-slate-600 animate-pulse">Mengurai data file & memvalidasi keanggotaan...</p>
                  </div>
                )}

                {/* General Parsing Error */}
                {importError && (
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 flex items-start gap-3 text-rose-700">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold">Kesalahan Penguraian</p>
                      <p className="text-[10px] leading-relaxed">{importError}</p>
                    </div>
                  </div>
                )}

                {/* Parsing Alerts or Corrections Warnings */}
                {importWarnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 space-y-2">
                    <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <AlertCircle size={15} />
                      Catatan Validasi ({importWarnings.length})
                    </p>
                    <div className="max-h-[120px] overflow-y-auto text-[10px] text-amber-700 leading-relaxed font-mono space-y-1 custom-scrollbar">
                      {importWarnings.map((warn, wIdx) => (
                        <div key={wIdx}>• {warn}</div>
                      ))}
                    </div>
                    <p className="text-[9px] text-amber-600/80">Sistem melakukan pemetaan otomatis ke Desa, Kelompok, atau Kategori Usia terdekat bila penulisan sedikit berbeda.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 md:px-8 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
                <span className="text-[10px] text-slate-400 font-medium">Pastikan seluruh data wajib (Nama Lengkap, Desa, Kelompok) sudah sesuai.</span>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportPreview([]);
                      setImportWarnings([]);
                      setImportError('');
                    }}
                    className="flex-1 md:flex-none px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold transition-all active:scale-95"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={importPreview.length === 0 || isSubmittingImport}
                    onClick={handleCommitImport}
                    className="flex-1 md:flex-none px-6 py-2.5 bg-blue-600 hover:bg-blue-700 hover:shadow-lg disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shadow-blue-200"
                  >
                    {isSubmittingImport ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        Proses...
                      </>
                    ) : (
                      `Simpan ${importPreview.length} Jiwa`
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Form Modal */}
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full md:max-w-4xl h-full md:h-auto md:max-h-[90vh] rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="px-4 md:px-12 py-4 md:py-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg md:text-2xl font-black text-slate-900 leading-tight">
                      {editingMember ? 'Metamorfosis Data' : 'Pendaftaran Anggota'}
                    </h3>
                    {editingMember === null && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] md:text-[9px] font-black uppercase rounded-full border border-emerald-200 animate-pulse tracking-wider">
                        📝 Draft Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] md:text-xs text-slate-400 mt-0.5 md:mt-1 uppercase font-black tracking-[0.2em]">Formulir Digital Administrasi</p>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2">
                  {editingMember === null && (
                    <button 
                      type="button" 
                      onClick={() => setShowModal(false)} 
                      className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-full flex items-center justify-center transition-all active:scale-90"
                      title="Minimalkan ke Draft"
                    >
                      <Minimize2 size={16} />
                    </button>
                  )}
                  <button onClick={() => setShowModal(false)} className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-full flex items-center justify-center transition-all active:scale-90" title="Tutup">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-12 space-y-8 md:space-y-12 no-scrollbar">
                {/* Section: Identitas Utama */}
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-50 text-blue-600 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                      <User size={16} className="md:w-5 md:h-5" />
                    </div>
                    <h4 className="text-[10px] md:text-sm font-black text-slate-700 uppercase tracking-widest">Identitas Dasar</h4>
                    <div className="h-px bg-slate-100 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                    <div className="space-y-1 md:space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nama Lengkap *</label>
                       <input 
                         required type="text" value={formData.nama_lengkap}
                         onChange={e => setFormData({...formData, nama_lengkap: e.target.value})}
                         className="w-full px-4 md:px-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold placeholder:text-slate-300"
                         placeholder="Masukan Nama Anggota"
                       />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Jenis Kelamin</label>
                       <ModernSelect 
                         value={formData.jenis_kelamin || ''}
                         onChange={val => setFormData({...formData, jenis_kelamin: val as any})}
                         options={[{ value: 'Laki-laki', label: 'Laki-laki' }, { value: 'Perempuan', label: 'Perempuan' }]}
                       />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Kontak WhatsApp</label>
                       <div className="relative">
                          <Phone className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                          <input 
                            type="text" value={formData.no_hp_anggota}
                            onChange={e => setFormData({...formData, no_hp_anggota: e.target.value})}
                            className="w-full pl-10 md:pl-12 pr-4 md:pr-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold"
                            placeholder="085123xxx"
                          />
                       </div>
                    </div>
                    <div className="space-y-1 md:space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tempat Lahir</label>
                          <input 
                            type="text" value={formData.tempat_lahir}
                            onChange={e => setFormData({...formData, tempat_lahir: e.target.value})}
                            className="w-full px-4 md:px-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold"
                            placeholder="Masukan kota lahir"
                          />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tanggal Lahir</label>
                       <div className="relative">
                          <Calendar className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                          <input 
                            type="date" value={formData.tanggal_lahir}
                            onChange={e => setFormData({...formData, tanggal_lahir: e.target.value})}
                            className="w-full pl-10 md:pl-12 pr-4 md:pr-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold text-slate-600"
                          />
                       </div>
                    </div>
                    <div className="space-y-1 md:space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Kategori Usia *</label>
                       <ModernSelect 
                         value={String(formData.age_category_id || '')}
                         onChange={val => setFormData({...formData, age_category_id: val})}
                         options={ages.map(a => ({ value: String(a.id), label: a.name }))}
                         placeholder="Pilih Kategori"
                       />
                    </div>
                    <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {/* RFID Card */}
                      <div className="space-y-1 md:space-y-2">
                         <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Registrasi ID Card RFID / NFC</label>
                         {formData.rfid ? (
                           <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl md:rounded-2xl">
                             <div className="flex items-center gap-2.5">
                               <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                                 <CheckCircle2 size={12} />
                               </div>
                               <div>
                                 <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">ID Card Terhubung</p>
                                 <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-tight font-mono">{formData.rfid}</p>
                               </div>
                             </div>
                             <button
                               type="button"
                               onClick={() => setFormData(prev => ({ ...prev, rfid: '' }))}
                               className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest px-2.5 py-1 bg-white border border-rose-100 rounded-lg hover:shadow-sm transition-all"
                             >
                               Hapus
                             </button>
                           </div>
                         ) : isScanningRfid ? (
                           <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl md:rounded-2xl space-y-2.5">
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                 <span className="relative flex h-2 w-2">
                                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                   <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                 </span>
                                 <p className="text-[10px] font-black text-blue-800 uppercase tracking-wider">Menunggu Tap ID Card...</p>
                               </div>
                               <button
                                 type="button"
                                 onClick={() => setIsScanningRfid(false)}
                                 className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                                >
                                 Batal
                               </button>
                             </div>
                             <div className="relative">
                               <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 animate-pulse" size={12} />
                               <input 
                                 type="text"
                                 autoFocus
                                 onKeyDown={e => {
                                   if (e.key === 'Enter') {
                                     e.preventDefault();
                                     e.stopPropagation();
                                     const val = (e.target as HTMLInputElement).value.trim();
                                     if (val) {
                                       setFormData(prev => ({ ...prev, rfid: val }));
                                       setIsScanningRfid(false);
                                     }
                                   }
                                 }}
                                 className="w-full pl-9 pr-3 py-2 bg-white border border-blue-300 rounded-xl outline-none focus:border-blue-500 transition-all text-xs font-bold text-slate-800"
                                 placeholder="Tap kartu ke Reader..."
                               />
                             </div>
                             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed text-center">
<<<<<<< HEAD
                               Dekatkan kartu RFID pada reader. Kode akan otomatis terinput.
=======
                               {typeof window !== 'undefined' && 'NDEFReader' in window ? "📱 NFC BROWSER HP AKTIF: CUKUP TEMPEL KARTU KE BELAKANG HP ANDA!" : "Dekatkan kartu RFID pada reader. Kode akan otomatis terinput."}
>>>>>>> 32a6d8fbb3b92b999e7fbe01485aac778753e9a0
                             </p>
                           </div>
                         ) : (
                           <button
                             type="button"
                             onClick={() => {
                               setIsScanningRfid(true);
                               setIsScanningRfidKtp(false);
                             }}
                             className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-50 border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/20 rounded-xl md:rounded-2xl transition-all group"
                           >
                             <CreditCard className="text-slate-400 group-hover:text-blue-500 transition-colors" size={14} />
                             <span className="text-xs font-black text-slate-500 group-hover:text-blue-600 uppercase tracking-widest">Daftarkan ID Card</span>
                           </button>
                         )}
                      </div>

                      {/* E-KTP NFC Card */}
                      <div className="space-y-1 md:space-y-2">
                         <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Registrasi E-KTP / NFC Card</label>
                         {formData.rfid_ktp ? (
                           <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-200 rounded-xl md:rounded-2xl">
                             <div className="flex items-center gap-2.5">
                               <div className="w-6 h-6 rounded-lg bg-violet-500 text-white flex items-center justify-center shadow-sm">
                                 <CheckCircle2 size={12} />
                               </div>
                               <div>
                                 <p className="text-[10px] font-black text-violet-800 uppercase tracking-wider">E-KTP Terhubung</p>
                                 <p className="text-[9px] text-violet-600 font-bold uppercase tracking-tight font-mono">{formData.rfid_ktp}</p>
                               </div>
                             </div>
                             <button
                               type="button"
                               onClick={() => setFormData(prev => ({ ...prev, rfid_ktp: '' }))}
                               className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest px-2.5 py-1 bg-white border border-rose-100 rounded-lg hover:shadow-sm transition-all"
                             >
                               Hapus
                             </button>
                           </div>
                         ) : isScanningRfidKtp ? (
                           <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl md:rounded-2xl space-y-2.5">
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                 <span className="relative flex h-2 w-2">
                                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                                   <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                                 </span>
                                 <p className="text-[10px] font-black text-violet-800 uppercase tracking-wider">Menunggu Tap E-KTP...</p>
                               </div>
                               <button
                                 type="button"
                                 onClick={() => setIsScanningRfidKtp(false)}
                                 className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                               >
                                 Batal
                               </button>
                             </div>
                             <div className="relative">
                               <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400 animate-pulse" size={12} />
                               <input 
                                 type="text"
                                 autoFocus
                                 onKeyDown={e => {
                                   if (e.key === 'Enter') {
                                     e.preventDefault();
                                     e.stopPropagation();
                                     const val = (e.target as HTMLInputElement).value.trim();
                                     if (val) {
                                       setFormData(prev => ({ ...prev, rfid_ktp: val }));
                                       setIsScanningRfidKtp(false);
                                     }
                                   }
                                 }}
                                 className="w-full pl-9 pr-3 py-2 bg-white border border-violet-300 rounded-xl outline-none focus:border-violet-500 transition-all text-xs font-bold text-slate-800"
                                 placeholder="Tap E-KTP ke Reader..."
                               />
                             </div>
                             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed text-center">
<<<<<<< HEAD
                               Dekatkan E-KTP pada reader. Kode NFC akan otomatis terinput.
=======
                               {typeof window !== 'undefined' && 'NDEFReader' in window ? "📱 NFC BROWSER HP AKTIF: CUKUP TEMPEL E-KTP KE BELAKANG HP ANDA!" : "Dekatkan E-KTP pada reader. Kode NFC akan otomatis terinput."}
>>>>>>> 32a6d8fbb3b92b999e7fbe01485aac778753e9a0
                             </p>
                           </div>
                         ) : (
                           <button
                             type="button"
                             onClick={() => {
                               setIsScanningRfidKtp(true);
                               setIsScanningRfid(false);
                             }}
                             className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-50 border border-dashed border-slate-300 hover:border-violet-400 hover:bg-violet-50/20 rounded-xl md:rounded-2xl transition-all group"
                           >
                             <CreditCard className="text-slate-400 group-hover:text-violet-500 transition-colors" size={14} />
                             <span className="text-xs font-black text-slate-500 group-hover:text-violet-600 uppercase tracking-widest">Daftarkan E-KTP (NFC)</span>
                           </button>
                         )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Afiliasi & Penempatan */}
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-50 text-emerald-600 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                      <MapPin size={16} className="md:w-5 md:h-5" />
                    </div>
                    <h4 className="text-[10px] md:text-sm font-black text-slate-700 uppercase tracking-widest">Penempatan</h4>
                    <div className="h-px bg-slate-100 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <div className="space-y-1 md:space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Daerah Terdaftar</label>
                       <ModernSelect 
                         value={String(formData.daerah_id || '')}
                         onChange={val => {
                           // When Daerah is changed, if the current desa belongs to a different daerah, reset desa & kelompok
                           const matchedDesa = desas.find(d => String(d.id) === String(formData.desa_id));
                           const needsReset = matchedDesa && String(matchedDesa.daerah_id) !== String(val);
                           setFormData({
                             ...formData,
                             daerah_id: val,
                             desa_id: needsReset ? '' : formData.desa_id,
                             kelompok_id: needsReset ? '' : formData.kelompok_id
                           });
                         }}
                         options={(daerahs || []).map(d => ({ value: String(d.id), label: d.nama_daerah }))}
                         placeholder="Pilih Daerah"
                       />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Desa Terdaftar *</label>
                       <ModernSelect 
                         value={String(formData.desa_id || '')}
                         onChange={val => {
                           const matchedDesaDoc = desas.find(d => String(d.id) === String(val));
                           const targetDaerahId = matchedDesaDoc?.daerah_id || formData.daerah_id || '';
                           const allowedKlp = kelompoks.filter(k => String(k.desa_id) === String(val));
                           const isCurrentAllowed = allowedKlp.some(k => String(k.id) === String(formData.kelompok_id));
                           const newKelompokId = isCurrentAllowed ? formData.kelompok_id : (allowedKlp.length > 0 ? allowedKlp[0].id : '');
                           setFormData({
                             ...formData,
                             daerah_id: targetDaerahId,
                             desa_id: val,
                             kelompok_id: newKelompokId
                           });
                         }}
                         options={desas
                           .filter(d => !formData.daerah_id || String(d.daerah_id) === String(formData.daerah_id))
                           .map(d => ({ value: String(d.id), label: d.nama_desa }))}
                         placeholder="Pilih Desa Asal"
                       />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Kelompok *</label>
                       <ModernSelect 
                         value={String(formData.kelompok_id || '')}
                         onChange={val => setFormData({...formData, kelompok_id: val})}
                         options={kelompoks
                           .filter(k => !formData.desa_id || !k.desa_id || String(k.desa_id) === String(formData.desa_id))
                           .map(k => ({ value: String(k.id), label: k.nama_kelompok }))}
                         placeholder="Pilih Kelompok"
                       />
                    </div>
                    <div className="space-y-1 md:space-y-2 md:col-span-2">
                        <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Alamat Tinggal Lengkap</label>
                        <div className="relative">
                          <Home className="absolute left-3 md:left-4 top-4 md:top-5 text-slate-300" size={14} />
                          <textarea 
                            value={formData.alamat_rumah}
                            onChange={e => setFormData({...formData, alamat_rumah: e.target.value})}
                            className="w-full pl-10 md:pl-12 pr-4 md:pr-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold min-h-[80px] md:min-h-[100px] resize-none"
                            placeholder="Alamat lengkap..."
                          />
                        </div>
                    </div>
                  </div>
                </div>

                {/* Section: Keluarga & Peranan */}
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-amber-50 text-amber-600 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                      <Users size={16} className="md:w-5 md:h-5" />
                    </div>
                    <h4 className="text-[10px] md:text-sm font-black text-slate-700 uppercase tracking-widest">Keluarga &amp; Peranan</h4>
                    <div className="h-px bg-slate-100 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                    <div className="space-y-1 md:space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Hubungkan Keluarga / KK</label>
                       <ModernSelect 
                         value={String(formData.family_id || '')}
                         onChange={val => setFormData({...formData, family_id: val})}
                         options={[
                           { value: '', label: '-- Tanpa Keluarga (Pribadi) --' },
                           ...(families || []).map(f => ({ 
                             value: String(f.id), 
                             label: `${f.nama_keluarga} ${f.nomor_kk ? `(KK: ${f.nomor_kk})` : ''}` 
                           }))
                         ]}
                         placeholder="Pilih Keluarga"
                       />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Peranan / Hubungan</label>
                       <ModernSelect 
                         value={String(formData.relationship_id || '')}
                         onChange={val => setFormData({...formData, relationship_id: val})}
                         options={[
                           { value: '', label: '-- Tanpa Hubungan --' },
                           ...(relationships || []).map(r => ({ 
                             value: String(r.id), 
                             label: `${r.name} ${r.is_wali ? '(👑 Wali)' : ''}` 
                           }))
                         ]}
                         placeholder="Pilih Peranan"
                       />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pekerjaan Anggota</label>
                       <div className="relative">
                          <Briefcase className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                          <input 
                            type="text" value={formData.pekerjaan || ''}
                            onChange={e => setFormData({...formData, pekerjaan: e.target.value})}
                            className="w-full pl-10 md:pl-12 pr-4 md:pr-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold"
                            placeholder="Wiraswasta, Pelajar, dsb"
                          />
                       </div>
                    </div>
                  </div>

                  {formData.family_id && (
                    <div className="p-4 bg-amber-50/30 border border-amber-100 rounded-2xl space-y-2">
                      <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Deteksi Otomatis Orang Tua / Wali:</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-white/80 p-2.5 rounded-xl border border-amber-100/40">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Nama Ayah (Wali)</p>
                          <p className="text-xs font-black text-slate-700">{
                            members.find(m => m.family_id === formData.family_id && relationships.find(r => r.id === m.relationship_id)?.name.toLowerCase() === 'ayah')?.nama_lengkap || '-'
                          }</p>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-amber-100/40">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Nama Ibu (Wali)</p>
                          <p className="text-xs font-black text-slate-700">{
                            members.find(m => m.family_id === formData.family_id && relationships.find(r => r.id === m.relationship_id)?.name.toLowerCase() === 'ibu')?.nama_lengkap || '-'
                          }</p>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-amber-100/40">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">No. HP Wali Utama</p>
                          <p className="text-xs font-black text-slate-700">{
                            members.find(m => m.family_id === formData.family_id && relationships.find(r => r.id === m.relationship_id)?.is_wali)?.no_hp_anggota || '-'
                          }</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section: Pendidikan */}
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-50 text-indigo-600 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                      <GraduationCap size={16} className="md:w-5 md:h-5" />
                    </div>
                    <h4 className="text-[10px] md:text-sm font-black text-slate-700 uppercase tracking-widest">Pendidikan</h4>
                    <div className="h-px bg-slate-100 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    <div className="space-y-1 md:space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pendidikan Terakhir</label>
                        <input 
                          type="text" value={formData.pendidikan}
                          onChange={e => setFormData({...formData, pendidikan: e.target.value})}
                          className="w-full px-4 md:px-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold"
                          placeholder="SD, SMP, dsb"
                        />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Kelas / Semester</label>
                        <input 
                          type="text" value={formData.kelas}
                          onChange={e => setFormData({...formData, kelas: e.target.value})}
                          className="w-full px-4 md:px-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold"
                          placeholder="Tingkatan"
                        />
                    </div>
                  </div>
                </div>
              </form>

              <div className="p-4 md:px-12 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 w-full md:w-auto">
                  {editingMember === null && hasDraftContent && (
                    <button 
                      type="button"
                      onClick={() => {
                        if (window.confirm("Apakah Anda yakin ingin menghapus seluruh isi formulir ini dan mulai baru?")) {
                          try {
                            localStorage.removeItem('absensi_member_registration_draft');
                          } catch (e) {
                            console.error(e);
                          }
                          setFormData({
                            nama_lengkap: '', daerah_id: '', desa_id: '', kelompok_id: '', age_category_id: '',
                            tempat_lahir: '', tanggal_lahir: '', no_hp_anggota: '', jenis_kelamin: 'Laki-laki',
                            nama_ortu: '', no_hp_ortu: '', pekerjaan_ortu: '', alamat_rumah: '', pendidikan: '', kelas: '',
                            rfid: '', rfid_ktp: '', family_id: '', relationship_id: '', pekerjaan: ''
                          });
                        }
                      }}
                      className="w-full md:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-xl font-bold text-[9px] md:text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 border border-slate-200"
                    >
                      <RotateCcw size={14} />
                      Mulai Baru (Reset)
                    </button>
                  )}
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-2.5 w-full md:w-auto justify-end">
                  {editingMember === null && (
                    <button 
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="w-full md:w-auto px-5 py-3 md:py-4 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Minimize2 size={14} />
                      Minimalkan Form
                    </button>
                  )}
                  <button 
                    onClick={handleSubmit} disabled={isSubmitting}
                    className="w-full md:w-auto px-6 md:px-10 py-3 md:py-4 bg-blue-600 text-white rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-blue-600/30 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Simpan Data
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedMember && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDetailModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 10 }}
              className="relative bg-white w-full max-w-[92%] md:max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[78vh] md:max-h-[80vh]"
            >
              {/* Profile Header */}
              <div className={`relative px-5 py-3 md:px-8 md:py-8 overflow-hidden shrink-0 ${selectedMember.jenis_kelamin === 'Laki-laki' ? 'bg-gradient-to-br from-blue-600 to-indigo-700' : 'bg-gradient-to-br from-rose-500 to-pink-600'}`}>
                {/* Decorative background circle */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                
                <div className="relative flex items-center gap-4 md:gap-6">
                  <div className="w-12 h-12 md:w-20 md:h-20 rounded-xl bg-white p-1 shadow-lg relative shrink-0">
                    <div className={`w-full h-full rounded-lg flex items-center justify-center ${selectedMember.jenis_kelamin === 'Laki-laki' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                       <User size={selectedMember.id ? 24 : 36} className="md:w-10 md:h-10" />
                    </div>
                    {/* Status indicator for desktop */}
                    <div className="hidden md:flex absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full items-center justify-center shadow-lg">
                       <CheckCircle2 size={12} className="text-white" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                      <h3 className="text-base md:text-2xl font-bold text-white uppercase tracking-tight truncate leading-none">{selectedMember.nama_lengkap}</h3>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[8px] md:text-[10px] font-bold text-white/90 uppercase tracking-wider">{selectedMember.id}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 md:mt-3">
                       <span className="px-2 py-0.5 md:px-3 md:py-1 bg-white/10 rounded-md text-[7px] md:text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm border border-white/10">{selectedMember.jenis_kelamin}</span>
                       <span className="px-2 py-0.5 md:px-3 md:py-1 bg-white/10 rounded-md text-[7px] md:text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm border border-white/10">{selectedMember.age_category_name}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail Content Scroller */}
              <div className="relative -mt-2 md:-mt-4 bg-white rounded-t-xl md:rounded-t-3xl p-3 md:p-8 overflow-y-auto no-scrollbar flex-1">
                <div className="space-y-6 md:space-y-8">
                   {/* Primary Grid - 2 columns on desktop */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                      {/* Domisili */}
                      <div className="flex gap-3 items-start">
                         <div className="w-9 h-9 md:w-12 md:h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                            <MapPin size={18} />
                         </div>
                         <div className="min-w-0">
                            <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Domisili (Kelompok)</p>
                            <p className="text-xs md:text-sm font-medium text-slate-700">{selectedMember.desa_name} / {selectedMember.kelompok_name}</p>
                         </div>
                      </div>

                      {/* Kontak */}
                      <div className="flex gap-3 items-start">
                         <div className="w-9 h-9 md:w-12 md:h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                            <Smartphone size={18} />
                         </div>
                         <div className="min-w-0">
                            <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Kontak WhatsApp</p>
                            <p className="text-xs md:text-sm font-medium text-slate-700">{selectedMember.no_hp_anggota || 'Belum terdata'}</p>
                         </div>
                      </div>

                      {/* Kelahiran */}
                      <div className="flex gap-3 items-start">
                         <div className="w-9 h-9 md:w-12 md:h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                            <Calendar size={18} />
                         </div>
                         <div className="min-w-0">
                            <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Kelahiran</p>
                            <p className="text-xs md:text-sm font-medium text-slate-700">
                               {selectedMember.tempat_lahir || selectedMember.tanggal_lahir 
                                 ? [selectedMember.tempat_lahir, formatDisplayDate(selectedMember.tanggal_lahir)].filter(Boolean).join(', ') 
                                 : 'Belum terdata'}
                            </p>
                         </div>
                      </div>

                      {/* Pendidikan */}
                      <div className="flex gap-3 items-start">
                         <div className="w-9 h-9 md:w-12 md:h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                            <GraduationCap size={18} />
                         </div>
                         <div className="min-w-0">
                            <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Pendidikan</p>
                            <p className="text-xs md:text-sm font-medium text-slate-700">{selectedMember.pendidikan ? `${selectedMember.pendidikan} (Kls ${selectedMember.kelas || '-'})` : 'Belum terdata'}</p>
                         </div>
                      </div>

                      {/* RFID / NFC Card */}
                      <div className="flex gap-3 items-start">
                         <div className={`w-9 h-9 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm transition-all ${selectedMember.rfid ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                            <CreditCard size={18} />
                         </div>
                         <div className="min-w-0">
                            <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">ID Card RFID / NFC</p>
                            {selectedMember.rfid ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider border border-emerald-200/50">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                {selectedMember.rfid}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider border border-slate-200">
                                Belum Terdaftar
                              </span>
                            )}
                         </div>
                      </div>

                      {/* E-KTP NFC Card */}
                      <div className="flex gap-3 items-start">
                         <div className={`w-9 h-9 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm transition-all ${selectedMember.rfid_ktp ? 'bg-violet-50 text-violet-600 border-violet-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                            <CreditCard size={18} />
                         </div>
                         <div className="min-w-0">
                            <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">E-KTP NFC Card</p>
                            {selectedMember.rfid_ktp ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-[10px] font-black uppercase tracking-wider border border-violet-200/50">
                                <span className="h-1.5 w-1.5 rounded-full bg-violet-500"></span>
                                {selectedMember.rfid_ktp}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider border border-slate-200">
                                Belum Terdaftar
                              </span>
                            )}
                         </div>
                      </div>
                   </div>

                   {/* Secondary Info: Family & Address */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                      {/* Family */}
                      <div className="bg-slate-50/50 rounded-2xl p-4 md:p-6 space-y-4 border border-slate-100/50">
                         <div className="flex items-center gap-2 text-slate-400 mb-1">
                            <Users size={14} />
                            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">Keluarga &amp; Peranan</span>
                         </div>
                         <div className="grid grid-cols-1 gap-3">
                            <div className="grid grid-cols-2 gap-2">
                               <div>
                                  <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Keluarga / KK</p>
                                  <p className="text-xs md:text-sm font-black text-slate-700 truncate">{selectedMember.family_name || 'Mandiri / Pribadi'}</p>
                               </div>
                               <div>
                                  <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Hubungan / Peranan</p>
                                  <p className="text-xs md:text-sm font-black text-slate-700 truncate">
                                    {selectedMember.relationship_name || '-'}
                                    {selectedMember.is_wali && <span className="ml-1 text-amber-500 font-extrabold" title="Wali">👑</span>}
                                  </p>
                                </div>
                            </div>
                            <div className="border-t border-dashed border-slate-200/60 my-1"></div>
                            <div>
                               <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Deteksi Orang Tua / Wali</p>
                               <p className="text-xs md:text-sm font-medium text-slate-700 truncate">{selectedMember.nama_ortu || '-'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                               <div>
                                  <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Kontak Wali</p>
                                  <p className="text-xs md:text-sm font-medium text-slate-700">{selectedMember.no_hp_ortu || '-'}</p>
                                </div>
                                <div>
                                   <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Pekerjaan Anggota</p>
                                   <p className="text-xs md:text-sm font-medium text-slate-700 truncate">{selectedMember.pekerjaan || '-'}</p>
                                </div>
                            </div>
                         </div>
                      </div>

                      {/* Address */}
                      <div className="space-y-3">
                         <div className="flex items-center gap-2 text-slate-400">
                            <Home size={14} />
                            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">Alamat Lengkap</span>
                         </div>
                         <div className="p-4 bg-blue-50/30 border border-blue-100/50 rounded-xl h-full min-h-[80px]">
                            <p className="text-xs md:text-sm font-medium text-blue-900 leading-relaxed">
                               {selectedMember.alamat_rumah || 'Data alamat resmi tidak tercatat di profil.'}
                            </p>
                         </div>
                      </div>
                   </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-5 py-3 md:py-4 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center justify-between gap-4">
                <button 
                   onClick={() => setShowDetailModal(false)}
                   className="hidden md:flex px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                >
                   Kembali ke Daftar
                </button>
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                >
                  Tutup
                </button>
                
                <button 
                  onClick={() => downloadMemberCard(selectedMember)}
                  className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl font-bold text-[10px] md:text-xs uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-xs"
                  title="Unduh Kartu & Barcode Code 128"
                >
                  <Download size={14} />
                  <span>Unduh Barcode</span>
                </button>
                
                {canWrite && (
                  <div className="flex items-center gap-2 md:gap-3 flex-1 md:flex-none justify-end">
                    <button 
                      onClick={() => { setShowDetailModal(false); setDeleteConfirmId(selectedMember.id); }}
                      className="w-10 h-10 md:w-12 md:h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center active:scale-90 transition-all hover:bg-rose-100"
                      title="Hapus Anggota"
                    >
                      <Trash2 size={selectedMember.id ? 18 : 20} className="md:w-5 md:h-5" />
                    </button>
                    <button 
                      onClick={() => { setShowDetailModal(false); handleEdit(selectedMember); }}
                      className="flex-1 md:flex-none flex items-center gap-2 px-4 md:px-8 py-2.5 md:py-3 bg-emerald-600 text-white rounded-xl font-bold text-[10px] md:text-xs uppercase tracking-wider shadow-lg shadow-emerald-200 active:scale-95 transition-all hover:bg-emerald-700"
                    >
                      <Edit2 size={14} className="md:w-4 md:h-4" />
                      <span className="md:inline">Ubah Data</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Confirm */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmId(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
               className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 text-center space-y-6"
            >
               <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle size={48} />
               </div>
               <h3 className="text-xl font-bold text-slate-900">Konfirmasi Hapus</h3>
               <p className="text-sm text-slate-500 leading-relaxed pb-4">Apakah Anda yakin ingin menghapus data ini secara permanen?</p>
               <div className="flex flex-col gap-3">
                  <button onClick={() => handleDelete(deleteConfirmId)} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold shadow-lg shadow-rose-100">Hapus Permanen</button>
                  <button onClick={() => setDeleteConfirmId(null)} className="w-full py-4 text-slate-400 font-bold">Batalkan</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FILTER MODAL */}
      <AnimatePresence>
        {showFilterModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilterModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative bg-white w-full max-w-md mx-4 rounded-3xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10"
            >
              {/* Header */}
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <SlidersHorizontal size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-800">Filter Anggota</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Persempit pencarian data</p>
                  </div>
                </div>
                <button 
                  id="close-filter-modal-btn"
                  onClick={() => setShowFilterModal(false)}
                  className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable Filters List */}
              <div className="p-5 overflow-y-auto space-y-4">
                {/* Daerah Selector */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Pilih Daerah</label>
                  <ModernSelect 
                    value={filterDaerah} 
                    onChange={val => {
                      setFilterDaerah(val);
                      if (val !== 'All') {
                        // Check if current filterDesa matches this daerah
                        const dDoc = desas.find(d => String(d.id) === String(filterDesa));
                        if (dDoc && String(dDoc.daerah_id) !== String(val)) {
                          setFilterDesa('All');
                          setFilterKelompok('All');
                        }
                      }
                    }} 
                    options={[
                      { value: 'All', label: 'SEMUA DAERAH' }, 
                      ...(daerahs || []).map(da => ({ value: String(da.id), label: da.nama_daerah.toUpperCase() }))
                    ]}
                    noAnimation
                    icon={Users}
                    placeholder="SEMUA DAERAH"
                    className="w-full"
                  />
                </div>

                {/* Desa Selector */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Pilih Desa</label>
                  <ModernSelect 
                    value={filterDesa} 
                    onChange={val => {
                      setFilterDesa(val);
                      if (val !== 'All') {
                        const matched = kelompoks.find(k => String(k.id) === String(filterKelompok));
                        if (matched && matched.desa_id && String(matched.desa_id) !== String(val)) {
                          setFilterKelompok('All');
                        }
                      }
                    }} 
                    options={[
                      { value: 'All', label: 'SEMUA DESA' }, 
                      ...desas
                        .filter(d => filterDaerah === 'All' || String(d.daerah_id) === String(filterDaerah))
                        .map(d => ({ value: String(d.id), label: d.nama_desa.toUpperCase() }))
                    ]}
                    noAnimation
                    icon={MapPin}
                    placeholder="SEMUA DESA"
                    className="w-full"
                  />
                </div>

                {/* Kelompok Selector */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Pilih Kelompok</label>
                  <ModernSelect 
                    value={filterKelompok} 
                    onChange={setFilterKelompok} 
                    options={[
                      { value: 'All', label: 'SEMUA KELOMPOK' }, 
                      ...kelompoks
                        .filter(k => {
                          const matchedDesa = desas.find(d => String(d.id) === String(k.desa_id));
                          const isDesaMatch = filterDesa === 'All' || !k.desa_id || String(k.desa_id) === String(filterDesa);
                          const isDaerahMatch = filterDaerah === 'All' || !matchedDesa || String(matchedDesa.daerah_id) === String(filterDaerah);
                          return isDesaMatch && isDaerahMatch;
                        })
                        .map(k => ({ value: String(k.id), label: k.nama_kelompok.toUpperCase() }))
                    ]}
                    noAnimation
                    icon={Users}
                    placeholder="SEMUA KELOMPOK"
                    className="w-full"
                  />
                </div>

                {/* Usia Selector */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Kategori Usia</label>
                  <ModernSelect 
                    value={filterAge} 
                    onChange={setFilterAge} 
                    options={[{ value: 'All', label: 'SEMUA KATEGORI USIA' }, ...ages.map(a => ({ value: String(a.id), label: a.name.toUpperCase() }))]}
                    noAnimation
                    icon={Calendar}
                    placeholder="SEMUA KATEGORI USIA"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex gap-2 shrink-0">
                <button 
                  id="reset-filter-modal-btn"
                  onClick={() => {
                    setFilterDaerah('All');
                    setFilterDesa('All');
                    setFilterKelompok('All');
                    setFilterAge('All');
                  }}
                  disabled={!isFilterActive}
                  className="flex-1 py-3 border border-slate-200 text-slate-500 disabled:opacity-50 hover:bg-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-colors active:scale-95 flex items-center justify-center gap-2"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
                <button 
                  id="submit-filter-modal-btn"
                  onClick={() => setShowFilterModal(false)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-blue-100"
                >
                  Terapkan ({filteredMembers.length})
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Floating Action Button */}
      {canWrite && (
        <motion.button 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setEditingMember(null);
            try {
              const savedDraft = localStorage.getItem('absensi_member_registration_draft');
              if (savedDraft) {
                setFormData(JSON.parse(savedDraft));
              } else {
                setFormData({
                  nama_lengkap: '', daerah_id: '', desa_id: '', kelompok_id: '', age_category_id: '',
                  tempat_lahir: '', tanggal_lahir: '', no_hp_anggota: '', jenis_kelamin: 'Laki-laki',
                  nama_ortu: '', no_hp_ortu: '', pekerjaan_ortu: '', alamat_rumah: '', pendidikan: '', kelas: '',
                  rfid: '', rfid_ktp: '', family_id: '', relationship_id: '', pekerjaan: ''
                });
              }
            } catch (e) {
              console.error(e);
            }
            setShowModal(true);
          }}
          className="md:hidden fixed right-6 bottom-24 z-40 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-all"
        >
          <UserPlus size={24} />
        </motion.button>
      )}
    </div>
  );
};

export default MemberManagement;
