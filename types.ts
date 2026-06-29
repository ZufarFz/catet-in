
export type TransactionType = 'INCOME' | 'EXPENSE';

export interface GlobalStats {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  overallCount: number;
}

export interface ProjectMetadata {
  name: string;
  created_at: string;
  status: string;
  approved_by: string;
  approved_at: string;
  approver_role: string;
}

export interface Transaction {
  id: string;
  date: string; // Internal: YYYY-MM-DD
  formattedDate: string; // Display: DD/MM/YY
  description: string;
  type: 'masuk' | 'keluar';
  category: string;
  project_name: string;
  debit: number;
  credit: number;
  balance: number;
  amount: number; // Internal usage for calculations
  created_at: string;
  created_by: string;
  created_by_role: string;
  edit_version: number;
  // Dynamic fields mapped from Monthly_Approvals
  is_approve: boolean;
  approve_by: string;
  approve_date: string;
  approver_role?: string;
}

export interface DeletedTransaction extends Transaction {
  delete_reason: string;
  deleted_at: string;
  delete_by: string;
}

export interface EditHistory {
  id: string;
  transaction_id: string;
  project_name: string; // New field
  type: string;
  old_description: string;
  new_description: string;
  old_value: number;
  new_value: number;
  edited_at: string;
  edited_by: string;
  version_number: number;
}

export type AppTab = 'dashboard' | 'transaksi' | 'history' | 'laporan' | 'setup' | 'audit' | 'settings' | 'edit_audit' | 'absensi_form' | 'absensi_history' | 'absensi_members' | 'absensi_groups';

export type AppType = 'bendahara' | 'absensi';

export interface Family {
  id: string;
  nama_keluarga: string;
  nomor_kk?: string;
  created_at?: string;
}

export interface FamilyRelationship {
  id: string;
  name: string;
  is_wali: boolean;
}

export interface AbsensiMember {
  id: string;
  daerah_id?: string;
  desa_id: string;
  kelompok_id: string;
  age_category_id: string;
  nama_lengkap: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  no_hp_anggota: string;
  jenis_kelamin: string;
  alamat_rumah: string;
  pendidikan: string;
  kelas: string;
  rfid?: string;
  rfid_ktp?: string;
  family_id?: string;
  relationship_id?: string;
  pekerjaan?: string;
  // Join data
  nama_ortu?: string; // Virtual / Computed from family relationships
  no_hp_ortu?: string; // Virtual / Computed from family relationships
  pekerjaan_ortu?: string; // Virtual / Computed from family relationships
  daerah_name?: string;
  desa_name?: string;
  kelompok_name?: string;
  age_category_name?: string;
  family_name?: string;
  relationship_name?: string;
  is_wali?: boolean;
}

export interface AttendanceLog {
  id: string;
  memberId: string;
  memberName: string;
  ageName: string;
  kelompokName: string;
  desaName: string;
  daerahName?: string;
  date: string;
  dateInput: string;
  status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';
  note: string;
  event_id?: string;
  metode?: 'manual' | 'scan' | 'rfid';
}

export interface DaerahData {
  id: string;
  nama_daerah: string;
  pimpinan: string;
  keterangan: string;
}

export interface DesaData {
  id: string;
  nama_desa: string;
  pimpinan: string;
  alamat: string;
  daerah_id?: string;
}

export interface KelompokData {
  id: string;
  nama_kelompok: string;
  pimpinan: string;
  keterangan: string;
  desa_id?: string;
}

export interface AgeCategoryData {
  id: string;
  name: string;
  description: string;
}

export interface EventData {
  id: string;
  nama_kegiatan: string;
  tanggal_kegiatan?: string;
  keterangan?: string;
  created_at?: string;
}
