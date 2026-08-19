import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  UserPlus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  X,
  Save,
  MapPin,
  Users,
  User,
  Smartphone,
  Calendar,
  GraduationCap,
  Phone,
  Home,
  CheckCircle2,
  Briefcase,
  AlertCircle,
  RotateCcw,
  Upload,
  Download,
  LayoutGrid,
  SlidersHorizontal,
  CreditCard,
  Minimize2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  AbsensiMember,
  DesaData,
  KelompokData,
  AgeCategoryData,
  DaerahData,
  Family,
  FamilyRelationship,
  LabelData,
} from "../../types";
import ModernSelect from "../ui/ModernSelect";
import { motion, AnimatePresence } from "motion/react";
import { dbAddMember, dbDeleteMember, dbAddFamily, dbGetLabels, dbAddLabel } from "../../supabase";
import { downloadMemberCard } from "../utils/barcode128";

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
  daerahs,
  members,
  setMembers,
  desas,
  kelompoks,
  ages,
  families = [],
  relationships = [],
  appScriptMaster,
  canWrite,
  onRefresh,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingMember, setEditingMember] = useState<AbsensiMember | null>(
    null,
  );
  const [selectedMember, setSelectedMember] = useState<AbsensiMember | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isScanningRfid, setIsScanningRfid] = useState(false);
  const [isScanningRfidKtp, setIsScanningRfidKtp] = useState(false);

  // States for importing via file
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<"member" | "family" | "both">("both");
  const [activePreviewTab, setActivePreviewTab] = useState<"member" | "family">("member");
  const [isParsing, setIsParsing] = useState(false);
  const [importError, setImportError] = useState("");
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importPreviewFamilies, setImportPreviewFamilies] = useState<any[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [allLabels, setAllLabels] = useState<LabelData[]>([]);

  useEffect(() => {
    const loadLabels = async () => {
      try {
        const data = await dbGetLabels();
        setAllLabels(data);
      } catch (err) {
        console.error("Gagal memuat label di MemberManagement:", err);
      }
    };
    loadLabels();
  }, [showModal]);

  // Filters
  const [filterDaerah, setFilterDaerah] = useState("All");
  const [filterDesa, setFilterDesa] = useState("All");
  const [filterKelompok, setFilterKelompok] = useState("All");
  const [filterAge, setFilterAge] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"anggota" | "kk">("anggota");

  // Sticky header height sync
  const searchBarRef = useRef<HTMLDivElement>(null);
  const [searchBarHeight, setSearchBarHeight] = useState<number>(54);
  const [daerahHeight, setDaerahHeight] = useState<number>(48);

  useEffect(() => {
    if (!searchBarRef.current) return;
    const updateHeight = () => {
      if (searchBarRef.current) {
        setSearchBarHeight(searchBarRef.current.offsetHeight);
      }
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(searchBarRef.current);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [showFilters]);

  const setDaerahHeaderRef = (el: HTMLDivElement | null) => {
    if (el) {
      const h = el.offsetHeight;
      if (h > 0 && Math.abs(h - daerahHeight) > 1) {
        setDaerahHeight(h);
      }
    }
  };

  const isFilterActive = useMemo(() => {
    return (
      filterDaerah !== "All" ||
      filterDesa !== "All" ||
      filterKelompok !== "All" ||
      filterAge !== "All"
    );
  }, [filterDaerah, filterDesa, filterKelompok, filterAge]);

  const detailFamilyMembers = useMemo(() => {
    if (!selectedMember || !selectedMember.family_id) return [];
    const filtered = members.filter((m) => m.family_id === selectedMember.family_id);
    return [...filtered].sort((a, b) => {
      const relA = (relationships || []).find((r) => r.id === a.relationship_id);
      const relB = (relationships || []).find((r) => r.id === b.relationship_id);
      
      const valA = relA ? parseInt(relA.is_wali || "99", 10) : 99;
      const valB = relB ? parseInt(relB.is_wali || "99", 10) : 99;
      
      if (valA !== valB) {
        return valA - valB;
      }
      return (a.nama_lengkap || "").localeCompare(b.nama_lengkap || "");
    });
  }, [selectedMember, members, relationships]);

  const [formData, setFormData] = useState<Partial<AbsensiMember>>(() => {
    try {
      const saved = localStorage.getItem("absensi_member_registration_draft");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load registration draft", e);
    }
    return {
      nama_lengkap: "",
      daerah_id: "",
      desa_id: "",
      kelompok_id: "",
      age_category_id: "",
      tempat_lahir: "",
      tanggal_lahir: "",
      no_hp_anggota: "",
      jenis_kelamin: "Laki-laki",
      alamat_rumah: "",
      pendidikan: "",
      kelas: "",
      rfid: "",
      rfid_ktp: "",
      family_id: "",
      relationship_id: "",
      pekerjaan: "",
      status: "",
    };
  });

  useEffect(() => {
    if (editingMember === null) {
      localStorage.setItem(
        "absensi_member_registration_draft",
        JSON.stringify(formData),
      );
    }
  }, [formData, editingMember]);

  useEffect(() => {
    const handleNfcRead = (e: Event) => {
      const uid = (e as any).detail?.uid;
      if (!uid) return;

      if (isScanningRfid) {
        setFormData((prev) => ({ ...prev, rfid: uid }));
        setIsScanningRfid(false);
      } else if (isScanningRfidKtp) {
        setFormData((prev) => ({ ...prev, rfid_ktp: uid }));
        setIsScanningRfidKtp(false);
      }
    };

    window.addEventListener("nfc-read", handleNfcRead);
    return () => {
      window.removeEventListener("nfc-read", handleNfcRead);
    };
  }, [isScanningRfid, isScanningRfidKtp]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        (m.nama_lengkap || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (m.id || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchedDesaDoc = desas.find(
        (d) => String(d.id) === String(m.desa_id),
      );
      const finalDaerahId = m.daerah_id || matchedDesaDoc?.daerah_id || "";

      const matchesDaerah =
        filterDaerah === "All" ||
        String(finalDaerahId) === String(filterDaerah);
      const matchesDesa =
        filterDesa === "All" || String(m.desa_id) === String(filterDesa);
      const matchesKelompok =
        filterKelompok === "All" ||
        String(m.kelompok_id) === String(filterKelompok);
      const matchesAge =
        filterAge === "All" || String(m.age_category_id) === String(filterAge);
      return (
        matchesSearch &&
        matchesDaerah &&
        matchesDesa &&
        matchesKelompok &&
        matchesAge
      );
    });
  }, [
    members,
    searchTerm,
    filterDaerah,
    filterDesa,
    filterKelompok,
    filterAge,
    desas,
  ]);

  const groupedMembers = useMemo(() => {
    const groups: {
      [daerah: string]: {
        [desa: string]: {
          [kelompok: string]: { [age: string]: AbsensiMember[] };
        };
      };
    } = {};

    // Sort members by name first to ensure alphabetical order within groups
    const sorted = [...filteredMembers].sort((a, b) =>
      (a.nama_lengkap || "").localeCompare(b.nama_lengkap || ""),
    );

    sorted.forEach((m) => {
      const matchedDesaDoc = desas.find(
        (d) => String(d.id) === String(m.desa_id),
      );
      const matchedDaerahId = m.daerah_id || matchedDesaDoc?.daerah_id || "";
      const matchedDaerahDoc = (daerahs || []).find(
        (d) => String(d.id) === String(matchedDaerahId),
      );

      const daerah = matchedDaerahDoc?.nama_daerah || "Tanpa Daerah";
      const desa = m.desa_name || "Tanpa Desa";
      const kelompok = m.kelompok_name || "Tanpa Kelompok";
      const age = m.age_category_name || "Tanpa Kategori Usia";

      if (!groups[daerah]) groups[daerah] = {};
      if (!groups[daerah][desa]) groups[daerah][desa] = {};
      if (!groups[daerah][desa][kelompok]) groups[daerah][desa][kelompok] = {};
      if (!groups[daerah][desa][kelompok][age])
        groups[daerah][desa][kelompok][age] = [];

      groups[daerah][desa][kelompok][age].push(m);
    });

    return groups;
  }, [filteredMembers, daerahs, desas]);

  const groupedMembersByFamily = useMemo(() => {
    if (viewMode !== "kk") return {};

    const groups: {
      [daerah: string]: {
        [desa: string]: {
          [kelompok: string]: {
            [familyId: string]: {
              familyName: string;
              familyNo?: string;
              members: AbsensiMember[];
            };
          };
        };
      };
    } = {};

    const sorted = [...filteredMembers];

    sorted.forEach((m) => {
      const matchedDesaDoc = desas.find(
        (d) => String(d.id) === String(m.desa_id),
      );
      const matchedDaerahId = m.daerah_id || matchedDesaDoc?.daerah_id || "";
      const matchedDaerahDoc = (daerahs || []).find(
        (d) => String(d.id) === String(matchedDaerahId),
      );

      const daerah = matchedDaerahDoc?.nama_daerah || "Tanpa Daerah";
      const desa = m.desa_name || "Tanpa Desa";
      const kelompok = m.kelompok_name || "Tanpa Kelompok";
      const familyId = m.family_id || "unassigned";
      
      const matchedFamilyDoc = (families || []).find(
        (f) => String(f.id) === String(familyId),
      );
      const familyName = m.family_name || matchedFamilyDoc?.nama_keluarga || "Mandiri / Belum Tergabung";
      const familyNo = matchedFamilyDoc?.nomor_kk || "";

      if (!groups[daerah]) groups[daerah] = {};
      if (!groups[daerah][desa]) groups[daerah][desa] = {};
      if (!groups[daerah][desa][kelompok]) groups[daerah][desa][kelompok] = {};
      if (!groups[daerah][desa][kelompok][familyId]) {
        groups[daerah][desa][kelompok][familyId] = {
          familyName,
          familyNo,
          members: [],
        };
      }

      groups[daerah][desa][kelompok][familyId].members.push(m);
    });

    // Within each family, we should sort members by relationship is_wali order
    Object.values(groups).forEach((desaGroup) => {
      Object.values(desaGroup).forEach((kelompokGroup) => {
        Object.values(kelompokGroup).forEach((familyGroup) => {
          Object.values(familyGroup).forEach((family) => {
            family.members.sort((a, b) => {
              const relA = (relationships || []).find((r) => r.id === a.relationship_id);
              const relB = (relationships || []).find((r) => r.id === b.relationship_id);
              
              const valA = relA ? parseInt(relA.is_wali || "99", 10) : 99;
              const valB = relB ? parseInt(relB.is_wali || "99", 10) : 99;
              
              if (valA !== valB) {
                return valA - valB;
              }
              return (a.nama_lengkap || "").localeCompare(b.nama_lengkap || "");
            });
          });
        });
      });
    });

    return groups;
  }, [filteredMembers, daerahs, desas, families, relationships, viewMode]);

  // Track currently scrolled-to Desa within each Daerah for sticky header display
  const [activeDesas, setActiveDesas] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!showModal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsScanningRfid(false);
      setIsScanningRfidKtp(false);
    }
  }, [showModal]);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-120px 0px -80% 0px", // Focused around the top header sticky zone
      threshold: [0, 1],
    };

    const handleIntersection = (entries: any[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target as HTMLElement;
          const daerah = target.getAttribute("data-daerah");
          const desa = target.getAttribute("data-desa");
          if (daerah && desa) {
            setActiveDesas((prev) => ({
              ...prev,
              [daerah]: desa,
            }));
          }
        }
      });
    };

    const observer = new IntersectionObserver(
      handleIntersection,
      observerOptions,
    );

    // Dynamic selection of sentinel elements
    const elements = document.querySelectorAll(".desa-scroll-sentinel");
    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [groupedMembers]);

  const stats = useMemo(() => {
    return {
      total: members.length,
      male: members.filter((m) => m.jenis_kelamin === "Laki-laki").length,
      female: members.filter((m) => m.jenis_kelamin === "Perempuan").length,
    };
  }, [members]);

  const hasDraftContent = useMemo(() => {
    return (
      editingMember === null &&
      (!!formData.nama_lengkap ||
        !!formData.tempat_lahir ||
        !!formData.no_hp_anggota ||
        !!formData.rfid ||
        !!formData.alamat_rumah ||
        !!formData.pendidikan ||
        !!formData.family_id)
    );
  }, [formData, editingMember]);

  const formatDisplayDate = (dateVal: any) => {
    if (!dateVal || dateVal === "-" || dateVal === "?") return "";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);

      const day = d.getDate();
      const monthNames = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();

      return `${day} ${month} ${year}`;
    } catch {
      return String(dateVal);
    }
  };

  const formatMobileBirth = (tempat: string, tgl: any) => {
    if (!tempat && !tgl) return "-";
    let formattedDate = "";
    if (tgl && tgl !== "-" && tgl !== "?") {
      try {
        const d = new Date(tgl);
        if (!isNaN(d.getTime())) {
          const day = d.getDate();
          const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
          const month = months[d.getMonth()];
          const year = d.getFullYear();
          formattedDate = `${day} ${month} ${year}`;
        } else {
          formattedDate = String(tgl);
        }
      } catch {
        formattedDate = String(tgl);
      }
    }
    if (tempat && formattedDate) {
      return `${tempat}, ${formattedDate}`;
    }
    return tempat || formattedDate || "-";
  };

  const formatDateForInput = (dateVal: any) => {
    if (!dateVal) return "";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return "";

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch {
      return "";
    }
  };

  const handleOpenAdd = () => {
    try {
      if (editingMember !== null) {
        setEditingMember(null);
      }
      const initialForm: Partial<AbsensiMember> = {
        nama_lengkap: "",
        daerah_id: daerahs.length === 1 ? String(daerahs[0].id) : "",
        desa_id: desas.length === 1 ? String(desas[0].id) : "",
        kelompok_id: kelompoks.length === 1 ? String(kelompoks[0].id) : "",
        age_category_id: ages.length === 1 ? String(ages[0].id) : "",
        tempat_lahir: "",
        tanggal_lahir: "",
        no_hp_anggota: "",
        jenis_kelamin: "Laki-laki",
        alamat_rumah: "",
        pendidikan: "",
        kelas: "",
        rfid: "",
        rfid_ktp: "",
        family_id: "",
        relationship_id: "",
        pekerjaan: "",
        status: "",
      };
      
      const savedDraft = localStorage.getItem("absensi_member_registration_draft");
      if (savedDraft) {
        const parsedDraft = JSON.parse(savedDraft);
        if (daerahs.length === 1) parsedDraft.daerah_id = String(daerahs[0].id);
        if (desas.length === 1) parsedDraft.desa_id = String(desas[0].id);
        if (kelompoks.length === 1) parsedDraft.kelompok_id = String(kelompoks[0].id);
        if (ages.length === 1) parsedDraft.age_category_id = String(ages[0].id);
        setFormData(parsedDraft);
      } else {
        setFormData(initialForm);
      }
    } catch (e) {
      console.error(e);
    }
    setShowModal(true);
  };

  const handleEdit = (member: AbsensiMember) => {
    setEditingMember(member);
    setFormData({
      ...member,
      tanggal_lahir: formatDateForInput(member.tanggal_lahir),
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    setIsSubmitting(true);
    try {
      await dbDeleteMember(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
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

    if (
      !formData.nama_lengkap ||
      !formData.desa_id ||
      !formData.kelompok_id ||
      !formData.age_category_id
    ) {
      window.alert("Mohon lengkapi bagian bertanda bintang (*)");
      return;
    }

    setIsSubmitting(true);
    // High-density, compact Base-36 ID + 4 random characters (e.g., MBR-K8ZJ1B3FX9A)
    const generatedId =
      editingMember?.id ||
      `MBR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Resolve daerah info from desa
    const matchedDesaDoc = desas.find(
      (d) => String(d.id) === String(formData.desa_id),
    );
    const resolvedDaerahId =
      matchedDesaDoc?.daerah_id || formData.daerah_id || "";
    const resolvedDaerahName =
      (daerahs || []).find((d) => String(d.id) === String(resolvedDaerahId))
        ?.nama_daerah || "";

    const payloadData: AbsensiMember = {
      ...(formData as AbsensiMember),
      id: generatedId,
      daerah_id: resolvedDaerahId,
      daerah_name: resolvedDaerahName,
      desa_name: matchedDesaDoc?.nama_desa || "",
      kelompok_name:
        kelompoks.find((k) => String(k.id) === String(formData.kelompok_id))
          ?.nama_kelompok || "",
      age_category_name:
        ages.find((a) => String(a.id) === String(formData.age_category_id))
          ?.name || "",
    };

    try {
      await dbAddMember(payloadData);

      if (editingMember) {
        setMembers((prev) =>
          prev.map((m) => (m.id === editingMember.id ? payloadData : m)),
        );
      } else {
        setMembers((prev) => [payloadData, ...prev]);
        try {
          localStorage.removeItem("absensi_member_registration_draft");
        } catch (e) {
          console.error(e);
        }
        setFormData({
          nama_lengkap: "",
          daerah_id: "",
          desa_id: "",
          kelompok_id: "",
          age_category_id: "",
          tempat_lahir: "",
          tanggal_lahir: "",
          no_hp_anggota: "",
          jenis_kelamin: "Laki-laki",
          alamat_rumah: "",
          pendidikan: "",
          kelas: "",
          rfid: "",
          rfid_ktp: "",
          family_id: "",
          relationship_id: "",
          pekerjaan: "",
          status: "",
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
    const workbook = XLSX.utils.book_new();

    // ==========================================
    // SHEET 1: DAFTAR ANGGOTA
    // ==========================================
    const memberHeaders = [
      "Nama Lengkap",
      "Jenis Kelamin",
      "ID Daerah (Opsional)",
      "ID Desa",
      "ID Kelompok",
      "ID Kategori Usia",
      "Tempat Lahir",
      "Tanggal Lahir",
      "No HP Anggota",
      "ID Keluarga (Opsional)",
      "ID Hubungan Keluarga (Opsional)",
      "Alamat Rumah",
      "Pendidikan Terakhir",
      "Kelas atau Semester",
      "RFID Code (Opsional)",
      "RFID KTP Code (Opsional)",
      "Pekerjaan",
      "Status Pernikahan",
      "Label Anggota (Opsional)"
    ];

    const memberRows = [
      [
        "Ahmad Fauzi",
        "Laki-laki",
        daerahs[0]?.id || "DAE-CONTOH",
        desas[0]?.id || "DES-CONTOH",
        kelompoks[0]?.id || "KLP-CONTOH",
        ages[0]?.id || "AGE-REMAJA",
        "Jakarta",
        "2005-08-12",
        "081234567890",
        "FAM-001",
        relationships[0]?.id || "ayah",
        "Jl. Merdeka No. 10",
        "SMA",
        "Kelas 11",
        "1234567890",
        "9876543210",
        "Pelajar/Mahasiswa",
        "Belum Kawin",
        "Muda-mudi, Panitia"
      ],
      [
        "Siti Aminah",
        "Perempuan",
        daerahs[0]?.id || "DAE-CONTOH",
        desas[0]?.id || "DES-CONTOH",
        kelompoks[0]?.id || "KLP-CONTOH",
        ages[1]?.id || "AGE-CABON",
        "Bandung",
        "2010-04-20",
        "081223344556",
        "FAM-001",
        relationships[1]?.id || "anak",
        "Jl. Melati No. 5",
        "SMP",
        "Kelas 8",
        "",
        "",
        "Pelajar/Mahasiswa",
        "Belum Kawin",
        "Muda-mudi"
      ]
    ];

    const memberSheetData = [memberHeaders, ...memberRows];
    const memberWorksheet = XLSX.utils.aoa_to_sheet(memberSheetData);
    XLSX.utils.book_append_sheet(workbook, memberWorksheet, "Daftar Anggota");

    // ==========================================
    // SHEET 2: MASTER KELUARGA
    // ==========================================
    const familyHeaders = [
      "ID Keluarga",
      "Nama Keluarga (KK)",
      "Nomor Kartu Keluarga (KK)"
    ];

    const familyRows = [
      [
        "FAM-001",
        "Keluarga Ahmad Fauzi",
        "3201234567890123"
      ],
      [
        "",
        "Keluarga Bp. Supardi",
        "3201234567890124"
      ]
    ];

    const familySheetData = [familyHeaders, ...familyRows];
    const familyWorksheet = XLSX.utils.aoa_to_sheet(familySheetData);
    XLSX.utils.book_append_sheet(workbook, familyWorksheet, "Master Keluarga");

    // ==========================================
    // SHEET 3: REFERENSI ID
    // ==========================================
    const refHeaders = [
      "Tipe Data",
      "ID Database (Masukkan ke Kolom)",
      "Nama / Keterangan"
    ];
    const refRows: any[] = [];

    // Add Kategori Usia
    ages.forEach((a) => {
      refRows.push(["Kategori Usia", a.id, a.name]);
    });
    // Add Daerah
    (daerahs || []).forEach((d) => {
      refRows.push(["Daerah", d.id, d.nama_daerah]);
    });
    // Add Desa
    desas.forEach((d) => {
      const matchDaerah = (daerahs || []).find(
        (da) => String(da.id) === String(d.daerah_id)
      );
      refRows.push([
        "Desa",
        d.id,
        `${d.nama_desa} (${matchDaerah?.nama_daerah || "-"})`
      ]);
    });
    // Add Kelompok
    kelompoks.forEach((k) => {
      const matchDesa = desas.find((ds) => String(ds.id) === String(k.desa_id));
      refRows.push([
        "Kelompok",
        k.id,
        `${k.nama_kelompok} (${matchDesa?.nama_desa || "-"})`
      ]);
    });
    // Add Hubungan Keluarga
    (relationships || []).forEach((r) => {
      refRows.push(["Hubungan Keluarga", r.id, r.name]);
    });
    // Add Keluarga
    (families || []).forEach((f) => {
      refRows.push(["Keluarga (KK)", f.id, f.nama_keluarga]);
    });
    // Add Label Anggota
    (allLabels || []).forEach((lbl) => {
      refRows.push(["Label Anggota", lbl.name, lbl.name]);
    });

    const rWorksheetData = [refHeaders, ...refRows];
    const rWorksheet = XLSX.utils.aoa_to_sheet(rWorksheetData);
    XLSX.utils.book_append_sheet(workbook, rWorksheet, "Referensi ID");

    // ==========================================
    // SHEET 4: CARA PENGISIAN
    // ==========================================
    const helpHeaders = [
      "Kategori / Nama Kolom",
      "Sifat",
      "Petunjuk Pengisian",
      "Contoh Nilai"
    ];
    const helpRows = [
      // Keluarga
      ["[Keluarga] ID Keluarga", "Opsional", "Biarkan KOSONG untuk membuat keluarga baru. Jika ingin meng-update data keluarga yang ada, isi dengan ID Keluarga dari tab Referensi ID.", "FAM-001"],
      ["[Keluarga] Nama Keluarga (KK)", "WAJIB", "Isi dengan nama keluarga atau nama Kepala Keluarga untuk master keluarga.", "Keluarga Ahmad Fauzi"],
      ["[Keluarga] Nomor Kartu Keluarga (KK)", "Opsional", "Isi dengan 16 digit nomor Kartu Keluarga resmi jika ada.", "3201234567890123"],
      
      // Anggota
      ["[Anggota] Nama Lengkap", "WAJIB", "Isi dengan nama lengkap anggota yang akan didaftarkan.", "Ahmad Fauzi"],
      ["[Anggota] Jenis Kelamin", "WAJIB", "Isi dengan 'Laki-laki' or 'Perempuan'.", "Laki-laki"],
      ["[Anggota] ID Daerah", "Opsional", "Masukkan ID Daerah dari tab Referensi ID.", "DAE-001"],
      ["[Anggota] ID Desa", "WAJIB", "Masukkan ID Desa dari tab Referensi ID.", "DES-001"],
      ["[Anggota] ID Kelompok", "WAJIB", "Masukkan ID Kelompok dari tab Referensi ID.", "KLP-001"],
      ["[Anggota] ID Kategori Usia", "WAJIB", "Masukkan ID Kategori Usia dari tab Referensi ID.", "AGE-REMAJA"],
      ["[Anggota] Tempat Lahir", "Opsional", "Isi dengan kota/kabupaten tempat lahir.", "Jakarta"],
      ["[Anggota] Tanggal Lahir", "Opsional", "Format pengisian YYYY-MM-DD (Tahun-Bulan-Hari).", "2005-08-12"],
      ["[Anggota] No HP Anggota", "Opsional", "No HP aktif anggota.", "081234567890"],
      ["[Anggota] ID Keluarga", "Opsional", "Hubungkan dengan keluarga. Masukkan ID Keluarga dari tab Referensi ID. Jika ingin membuat keluarga baru secara otomatis dari file ini, tulis ID keluarga baru buatan Anda (misal: FAM-NEW1) dan gunakan ID yang sama untuk anggota keluarga lainnya agar dikelompokkan bersama.", "FAM-001"],
      ["[Anggota] ID Hubungan Keluarga", "Opsional", "Peranan di keluarga. Masukkan ID dari tab Referensi ID (misal: ayah, ibu, anak, dll).", "ayah"],
      ["[Anggota] Alamat Rumah", "Opsional", "Isi dengan alamat domisili lengkap.", "Jl. Merdeka No. 10"],
      ["[Anggota] Pendidikan Terakhir", "Opsional", "Pendidikan formal terakhir (misal: SD, SMP, SMA, S1, dll).", "SMA"],
      ["[Anggota] Kelas atau Semester", "Opsional", "Jika masih sekolah, isi dengan jenjang kelas atau semester kuliah.", "Kelas 11"],
      ["[Anggota] RFID Code", "Opsional", "Isi dengan kode RFID kartu absensi.", "1234567890"],
      ["[Anggota] RFID KTP Code", "Opsional", "Isi dengan kode NFC/RFID KTP.", "9876543210"],
      ["[Anggota] Pekerjaan", "Opsional", "Pekerjaan atau profesi saat ini.", "Pelajar/Mahasiswa"],
      ["[Anggota] Status Pernikahan", "Opsional", "Pilihan: Belum Kawin, Kawin, Cerai Hidup, Cerai Mati.", "Belum Kawin"],
      ["[Anggota] Label Anggota", "Opsional", "Pilih label kustom untuk anggota. Pisahkan beberapa label dengan tanda koma (e.g. Muda-mudi, Panitia).", "Muda-mudi, Panitia"]
    ];

    const hWorksheetData = [helpHeaders, ...helpRows];
    const hWorksheet = XLSX.utils.aoa_to_sheet(hWorksheetData);
    XLSX.utils.book_append_sheet(workbook, hWorksheet, "Cara Pengisian");

    XLSX.writeFile(workbook, "Template_Impor_Absensi.xlsx");
  };

  const parseAndPreviewFile = (file: any) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error("Gagal membaca file.");

        const workbook = XLSX.read(data, { type: "array" });
        const sheetNames = workbook.SheetNames;

        let parsedMembers: any[] = [];
        let parsedFamilies: any[] = [];
        let combinedWarnings: string[] = [];

        // Try to find the appropriate sheets based on names or fallback
        const memberSheetName = sheetNames.find(
          name => name.toLowerCase().includes("anggota") || name.toLowerCase().includes("member")
        ) || (sheetNames.includes("Format Pengisian") ? "Format Pengisian" : "");

        const familySheetName = sheetNames.find(
          name => name.toLowerCase().includes("keluarga") || name.toLowerCase().includes("family")
        ) || "";

        // Fallbacks if sheet names are totally different (e.g. they uploaded custom sheet where 1st is members, 2nd is families)
        let finalMemberSheetName = memberSheetName;
        let finalFamilySheetName = familySheetName;

        if (!finalMemberSheetName && !finalFamilySheetName) {
          // If neither matches, try first sheet as members and second as families (if exists)
          finalMemberSheetName = sheetNames[0] || "";
          if (sheetNames.length > 1) {
            finalFamilySheetName = sheetNames[1];
          }
        }

        // --- 1. Parse Family Sheet if detected ---
        if (finalFamilySheetName) {
          const wsFam = workbook.Sheets[finalFamilySheetName];
          const famData = XLSX.utils.sheet_to_json<any[]>(wsFam, { header: 1 });
          if (famData.length >= 2) {
            const famHeadersRow = famData[0].map((h: any) => String(h || "").trim().toLowerCase());

            const findFamIndex = (keywords: string[]) => {
              // 1. Exact match first (most reliable to avoid overlaps like "kk" vs "(kk)")
              const exactIdx = famHeadersRow.findIndex((h: string) =>
                keywords.some((kw) => h.toLowerCase().trim() === kw.toLowerCase().trim())
              );
              if (exactIdx !== -1) return exactIdx;

              // 2. Substring match for compatibility
              return famHeadersRow.findIndex((h: string) =>
                keywords.some((kw) => {
                  const fieldClean = h.toLowerCase().trim();
                  const kwClean = kw.toLowerCase().trim();
                  
                  // Avoid cross matching Nama KK and No KK
                  const isKKKeyword = [
                    "kk", "no kk", "no. kk", "no.kk", "no_kk", "nomor_kk", "nomor kk", 
                    "nomor kartu keluarga (kk)", "nomor kartu keluarga"
                  ].includes(kwClean);
                  const isNameKeyword = [
                    "nama", "nama keluarga", "nama_keluarga", "nama keluarga (kk)", 
                    "family_name", "family name", "nama kk", "nama_kk"
                  ].includes(kwClean);
                  
                  if (isKKKeyword && (fieldClean.includes("nama") || fieldClean.includes("name"))) {
                    return false;
                  }
                  if (isNameKeyword && (fieldClean.includes("nomor") || fieldClean.includes("no.") || fieldClean.includes("no_") || /\bno\b/.test(fieldClean))) {
                    return false;
                  }

                  if (kwClean === "kk" || kwClean === "nama" || kwClean === "usia") {
                    return fieldClean === kwClean || new RegExp(`\\b${kwClean}\\b`).test(fieldClean);
                  }
                  return fieldClean.includes(kwClean) || kwClean.includes(fieldClean);
                })
              );
            };

            const idxFamilyId = findFamIndex(["id keluarga", "id_keluarga", "family_id", "family id"]);
            const idxFamilyName = findFamIndex(["nama keluarga (kk)", "nama keluarga", "nama_keluarga", "nama", "family_name", "family name", "nama kk", "nama_kk"]);
            const idxFamilyKK = findFamIndex(["nomor kartu keluarga (kk)", "nomor kartu keluarga", "nomor kk", "no kk", "no. kk", "no.kk", "no_kk", "nomor_kk", "kk"]);

            for (let i = 1; i < famData.length; i++) {
              const row = famData[i];
              if (!row || row.length === 0) continue;
              const isRowEmpty = row.every(val => val === undefined || val === null || String(val).trim() === "");
              if (isRowEmpty) continue;

              const getValue = (idx: number, fallback = "") => {
                if (idx === -1 || idx >= row.length) return fallback;
                return row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : fallback;
              };

              const famId = getValue(idxFamilyId);
              const famName = getValue(idxFamilyName);
              const famKK = getValue(idxFamilyKK);

              if (!famName) {
                combinedWarnings.push(`[Keluarga] Baris ${i + 1}: Nama Keluarga kosong.`);
                continue;
              }

              parsedFamilies.push({
                id: famId || `FAM-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                nama_keluarga: famName,
                nomor_kk: famKK,
                is_new: !famId,
              });
            }
          }
        }

        // --- 2. Parse Members Sheet if detected ---
        if (finalMemberSheetName) {
          const wsMem = workbook.Sheets[finalMemberSheetName];
          const memData = XLSX.utils.sheet_to_json<any[]>(wsMem, { header: 1 });
          if (memData.length >= 2) {
            const memHeadersRow = memData[0].map((h: any) => String(h || "").trim().toLowerCase());

             const findMemIndex = (keywords: string[]) => {
              // 1. Exact match first
              const exactIdx = memHeadersRow.findIndex((h: string) =>
                keywords.some((kw) => h.toLowerCase().trim() === kw.toLowerCase().trim())
              );
              if (exactIdx !== -1) return exactIdx;

              // 2. Substring match
              return memHeadersRow.findIndex((h: string) =>
                keywords.some((kw) => {
                  const fieldClean = h.toLowerCase().trim();
                  const kwClean = kw.toLowerCase().trim();
                  
                  // Avoid cross matching Nama KK and No KK
                  const isKKKeyword = [
                    "kk", "no kk", "no. kk", "no.kk", "no_kk", "nomor_kk", "nomor kk", 
                    "nomor kartu keluarga (kk)", "nomor kartu keluarga"
                  ].includes(kwClean);
                  const isNameKeyword = [
                    "nama", "nama keluarga", "nama_keluarga", "nama keluarga (kk)", 
                    "family_name", "family name", "nama kk", "nama_kk"
                  ].includes(kwClean);
                  
                  if (isKKKeyword && (fieldClean.includes("nama") || fieldClean.includes("name"))) {
                    return false;
                  }
                  if (isNameKeyword && (fieldClean.includes("nomor") || fieldClean.includes("no.") || fieldClean.includes("no_") || /\bno\b/.test(fieldClean))) {
                    return false;
                  }

                  if (kwClean === "kk" || kwClean === "nama" || kwClean === "usia") {
                    return fieldClean === kwClean || new RegExp(`\\b${kwClean}\\b`).test(fieldClean);
                  }
                  return fieldClean.includes(kwClean) || kwClean.includes(fieldClean);
                })
              );
            };

            const idxNama = findMemIndex(["nama lengkap", "nama_lengkap", "nama"]);
            const idxJK = findMemIndex(["jenis kelamin", "jenis_kelamin", "gender", "jk"]);
            const idxDaerah = findMemIndex(["id daerah", "daerah"]);
            const idxDesa = findMemIndex(["id desa", "desa"]);
            const idxKelompok = findMemIndex(["id kelompok", "kelompok"]);
            const idxUsia = findMemIndex(["id kategori usia", "kategori usia", "kategori_usia", "usia", "kategori"]);
            const idxTempat = findMemIndex(["tempat lahir", "tempat_lahir", "tempat"]);
            const idxTanggal = findMemIndex(["tanggal lahir", "tanggal_lahir", "tgl lahir", "tgl_lahir", "tanggal"]);
            const idxHPAnggota = findMemIndex(["no hp anggota", "no_hp_anggota", "hp anggota", "no hp", "hp", "no_hp"]);
            const idxAlamat = findMemIndex(["alamat rumah", "alamat_rumah", "alamat"]);
            const idxPendidikan = findMemIndex(["pendidikan terkahir", "pendidikan terakhir", "pendidikan_terakhir", "pendidikan"]);
            const idxKelas = findMemIndex(["kelas atau semester", "kelas_atau_semester", "kelas", "semester"]);
            const idxRFID = findMemIndex(["rfid", "nfc", "kartu rfid", "rfid_code", "rfid code"]);
            const idxRFIDKtp = findMemIndex(["rfid ktp", "rfid_ktp", "nfc ktp", "nfc_ktp", "e-ktp", "ektp", "kartu ktp", "ktp rfid", "nfc_ktp_code"]);
            const idxStatus = findMemIndex(["status pernikahan", "status perkawinan", "status_perkawinan", "status_pernikahan", "perkawinan", "pernikahan", "status"]);
            const idxPekerjaan = findMemIndex(["pekerjaan", "pekerjaan_anggota", "profesi"]);
            const idxFamilyId = findMemIndex(["id keluarga", "family_id", "family id", "id_keluarga", "keluarga_id"]);
            const idxRelationshipId = findMemIndex(["id hubungan keluarga", "relationship_id", "hubungan keluarga", "id hubungan", "relationship id", "hubungan_keluarga", "peranan keluarga"]);
            const idxLabels = findMemIndex(["label anggota (opsional)", "label anggota", "label/tagging", "label", "tag", "labels", "tagging"]);

            for (let i = 1; i < memData.length; i++) {
              const row = memData[i];
              if (!row || row.length === 0) continue;
              const isRowEmpty = row.every(val => val === undefined || val === null || String(val).trim() === "");
              if (isRowEmpty) continue;

              const getValue = (idx: number, fallback = "") => {
                if (idx === -1 || idx >= row.length) return fallback;
                return row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : fallback;
              };

              const nama = getValue(idxNama);
              const jk = getValue(idxJK);
              const daerahRaw = getValue(idxDaerah);
              const desaRaw = getValue(idxDesa);
              const kelompokRaw = getValue(idxKelompok);
              const usiaRaw = getValue(idxUsia);
              const tempat = getValue(idxTempat);
              const tanggalRaw = getValue(idxTanggal);
              const hpAnggota = getValue(idxHPAnggota);
              const alamat = getValue(idxAlamat);
              const pendidikan = getValue(idxPendidikan);
              const kelas = getValue(idxKelas);
              const rfid = getValue(idxRFID);
              const rfidKtp = getValue(idxRFIDKtp);
              const statusVal = getValue(idxStatus);
              const pekerjaanVal = getValue(idxPekerjaan);
              const familyIdRaw = getValue(idxFamilyId);
              const relationshipIdRaw = getValue(idxRelationshipId);
              const labelsRaw = getValue(idxLabels);

              if (!nama) {
                combinedWarnings.push(`[Anggota] Baris ${i + 1}: Nama Lengkap kosong.`);
                continue;
              }

              // Parse labels separated by comma
              const labels = labelsRaw
                ? labelsRaw.split(",").map((s) => s.trim()).filter(Boolean)
                : [];

              // Normalize gender
              let finalJK = "Laki-laki";
              if (jk) {
                const jkLower = jk.toLowerCase();
                if (jkLower.startsWith("p") || jkLower.includes("wanita") || jkLower.includes("perempuan")) {
                  finalJK = "Perempuan";
                }
              }

              // Match Desa
              let matchedDesaId = "";
              let matchedDesaName = "";
              if (desaRaw) {
                const matched = desas.find(d => d.id.toLowerCase().trim() === desaRaw.toLowerCase().trim());
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
                    combinedWarnings.push(`[Anggota] Baris ${i + 1} ("${nama}"): ID Desa "${desaRaw}" tidak terdaftar. Menggunakan default "${matchedDesaName}".`);
                  } else {
                    combinedWarnings.push(`[Anggota] Baris ${i + 1} ("${nama}"): ID Desa "${desaRaw}" tidak ditemukan.`);
                  }
                }
              } else {
                if (desas.length > 0) {
                  matchedDesaId = desas[0].id;
                  matchedDesaName = desas[0].nama_desa;
                } else {
                  combinedWarnings.push(`[Anggota] Baris ${i + 1} ("${nama}"): Kolom ID Desa kosong.`);
                }
              }

              // Match Kelompok
              let matchedKelompokId = "";
              let matchedKelompokName = "";
              if (kelompokRaw) {
                const matched = kelompoks.find(k => k.id.toLowerCase().trim() === kelompokRaw.toLowerCase().trim());
                if (matched) {
                  matchedKelompokId = matched.id;
                  matchedKelompokName = matched.nama_kelompok;
                } else {
                  let matchedByName = kelompoks.find(k =>
                    String(k.desa_id) === String(matchedDesaId) &&
                    (k.nama_kelompok.toLowerCase().trim() === kelompokRaw.toLowerCase().trim() ||
                      k.nama_kelompok.toLowerCase().trim().includes(kelompokRaw.toLowerCase().trim()) ||
                      kelompokRaw.toLowerCase().trim().includes(k.nama_kelompok.toLowerCase().trim()))
                  );
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
                  } else if (kelompoks.length > 0) {
                    matchedKelompokId = kelompoks[0].id;
                    matchedKelompokName = kelompoks[0].nama_kelompok;
                    combinedWarnings.push(`[Anggota] Baris ${i + 1} ("${nama}"): ID Kelompok "${kelompokRaw}" tidak terdaftar. Menggunakan default "${matchedKelompokName}".`);
                  } else {
                    combinedWarnings.push(`[Anggota] Baris ${i + 1} ("${nama}"): ID Kelompok "${kelompokRaw}" tidak ditemukan.`);
                  }
                }
              } else {
                if (kelompoks.length > 0) {
                  matchedKelompokId = kelompoks[0].id;
                  matchedKelompokName = kelompoks[0].nama_kelompok;
                } else {
                  combinedWarnings.push(`[Anggota] Baris ${i + 1} ("${nama}"): Kolom ID Kelompok kosong.`);
                }
              }

              // Match Kategori Usia
              let matchedAgeId = "";
              let matchedAgeName = "";
              if (usiaRaw) {
                const matched = ages.find(a => a.id.toLowerCase().trim() === usiaRaw.toLowerCase().trim());
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
                    combinedWarnings.push(`[Anggota] Baris ${i + 1} ("${nama}"): Kategori Usia "${usiaRaw}" tidak valid. Menggunakan default "${matchedAgeName}".`);
                  } else {
                    combinedWarnings.push(`[Anggota] Baris ${i + 1} ("${nama}"): Kategori Usia "${usiaRaw}" tidak ditemukan.`);
                  }
                }
              } else {
                if (ages.length > 0) {
                  matchedAgeId = ages[0].id;
                  matchedAgeName = ages[0].name;
                } else {
                  combinedWarnings.push(`[Anggota] Baris ${i + 1} ("${nama}"): Kolom Kategori Usia kosong.`);
                }
              }

              // Match Keluarga
              let matchedFamilyId = "";
              let matchedFamilyName = "";
              if (familyIdRaw) {
                // First search in parsedFamilies from this import file so they match perfectly!
                const matchedInParsed = parsedFamilies.find(f =>
                  f.id.toLowerCase().trim() === familyIdRaw.toLowerCase().trim() ||
                  f.nama_keluarga.toLowerCase().trim() === familyIdRaw.toLowerCase().trim()
                );

                const matchedInDb = (families || []).find(f =>
                  f.id.toLowerCase().trim() === familyIdRaw.toLowerCase().trim() ||
                  f.nama_keluarga.toLowerCase().trim() === familyIdRaw.toLowerCase().trim()
                );

                if (matchedInParsed) {
                  matchedFamilyId = matchedInParsed.id;
                  matchedFamilyName = matchedInParsed.nama_keluarga;
                } else if (matchedInDb) {
                  matchedFamilyId = matchedInDb.id;
                  matchedFamilyName = matchedInDb.nama_keluarga;
                } else {
                  matchedFamilyId = familyIdRaw; // keep raw so we can auto-create later
                  matchedFamilyName = familyIdRaw.toUpperCase().startsWith("FAM-") ? `Keluarga ${familyIdRaw}` : familyIdRaw;
                }
              }

              // Match Hubungan Keluarga
              let matchedRelationshipId = "";
              let matchedRelationshipName = "";
              if (relationshipIdRaw) {
                const matched = (relationships || []).find(r =>
                  r.id.toLowerCase().trim() === relationshipIdRaw.toLowerCase().trim() ||
                  r.name.toLowerCase().trim() === relationshipIdRaw.toLowerCase().trim()
                );
                if (matched) {
                  matchedRelationshipId = matched.id;
                  matchedRelationshipName = matched.name;
                } else if (relationships && relationships.length > 0) {
                  const partial = relationships.find(r =>
                    r.name.toLowerCase().trim().includes(relationshipIdRaw.toLowerCase().trim()) ||
                    relationshipIdRaw.toLowerCase().trim().includes(r.name.toLowerCase().trim())
                  );
                  if (partial) {
                    matchedRelationshipId = partial.id;
                    matchedRelationshipName = partial.name;
                  } else {
                    combinedWarnings.push(`[Anggota] Baris ${i + 1} ("${nama}"): Hubungan Keluarga "${relationshipIdRaw}" tidak terdaftar.`);
                  }
                }
              }

              // Format Tanggal Lahir
              let finalTanggal = "";
              if (tanggalRaw) {
                if (!isNaN(Number(tanggalRaw)) && Number(tanggalRaw) > 10000) {
                  const dateObj = XLSX.SSF.parse_date_code(Number(tanggalRaw));
                  const yy = dateObj.y;
                  const mm = String(dateObj.m).padStart(2, "0");
                  const dd = String(dateObj.d).padStart(2, "0");
                  finalTanggal = `${yy}-${mm}-${dd}`;
                } else {
                  const dateStr = String(tanggalRaw).trim();
                  const parts = dateStr.split(/[-/.]/);
                  if (parts.length === 3) {
                    if (parts[0].length === 4) {
                      finalTanggal = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
                    } else if (parts[2].length === 4) {
                      finalTanggal = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                    } else {
                      finalTanggal = dateStr;
                    }
                  } else {
                    finalTanggal = dateStr;
                  }
                }
              }

              const parsedDesa = desas.find(d => String(d.id) === String(matchedDesaId));
              let parsedDaerahId = daerahRaw;
              if (!parsedDaerahId) {
                parsedDaerahId = parsedDesa?.daerah_id || "";
              }
              const parsedDaerahName = (daerahs || []).find(da => String(da.id) === String(parsedDaerahId))?.nama_daerah || "";

              parsedMembers.push({
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
                alamat_rumah: alamat,
                pendidikan: pendidikan,
                kelas: kelas,
                rfid: rfid,
                rfid_ktp: rfidKtp,
                status: statusVal,
                pekerjaan: pekerjaanVal,
                labels: labels,
                family_id: matchedFamilyId,
                family_name: matchedFamilyName,
                relationship_id: matchedRelationshipId,
                relationship_name: matchedRelationshipName,
              });
            }
          }
        }

        // Set state based on parsed results
        setImportPreview(parsedMembers);
        setImportPreviewFamilies(parsedFamilies);
        setImportWarnings(combinedWarnings);

        if (parsedMembers.length > 0 && parsedFamilies.length > 0) {
          setImportType("both");
          setActivePreviewTab("member");
        } else if (parsedFamilies.length > 0) {
          setImportType("family");
          setActivePreviewTab("family");
        } else if (parsedMembers.length > 0) {
          setImportType("member");
          setActivePreviewTab("member");
        } else {
          throw new Error("Tidak menemukan data anggota atau keluarga yang valid di file excel ini.");
        }

      } catch (err: any) {
        setImportError(err.message || "Gagal mengurai file. Pastikan format file sesuai.");
      } finally {
        setIsParsing(false);
      }
    };

    setIsParsing(true);
    setImportError("");
    setImportPreview([]);
    setImportPreviewFamilies([]);
    setImportWarnings([]);
    reader.readAsArrayBuffer(file);
  };

  const handleCommitImport = async () => {
    // Determine if we have any data to commit
    const hasMembers = importPreview.length > 0;
    const hasFamilies = importPreviewFamilies.length > 0;
    if (!hasMembers && !hasFamilies) return;

    setIsSubmittingImport(true);
    try {
      let familiesSuccess = 0;
      let membersSuccess = 0;

      const tempToRealFamilyId = new Map<string, string>(); // temp ID -> real ID mapping

      // 1. First write families if they are present in the import
      if (importType === "family" || importType === "both") {
        for (const record of importPreviewFamilies) {
          // If record.id starts with "FAM-" (case-insensitive), use it directly
          const isFamIdFormat = record.id && record.id.toUpperCase().startsWith("FAM-");
          const realFamId = isFamIdFormat 
            ? record.id.toUpperCase().trim() 
            : `FAM-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

          const success = await dbAddFamily({
            id: realFamId,
            nama_keluarga: record.nama_keluarga,
            nomor_kk: record.nomor_kk || "",
          });
          if (success) {
            familiesSuccess++;
            if (record.id) {
              tempToRealFamilyId.set(record.id.toLowerCase(), realFamId);
            }
          }
        }
      }

      // 2. Second write members if they are present in the import
      if (importType === "member" || importType === "both") {
        for (const record of importPreview) {
          let familyId = record.family_id;
          if (familyId) {
            const tempFamIdLower = familyId.toLowerCase();
            if (tempFamIdLower.startsWith("fam-")) {
              // If it starts with FAM-, use it directly (either mapped or raw)
              if (tempToRealFamilyId.has(tempFamIdLower)) {
                familyId = tempToRealFamilyId.get(tempFamIdLower);
              } else {
                familyId = familyId.toUpperCase().trim();
              }
            } else {
              // Otherwise, treat it as a temporary ID of a new family to be registered
              if (!tempToRealFamilyId.has(tempFamIdLower)) {
                // Create a family on the fly if it doesn't exist yet
                const realFamId = `FAM-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

                const newFamilyDoc = {
                  id: realFamId,
                  nama_keluarga: record.family_name || `Keluarga ${record.nama_lengkap}`,
                  nomor_kk: ""
                };

                await dbAddFamily(newFamilyDoc);
                tempToRealFamilyId.set(tempFamIdLower, realFamId);
                familyId = realFamId;
              } else {
                familyId = tempToRealFamilyId.get(tempFamIdLower);
              }
            }
          }

          // Generate a clean member ID
          const generatedId = `MBR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          const payload: AbsensiMember = {
            ...record,
            id: generatedId,
            family_id: familyId,
          };
          await dbAddMember(payload);
          setMembers((prev) => [payload, ...prev]);
          membersSuccess++;
        }
      }

      // 3. Register imported labels to the master label table if they are new
      const uniqueImportedLabels = new Set<string>();
      if (importType === "member" || importType === "both") {
        for (const record of importPreview) {
          if (record.labels && Array.isArray(record.labels)) {
            record.labels.forEach((lbl: string) => {
              if (lbl.trim()) uniqueImportedLabels.add(lbl.trim());
            });
          }
        }
      }

      const existingLabelNames = new Set((allLabels || []).map(lbl => lbl.name.toLowerCase().trim()));
      for (const labelName of uniqueImportedLabels) {
        if (!existingLabelNames.has(labelName.toLowerCase())) {
          const newLabelId = `LBL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          await dbAddLabel({
            id: newLabelId,
            name: labelName
          });
        }
      }

      // Refresh local labels state
      try {
        const updatedLabels = await dbGetLabels();
        setAllLabels(updatedLabels);
      } catch (err) {
        console.error("Gagal menyinkronkan label setelah impor:", err);
      }

      // Construct success message
      let message = "Berhasil mengimpor data:";
      if (importType === "family") {
        message = `Berhasil mengimpor ${familiesSuccess} keluarga!`;
      } else if (importType === "member") {
        message = `Berhasil mengimpor ${membersSuccess} anggota!`;
      } else {
        message = `Berhasil mengimpor ${membersSuccess} anggota dan ${familiesSuccess} keluarga!`;
      }

      window.alert(message);
      setShowImportModal(false);
      setImportPreview([]);
      setImportPreviewFamilies([]);
      setImportWarnings([]);
      onRefresh();
    } catch (err) {
      console.error(err);
      window.alert(
        `Gagal mengimpor data: ${err instanceof Error ? err.message : "Kesalahan database"}`
      );
    } finally {
      setIsSubmittingImport(false);
    }
  };

  return (
    <div className="h-full bg-[#f8f9fa] overflow-y-auto custom-scrollbar pb-28 md:pb-8">
      {/* Header & Quick Stats */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-2 md:py-3 relative">
        <div className="max-w-7xl mx-auto space-y-2 md:space-y-3">
          <div className="flex flex-row justify-between items-center gap-4">
            <div className="space-y-0">
              <h2 className="text-sm md:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 md:gap-3">
                <Users className="text-blue-600 w-4 h-4 md:w-5 md:h-5" />
                Direktori Anggota
              </h2>
              <p className="hidden md:block text-[10px] text-slate-400 font-medium">
                Kelola dan pantau seluruh data keanggotaan dalam satu platform
              </p>
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
                  onClick={handleOpenAdd}
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
              {
                label: "Total Anggota",
                value: stats.total,
                icon: Users,
                color: "text-blue-600",
                bg: "bg-blue-50",
                showMobile: true,
              },
              {
                label: "Laki-laki",
                value: stats.male,
                icon: User,
                color: "text-emerald-600",
                bg: "bg-emerald-50",
                showMobile: true,
              },
              {
                label: "Perempuan",
                value: stats.female,
                icon: User,
                color: "text-rose-600",
                bg: "bg-rose-50",
                showMobile: true,
              },
              {
                label: "Total Desa",
                value: desas.length,
                icon: MapPin,
                color: "text-purple-600",
                bg: "bg-purple-50",
                showMobile: false,
              },
              {
                label: "Total Kelompok",
                value: kelompoks.length,
                icon: Users,
                color: "text-amber-600",
                bg: "bg-amber-50",
                showMobile: false,
              },
            ].map((stat, i) => (
              <div
                key={i}
                className={`
                  bg-white border border-slate-100 p-2 md:p-3 rounded-xl flex items-center gap-2 md:gap-2.5 transition-all shadow-sm shrink-0
                  ${stat.showMobile ? "flex-1 min-w-[100px] md:min-w-0" : "hidden md:flex flex-1"}
                `}
              >
                <div
                  className={`${stat.bg} ${stat.color} w-8 md:w-10 h-8 md:h-10 rounded-lg flex items-center justify-center shrink-0`}
                >
                  <stat.icon className="w-4 md:w-5 h-4 md:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight truncate">
                    {stat.label}
                  </p>
                  <p className="text-xs md:text-lg font-black text-slate-900 leading-none mt-1">
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div
        ref={searchBarRef}
        className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 md:px-6 py-2 md:py-2.5 cursor-default"
      >
        <div className="w-full max-w-7xl mx-auto space-y-2.5">
          <div className="flex items-center justify-between gap-2 md:gap-3">
            {/* Search Bar */}
            <div className="flex-1 relative group">
              <Search className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors w-3.5 h-3.5 md:w-4 md:h-4" />
              <input
                id="member-search-input"
                type="text"
                placeholder="CARI NAMA ATAU ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 md:pl-11 pr-3 md:pr-4 py-2 md:py-2.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase text-slate-700 focus:border-blue-600 focus:bg-white outline-none transition-all shadow-xs"
              />
            </div>

            {/* Action Buttons: View Mode + Filter Toggle + Reset */}
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
              {/* View Mode Selector Dropdown */}
              <div className="w-[125px] sm:w-[155px] md:w-[170px] shrink-0 select-none">
                <ModernSelect
                  value={viewMode}
                  onChange={(val) => setViewMode(val as "anggota" | "kk")}
                  options={[
                    { value: "anggota", label: "PER ANGGOTA", icon: User },
                    { value: "kk", label: "PER KK", icon: Home },
                  ]}
                  placeholder="PILIH TAMPILAN"
                  size="sm"
                />
              </div>

              {/* Filter Toggle Button (Hide / Unhide like History Tab) */}
              <button
                id="filter-trigger-btn"
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-2 md:py-2.5 rounded-xl md:rounded-2xl border font-black text-[9px] md:text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 select-none active:scale-95 shrink-0 ${
                  showFilters
                    ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                    : isFilterActive
                    ? "bg-blue-50 border-blue-200 text-blue-600 shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                title="Filter Anggota"
              >
                <SlidersHorizontal
                  size={13}
                  className={isFilterActive && !showFilters ? "text-blue-500" : ""}
                />
                <span className="hidden sm:inline">
                  {showFilters ? "Sembunyikan" : "Filter"}
                </span>
                {isFilterActive && !showFilters && (
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                )}
                {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {/* Reset Filter Button (Only show if filter is active) */}
              {isFilterActive && (
                <button
                  id="filter-reset-btn"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterDaerah("All");
                    setFilterDesa("All");
                    setFilterKelompok("All");
                    setFilterAge("All");
                  }}
                  title="Reset All Filters"
                  className="p-2 md:p-2.5 bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-100 hover:border-rose-200 rounded-xl md:rounded-2xl transition-all active:scale-95 shrink-0"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Compact 4-column filter grid with animation (Hide/Unhide) */}
          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-visible"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
                  {/* Filter 1: Daerah */}
                  <div>
                    <span className="block text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                      Daerah
                    </span>
                    <ModernSelect
                      size="sm"
                      value={filterDaerah}
                      onChange={(val) => {
                        setFilterDaerah(val);
                        if (val !== "All") {
                          const dDoc = desas.find(
                            (d) => String(d.id) === String(filterDesa),
                          );
                          if (dDoc && String(dDoc.daerah_id) !== String(val)) {
                            setFilterDesa("All");
                            setFilterKelompok("All");
                          }
                        }
                      }}
                      options={[
                        { value: "All", label: "SEMUA DAERAH" },
                        ...(daerahs || []).map((da) => ({
                          value: String(da.id),
                          label: da.nama_daerah.toUpperCase(),
                        })),
                      ]}
                      icon={Users}
                      placeholder="SEMUA DAERAH"
                    />
                  </div>

                  {/* Filter 2: Desa */}
                  <div>
                    <span className="block text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                      Desa
                    </span>
                    <ModernSelect
                      size="sm"
                      value={filterDesa}
                      onChange={(val) => {
                        setFilterDesa(val);
                        if (val !== "All") {
                          const matched = kelompoks.find(
                            (k) => String(k.id) === String(filterKelompok),
                          );
                          if (
                            matched &&
                            matched.desa_id &&
                            String(matched.desa_id) !== String(val)
                          ) {
                            setFilterKelompok("All");
                          }
                        }
                      }}
                      options={[
                        { value: "All", label: "SEMUA DESA" },
                        ...desas
                          .filter(
                            (d) =>
                              filterDaerah === "All" ||
                              String(d.daerah_id) === String(filterDaerah),
                          )
                          .map((d) => ({
                            value: String(d.id),
                            label: d.nama_desa.toUpperCase(),
                          })),
                      ]}
                      icon={MapPin}
                      placeholder="SEMUA DESA"
                    />
                  </div>

                  {/* Filter 3: Kelompok */}
                  <div>
                    <span className="block text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                      Kelompok
                    </span>
                    <ModernSelect
                      size="sm"
                      value={filterKelompok}
                      onChange={setFilterKelompok}
                      options={[
                        { value: "All", label: "SEMUA KELOMPOK" },
                        ...kelompoks
                          .filter((k) => {
                            const matchedDesa = desas.find(
                              (d) => String(d.id) === String(k.desa_id),
                            );
                            const isDesaMatch =
                              filterDesa === "All" ||
                              !k.desa_id ||
                              String(k.desa_id) === String(filterDesa);
                            const isDaerahMatch =
                              filterDaerah === "All" ||
                              !matchedDesa ||
                              String(matchedDesa.daerah_id) ===
                                String(filterDaerah);
                            return isDesaMatch && isDaerahMatch;
                          })
                          .map((k) => ({
                            value: String(k.id),
                            label: k.nama_kelompok.toUpperCase(),
                          })),
                      ]}
                      icon={Users}
                      placeholder="SEMUA KELOMPOK"
                    />
                  </div>

                  {/* Filter 4: Kategori Usia */}
                  <div>
                    <span className="block text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                      Kategori Usia
                    </span>
                    <ModernSelect
                      size="sm"
                      value={filterAge}
                      onChange={setFilterAge}
                      options={[
                        { value: "All", label: "SEMUA KATEGORI USIA" },
                        ...ages.map((a) => ({
                          value: String(a.id),
                          label: a.name.toUpperCase(),
                        })),
                      ]}
                      icon={Calendar}
                      placeholder="SEMUA KATEGORI USIA"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-2 md:p-4">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="relative">
                <div className="w-10 h-10 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
              <p className="text-xs text-slate-500 font-medium animate-pulse">
                Sinkronisasi data...
              </p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-8 md:p-16 text-center shadow-sm">
              <Search size={32} className="text-slate-200 mx-auto mb-4" />
              <h3 className="text-sm font-bold text-slate-800">
                Tidak ada hasil
              </h3>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterDesa("All");
                  setFilterKelompok("All");
                  setFilterAge("All");
                }}
                className="mt-4 text-xs text-blue-600 font-bold hover:underline"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="space-y-6 md:space-y-8">
              {Object.entries(groupedMembers)
                .sort()
                .map(([daerah, desaGroup]) => {
                  const currentActiveDesa =
                    activeDesas[daerah] || Object.keys(desaGroup).sort()[0];
                  return (
                    <div
                      key={daerah}
                      className="space-y-3 bg-white p-3 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm relative group-section"
                    >
                      {/* DAERAH HEADER - Sticky */}
                      <div
                        ref={setDaerahHeaderRef}
                        className="sticky z-20 py-1 -mx-3 px-3 bg-white/95 backdrop-blur-sm rounded-t-xl transition-all duration-200"
                        style={{ top: `${searchBarHeight}px` }}
                      >
                        <div className="flex flex-row items-center justify-between gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2.5 bg-purple-50 text-purple-700 rounded-xl border border-purple-100 shadow-xs w-full">
                          <div className="flex items-center gap-1.5 md:gap-2.5 min-w-0">
                            <LayoutGrid
                              size={13}
                              className="text-purple-600 animate-pulse shrink-0"
                            />
                            <h3 className="text-[9px] md:text-xs font-black uppercase tracking-wider truncate leading-none">
                              DAERAH: {daerah}
                            </h3>
                            {currentActiveDesa && (
                              <div className="flex items-center gap-1 text-blue-700 border-l border-purple-200 pl-1.5 md:pl-2.5 shrink-0">
                                <MapPin
                                  size={11}
                                  className="text-blue-500 shrink-0"
                                />
                                <span className="text-[9px] md:text-xs font-black uppercase tracking-wider leading-none truncate">
                                  DESA: {currentActiveDesa}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center shrink-0">
                            <span className="text-[8px] md:text-[10px] font-black text-purple-600 bg-white px-2 py-0.5 rounded-full border border-purple-100/30 whitespace-nowrap">
                              {Object.values(desaGroup).reduce(
                                (acc, curr) =>
                                  acc +
                                  Object.values(curr).reduce(
                                    (innerAcc, innerCurr) =>
                                      innerAcc +
                                      Object.values(innerCurr).flat().length,
                                    0,
                                  ),
                                0,
                              )}{" "}
                              JIWA
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-1">
                        {Object.entries(desaGroup)
                          .sort()
                          .map(([desa, kelompokGroup]) => (
                            <div
                              key={desa}
                              className="space-y-3 pl-2 md:pl-4 border-l-2 border-dashed border-purple-100 relative group-section-desa"
                            >
                              {/* DESA HEADER - Static, Acts as Scroll Sentinel */}
                              <div
                                className="desa-scroll-sentinel py-1 bg-white"
                                data-daerah={daerah}
                                data-desa={desa}
                              >
                                <div className="flex items-center gap-2 pl-3 md:pl-4 py-1.5 bg-blue-50/50 rounded-xl border border-blue-100/30">
                                  <MapPin size={13} className="text-blue-500" />
                                  <h4 className="text-[10px] md:text-[11px] font-black text-slate-700 uppercase tracking-wider leading-none">
                                    DESA: {desa}
                                  </h4>
                                  <div className="h-px bg-blue-100/20 flex-1 mx-2"></div>
                                  <span className="text-[9px] font-bold text-blue-500 mr-2">
                                    {Object.values(kelompokGroup).reduce(
                                      (acc, curr) =>
                                        acc + Object.values(curr).flat().length,
                                      0,
                                    )}{" "}
                                    JIWA
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-3 pl-2 md:pl-4">
                                {Object.entries(kelompokGroup)
                                  .sort()
                                  .map(([kelompok, ageGroups]) => (
                                    <div
                                      key={kelompok}
                                      className="space-y-2 relative group-section-kelompok"
                                    >
                                      {/* KELOMPOK HEADER - Sticky right below the Daerah/Desa sticky zone */}
                                      <div
                                        className="sticky z-10 py-1 bg-white/95 backdrop-blur-sm rounded-lg -mx-2 px-2"
                                        style={{ top: `${searchBarHeight + daerahHeight}px` }}
                                      >
                                        <div className="flex items-center gap-2 pl-3 border-l-2 border-emerald-400 py-1 bg-emerald-50/20 rounded-r-lg">
                                          <Users
                                            size={11}
                                            className="text-emerald-500"
                                          />
                                          <h5 className="text-[9px] font-bold text-slate-600 uppercase tracking-wider leading-none">
                                            KELOMPOK: {kelompok}
                                          </h5>
                                          <div className="h-px bg-slate-100 flex-1 mx-2"></div>
                                          <span className="text-[8px] font-black text-slate-400 mr-3">
                                            {
                                              Object.values(ageGroups).flat()
                                                .length
                                            }{" "}
                                            ANGGOTA
                                          </span>
                                        </div>
                                      </div>

                                      <div className="space-y-4 pl-3 md:pl-6">
                                        {viewMode === "kk" ? (
                                          <div className="space-y-3">
                                            {Object.entries(groupedMembersByFamily[daerah]?.[desa]?.[kelompok] || {})
                                              .sort((a, b) => a[1].familyName.localeCompare(b[1].familyName))
                                              .map(([familyId, familyGroup]) => (
                                                <motion.div
                                                  key={familyId}
                                                  initial={{ opacity: 0, y: 5 }}
                                                  animate={{ opacity: 1, y: 0 }}
                                                  className="bg-white border border-slate-100 rounded-xl p-3 md:p-4 hover:shadow-md hover:border-slate-200 transition-all duration-200 flex flex-col gap-2.5 md:gap-3 w-full"
                                                >
                                                  {/* Family Header */}
                                                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-dashed border-slate-200/60">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                      <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0 border border-blue-100/20">
                                                        <Home size={14} />
                                                      </div>
                                                      <div className="min-w-0">
                                                        <h4 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-tight truncate leading-snug">
                                                          Keluarga: {familyGroup.familyName}
                                                        </h4>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none mt-0.5">
                                                          {familyGroup.members.length} Anggota Keluarga
                                                        </p>
                                                      </div>
                                                    </div>
                                                    
                                                  </div>

                                                  {/* Family Members List - Rich Details & Full Width */}
                                                  <div className="space-y-1.5">
                                                    {familyGroup.members.map((fm) => (
                                                      <div
                                                        key={fm.id}
                                                        onClick={() => {
                                                          setSelectedMember(fm);
                                                          setShowDetailModal(true);
                                                        }}
                                                        className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 py-1.5 px-3 bg-slate-50/30 border border-slate-100/60 hover:bg-white hover:border-blue-150 hover:shadow-sm active:scale-[0.995] rounded-xl transition-all cursor-pointer group/row"
                                                      >
                                                        {/* Left Section: Avatar, Name, Relationship, ID */}
                                                        <div className="flex items-center justify-between md:justify-start gap-2 min-w-0 md:w-1/3 shrink-0 w-full">
                                                          <div className="flex items-center gap-2 min-w-0">
                                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${fm.jenis_kelamin === "Laki-laki" ? "bg-blue-50 text-blue-600 border border-blue-100/50" : "bg-rose-50 text-rose-600 border border-rose-100/50"}`}>
                                                              <User size={13} />
                                                            </div>
                                                            <div className="min-w-0">
                                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-[11px] font-black text-slate-800 group-hover/row:text-blue-600 transition-colors uppercase truncate">
                                                                  {fm.nama_lengkap}
                                                                </span>
                                                              </div>
                                                              {/* Mobile only Birth Info */}
                                                              <div className="md:hidden flex items-center gap-1 mt-0.5 min-w-0">
                                                                <Calendar size={10} className="text-slate-400 shrink-0" />
                                                                <p className="text-[9px] font-bold text-slate-500 truncate uppercase">
                                                                  {formatMobileBirth(fm.tempat_lahir, fm.tanggal_lahir)}
                                                                </p>
                                                              </div>
                                                              {/* Desktop only Relationship Tag */}
                                                              <span className={`hidden md:inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.2 rounded-md text-[8px] font-black uppercase tracking-wider ${
                                                                fm.relationship_name?.toLowerCase().includes("wali") || fm.relationship_name?.toLowerCase().includes("kepala")
                                                                  ? "bg-violet-50 text-violet-700 border border-violet-100"
                                                                  : "bg-slate-100 text-slate-500 border border-slate-200/50"
                                                              }`}>
                                                                {fm.relationship_name || "Anggota"}
                                                              </span>
                                                            </div>
                                                          </div>

                                                          {/* Mobile only Relationship Tag - Pojok Kanan */}
                                                          <div className="md:hidden shrink-0">
                                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                                                              fm.relationship_name?.toLowerCase().includes("wali") || fm.relationship_name?.toLowerCase().includes("kepala")
                                                                ? "bg-violet-50 text-violet-700 border border-violet-100"
                                                                : "bg-slate-100 text-slate-500 border border-slate-200/50"
                                                            }`}>
                                                              {fm.relationship_name || "Anggota"}
                                                            </span>
                                                          </div>
                                                        </div>

                                                        {/* Desktop only Middle Section: Birthplace/date & Education & Pekerjaan/Pernikahan */}
                                                        <div className="hidden md:grid md:grid-cols-3 gap-2 flex-1 min-w-0 md:border-l md:border-slate-200/60 md:pl-4">
                                                          {/* Birth info */}
                                                          <div className="flex items-center gap-1.5 min-w-0 md:pr-4">
                                                            <Calendar size={11} className="text-slate-400 shrink-0" />
                                                            <div className="min-w-0">
                                                              <p className="text-[10px] font-bold text-slate-600 uppercase truncate leading-tight">
                                                                {fm.tempat_lahir || "Belum ada"}
                                                              </p>
                                                              <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 leading-none">
                                                                {formatDisplayDate(fm.tanggal_lahir) || "-"}
                                                              </p>
                                                            </div>
                                                          </div>

                                                          {/* Education info */}
                                                          <div className="flex items-center gap-1.5 min-w-0 md:border-l md:border-slate-200/60 md:px-4">
                                                            <GraduationCap size={11} className="text-slate-400 shrink-0" />
                                                            <div className="min-w-0">
                                                              <p className="text-[10px] font-bold text-slate-600 uppercase truncate leading-tight">
                                                                {fm.pendidikan || "-"}
                                                              </p>
                                                              <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 leading-none">
                                                                {fm.kelas ? `Kls ${fm.kelas}` : "-"}
                                                              </p>
                                                            </div>
                                                          </div>

                                                          {/* Pekerjaan & Status Pernikahan */}
                                                          <div className="flex flex-col justify-center gap-1 min-w-0 md:border-l md:border-slate-200/60 md:pl-4">
                                                            <div className="flex items-center gap-1 min-w-0">
                                                              <Briefcase size={11} className="text-slate-400 shrink-0" />
                                                              <p className="text-[10px] font-black text-slate-700 uppercase truncate leading-none">
                                                                {fm.pekerjaan || "Belum Bekerja"}
                                                              </p>
                                                            </div>
                                                            <div className="flex items-center gap-1 min-w-0">
                                                              <CheckCircle2 size={11} className="text-slate-400 shrink-0" />
                                                              <p className="text-[8px] font-black text-slate-400 uppercase leading-none">
                                                                {fm.status || "Belum Menikah"}
                                                              </p>
                                                            </div>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </motion.div>
                                              ))}
                                          </div>
                                        ) : (
                                          Object.entries(ageGroups)
                                            .sort(([ageA], [ageB]) => {
                                              const matchedA = ages.find(a => a.name.toLowerCase().trim() === ageA.toLowerCase().trim());
                                              const matchedB = ages.find(b => b.name.toLowerCase().trim() === ageB.toLowerCase().trim());
                                              const orderA = matchedA && matchedA.sort_order !== null && matchedA.sort_order !== undefined ? matchedA.sort_order : 9999;
                                              const orderB = matchedB && matchedB.sort_order !== null && matchedB.sort_order !== undefined ? matchedB.sort_order : 9999;
                                              if (orderA !== orderB) return orderA - orderB;
                                              return ageA.localeCompare(ageB);
                                            })
                                            .map(([age, members]) => (
                                              <div
                                                key={age}
                                                className="space-y-2"
                                              >
                                                <div className="flex items-center gap-2">
                                                  <Calendar
                                                    size={10}
                                                    className="text-slate-300"
                                                  />
                                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                    {age}
                                                  </span>
                                                  <div className="h-px bg-slate-50 flex-1 ml-2"></div>
                                                </div>

                                                 <div className="space-y-1.5">
                                                   {members.map((member) => (
                                                     <motion.div
                                                       key={member.id}
                                                       initial={{
                                                         opacity: 0,
                                                         y: 5,
                                                       }}
                                                       animate={{
                                                         opacity: 1,
                                                         y: 0,
                                                       }}
                                                       onClick={() => {
                                                         setSelectedMember(member);
                                                         setShowDetailModal(true);
                                                       }}
                                                       className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 py-1.5 px-3 bg-slate-50/30 border border-slate-100/60 hover:bg-white hover:border-blue-150 hover:shadow-sm active:scale-[0.995] rounded-xl transition-all cursor-pointer group/row"
                                                     >
                                                       {/* Left Section: Avatar, Name, Relationship, ID */}
                                                       <div className="flex items-center justify-between md:justify-start gap-2 min-w-0 md:w-1/3 shrink-0 w-full">
                                                         <div className="flex items-center gap-2 min-w-0">
                                                           <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${member.jenis_kelamin === "Laki-laki" ? "bg-blue-50 text-blue-600 border border-blue-100/50" : "bg-rose-50 text-rose-600 border border-rose-100/50"}`}>
                                                             <User size={13} />
                                                           </div>
                                                           <div className="min-w-0">
                                                             <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-[11px] font-black text-slate-800 group-hover/row:text-blue-600 transition-colors uppercase truncate">
                                                                  {member.nama_lengkap}
                                                                </span>
                                                              </div>
                                                             {/* Mobile only Birth Info */}
                                                             <p className="md:hidden text-[9px] font-bold text-slate-500 truncate mt-0.5 uppercase">
                                                               <span className="inline-flex items-center gap-1"><Calendar size={10} className="text-slate-400 shrink-0" /> {formatMobileBirth(member.tempat_lahir, member.tanggal_lahir)}</span>
                                                             </p>
                                                           </div>
                                                         </div>

                                                         {/* Mobile only: Empty for Per Anggota as requested "(di per anggota kosong)" */}
                                                         <div className="md:hidden shrink-0"></div>
                                                       </div>

                                                       {/* Desktop only Middle Section: Birthplace/date & Education & Pekerjaan/Pernikahan */}
                                                       <div className="hidden md:grid md:grid-cols-3 gap-2 flex-1 min-w-0 md:border-l md:border-slate-200/60 md:pl-4">
                                                         {/* Birth info */}
                                                         <div className="flex items-center gap-1.5 min-w-0 md:pr-4">
                                                           <Calendar size={11} className="text-slate-400 shrink-0" />
                                                           <div className="min-w-0">
                                                             <p className="text-[10px] font-bold text-slate-600 uppercase truncate leading-tight">
                                                               {member.tempat_lahir || "Belum ada"}
                                                             </p>
                                                             <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 leading-none">
                                                               {formatDisplayDate(member.tanggal_lahir) || "-"}
                                                             </p>
                                                           </div>
                                                         </div>

                                                         {/* Education info */}
                                                         <div className="flex items-center gap-1.5 min-w-0 md:border-l md:border-slate-200/60 md:px-4">
                                                           <GraduationCap size={11} className="text-slate-400 shrink-0" />
                                                           <div className="min-w-0">
                                                             <p className="text-[10px] font-bold text-slate-600 uppercase truncate leading-tight">
                                                               {member.pendidikan || "-"}
                                                             </p>
                                                             <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 leading-none">
                                                               {member.kelas ? `Kls ${member.kelas}` : "-"}
                                                             </p>
                                                           </div>
                                                         </div>

                                                         {/* Pekerjaan & Status Pernikahan */}
                                                         <div className="flex items-center gap-1.5 min-w-0 md:border-l md:border-slate-200/60 md:pl-4">
                                                           <div className="min-w-0">
                                                             <p className="text-[10px] font-black text-slate-700 uppercase truncate leading-tight">
                                                               <span className="inline-flex items-center gap-1"><Briefcase size={11} className="text-slate-400 shrink-0" /> {member.pekerjaan || "Belum Bekerja"}</span>
                                                             </p>
                                                             <p className="text-[8px] font-black text-slate-400 uppercase mt-0.5 leading-none">
                                                               <span className="inline-flex items-center gap-1"><CheckCircle2 size={11} className="text-slate-400 shrink-0" /> {member.status || "Belum Menikah"}</span>
                                                             </p>
                                                           </div>
                                                         </div>
                                                       </div>
                                                     </motion.div>
                                                   ))}
                                                 </div>
                                              </div>
                                            ))
                                        )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowImportModal(false);
                setImportPreview([]);
                setImportWarnings([]);
                setImportError("");
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative bg-white w-full ${(importPreview.length > 0 || importPreviewFamilies.length > 0) ? "md:max-w-7xl md:max-h-[92vh]" : "md:max-w-3xl md:max-h-[85vh]"} h-full md:h-auto rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300`}
            >
              {/* Header */}
              <div className="px-5 md:px-8 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-base md:text-xl font-black text-slate-900 leading-tight">
                    Impor Massal Anggota
                  </h3>
                  <p className="text-[9px] md:text-xs text-slate-400 mt-0.5 uppercase font-black tracking-widest leading-none">
                    Unggah File Excel atau CSV Anda
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportPreview([]);
                    setImportPreviewFamilies([]);
                    setImportWarnings([]);
                    setImportError("");
                  }}
                  className="w-8 h-8 md:w-10 md:h-10 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-full flex items-center justify-center transition-all active:scale-90"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 no-scrollbar">
                {/* PREVIEW OF SUCCESSFULLY PARSED RECORDS - HIGHEST PRIORITY AT THE TOP */}

                {(importPreview.length > 0 || importPreviewFamilies.length > 0) && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/50 border border-emerald-100/50 p-3 rounded-xl">
                      <div>
                        <h4 className="text-xs md:text-sm font-black text-slate-800 flex items-center gap-2">
                          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          Pratinjau Data yang Terbaca
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {importType === "both"
                            ? `Berhasil menguraikan ${importPreview.length} Anggota dan ${importPreviewFamilies.length} Keluarga dari file Excel.`
                            : `Semua data kolom di bawah berhasil dibaca dari Excel Anda. Silakan verifikasi kecocokannya.`}
                        </p>
                      </div>
                      <span className="text-[9px] w-fit uppercase tracking-widest text-emerald-700 bg-emerald-100/70 font-black px-2.5 py-1 rounded-lg border border-emerald-200">
                        Siap Diimpor
                      </span>
                    </div>

                    {/* Segmented control tabs for dual-import */}
                    {importType === "both" && (
                      <div className="flex gap-2 border-b border-slate-200 pb-1">
                        <button
                          type="button"
                          onClick={() => setActivePreviewTab("member")}
                          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                            activePreviewTab === "member"
                              ? "border-blue-600 text-blue-600"
                              : "border-transparent text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Daftar Anggota ({importPreview.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivePreviewTab("family")}
                          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                            activePreviewTab === "family"
                              ? "border-blue-600 text-blue-600"
                              : "border-transparent text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Master Keluarga ({importPreviewFamilies.length})
                        </button>
                      </div>
                    )}

                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto overflow-x-auto shadow-sm custom-scrollbar bg-slate-50">
                      {activePreviewTab === "family" ? (
                        <table className="w-full text-left text-xs border-collapse font-sans bg-white min-w-[800px]">
                          <thead className="sticky top-0 bg-slate-100 text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-200 z-10 shadow-sm">
                            <tr>
                              <th className="p-3 text-center w-12 bg-slate-100">No</th>
                              <th className="p-3 whitespace-nowrap min-w-[150px] bg-slate-100">ID Keluarga</th>
                              <th className="p-3 whitespace-nowrap min-w-[250px]">Nama Keluarga (KK)</th>
                              <th className="p-3 whitespace-nowrap min-w-[200px]">Nomor Kartu Keluarga (KK)</th>
                              <th className="p-3 whitespace-nowrap min-w-[120px] text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-700">
                            {importPreviewFamilies.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-blue-50/20 transition-colors leading-relaxed">
                                <td className="p-3 text-center text-slate-400 font-mono text-[10px] border-r border-slate-100 bg-slate-50/50">
                                  {rIdx + 1}
                                </td>
                                <td className="p-3 font-mono text-[11px] text-slate-800 border-r border-slate-100 uppercase font-bold bg-white">
                                  {row.id}
                                </td>
                                <td className="p-3 font-bold uppercase text-slate-900 border-r border-slate-100">
                                  {row.nama_keluarga}
                                </td>
                                <td className="p-3 font-mono text-[11px] text-slate-600">
                                  {row.nomor_kk || "-"}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${row.is_new ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-blue-50 text-blue-600 border border-blue-100"}`}>
                                    {row.is_new ? "Baru" : "Update"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <table className="w-full text-left text-xs border-collapse font-sans bg-white min-w-[1500px]">
                          <thead className="sticky top-0 bg-slate-100 text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-200 z-10 shadow-sm">
                            <tr>
                              <th className="p-3 text-center w-12 bg-slate-100">
                                No
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[200px] bg-slate-100 sticky left-0 z-20 border-r border-slate-200">
                                Nama Lengkap
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[150px] bg-slate-100">
                                Label Anggota
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[110px] text-center">
                                Jenis Kelamin
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[200px]">
                                Hubungan Keluarga
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[140px]">
                                ID Daerah (Opsional)
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[150px]">
                                ID Desa
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[150px]">
                                ID Kelompok
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[150px]">
                                ID Kategori Usia
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[130px]">
                                No. HP Anggota
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[130px]">
                                Pendidikan Terakhir
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[110px] text-center">
                                Kelas/Sem
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[130px]">
                                Tempat Lahir
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[110px] text-center">
                                Tgl Lahir
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[250px]">
                                Alamat Rumah
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[130px]">
                                Pekerjaan
                              </th>
                              <th className="p-3 whitespace-nowrap min-w-[130px]">
                                Status Pernikahan
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-700">
                            {importPreview.map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                className="hover:bg-blue-50/20 transition-colors leading-relaxed"
                              >
                                <td className="p-3 text-center text-slate-400 font-mono text-[10px] border-r border-slate-100 bg-slate-50/50">
                                  {rIdx + 1}
                                </td>
                                <td className="p-3 font-bold uppercase text-slate-900 border-r border-slate-100 sticky left-0 bg-white hover:bg-slate-50">
                                  {row.nama_lengkap}
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  {row.labels && row.labels.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 max-w-[160px]">
                                      {row.labels.map((lbl: string, lIdx: number) => (
                                        <span key={lIdx} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100/30 rounded text-[9px] font-black uppercase">
                                          {lbl}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 font-semibold">-</span>
                                  )}
                                </td>
                                <td className="p-3 whitespace-nowrap text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${row.jenis_kelamin === "Laki-laki" ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-600"}`}
                                  >
                                    {row.jenis_kelamin}
                                  </span>
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <div className="text-[10px] font-bold text-slate-800">
                                    {row.relationship_name ? `${row.relationship_name.toUpperCase()} dari:` : "-"}
                                  </div>
                                  <div className="text-[9px] text-slate-500 font-semibold truncate max-w-[180px]">
                                    {row.family_name || row.family_id || "Belum ada"}
                                  </div>
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <div className="text-[10px] font-bold text-slate-700">
                                    {row.daerah_name || "-"}
                                  </div>
                                  <div className="text-[8px] text-slate-400 font-mono">
                                    {row.daerah_id || "-"}
                                  </div>
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <div className="text-[10px] font-bold text-slate-850">
                                    {row.desa_name || "-"}
                                  </div>
                                  <div className="text-[8px] text-slate-400 font-mono">
                                    {row.desa_id || "-"}
                                  </div>
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <div className="text-[10px] font-bold text-slate-850">
                                    {row.kelompok_name || "-"}
                                  </div>
                                  <div className="text-[8px] text-slate-400 font-mono">
                                    {row.kelompok_id || "-"}
                                  </div>
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <div className="text-[10px] font-bold text-slate-850">
                                    {row.age_category_name || "-"}
                                  </div>
                                  <div className="text-[8px] text-slate-400 font-mono">
                                    {row.age_category_id || "-"}
                                  </div>
                                </td>
                                <td className="p-3 font-mono text-[10.5px] text-slate-600 whitespace-nowrap">
                                  {row.no_hp_anggota || "-"}
                                </td>
                                <td className="p-3 text-slate-600 text-[10px] whitespace-nowrap">
                                  {row.pendidikan || "-"}
                                </td>
                                <td className="p-3 text-slate-600 text-[10px] text-center whitespace-nowrap">
                                  {row.kelas || "-"}
                                </td>
                                <td className="p-3 text-slate-600 text-[10px] whitespace-nowrap">
                                  {row.tempat_lahir || "-"}
                                </td>
                                <td className="p-3 font-mono text-[10px] text-center text-slate-600 whitespace-nowrap">
                                  {row.tanggal_lahir || "-"}
                                </td>
                                <td
                                  className="p-3 text-slate-500 text-[10px] max-w-[250px] truncate"
                                  title={row.alamat_rumah}
                                >
                                  {row.alamat_rumah || "-"}
                                </td>
                                <td className="p-3 text-slate-600 text-[10px] whitespace-nowrap">
                                  {row.pekerjaan || "-"}
                                </td>
                                <td className="p-3 text-slate-600 text-[10px] whitespace-nowrap">
                                  {row.status || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {/* STEPS 1 & 2: Dynamic Layout (Collapsed if Preview has Data) */}
                {(importPreview.length > 0 || importPreviewFamilies.length > 0) ? (
                  <div className="bg-slate-50 rounded-2xl border border-slate-150 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                        Opsi Tambahan / Unggah Ulang
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Step 1 download compact */}
                      <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex items-center justify-between hover:shadow-sm transition-shadow">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-slate-700 truncate">
                            Template Format Excel
                          </p>
                          <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                            Gunakan format standar agar tidak salah terbaca.
                          </p>
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
                          <p className="text-xs font-bold text-slate-700 truncate">
                            Unggah File Lain
                          </p>
                          <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                            Ganti dengan file excel yang telah dikoordinir.
                          </p>
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
                        <p className="text-[10px] md:text-xs text-slate-500">
                          Gunakan format Excel standar agar data terpetakan
                          otomatis ke sistem database.
                        </p>
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
                          <p className="text-xs font-bold text-slate-700">
                            Klik untuk memilih file, atau seret ke sini
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Mendukung format .XLSX, .XLS, dan .CSV
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Parsing Status indicator */}
                {isParsing && (
                  <div className="flex items-center justify-center py-6 gap-3">
                    <Loader2 className="animate-spin text-blue-600" size={20} />
                    <p className="text-xs font-medium text-slate-600 animate-pulse">
                      Mengurai data file & memvalidasi keanggotaan...
                    </p>
                  </div>
                )}

                {/* General Parsing Error */}
                {importError && (
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 flex items-start gap-3 text-rose-700">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold">Kesalahan Penguraian</p>
                      <p className="text-[10px] leading-relaxed">
                        {importError}
                      </p>
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
                    <p className="text-[9px] text-amber-600/80">
                      Sistem melakukan pemetaan otomatis ke Desa, Kelompok, atau
                      Kategori Usia terdekat bila penulisan sedikit berbeda.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 md:px-8 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
                <span className="text-[10px] text-slate-400 font-medium">
                  {importType === "family"
                    ? "Pastikan seluruh data wajib (Nama Keluarga) sudah sesuai."
                    : importType === "member"
                    ? "Pastikan seluruh data wajib (Nama Lengkap, Desa, Kelompok) sudah sesuai."
                    : "Pastikan seluruh data wajib (Nama Lengkap, Desa, Kelompok, dan Nama Keluarga) sudah sesuai."}
                </span>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportPreview([]);
                      setImportPreviewFamilies([]);
                      setImportWarnings([]);
                      setImportError("");
                    }}
                    className="flex-1 md:flex-none px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold transition-all active:scale-95"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={(importPreview.length === 0 && importPreviewFamilies.length === 0) || isSubmittingImport}
                    onClick={handleCommitImport}
                    className="flex-1 md:flex-none px-6 py-2.5 bg-blue-600 hover:bg-blue-700 hover:shadow-lg disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shadow-blue-200"
                  >
                    {isSubmittingImport ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        Proses...
                      </>
                    ) : (
                      importType === "family"
                        ? `Simpan ${importPreviewFamilies.length} Keluarga`
                        : importType === "member"
                        ? `Simpan ${importPreview.length} Jiwa`
                        : `Simpan ${importPreview.length} Jiwa & ${importPreviewFamilies.length} Keluarga`
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full md:max-w-4xl h-full md:h-auto md:max-h-[90vh] rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="px-4 md:px-12 py-4 md:py-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg md:text-2xl font-black text-slate-900 leading-tight">
                      {editingMember
                        ? "Metamorfosis Data"
                        : "Pendaftaran Anggota"}
                    </h3>
                    {editingMember === null && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] md:text-[9px] font-black uppercase rounded-full border border-emerald-200 animate-pulse tracking-wider">
                        📝 Draft Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] md:text-xs text-slate-400 mt-0.5 md:mt-1 uppercase font-black tracking-[0.2em]">
                    Formulir Digital Administrasi
                  </p>
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
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-full flex items-center justify-center transition-all active:scale-90"
                    title="Tutup"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex-1 overflow-y-auto p-4 md:p-12 space-y-8 md:space-y-12 no-scrollbar"
              >
                {/* Section: Identitas Utama */}
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-50 text-blue-600 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                      <User size={16} className="md:w-5 md:h-5" />
                    </div>
                    <h4 className="text-[10px] md:text-sm font-black text-slate-700 uppercase tracking-widest">
                      Identitas Dasar
                    </h4>
                    <div className="h-px bg-slate-100 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Nama Lengkap *
                      </label>
                      <input
                        required
                        type="text"
                        value={formData.nama_lengkap}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            nama_lengkap: e.target.value,
                          })
                        }
                        className="w-full px-4 md:px-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold placeholder:text-slate-300"
                        placeholder="Masukan Nama Anggota"
                      />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Jenis Kelamin
                      </label>
                      <ModernSelect
                        value={formData.jenis_kelamin || ""}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            jenis_kelamin: val as any,
                          })
                        }
                        options={[
                          { value: "Laki-laki", label: "Laki-laki" },
                          { value: "Perempuan", label: "Perempuan" },
                        ]}
                      />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Kontak WhatsApp
                      </label>
                      <div className="relative">
                        <Phone
                          className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-300"
                          size={14}
                        />
                        <input
                          type="text"
                          value={formData.no_hp_anggota}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              no_hp_anggota: e.target.value,
                            })
                          }
                          className="w-full pl-10 md:pl-12 pr-4 md:pr-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold"
                          placeholder="085123xxx"
                        />
                      </div>
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Tempat Lahir
                      </label>
                      <input
                        type="text"
                        value={formData.tempat_lahir}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            tempat_lahir: e.target.value,
                          })
                        }
                        className="w-full px-4 md:px-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold"
                        placeholder="Masukan kota lahir"
                      />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Tanggal Lahir
                      </label>
                      <div className="relative">
                        <Calendar
                          className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-300"
                          size={14}
                        />
                        <input
                          type="date"
                          value={formData.tanggal_lahir}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              tanggal_lahir: e.target.value,
                            })
                          }
                          className="w-full pl-10 md:pl-12 pr-4 md:pr-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold text-slate-600"
                        />
                      </div>
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Kategori Usia *
                      </label>
                      <ModernSelect
                        value={String(formData.age_category_id || "")}
                        onChange={(val) =>
                          setFormData({ ...formData, age_category_id: val })
                        }
                        options={ages.map((a) => ({
                          value: String(a.id),
                          label: a.name,
                        }))}
                        placeholder="Pilih Kategori"
                      />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Status Pernikahan
                      </label>
                      <ModernSelect
                        value={String(formData.status || "")}
                        onChange={(val) =>
                          setFormData({ ...formData, status: val })
                        }
                        options={[
                          { value: "Belum Menikah", label: "Belum Menikah" },
                          { value: "Menikah", label: "Menikah" },
                          { value: "Janda", label: "Janda" },
                          { value: "Duda", label: "Duda" },
                        ]}
                        placeholder="Pilih Status"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {/* RFID Card */}
                      <div className="space-y-1 md:space-y-2">
                        <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                          Registrasi ID Card RFID / NFC
                        </label>
                        {formData.rfid ? (
                          <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl md:rounded-2xl">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                                <CheckCircle2 size={12} />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                                  ID Card Terhubung
                                </p>
                                <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-tight ">
                                  {formData.rfid ? "Terdaftar" : ""}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({ ...prev, rfid: "" }))
                              }
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
                                <p className="text-[10px] font-black text-blue-800 uppercase tracking-wider">
                                  Menunggu Tap ID Card...
                                </p>
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
                              <div className="flex flex-col items-center justify-center py-6 w-full">
                                <CreditCard
                                  className="text-blue-500 animate-bounce mb-2"
                                  size={24}
                                />
                                <p className="text-xs font-bold text-blue-700 animate-pulse text-center">
                                  Tempelkan kartu atau scan kartu
                                </p>
                              </div>
                              <input
                                type="text"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const val = (
                                      e.target as HTMLInputElement
                                    ).value.trim();
                                    if (val) {
                                      setFormData((prev) => ({
                                        ...prev,
                                        rfid: val,
                                      }));
                                      setIsScanningRfid(false);
                                    }
                                  }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-default"
                                placeholder=""
                              />
                            </div>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed text-center">
                              Kartu akan otomatis terdeteksi.
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
                            <CreditCard
                              className="text-slate-400 group-hover:text-blue-500 transition-colors"
                              size={14}
                            />
                            <span className="text-xs font-black text-slate-500 group-hover:text-blue-600 uppercase tracking-widest">
                              Daftarkan ID Card
                            </span>
                          </button>
                        )}
                      </div>

                      {/* E-KTP NFC Card */}
                      <div className="space-y-1 md:space-y-2">
                        <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                          Registrasi E-KTP / NFC Card
                        </label>
                        {formData.rfid_ktp ? (
                          <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-200 rounded-xl md:rounded-2xl">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-lg bg-violet-500 text-white flex items-center justify-center shadow-sm">
                                <CheckCircle2 size={12} />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-violet-800 uppercase tracking-wider">
                                  E-KTP Terhubung
                                </p>
                                <p className="text-[9px] text-violet-600 font-bold uppercase tracking-tight ">
                                  {formData.rfid_ktp ? "Terdaftar" : ""}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  rfid_ktp: "",
                                }))
                              }
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
                                <p className="text-[10px] font-black text-violet-800 uppercase tracking-wider">
                                  Menunggu Tap E-KTP...
                                </p>
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
                              <div className="flex flex-col items-center justify-center py-6 w-full">
                                <CreditCard
                                  className="text-violet-500 animate-bounce mb-2"
                                  size={24}
                                />
                                <p className="text-xs font-bold text-violet-700 animate-pulse text-center">
                                  Tempelkan kartu atau scan kartu
                                </p>
                              </div>
                              <input
                                type="text"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const val = (
                                      e.target as HTMLInputElement
                                    ).value.trim();
                                    if (val) {
                                      setFormData((prev) => ({
                                        ...prev,
                                        rfid_ktp: val,
                                      }));
                                      setIsScanningRfidKtp(false);
                                    }
                                  }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-default"
                                placeholder=""
                              />
                            </div>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed text-center">
                              Kartu akan otomatis terdeteksi.
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
                            <CreditCard
                              className="text-slate-400 group-hover:text-violet-500 transition-colors"
                              size={14}
                            />
                            <span className="text-xs font-black text-slate-500 group-hover:text-violet-600 uppercase tracking-widest">
                              Daftarkan E-KTP (NFC)
                            </span>
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
                    <h4 className="text-[10px] md:text-sm font-black text-slate-700 uppercase tracking-widest">
                      Penempatan
                    </h4>
                    <div className="h-px bg-slate-100 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Daerah Terdaftar
                      </label>
                      <ModernSelect
                        value={String(formData.daerah_id || "")}
                        onChange={(val) => {
                          // When Daerah is changed, if the current desa belongs to a different daerah, reset desa & kelompok
                          const matchedDesa = desas.find(
                            (d) => String(d.id) === String(formData.desa_id),
                          );
                          const needsReset =
                            matchedDesa &&
                            String(matchedDesa.daerah_id) !== String(val);
                          setFormData({
                            ...formData,
                            daerah_id: val,
                            desa_id: needsReset ? "" : formData.desa_id,
                            kelompok_id: needsReset ? "" : formData.kelompok_id,
                          });
                        }}
                        options={(daerahs || []).map((d) => ({
                          value: String(d.id),
                          label: d.nama_daerah,
                        }))}
                        placeholder="Pilih Daerah"
                      />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Desa Terdaftar *
                      </label>
                      <ModernSelect
                        value={String(formData.desa_id || "")}
                        onChange={(val) => {
                          const matchedDesaDoc = desas.find(
                            (d) => String(d.id) === String(val),
                          );
                          const targetDaerahId =
                            matchedDesaDoc?.daerah_id ||
                            formData.daerah_id ||
                            "";
                          const allowedKlp = kelompoks.filter(
                            (k) => String(k.desa_id) === String(val),
                          );
                          const isCurrentAllowed = allowedKlp.some(
                            (k) =>
                              String(k.id) === String(formData.kelompok_id),
                          );
                          const newKelompokId = isCurrentAllowed
                            ? formData.kelompok_id
                            : allowedKlp.length > 0
                              ? allowedKlp[0].id
                              : "";
                          setFormData({
                            ...formData,
                            daerah_id: targetDaerahId,
                            desa_id: val,
                            kelompok_id: newKelompokId,
                          });
                        }}
                        options={desas
                          .filter(
                            (d) =>
                              !formData.daerah_id ||
                              String(d.daerah_id) ===
                                String(formData.daerah_id),
                          )
                          .map((d) => ({
                            value: String(d.id),
                            label: d.nama_desa,
                          }))}
                        placeholder="Pilih Desa Asal"
                      />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Kelompok *
                      </label>
                      <ModernSelect
                        value={String(formData.kelompok_id || "")}
                        onChange={(val) =>
                          setFormData({ ...formData, kelompok_id: val })
                        }
                        options={kelompoks
                          .filter(
                            (k) =>
                              !formData.desa_id ||
                              !k.desa_id ||
                              String(k.desa_id) === String(formData.desa_id),
                          )
                          .map((k) => ({
                            value: String(k.id),
                            label: k.nama_kelompok,
                          }))}
                        placeholder="Pilih Kelompok"
                      />
                    </div>
                    <div className="space-y-1 md:space-y-2 md:col-span-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Alamat Tinggal Lengkap
                      </label>
                      <div className="relative">
                        <Home
                          className="absolute left-3 md:left-4 top-4 md:top-5 text-slate-300"
                          size={14}
                        />
                        <textarea
                          value={formData.alamat_rumah}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              alamat_rumah: e.target.value,
                            })
                          }
                          className="w-full pl-10 md:pl-12 pr-4 md:pr-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold min-h-[80px] md:min-h-[100px] resize-none"
                          placeholder="Alamat lengkap..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Label & Kategori */}
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-50 text-indigo-600 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                      <LayoutGrid size={16} className="md:w-5 md:h-5" />
                    </div>
                    <h4 className="text-[10px] md:text-sm font-black text-slate-700 uppercase tracking-widest">
                      Label / Tagging Anggota
                    </h4>
                    <div className="h-px bg-slate-100 flex-1"></div>
                  </div>

                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 md:p-6">
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 leading-none">
                      Pilih label kustom untuk anggota ini:
                    </p>
                    {allLabels.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium">Belum ada label kustom yang dibuat. Kelola label di tab Group & Master.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 md:gap-3">
                        {allLabels.map((lbl) => {
                          const isChecked = (formData.labels || []).includes(lbl.name);
                          return (
                            <button
                              key={lbl.id}
                              type="button"
                              onClick={() => {
                                const current = formData.labels || [];
                                const next = isChecked
                                  ? current.filter((x) => x !== lbl.name)
                                  : [...current, lbl.name];
                                setFormData({ ...formData, labels: next });
                              }}
                              className={`px-3 py-2 rounded-xl text-xs font-black transition-all border ${
                                isChecked
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {lbl.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section: Keluarga & Peranan */}
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-amber-50 text-amber-600 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                      <Users size={16} className="md:w-5 md:h-5" />
                    </div>
                    <h4 className="text-[10px] md:text-sm font-black text-slate-700 uppercase tracking-widest">
                      Keluarga &amp; Peranan
                    </h4>
                    <div className="h-px bg-slate-100 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Hubungkan Keluarga / KK
                      </label>
                      <ModernSelect
                        value={String(formData.family_id || "")}
                        onChange={(val) =>
                          setFormData({ ...formData, family_id: val })
                        }
                        options={[
                          {
                            value: "",
                            label: "-- Tanpa Keluarga (Pribadi) --",
                          },
                          ...(families || []).map((f) => ({
                            value: String(f.id),
                            label: `${f.nama_keluarga} ${f.nomor_kk ? `(KK: ${f.nomor_kk})` : ""}`,
                          })),
                        ]}
                        placeholder="Pilih Keluarga"
                      />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Peranan / Hubungan
                      </label>
                      <ModernSelect
                        value={String(formData.relationship_id || "")}
                        onChange={(val) =>
                          setFormData({ ...formData, relationship_id: val })
                        }
                        options={[
                          { value: "", label: "-- Tanpa Hubungan --" },
                          ...(relationships || []).map((r) => {
                            const isWali = ['1', '2', '3', '6'].includes(String(r.is_wali || ''));
                            return {
                              value: String(r.id),
                              label: `${r.name} ${isWali ? "(👑 Wali)" : ""}`,
                            };
                          }),
                        ]}
                        placeholder="Pilih Peranan"
                      />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Pekerjaan Anggota
                      </label>
                      <div className="relative">
                        <Briefcase
                          className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-300"
                          size={14}
                        />
                        <input
                          type="text"
                          value={formData.pekerjaan || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              pekerjaan: e.target.value,
                            })
                          }
                          className="w-full pl-10 md:pl-12 pr-4 md:pr-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold"
                          placeholder="Wiraswasta, Pelajar, dsb"
                        />
                      </div>
                    </div>
                  </div>

                  {formData.family_id && (
                    <div className="p-4 bg-amber-50/30 border border-amber-100 rounded-2xl space-y-2">
                      <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider">
                        Deteksi Otomatis Orang Tua / Wali:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-white/80 p-2.5 rounded-xl border border-amber-100/40">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">
                            Nama Ayah (Wali)
                          </p>
                          <p className="text-xs font-black text-slate-700">
                            {members.find((m) => {
                              if (m.family_id !== formData.family_id) return false;
                              const relName = relationships.find((r) => r.id === m.relationship_id)?.name?.toLowerCase() || "";
                              return relName.startsWith("1") || 
                                     relName.includes("kepala keluarga (laki-laki)") || 
                                     relName.includes("kepala keluarga (pria)") || 
                                     relName === "ayah" || 
                                     relName === "bapak";
                            })?.nama_lengkap || "-"}
                          </p>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-amber-100/40">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">
                            Nama Ibu (Wali)
                          </p>
                          <p className="text-xs font-black text-slate-700">
                            {members.find((m) => {
                              if (m.family_id !== formData.family_id) return false;
                              const relName = relationships.find((r) => r.id === m.relationship_id)?.name?.toLowerCase() || "";
                              return relName.startsWith("3") || 
                                     relName.startsWith("2") || 
                                     relName.includes("istri") || 
                                     relName.includes("kepala keluarga (perempuan)") || 
                                     relName.includes("kepala keluarga (wanita)") || 
                                     relName === "ibu";
                            })?.nama_lengkap || "-"}
                          </p>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-amber-100/40">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">
                            No. HP Wali Utama
                          </p>
                          <p className="text-xs font-black text-slate-700">
                            {members.find((m) => {
                              if (m.family_id !== formData.family_id) return false;
                              const rel = relationships.find((r) => r.id === m.relationship_id);
                              const relName = rel?.name?.toLowerCase() || "";
                              return ['1', '2', '3', '6'].includes(String(rel?.is_wali || '')) || 
                                     relName.startsWith("1") || 
                                     relName.startsWith("2") || 
                                     relName.startsWith("3") || 
                                     relName.startsWith("6");
                            })?.no_hp_anggota || "-"}
                          </p>
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
                    <h4 className="text-[10px] md:text-sm font-black text-slate-700 uppercase tracking-widest">
                      Pendidikan
                    </h4>
                    <div className="h-px bg-slate-100 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Pendidikan Terakhir
                      </label>
                      <input
                        type="text"
                        value={formData.pendidikan}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pendidikan: e.target.value,
                          })
                        }
                        className="w-full px-4 md:px-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs md:text-sm font-bold"
                        placeholder="SD, SMP, dsb"
                      />
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Kelas / Semester
                      </label>
                      <input
                        type="text"
                        value={formData.kelas}
                        onChange={(e) =>
                          setFormData({ ...formData, kelas: e.target.value })
                        }
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
                        if (
                          window.confirm(
                            "Apakah Anda yakin ingin menghapus seluruh isi formulir ini dan mulai baru?",
                          )
                        ) {
                          try {
                            localStorage.removeItem(
                              "absensi_member_registration_draft",
                            );
                          } catch (e) {
                            console.error(e);
                          }
                          setFormData({
                            nama_lengkap: "",
                            daerah_id: "",
                            desa_id: "",
                            kelompok_id: "",
                            age_category_id: "",
                            tempat_lahir: "",
                            tanggal_lahir: "",
                            no_hp_anggota: "",
                            jenis_kelamin: "Laki-laki",
                            alamat_rumah: "",
                            pendidikan: "",
                            kelas: "",
                            rfid: "",
                            rfid_ktp: "",
                            family_id: "",
                            relationship_id: "",
                            pekerjaan: "",
                            status: "",
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
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full md:w-auto px-6 md:px-10 py-3 md:py-4 bg-blue-600 text-white rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-blue-600/30 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Save size={16} />
                    )}
                    Simpan Data
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedMember && (
          <div className="fixed inset-0 z-[150] flex items-start md:items-center justify-center p-3 pt-2 pb-[88px] md:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              className="relative bg-white w-full max-w-[92%] md:max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-150px)] md:max-h-[80vh] mt-0.5 md:mt-0"
            >
              {/* Profile Header */}
              <div
                className={`relative px-6 py-5 md:px-8 md:py-8 overflow-hidden shrink-0 ${selectedMember.jenis_kelamin === "Laki-laki" ? "bg-gradient-to-br from-blue-600 to-indigo-700" : "bg-gradient-to-br from-rose-500 to-pink-600"}`}
              >
                {/* Decorative background circle */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>

                <div className="relative flex items-center gap-4 md:gap-6">
                  <div className="w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-white p-1 shadow-lg relative shrink-0">
                    <div
                      className={`w-full h-full rounded-lg md:rounded-xl flex items-center justify-center ${selectedMember.jenis_kelamin === "Laki-laki" ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-600"}`}
                    >
                      <User
                        size={selectedMember.id ? 28 : 36}
                        className="md:w-10 md:h-10"
                      />
                    </div>
                    {/* Status indicator for desktop */}
                    <div className="hidden md:flex absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full items-center justify-center shadow-lg">
                      <CheckCircle2 size={12} className="text-white" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3">
                      <h3 className="text-[13px] md:text-2xl font-black text-white uppercase tracking-tight truncate leading-none">
                        {selectedMember.nama_lengkap}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[8px] md:text-[10px] font-black text-white uppercase tracking-widest border border-white/5">
                          {selectedMember.id}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 md:mt-3">
                      <span className="px-2 py-0.5 md:px-3 md:py-1 bg-white/10 rounded-md text-[8px] md:text-[10px] font-black text-white uppercase tracking-wider backdrop-blur-sm border border-white/10">
                        {selectedMember.jenis_kelamin}
                      </span>
                      <span className="px-2 py-0.5 md:px-3 md:py-1 bg-white/10 rounded-md text-[8px] md:text-[10px] font-black text-white uppercase tracking-wider backdrop-blur-sm border border-white/10">
                        {selectedMember.age_category_name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail Content Scroller */}
              <div className="relative -mt-2 md:-mt-4 bg-white rounded-t-xl md:rounded-t-3xl p-3 md:p-8 overflow-y-auto no-scrollbar flex-1">
                <div className="space-y-6 md:space-y-8">
                  {/* Primary Grid - 2 columns on desktop and mobile */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-8">
                    {/* Domisili */}
                    <div className="flex gap-1.5 md:gap-3 items-start min-w-0">
                      <div className="w-6 h-6 md:w-12 md:h-12 bg-slate-50 text-slate-400 rounded-md md:rounded-xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                        <MapPin size={12} className="md:w-[18px] md:h-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[7px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">
                          Domisili (Kelompok)
                        </p>
                        <p className="text-[10px] md:text-sm font-semibold md:font-medium text-slate-700 truncate" title={`${selectedMember.desa_name} / ${selectedMember.kelompok_name}`}>
                          {selectedMember.desa_name} /{" "}
                          {selectedMember.kelompok_name}
                        </p>
                      </div>
                    </div>

                    {/* Kontak */}
                    <div className="flex gap-1.5 md:gap-3 items-start min-w-0">
                      <div className="w-6 h-6 md:w-12 md:h-12 bg-slate-50 text-slate-400 rounded-md md:rounded-xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                        <Smartphone size={12} className="md:w-[18px] md:h-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[7px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">
                          Kontak WhatsApp
                        </p>
                        <p className="text-[10px] md:text-sm font-semibold md:font-medium text-slate-700 truncate" title={selectedMember.no_hp_anggota || "Belum terdata"}>
                          {selectedMember.no_hp_anggota || "Belum terdata"}
                        </p>
                      </div>
                    </div>

                    {/* Kelahiran */}
                    <div className="flex gap-1.5 md:gap-3 items-start min-w-0">
                      <div className="w-6 h-6 md:w-12 md:h-12 bg-slate-50 text-slate-400 rounded-md md:rounded-xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                        <Calendar size={12} className="md:w-[18px] md:h-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[7px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">
                          Kelahiran
                        </p>
                        <p className="text-[10px] md:text-sm font-semibold md:font-medium text-slate-700 truncate" title={formatMobileBirth(selectedMember.tempat_lahir, selectedMember.tanggal_lahir)}>
                          {formatMobileBirth(selectedMember.tempat_lahir, selectedMember.tanggal_lahir)}
                        </p>
                      </div>
                    </div>

                    {/* Pendidikan */}
                    <div className="flex gap-1.5 md:gap-3 items-start min-w-0">
                      <div className="w-6 h-6 md:w-12 md:h-12 bg-slate-50 text-slate-400 rounded-md md:rounded-xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                        <GraduationCap size={12} className="md:w-[18px] md:h-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[7px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">
                          Pendidikan
                        </p>
                        <p className="text-[10px] md:text-sm font-semibold md:font-medium text-slate-700 truncate" title={selectedMember.pendidikan ? (selectedMember.kelas ? `${selectedMember.pendidikan} (${selectedMember.kelas})` : selectedMember.pendidikan) : "Belum terdata"}>
                          {selectedMember.pendidikan
                            ? (selectedMember.kelas ? `${selectedMember.pendidikan} (${selectedMember.kelas})` : selectedMember.pendidikan)
                            : "Belum terdata"}
                        </p>
                      </div>
                    </div>

                    {/* Status Anggota */}
                    <div className="flex gap-1.5 md:gap-3 items-start min-w-0">
                      <div className="w-6 h-6 md:w-12 md:h-12 bg-slate-50 text-slate-400 rounded-md md:rounded-xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                        <CheckCircle2 size={12} className="md:w-[18px] md:h-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[7px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">
                          Status Anggota
                        </p>
                        <p className="text-[10px] md:text-sm font-semibold md:font-medium text-slate-700 truncate">
                          {selectedMember.status || "-"}
                        </p>
                      </div>
                    </div>

                    {/* Pekerjaan */}
                    <div className="flex gap-1.5 md:gap-3 items-start min-w-0">
                      <div className="w-6 h-6 md:w-12 md:h-12 bg-slate-50 text-slate-400 rounded-md md:rounded-xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                        <Briefcase size={12} className="md:w-[18px] md:h-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[7px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">
                          Pekerjaan
                        </p>
                        <p className="text-[10px] md:text-sm font-semibold md:font-medium text-slate-700 truncate">
                          {selectedMember.pekerjaan || "Belum Bekerja"}
                        </p>
                      </div>
                    </div>

                    {/* RFID & E-KTP NFC Info (Combined into 1) */}
                    <div className="col-span-2 bg-slate-50/50 p-2 md:p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-2 md:gap-4">
                      <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
                        <div className="w-7 h-7 md:w-10 md:h-10 bg-slate-100 text-slate-500 rounded-lg md:rounded-xl flex items-center justify-center border border-slate-200 shadow-sm shrink-0">
                          <CreditCard size={14} className="md:w-[18px] md:h-[18px]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                            NFC / RFID
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 md:gap-2 shrink-0">
                        <div className="flex items-center justify-between gap-1 px-1.5 py-1 md:px-3 md:py-2 bg-white rounded-lg md:rounded-xl border border-slate-200 text-[8px] md:text-[10px]">
                          <span className="font-black uppercase text-slate-400">ID:</span>
                          {selectedMember.rfid ? (
                            <span className="inline-flex items-center gap-1 px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 font-black uppercase tracking-wider border border-emerald-200/50 text-[7px] md:text-[9px]">
                              Terdaftar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1 py-0.2 rounded bg-slate-100 text-slate-500 font-black uppercase tracking-wider border border-slate-200 text-[7px] md:text-[9px]">
                              Kosong
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 px-1.5 py-1 md:px-3 md:py-2 bg-white rounded-lg md:rounded-xl border border-slate-200 text-[8px] md:text-[10px]">
                          <span className="font-black uppercase text-slate-400">KTP:</span>
                          {selectedMember.rfid_ktp ? (
                            <span className="inline-flex items-center gap-1 px-1 py-0.2 rounded bg-violet-50 text-violet-700 font-black uppercase tracking-wider border border-violet-200/50 text-[7px] md:text-[9px]">
                              Terdaftar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1 py-0.2 rounded bg-slate-100 text-slate-500 font-black uppercase tracking-wider border border-slate-200 text-[7px] md:text-[9px]">
                              Kosong
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Info: Family & Address */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    {/* Family */}
                    <div className="bg-slate-50/50 rounded-xl md:rounded-2xl p-2.5 md:p-6 space-y-2 md:space-y-4 border border-slate-100/50 flex flex-col">
                      <div className="flex items-center justify-between gap-2 text-slate-400 mb-1">
                        <div className="flex items-center gap-2">
                          <Users size={14} />
                          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">
                            Informasi Keluarga
                          </span>
                        </div>
                        {selectedMember.family_name && (
                          <span className="px-2 py-0.5 bg-violet-50 text-violet-700 text-[8px] font-black rounded-md uppercase border border-violet-100 leading-none">
                            KK: {selectedMember.family_name}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto max-h-[140px] md:max-h-[180px] no-scrollbar pr-1">
                        {detailFamilyMembers.length > 0 ? (
                          <div className="space-y-2">
                            {detailFamilyMembers.map((fm) => (
                              <button
                                key={fm.id}
                                type="button"
                                onClick={() => setSelectedMember(fm)}
                                className={`w-full flex items-center justify-between gap-2 md:gap-3 p-1.5 md:p-2.5 rounded-lg md:rounded-xl border text-left transition-all cursor-pointer hover:bg-slate-100/80 hover:border-slate-200 active:scale-[0.98] ${
                                  fm.id === selectedMember.id
                                    ? "bg-violet-50 border-violet-200"
                                    : "bg-white border-slate-100"
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-[8px] md:text-[9px] font-black text-violet-600/80 uppercase tracking-wider mb-0.5">
                                    {fm.relationship_name || "Anggota"}
                                  </p>
                                  <p className="text-[10px] md:text-xs font-black text-slate-800 uppercase truncate leading-none md:leading-snug">
                                    {fm.nama_lengkap}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-[8px] md:text-[9px] font-bold text-slate-500">
                                    {fm.no_hp_anggota || "-"}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                            <Users size={24} className="opacity-40 mb-1.5" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                              Mandiri / Belum Tergabung
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Address */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Home size={14} />
                        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">
                          Alamat Lengkap
                        </span>
                      </div>
                      <div className="p-4 bg-blue-50/30 border border-blue-100/50 rounded-xl h-full min-h-[80px]">
                        <p className="text-xs md:text-sm font-medium text-blue-900 leading-relaxed">
                          {selectedMember.alamat_rumah ||
                            "Data alamat resmi tidak tercatat di profil."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-3 py-2 md:px-5 md:py-4 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center justify-between gap-2 md:gap-4">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="hidden md:flex px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                >
                  Kembali ke Daftar
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="md:hidden w-8 h-8 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center active:scale-90 transition-all hover:bg-slate-200"
                  title="Tutup"
                >
                  <X size={14} />
                </button>

                <div className="flex items-center gap-1.5 md:gap-3">
                  <button
                    onClick={() => downloadMemberCard(selectedMember)}
                    className="w-8 h-8 md:w-auto md:px-4 md:py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg md:rounded-xl font-bold transition-all active:scale-95 shadow-xs flex items-center justify-center gap-2"
                    title="Unduh Kartu & Barcode"
                  >
                    <Download size={14} />
                    <span className="hidden md:inline text-[10px] md:text-xs font-bold uppercase tracking-wider">
                      Unduh Barcode
                    </span>
                  </button>

                  {canWrite && (
                    <div className="flex items-center gap-1.5 md:gap-3">
                      <button
                        onClick={() => {
                          setShowDetailModal(false);
                          setDeleteConfirmId(selectedMember.id);
                        }}
                        className="w-8 h-8 md:w-12 md:h-12 bg-rose-50 text-rose-500 border border-rose-100/50 md:border-none rounded-lg md:rounded-xl flex items-center justify-center active:scale-90 transition-all hover:bg-rose-100"
                        title="Hapus Anggota"
                      >
                        <Trash2
                          size={14}
                          className="md:w-5 md:h-5"
                        />
                      </button>
                      <button
                        onClick={() => {
                          setShowDetailModal(false);
                          handleEdit(selectedMember);
                        }}
                        className="w-8 h-8 md:w-auto md:px-8 md:py-3 bg-emerald-600 text-white rounded-lg md:rounded-xl font-bold shadow-sm md:shadow-lg md:shadow-emerald-200 active:scale-95 transition-all hover:bg-emerald-700 flex items-center justify-center gap-2"
                        title="Ubah Data"
                      >
                        <Edit2 size={14} className="md:w-4 md:h-4" />
                        <span className="hidden md:inline text-[10px] md:text-xs font-bold uppercase tracking-wider">
                          Ubah Data
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Confirm */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={48} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Konfirmasi Hapus
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed pb-4">
                Apakah Anda yakin ingin menghapus data ini secara permanen?
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold shadow-lg shadow-rose-100"
                >
                  Hapus Permanen
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="w-full py-4 text-slate-400 font-bold"
                >
                  Batalkan
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
          onClick={handleOpenAdd}
          className="md:hidden fixed right-6 bottom-24 z-40 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-all"
        >
          <UserPlus size={24} />
        </motion.button>
      )}
    </div>
  );
};

export default MemberManagement;
