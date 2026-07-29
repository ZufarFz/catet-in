# Catet-In

**Catet-In** adalah aplikasi web berbasis **React**, **TypeScript**, dan **Supabase** yang dirancang khusus untuk mengelola pencatatan Keuangan (Bendahara) serta Presensi/Absensi kegiatan organisasi, komunitas, atau instansi secara akurat, cepat, dan terintegrasi.

---

## 🌟 Fitur Utama

### 1. 💰 Modul Keuangan (Bendahara)
- **Pencatatan Transaksi Real-time**: Catat transaksi Pemasukan, Pengeluaran, dan Iuran/Tabungan dengan kategori khusus.
- **Dashboard Ringkasan Saldo**: Visualisasi grafik arus kas, perbandingan pemasukan vs pengeluaran, serta ringkasan saldo kas instansi.
- **Audit Trail & Riwayat Edit/Hapus**: Menjamin transparansi keuangan dengan mencatat setiap perubahan data, riwayat penyuntingan, dan daftar transaksi yang dihapus.
- **Laporan Keuangan Komprehensif**: Cetak dan ekspor laporan keuangan ke format **PDF** (dengan tabel rapi) dan **Excel (XLSX)** sesuai filter periode, kelompok, desa, atau daerah.

### 2. 📋 Modul Presensi & Absensi
- **Form Absensi Cepat**: Input data presensi peserta per event/kegiatan dengan filter tanggal, kelompok, dan kategorial usia.
- **Pencegahan Duplikasi Presensi**: Sistem otomatis memvalidasi anggota yang sudah mengabsen pada tanggal dan jenis kegiatan tertentu tanpa menimpa data presensi terdahulu.
- **Pencatatan Operator (Dicatat Oleh)**: Setiap entri absensi secara otomatis merekam nama pengguna/operator yang melakukan input.
- **Riwayat & Statistik Presensi**: Rekapitulasi presensi anggota beserta filter status kehadiran (Hadir, Izin, Sakit, Alpa).

### 3. 👥 Manajemen Anggota & Struktur Kelompok
- **Manajemen Data Anggota**: Tambah, ubah, dan kelola profil anggota/jamaah beserta data kategorial dan domisili.
- **Hierarki Instansi & Kelompok**: Dukungan pengelompokan berdasarkan Kelompok, Desa, dan Daerah.
- **Isolasi Data Instansi**: Pengaturan multi-tenant berbasis instansi agar data keuangan dan absensi tetap terlindungi sesuai ranah instansi.

### 4. 🔒 Keamanan & Pengaturan Pengguna
- **Otentikasi Pengguna**: Sistem login dan hak akses pengguna.
- **Fitur Ubah Password**: Kemampuan memperbarui kata sandi akun pengguna secara mandiri.
- **Panduan Setup & Integrasi Database**: Panel konfigurasi Supabase untuk kemudahan penghubungan database.

---

## 🛠️ Teknologi yang Digunakan

- **Frontend Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Lucide React (Icons) + Motion (Animations)
- **Database Backend**: Supabase (PostgreSQL)
- **Visualisasi Data**: Recharts
- **Ekspor Dokumen**: jsPDF, jsPDF-AutoTable, XLSX

---

## 🚀 Panduan Memulai (Getting Started)

### Prasyarat
- Node.js (versi 18 atau lebih baru)
- npm atau yarn / pnpm

### Instalasi & Menjalankan Aplikasi

1. **Clone repository**
   ```bash
   git clone https://github.com/ZufarFz/catet-in.git
   cd catet-in
   ```

2. **Install Dependensi**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment Variable**
   Buat file `.env` di root direktori dan sesuaikan kredensial Supabase Anda:
   ```env
   VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Jalankan Development Server**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:3000` (atau port yang terkonfigurasi).

5. **Build untuk Produksi**
   ```bash
   npm run build
   ```

---


## 📄 Lisensi
Hak Cipta © 2026 Catet-In. Seluruh hak dilindungi undang-undang.
