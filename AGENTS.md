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
