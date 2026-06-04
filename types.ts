
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
  history_id: string;
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
  nama_ortu: string;
  no_hp_ortu: string;
  pekerjaan_ortu: string;
  alamat_rumah: string;
  pendidikan: string;
  kelas: string;
  // Join data
  daerah_name?: string;
  desa_name?: string;
  kelompok_name?: string;
  age_category_name?: string;
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
