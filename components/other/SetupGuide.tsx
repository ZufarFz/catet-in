import React, { useState } from 'react';
import { Copy, Globe, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface SetupGuideProps {
  onLogout?: () => void;
  portalScriptUrl?: string;
}

const INTEGRATED_DB_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Global Safety Net: Catch-All Deny
    match /{document=**} {
      allow read, write: if false;
    }

    // --- Hardened Global Helper Primitives ---
    function isSignedIn() {
      return request.auth != null;
    }

    function incoming() {
      return request.resource.data;
    }

    function existing() {
      return resource.data;
    }

    function isValidId(id) {
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\\\-]+$');
    }

    // Role Lookup function with dynamic database context and dual fallback (UID and Email)
    function getUserRole() {
      return (request.auth != null)
        ? (exists(/databases/$(database)/documents/users/$(request.auth.uid))
          ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
          : (request.auth.token.email != null && exists(/databases/$(database)/documents/users/$(request.auth.token.email))
            ? get(/databases/$(database)/documents/users/$(request.auth.token.email)).data.role
            : 'none'))
        : 'none';
    }

    function isSuperadmin() {
      return isSignedIn() && (request.auth.uid == 'superadmin' || request.auth.uid == 'NV0R4cqRoPbzQxZRTayu4egBeFH3' || request.auth.token.email == 'superadmin@catetin.com' || getUserRole() == 'Superadmin' || getUserRole() == 'superadmin');
    }

    function isAdmin() {
      return isSignedIn() && (isSuperadmin() || getUserRole() == 'Admin' || getUserRole() == 'admin' || getUserRole() == 'Superadmin' || getUserRole() == 'superadmin');
    }

    function isBendahara() {
      return isSignedIn() && (getUserRole() == 'Bendahara' || getUserRole() == 'bendahara');
    }

    function isKetua() {
      return isSignedIn() && (getUserRole() == 'Ketua' || getUserRole() == 'ketua');
    }

    function isWakil() {
      return isSignedIn() && (getUserRole() == 'Wakil' || getUserRole() == 'wakil');
    }

    function canWriteFinance() {
      return isAdmin() || isBendahara();
    }

    // --- Entity Specific Validation Helpers ---
    function isValidUser(data) {
      return data.role is string && data.role.size() <= 32;
    }

    function isValidTransaction(data) {
      return data.id is string && data.id.size() <= 64 &&
             data.date is string && data.date.size() <= 32 &&
             data.description is string && data.description.size() <= 256 &&
             data.type is string && (data.type == 'masuk' || data.type == 'keluar') &&
             data.category is string && data.category.size() <= 64 &&
             data.project_name is string && data.project_name.size() <= 64 &&
             data.amount is number && data.amount >= 0 && data.amount <= 100000000000 &&
             data.created_at is string && data.created_at.size() <= 64;
    }

    function isValidDeletedTx(data) {
      return data.id is string && data.id.size() <= 64 &&
             data.delete_reason is string && data.delete_reason.size() <= 256 &&
             data.deleted_at is string && data.deleted_at.size() <= 64 &&
             data.delete_by is string && data.delete_by.size() <= 64;
    }

    function isValidEditHistory(data) {
      return data.history_id is string && data.history_id.size() <= 64 &&
             data.transaction_id is string && data.transaction_id.size() <= 64 &&
             data.project_name is string && data.project_name.size() <= 64 &&
             data.old_description is string && data.old_description.size() <= 256 &&
             data.new_description is string && data.new_description.size() <= 256 &&
             data.old_value is number && data.new_value is number &&
             data.edited_at is string && data.edited_at.size() <= 64 &&
             data.edited_by is string && data.edited_by.size() <= 64 &&
             data.version_number is number;
    }

    function isValidProject(data) {
      return data.name is string && data.name.size() <= 64 &&
             data.created_at is string && data.created_at.size() <= 64 &&
             data.status is string && data.status.size() <= 32;
    }

    function isValidPeriodApproval(data) {
      return data.period_id is string && data.period_id.size() <= 32 &&
             data.project_name is string && data.project_name.size() <= 64 &&
             data.approved_by is string && data.approved_by.size() <= 64 &&
             data.approve_date is string && data.approve_date.size() <= 64;
    }

    function isValidMember(data) {
      return data.id is string && data.id.size() <= 64 &&
             data.nama_lengkap is string && data.nama_lengkap.size() <= 128 &&
             data.desa_id is string && data.desa_id.size() <= 64 &&
             data.kelompok_id is string && data.kelompok_id.size() <= 64 &&
             data.age_category_id is string && data.age_category_id.size() <= 64;
    }

    function isValidAttendanceLog(data) {
      return data.id is string && data.id.size() <= 64 &&
             data.memberId is string && data.memberId.size() <= 64 &&
             data.memberName is string && data.memberName.size() <= 128 &&
             data.date is string && data.date.size() <= 32 &&
             data.status is string && (data.status == 'Hadir' || data.status == 'Izin' || data.status == 'Sakit' || data.status == 'Alpa');
    }

    // --- Collections Routing Rules ---

    // 1. Users Profile Collection
    match /users/{userId} {
      allow get, list: if isSignedIn() || true;
      allow create: if isSignedIn() && isValidUser(incoming());
      allow update: if isSignedIn() && (isAdmin() || request.auth.uid == userId) && isValidUser(incoming());
      allow delete: if isAdmin();
    }

    // 1.5 Firebase Dynamic configurations mapping
    match /instansi/{instansiId} {
      allow get, list: if true;
    }

    // -- Treasurer Web Data Segment --
    match /treasurer-web/data {

      // 2. Financial Transactions
      match /transactions/{transactionId} {
        allow get, list: if isSignedIn();
        allow create: if canWriteFinance() && isValidTransaction(incoming());
        allow update: if canWriteFinance() && isValidTransaction(incoming()) &&
                      incoming().created_at == existing().created_at &&
                      incoming().created_by == existing().created_by;
        allow delete: if canWriteFinance();
      }

      // 3. Transactions Deletion Audit History
      match /deletedTransactions/{deletedId} {
        allow get, list: if isSignedIn();
        allow create: if canWriteFinance() && isValidDeletedTx(incoming());
        allow update, delete: if false;
      }

      // 4. Transactions Modifications Audit History
      match /editHistory/{historyId} {
        allow get, list: if isSignedIn();
        allow create: if canWriteFinance() && isValidEditHistory(incoming());
        allow update, delete: if false;
      }

      // 5. Segmented Projects list
      match /projects/{projectId} {
        allow get, list: if isSignedIn();
        allow create, update: if canWriteFinance() && isValidProject(incoming());
        allow delete: if isAdmin();
      }

      // 6. Categories List
      match /categories/{categoryId} {
        allow get, list: if isSignedIn();
        allow create, update: if canWriteFinance() && incoming().name is string && incoming().name.size() <= 64;
        allow delete: if isAdmin();
      }

      // 7. Month Approval Period
      match /approvals/{approvalId} {
        allow get, list: if isSignedIn();
        allow create, update: if (isAdmin() || isKetua()) && isValidPeriodApproval(incoming());
        allow delete: if isAdmin();
      }
    }

    // -- Attendance Web Data Segment --
    match /attendance-web/data {

      // 8. Attendance Members Public Listing
      match /members/{memberId} {
        allow get, list: if isSignedIn();
        allow create, update: if canWriteFinance() && isValidMember(incoming());
        allow delete: if canWriteFinance();
      }

      // 9. Attendance Marking Logs
      match /attendanceLogs/{logId} {
        allow get, list: if isSignedIn();
        allow create, update: if canWriteFinance() && isValidAttendanceLog(incoming());
        allow delete: if canWriteFinance();
      }

      // 9b. Daerahs Meta
      match /daerahs/{daerahId} {
        allow get, list: if isSignedIn();
        allow create, update, delete: if canWriteFinance();
      }

      // 10. Desas Location Meta
      match /desas/{desaId} {
        allow get, list: if isSignedIn();
        allow create, update, delete: if canWriteFinance();
      }

      // 11. Kelompoks Meta
      match /kelompoks/{kelompokId} {
        allow get, list: if isSignedIn();
        allow create, update, delete: if canWriteFinance();
      }

      // 12. Age Categories Meta
      match /ageCategories/{ageCategoryId} {
        allow get, list: if isSignedIn();
        allow create, update, delete: if canWriteFinance();
      }

      // 13. Attendance Summaries
      match /attendanceSummaries/{summaryId} {
        allow get, list: if isSignedIn();
        allow create, update, delete: if canWriteFinance();
      }
    }
  }
}`;

const ACCOUNT_DB_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Keamanan Global: Tolak semua akses secara default
    match /{document=**} {
      allow read, write: if false;
    }

    // Helper functions to identify signed-in Admin on central database
    function isSignedIn() {
      return request.auth != null;
    }

    function getUserRole() {
      return (request.auth != null)
        ? (exists(/databases/$(database)/documents/users/$(request.auth.uid))
          ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
          : (request.auth.token.email != null && exists(/databases/$(database)/documents/users/$(request.auth.token.email))
            ? get(/databases/$(database)/documents/users/$(request.auth.token.email)).data.role
            : 'none'))
        : 'none';
    }

    function isSuperadmin() {
      return isSignedIn() && (request.auth.uid == 'superadmin' || request.auth.uid == 'NV0R4cqRoPbzQxZRTayu4egBeFH3' || request.auth.token.email == 'superadmin@catetin.com' || getUserRole() == 'Superadmin' || getUserRole() == 'superadmin');
    }

    function isAdmin() {
      return isSignedIn() && (isSuperadmin() || getUserRole() == 'Admin' || getUserRole() == 'admin');
    }

    // ATURAN DATABASE AKUN (Main DB tempat koleksi 'users' dan 'instansi')
    match /users/{userId} {
      allow get: if true; // anyone can get details to sign in
      allow list: if isAdmin(); // only superadmin can list users in management portal
      allow create: if isSignedIn(); // anyone signed in can register
      allow update: if isSignedIn() && (isAdmin() || request.auth.uid == userId);
      allow delete: if isAdmin();
    }

    match /instansi/{instansiId} {
      allow get, list: if true; // anyone can load the connection variables at authentication
      allow create, update, delete: if false; // only manageable via Firebase Console
    }

    match /firebase_config/{configId} {
      allow get, list: if true;
    }
  }
}`;

const DATA_DB_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Global Safety Net: Catch-All Deny
    match /{document=**} {
      allow read, write: if false;
    }

    // --- Hardened Global Helper Primitives ---
    function isSignedIn() {
      return request.auth != null;
    }

    function incoming() {
      return request.resource.data;
    }

    function existing() {
      return resource.data;
    }

    // Role Lookup function with dynamic database context and dual fallback (UID and Email)
    function getUserRole() {
      return (request.auth != null)
        ? (exists(/databases/$(database)/documents/users/$(request.auth.uid))
          ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
          : (request.auth.token.email != null && exists(/databases/$(database)/documents/users/$(request.auth.token.email))
            ? get(/databases/$(database)/documents/users/$(request.auth.token.email)).data.role
            : 'none'))
        : 'none';
    }

    function isSuperadmin() {
      return isSignedIn() && (request.auth.uid == 'superadmin' || request.auth.uid == 'NV0R4cqRoPbzQxZRTayu4egBeFH3' || request.auth.token.email == 'superadmin@catetin.com' || getUserRole() == 'Superadmin' || getUserRole() == 'superadmin');
    }

    function isAdmin() {
      return isSignedIn() && (isSuperadmin() || getUserRole() == 'Admin' || getUserRole() == 'admin' || getUserRole() == 'Superadmin' || getUserRole() == 'superadmin');
    }

    function isBendahara() {
      return isSignedIn() && (getUserRole() == 'Bendahara' || getUserRole() == 'bendahara');
    }

    function isKetua() {
      return isSignedIn() && (getUserRole() == 'Ketua' || getUserRole() == 'ketua');
    }

    function isWakil() {
      return isSignedIn() && (getUserRole() == 'Wakil' || getUserRole() == 'wakil');
    }

    function canWriteFinance() {
      return isAdmin() || isBendahara();
    }

    function canSeeAuditLogs() {
      return isAdmin() || isKetua() || isWakil() || isBendahara();
    }

    // --- Entity Specific Validation Helpers ---
    function isValidUser(data) {
      return data.role is string && data.role.size() <= 32;
    }

    function isValidTransaction(data) {
      return data.id is string && data.id.size() <= 64 &&
             data.date is string && data.date.size() <= 32 &&
             data.description is string && data.description.size() <= 256 &&
             data.type is string && (data.type == 'masuk' || data.type == 'keluar') &&
             data.category is string && data.category.size() <= 64 &&
             data.project_name is string && data.project_name.size() <= 64 &&
             data.amount is number && data.amount >= 0 && data.amount <= 100000000000 &&
             data.created_at is string && data.created_at.size() <= 64;
    }

    function isValidDeletedTx(data) {
      return data.id is string && data.id.size() <= 64 &&
             data.delete_reason is string && data.delete_reason.size() <= 256 &&
             data.deleted_at is string && data.deleted_at.size() <= 64 &&
             data.delete_by is string && data.delete_by.size() <= 64;
    }

    function isValidEditHistory(data) {
      return data.history_id is string && data.history_id.size() <= 64 &&
             data.transaction_id is string && data.transaction_id.size() <= 64 &&
             data.project_name is string && data.project_name.size() <= 64 &&
             data.old_description is string && data.old_description.size() <= 256 &&
             data.new_description is string && data.new_description.size() <= 256 &&
             data.old_value is number && data.new_value is number &&
             data.edited_at is string && data.edited_at.size() <= 64 &&
             data.edited_by is string && data.edited_by.size() <= 64 &&
             data.version_number is number;
    }

    function isValidProject(data) {
      return data.name is string && data.name.size() <= 64 &&
             data.created_at is string && data.created_at.size() <= 64 &&
             data.status is string && data.status.size() <= 32;
    }

    function isValidPeriodApproval(data) {
      return data.period_id is string && data.period_id.size() <= 32 &&
             data.project_name is string && data.project_name.size() <= 64 &&
             data.approved_by is string && data.approved_by.size() <= 64 &&
             data.approve_date is string && data.approve_date.size() <= 64;
    }

    function isValidMember(data) {
      return data.id is string && data.id.size() <= 64 &&
             data.nama_lengkap is string && data.nama_lengkap.size() <= 128 &&
             data.desa_id is string && data.desa_id.size() <= 64 &&
             data.kelompok_id is string && data.kelompok_id.size() <= 64 &&
             data.age_category_id is string && data.age_category_id.size() <= 64;
    }

    function isValidAttendanceLog(data) {
      return data.id is string && data.id.size() <= 64 &&
             data.memberId is string && data.memberId.size() <= 64 &&
             data.memberName is string && data.memberName.size() <= 128 &&
             data.date is string && data.date.size() <= 32 &&
             data.status is string && (data.status == 'Hadir' || data.status == 'Izin' || data.status == 'Sakit' || data.status == 'Alpa');
    }

    // --- Collections Routing Rules ---
    match /users/{userId} {
      allow get, list: if isSignedIn();
      allow create, update: if isSignedIn() && (isAdmin() || request.auth.uid == userId);
      allow delete: if isAdmin();
    }

    // -- Treasurer Web Data Segment --
    match /treasurer-web/data {
      match /transactions/{transactionId} {
        allow get, list: if isSignedIn();
        allow create: if canWriteFinance() && isValidTransaction(incoming());
        allow update: if canWriteFinance() && isValidTransaction(incoming()) &&
                      incoming().created_at == existing().created_at &&
                      incoming().created_by == existing().created_by;
        allow delete: if canWriteFinance();
      }

      match /deletedTransactions/{deletedId} {
        allow get, list: if canSeeAuditLogs();
        allow create: if canWriteFinance() && isValidDeletedTx(incoming());
        allow update, delete: if false;
      }

      match /editHistory/{historyId} {
        allow get, list: if canSeeAuditLogs();
        allow create: if canWriteFinance() && isValidEditHistory(incoming());
        allow update, delete: if false;
      }

      match /projects/{projectId} {
        allow get, list: if isSignedIn();
        allow create, update: if canWriteFinance() && isValidProject(incoming());
        allow delete: if isAdmin();
      }

      match /categories/{categoryId} {
        allow get, list: if isSignedIn();
        allow create, update: if canWriteFinance() && incoming().name is string && incoming().name.size() <= 64;
        allow delete: if isAdmin();
      }

      match /approvals/{approvalId} {
        allow get, list: if isSignedIn();
        allow create, update: if (isAdmin() || isKetua()) && isValidPeriodApproval(incoming());
        allow delete: if isAdmin();
      }
    }

    // -- Attendance Web Data Segment --
    match /attendance-web/data {
      match /members/{memberId} {
        allow get, list: if isSignedIn();
        allow create, update: if canWriteFinance() && isValidMember(incoming());
        allow delete: if canWriteFinance();
      }

      match /attendanceLogs/{logId} {
        allow get, list: if isSignedIn();
        allow create, update: if canWriteFinance() && isValidAttendanceLog(incoming());
        allow delete: if canWriteFinance();
      }

      match /daerahs/{daerahId} {
        allow get, list: if isSignedIn();
        allow create, update, delete: if canWriteFinance();
      }

      match /desas/{desaId} {
        allow get, list: if isSignedIn();
        allow create, update, delete: if canWriteFinance();
      }

      match /kelompoks/{kelompokId} {
        allow get, list: if isSignedIn();
        allow create, update, delete: if canWriteFinance();
      }

      match /ageCategories/{ageCategoryId} {
        allow get, list: if isSignedIn();
        allow create, update, delete: if canWriteFinance();
      }

      match /attendanceSummaries/{summaryId} {
        allow get, list: if isSignedIn();
        allow create, update, delete: if canWriteFinance();
      }
    }
  }
}`;

const SetupGuide: React.FC<SetupGuideProps> = ({ onLogout }) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const handleCopy = (code: string, type: string) => {
    navigator.clipboard.writeText(code);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar p-4 md:p-10 mx-auto pb-40">
      <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-12 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-slate-50 pb-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">System Configuration</h2>
            <div className="flex items-center space-x-2">
               <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest font-mono">v18.0 ULTRA SECURE CLOUD</span>
            </div>
          </div>
          {onLogout && (
            <button onClick={onLogout} className="px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm cursor-pointer">
              Keluar Sesi
            </button>
          )}
        </div>

        <div className="p-8 bg-blue-50 rounded-[2rem] border-2 border-blue-200 space-y-8">
           <div className="flex items-center space-x-3 text-blue-600">
              <ShieldCheck size={32} />
              <h4 className="text-sm md:text-lg font-black uppercase tracking-tight">PANDUAN KONFIGURASI PORTAL</h4>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-blue-800">
              <div className="space-y-4">
                 <div>
                    <h5 className="text-[11px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                       <Globe size={14} />
                       WEB ACCESS (Akses Aplikasi)
                    </h5>
                    <p className="text-[10px] font-bold leading-relaxed">
                       Atur aplikasi mana saja yang bisa diakses user di kolom <b>web_access</b>:
                    </p>
                    <ul className="mt-2 space-y-1.5 text-[10px] font-medium">
                       <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1 shrink-0"></div>
                          <span><b>bendahara</b> : Akses ke aplikasi Bendahara Pintar.</span>
                       </li>
                       <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1 shrink-0"></div>
                          <span><b>absensi</b> : Akses ke aplikasi Absensi Digital.</span>
                       </li>
                       <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1 shrink-0"></div>
                          <span><b>bendahara, absensi</b> : Akses ke kedua aplikasi sekaligus.</span>
                       </li>
                    </ul>
                 </div>
              </div>

               <div className="space-y-4">
                  <div>
                     <h5 className="text-[11px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                        <ShieldCheck size={14} />
                        ROLE TIER (Tingkatan Akses)
                     </h5>
                     <p className="text-[10px] font-bold leading-relaxed">
                        Setiap Tier memiliki hak akses berbeda di semua aplikasi:
                     </p>
                     <div className="mt-3 space-y-2">
                        <div className="p-3 bg-white/50 rounded-xl border border-blue-100">
                           <p className="text-[9px] font-black text-blue-700">TIER 1 (SUPER ADMIN)</p>
                           <p className="text-[8px] font-bold text-blue-600 mt-1">Akses penuh mutlak. Bisa input data, hapus data, audit log, dan verifikasi laporan bulanan.</p>
                        </div>
                        <div className="p-3 bg-white/50 rounded-xl border border-blue-100">
                           <p className="text-[9px] font-black text-blue-700">TIER 2 & 3 (EXECUTIVES)</p>
                           <p className="text-[8px] font-bold text-blue-600 mt-1">Hanya baca (Read-only). Bisa melihat Audit dan verifikasi laporan bulanan (Tier 2).</p>
                        </div>
                        <div className="p-3 bg-white/50 rounded-xl border border-blue-100">
                           <p className="text-[9px] font-black text-blue-700">TIER 4 (OPERATOR/BENDAHARA)</p>
                           <p className="text-[8px] font-bold text-blue-600 mt-1">Akses Input & Edit. Bisa mengelola data harian tapi tidak bisa menghapus permanen atau verifikasi laporan.</p>
                        </div>
                        <div className="p-3 bg-white/50 rounded-xl border border-blue-100">
                           <p className="text-[9px] font-black text-blue-700">TIER 5 (VIEWER)</p>
                           <p className="text-[8px] font-bold text-blue-600 mt-1">Hanya bisa melihat dashboard dan riwayat biasa. Tidak punya akses audit atau input.</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* OPSI 1: SILENT LOGIN GANDA SETUP GUIDE */}
         <div className="p-8 bg-emerald-50 rounded-[2rem] border-2 border-emerald-200 space-y-8 text-emerald-900">
            <div className="flex items-center space-x-3 text-emerald-600">
               <ShieldCheck className="w-6 h-6 flex-shrink-0" />
               <h4 className="text-sm md:text-lg font-black uppercase tracking-tight">PANDUAN KONFIGURASI SILENT LOGIN GANDA (OPSI 1)</h4>
            </div>

            <p className="text-[10px] font-bold text-emerald-800 leading-relaxed">
               Aplikasi Anda kini dikonfigurasi menggunakan metode <b>Opsi 1: Silent Login Ganda di Sisi Client</b>. Metode ini menyelaraskan identitas user lintas database terpisah (tenant-isolated) secara otomatis dan aman tanpa membingungkan user. Ikuti langkah setup berikut:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="p-5 bg-white rounded-2xl border border-emerald-100 shadow-sm space-y-2">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-lg text-[8px] font-black uppercase tracking-widest font-mono">LANGKAH 1</span>
                  <h6 className="text-[10px] font-black uppercase tracking-tight text-emerald-950 font-bold">Pendaftaran Superadmin Cabang</h6>
                  <p className="text-[9px] text-emerald-700 leading-relaxed font-bold">
                     Di setiap <b>Authentication</b> Firebase Proyek Cabang/Instansi, daftarkan akun email manual: <b>superadmin@catetin.com</b> dengan password: <b>superadmin354</b>. Akun ini dipakai portal utama untuk sinkronisasi profil user secara otomatis.
                  </p>
               </div>

               <div className="p-5 bg-white rounded-2xl border border-emerald-100 shadow-sm space-y-2">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-lg text-[8px] font-black uppercase tracking-widest font-mono">LANGKAH 2</span>
                  <h6 className="text-[10px] font-black uppercase tracking-tight text-emerald-950 font-bold">Kredensial Login Sama</h6>
                  <p className="text-[9px] text-emerald-700 leading-relaxed font-bold">
                     Bila menggunakan login email & password, pastikan kredensial (email & password) user yang terdaftar di Portal Utama didaftarkan secara sama di <b>Authentication</b> instansi cabang mereka. Sistem akan melakukan silent-login ganda otomatis saat user login.
                  </p>
               </div>

               <div className="p-5 bg-white rounded-2xl border border-emerald-100 shadow-sm space-y-2">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-lg text-[8px] font-black uppercase tracking-widest font-mono">LANGKAH 3</span>
                  <h6 className="text-[10px] font-black uppercase tracking-tight text-emerald-950 font-bold">Aktivasi Google Sign-In Cabang</h6>
                  <p className="text-[9px] text-emerald-700 leading-relaxed font-bold">
                     Bila user menggunakan Google Sign-In, pastikan fitur Google Sign-In diaktifkan di <b>Firebase Console</b> instansi cabang. Portal akan meneruskan kredensial autentikasi Google secara transparan demi login ganda instan tanpa popup tambahan.
                  </p>
               </div>
            </div>
         </div>

         {/* GOOGLE SIGN-IN SETUP GUIDE CARD */}
         <div className="p-8 bg-indigo-50 rounded-[2rem] border-2 border-indigo-200 space-y-8 text-indigo-900">
           <div className="flex items-center space-x-3 text-indigo-600">
              <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12.24 10.285V13.4h6.86c-.277 1.56-1.602 4.585-6.86 4.585-4.54 0-8.24-3.765-8.24-8.4s3.7-8.4 8.24-8.4c2.58 0 4.307 1.095 5.298 2.045l2.465-2.37C18.251 1.01 15.53 0 12.24 0 5.58 0 0 5.37 0 12s5.58 12 12.24 12c6.96 0 11.57-4.89 11.57-11.79 0-.795-.085-1.4-.195-1.925H12.24z"
                />
              </svg>
              <h4 className="text-sm md:text-lg font-black uppercase tracking-tight">PANDUAN AKTIVASI & SETUP GOOGLE SIGN-IN</h4>
           </div>

           <p className="text-[10px] font-bold text-indigo-800 leading-relaxed">
              Ikuti langkah-langkah mudah berikut di Firebase Console Anda untuk mengaktifkan fitur login instan via Google:
           </p>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 bg-white rounded-2xl border border-indigo-100 shadow-sm space-y-2">
                 <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-widest font-mono">LANGKAH 1</span>
                 <h6 className="text-[10px] font-black uppercase tracking-tight text-indigo-950">Provider Authentication</h6>
                 <p className="text-[9px] text-indigo-700 leading-relaxed font-bold">
                    Buka <b>Firebase Console</b> → Build → <b>Authentication</b> → tab <b>Sign-in method</b> → klik <b>Add new provider</b> → pilih <b>Google</b> → Aktifkan (Enable) dan lengkapi email dukungan proyek Anda, lalu klik Simpan.
                 </p>
              </div>

              <div className="p-5 bg-white rounded-2xl border border-indigo-100 shadow-sm space-y-2">
                 <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-widest font-mono">LANGKAH 2</span>
                 <h6 className="text-[10px] font-black uppercase tracking-tight text-indigo-950 font-bold">Authorized Domains</h6>
                 <p className="text-[9px] text-indigo-700 leading-relaxed font-bold">
                    Pastikan domain aplikasi (URL pengembangan/produksi) atau domain Netlify/Cloud Run Anda telah terdaftar di bagian <b>Authorized domains</b> pada halaman yang sama untuk menghindari pemblokiran jendela popup login.
                 </p>
              </div>

              <div className="p-5 bg-white rounded-2xl border border-indigo-100 shadow-sm space-y-2">
                 <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-widest font-mono">LANGKAH 3</span>
                 <h6 className="text-[10px] font-black uppercase tracking-tight text-indigo-950 font-bold">Pendaftaran Akun Anggota</h6>
                 <p className="text-[9px] text-indigo-700 leading-relaxed font-bold">
                    Daftarkan akun baru di Firestore koleksi <b>users</b>. Gunakan <b>alamat Google Mail / Gmail</b> mereka sebagai Document ID. Pada login pertama, portal akan otomatis melink-kan Google UID mereka secara instan!
                 </p>
              </div>
           </div>
         </div>

         {/* DYNAMIC SECURE RULES COPIER */}
         <div className="p-8 bg-slate-900 rounded-[2rem] border-2 border-slate-800 space-y-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div className="flex items-center space-x-3 text-amber-400">
                  <ShieldCheck size={32} />
                  <div>
                    <h4 className="text-sm md:text-lg font-black uppercase tracking-tight leading-none">FIRESTORE SECURITY RULES (MULTI-DB)</h4>
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-1">Copy and paste directly into Firebase Console</p>
                  </div>
               </div>
            </div>
            
            <p className="text-[10px] font-medium text-slate-300 leading-relaxed">
               Gunakan konfigurasi di bawah ini untuk mengamankan database Firebase Anda. Klik tombol <b>COPY</b> pada masing-masing bagian, lalu tempelkan (Paste) di tab <b>Rules</b> pada <b>Firestore Database</b> masing-masing console proyek Firebase Anda.
            </p>

            {/* SPLIT MULTI-DATABASE MODE CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-1 duration-300">
               {/* Database Akun Card */}
               <div className="space-y-4 bg-slate-950/70 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <div className="space-y-3">
                     <div className="flex items-center justify-between">
                        <div>
                           <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-[8.5px] font-black uppercase tracking-widest font-mono">Database Utama (Akun)</span>
                           <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-200 mt-1">
                              1. Database Portal Utama
                           </h5>
                        </div>
                        <button onClick={() => handleCopy(ACCOUNT_DB_RULES, 'rules_acc')} className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${copiedType === 'rules_acc' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                           {copiedType === 'rules_acc' ? <CheckCircle2 size={10}/> : <Copy size={10}/>}
                           <span>{copiedType === 'rules_acc' ? 'Tersalin' : 'Copy'}</span>
                        </button>
                     </div>
                     <p className="text-[9px] text-slate-400 font-bold leading-relaxed">
                        Dipasang di Firebase Project Utama (tempat data user login dan instansi disimpan). Hanya mengizinkan manajemen profil user dan konfigurasi instansi penyambung.
                     </p>
                  </div>
                  <div className="bg-slate-950 rounded-xl p-4 border border-slate-900 shadow-inner mt-2">
                     <pre className="text-[9px] text-blue-300 font-mono overflow-x-auto h-32 no-scrollbar">{ACCOUNT_DB_RULES}</pre>
                  </div>
               </div>

               {/* Database Data Card */}
               <div className="space-y-4 bg-slate-950/70 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <div className="space-y-3">
                     <div className="flex items-center justify-between">
                        <div>
                           <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-[8.5px] font-black uppercase tracking-widest font-mono">Database Operasional</span>
                           <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-200 mt-1">
                              2. Database Cabang/Instansi
                           </h5>
                        </div>
                        <button onClick={() => handleCopy(DATA_DB_RULES, 'rules_data')} className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${copiedType === 'rules_data' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                           {copiedType === 'rules_data' ? <CheckCircle2 size={10}/> : <Copy size={10}/>}
                           <span>{copiedType === 'rules_data' ? 'Tersalin' : 'Copy'}</span>
                        </button>
                     </div>
                     <p className="text-[9px] text-slate-400 font-bold leading-relaxed">
                        Dipasang di Firebase Project Cabang/Operasional. Mengizinkan baca & tulis untuk transaksi keuangan bendahara, log edit audit, dan absensi pada koleksi yang disegmentasi.
                     </p>
                  </div>
                  <div className="bg-slate-950 rounded-xl p-4 border border-slate-900 shadow-inner mt-2">
                     <pre className="text-[9px] text-emerald-300 font-mono overflow-x-auto h-32 no-scrollbar">{DATA_DB_RULES}</pre>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export { INTEGRATED_DB_RULES };
export default SetupGuide;
