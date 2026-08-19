# AI Rules & Design Guidelines - Catet-In

## 1. NAMA APLIKASI & BRANDING
* **Nama Resmi**: **Catet-In**
* **Deskripsi**: Sistem Informasi Absensi & Keuangan Instansi
* **Format Penulisan**: Wajib ditulis **Catet-In** (dengan huruf kapital pada **C** dan **I**, dipisahkan dengan tanda hubung/strip `-`). Jangan gunakan variasi lain seperti "CatetIn", "catetin", atau "Catet In".

---

## 2. ATURAN COLOR PALETTE & TEMA VISUAL

Aplikasi **Catet-In** menggunakan **Clean & Modern Light Theme** dengan aksen warna Sky Blue / Ocean Blue cerah.

### Palet Warna Utama (Light Sky Palette)
* **Primary Brand Blue**: `#0284c7` (Sky-600), `#0369a1` (Sky-700)
* **Light Sky Accents / Fill**: `#e0f2fe` (Sky-100), `#bae6fd` (Sky-200), `#f0f9ff` (Sky-50)
* **Background Canvas**: Light White / Soft Gray (`#ffffff`, `#f8fafc`, `#f1f5f9`)

### Palet Warna Status & Presensi
* **Hadir / Selesai (Emerald)**: `#15803d` / `#16a34a` (Teks/Aksen), `#dcfce7` (Background Terang)
* **Izin / Warning (Amber)**: `#b45309` / `#d97706` (Teks/Aksen), `#fef3c7` (Background Terang)
* **Sakit / Info (Blue)**: `#1d4ed8` / `#2563eb` (Teks/Aksen), `#dbeafe` (Background Terang)
* **Alpa / Danger (Red/Rose)**: `#b91c1c` / `#dc2626` (Teks/Aksen), `#fee2e2` (Background Terang)

### Aturan Batasan Warna Gelap (Dark Colors Constraint)
1. **Dilarang keras** menggunakan background atau kontainer yang serba gelap secara berlebihan di dalam UI maupun file export/laporan.
2. **Warna Gelap (Dark Navy/Slate `#0f172a` / `#1e293b`) HANYA BOHLEH DIGUNAKAN UNTUK**:
   * Judul banner paling atas (*Main Title Header*).
   * Teks utama agar kontras dan mudah dibaca (*High-Contrast Typography*).
   * Aksen tombol aksi utama (*Primary Action Button*).
3. Untuk card, tabel, modal, dan sheet laporan Excel, **WAJIB** menggunakan variasi warna versi terang (*light palette*).

---

## 3. PENGEMBANGAN MENU & FITUR BARU
* Setiap pembuatan menu, komponen UI, maupun fitur export baru di dalam aplikasi **Catet-In**, AI wajib secara konsisten mematuhi palet warna terang ini dan aturan penulisan nama **Catet-In**.

---

## 4. STANDAR KOMPONEN DROPDOWN & FILTER SELECT (MODERN SELECT)
Semua komponen Dropdown / Select di masa depan **WAJIB** menggunakan standar visual dan fungsional dari `ModernSelect` (`/components/ui/ModernSelect.tsx`) dengan ketentuan:

### A. Lapisan Stacking Paling Atas (Highest Layer Z-Index)
* Wrapper dropdown utama saat terbuka wajib memiliki `z-index: 500` (atau lebih tinggi):
  `style={{ zIndex: isOpen ? 500 : 1 }}`
* Panel dropdown menu list wajib menggunakan `z-[600]` dan `absolute` di atas komponen/kartu/tabel lainnya agar tidak pernah tertimpa elemen lain.

### B. Kontainer List (Frosted Glassmorphism & Penegas Bayangan)
* **Latar Belakang & Efek Kaca**: `bg-white/75 backdrop-blur-xl border border-white/90`
* **Garis Penegas Kontur (*Ring*) & Bayangan (*Shadow*)**: 
  `ring-1 ring-slate-900/15 shadow-[0_20px_50px_rgba(15,23,42,0.25)] rounded-2xl`
* **Internal Padding**: `p-1.5 md:p-2 space-y-1`

### C. Sorotan Item Aktif / Terpilih (*Selected Item*)
* **Bentuk & Sudut**: Tidak *full-bleed* menempel ke tepi, melainkan berjarak rapi dengan sudut tumpul `rounded-xl border`.
* **Warna Aktif**: Hijau semi-transparan elegan dengan teks tebal putih kontras:
  `bg-emerald-600/80 hover:bg-emerald-600/90 text-white border-emerald-500/40 font-black shadow-xs`
* **Ikon & Checkmark Aktif**: `text-white`
* **Item Tidak Terpilih (Normal & Hover)**: `text-slate-700 hover:bg-white/80 hover:text-slate-900 border-transparent`

### D. Header Pencarian di Dropdown (Search Bar)
* Header bar lengket: `bg-white/50 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-10 p-3`
* Input pencarian: `bg-white/60 border border-slate-200/70 rounded-xl text-[10px] font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white/95 focus:border-emerald-500`

