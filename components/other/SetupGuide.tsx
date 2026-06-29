import React, { useState, useEffect } from 'react';
import { 
  Copy, Globe, ShieldCheck, CheckCircle2, FileSpreadsheet, ChevronUp, ChevronDown, Check,
  Database, Key, Save, AlertCircle, Sparkles, HeartPulse, RefreshCw, Layers
} from 'lucide-react';
import { saveCentralConfig } from '../../supabase';

interface SetupGuideProps {
  onLogout?: () => void;
  portalScriptUrl?: string;
}

const APPS_SCRIPT_CODE = `// =========================================================================
// KODE GOOGLE APPS SCRIPT BACKUP OTOMATIS BENDARA (MULTI-DB SECURE SYNC)
// =========================================================================
function doPost(e) {
  try {
    var jsonString = e.postData.contents;
    var payload = JSON.parse(jsonString);
    var action = payload.action;
    var data = payload.data;
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheets(ss);
    
    if (action === "add_tx") {
      handleAddTx(ss, data);
    } else if (action === "edit_tx") {
      handleEditTx(ss, data, payload.auditEdit);
    } else if (action === "delete_tx") {
      handleDeleteTx(ss, data, payload.auditDelete);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Backup completed successfully" }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function initSheets(ss) {
  var sheets = {
    "Kas Harian": ["ID Transaksi", "Tanggal", "Keterangan", "Kategori", "Debet", "Kredit", "Saldo", "Input Oleh", "Peran", "Versi Edit", "Dibuat Pada"],
    "Event": ["ID Transaksi", "Nama Proker/Event", "Tanggal", "Keterangan", "Kategori", "Debet", "Kredit", "Input Oleh", "Peran", "Versi Edit", "Dibuat Pada"],
    "Audit Hapus": ["ID Hapus", "ID Transaksi", "Nama Proker/Event", "Tanggal", "Keterangan", "Kategori", "Nominal", "Tipe", "Dihapus Oleh", "Alasan Hapus", "Dihapus Pada"],
    "Audit Edit": ["ID Edit", "ID Transaksi", "Nama Proker/Event", "Tipe", "Keterangan Lama", "Keterangan Baru", "Nominal Lama", "Nominal Baru", "Diedit Oleh", "Versi", "Diedit Pada"]
  };
  
  for (var name in sheets) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(sheets[name]);
      sheet.getRange(1, 1, 1, sheets[name].length).setFontWeight("bold").setBackground("#f3f4f6");
      sheet.setFrozenRows(1);
    }
  }
}

function handleAddTx(ss, tx) {
  var isKasUmum = String(tx.project_name || "KAS UMUM").trim().toUpperCase() === "KAS UMUM";
  if (isKasUmum) {
    var sheet = ss.getSheetByName("Kas Harian");
    sheet.appendRow([
      tx.id,
      tx.date,
      tx.description,
      tx.category,
      Number(tx.debit || 0),
      Number(tx.credit || 0),
      0,
      tx.created_by,
      tx.created_by_role,
      Number(tx.edit_version || 0),
      tx.created_at
    ]);
    recalculateKasHarian(sheet);
  } else {
    var sheet = ss.getSheetByName("Event");
    sheet.appendRow([
      tx.id,
      tx.project_name,
      tx.date,
      tx.description,
      tx.category,
      Number(tx.debit || 0),
      Number(tx.credit || 0),
      tx.created_by,
      tx.created_by_role,
      Number(tx.edit_version || 0),
      tx.created_at
    ]);
  }
}

function handleEditTx(ss, tx, auditEdit) {
  var isKasUmum = String(tx.project_name || "KAS UMUM").trim().toUpperCase() === "KAS UMUM";
  var sheetName = isKasUmum ? "Kas Harian" : "Event";
  var sheet = ss.getSheetByName(sheetName);
  
  if (sheet) {
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var foundIndex = -1;
    
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]).toUpperCase() === String(tx.id).toUpperCase()) {
        foundIndex = i + 1;
        break;
      }
    }
    
    if (foundIndex !== -1) {
      if (isKasUmum) {
        sheet.getRange(foundIndex, 2, 1, 9).setValues([[
          tx.date,
          tx.description,
          tx.category,
          Number(tx.debit || 0),
          Number(tx.credit || 0),
          0,
          tx.created_by,
          tx.created_by_role,
          Number(tx.edit_version || 0)
        ]]);
        recalculateKasHarian(sheet);
      } else {
        sheet.getRange(foundIndex, 2, 1, 9).setValues([[
          tx.project_name,
          tx.date,
          tx.description,
          tx.category,
          Number(tx.debit || 0),
          Number(tx.credit || 0),
          tx.created_by,
          tx.created_by_role,
          Number(tx.edit_version || 0)
        ]]);
      }
    } else {
      handleAddTx(ss, tx);
    }
  }
  
  if (auditEdit) {
    var auditSheet = ss.getSheetByName("Audit Edit");
    if (auditSheet) {
      auditSheet.appendRow([
        auditEdit.id,
        auditEdit.transaction_id,
        auditEdit.project_name,
        auditEdit.type,
        auditEdit.old_description,
        auditEdit.new_description,
        Number(auditEdit.old_value || 0),
        Number(auditEdit.new_value || 0),
        auditEdit.edited_by,
        Number(auditEdit.version_number || 0),
        auditEdit.edited_at
      ]);
    }
  }
}

function handleDeleteTx(ss, tx, auditDelete) {
  var isKasUmum = String(tx.project_name || "KAS UMUM").trim().toUpperCase() === "KAS UMUM";
  var sheetName = isKasUmum ? "Kas Harian" : "Event";
  var sheet = ss.getSheetByName(sheetName);
  
  if (sheet) {
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var foundIndex = -1;
    
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]).toUpperCase() === String(tx.id).toUpperCase()) {
        foundIndex = i + 1;
        break;
      }
    }
    
    if (foundIndex !== -1) {
      sheet.deleteRow(foundIndex);
      if (isKasUmum) {
        recalculateKasHarian(sheet);
      }
    }
  }
  
  if (auditDelete) {
    var auditSheet = ss.getSheetByName("Audit Hapus");
    if (auditSheet) {
      auditSheet.appendRow([
        auditDelete.id,
        auditDelete.id,
        auditDelete.project_name,
        auditDelete.date,
        auditDelete.description,
        auditDelete.category,
        Number(auditDelete.amount || 0),
        auditDelete.type,
        auditDelete.delete_by,
        auditDelete.delete_reason,
        auditDelete.deleted_at
      ]);
    }
  }
}

function recalculateKasHarian(sheet) {
  var rowCount = sheet.getLastRow();
  if (rowCount < 2) return;
  
  var sortRange = sheet.getRange(2, 1, rowCount - 1, sheet.getLastColumn());
  sortRange.sort({column: 2, ascending: true});
  
  var dataRange = sheet.getRange(2, 1, rowCount - 1, sheet.getLastColumn());
  var values = dataRange.getValues();
  
  var runningBalance = 0;
  for (var i = 0; i < values.length; i++) {
    var debit = Number(values[i][4]) || 0;
    var credit = Number(values[i][5]) || 0;
    runningBalance += (debit - credit);
    sheet.getRange(i + 2, 7).setValue(runningBalance);
  }
}`;

const SUPABASE_CENTRAL_SQL = `-- =========================================================================
-- 1. CENTRAL DATABASE TABLES (Run this on your Central Supabase Project)
-- =========================================================================

-- Create Users Table (Central Master Accounts)
create table if not exists public.users (
  id text primary key, -- mapped from user auth UID
  email text,
  username text,
  password text, -- kept for legacy reference
  full_name text,
  role text default 'Pending',
  original_role text,
  instansi text, -- reference instance Id
  web_access text default 'bendahara,absensi', -- comma-separated (e.g. 'bendahara,absensi')
  status text default 'Pending',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS on central users
alter table public.users enable row level security;

-- Drop any stale policies on users to prevent conflicts
drop policy if exists "Allow public login checks" on public.users;
drop policy if exists "Allow self registration insert" on public.users;
drop policy if exists "Allow user self modifications" on public.users;
drop policy if exists "Allow login email lookup" on public.users;
drop policy if exists "Allow users to insert own registration" on public.users;
drop policy if exists "Allow users to edit own metadata" on public.users;
drop policy if exists "Allow superadmin full control on users" on public.users;

-- Helper function to check if the user is a Superadmin on Central DB
create or replace function public.is_superadmin()
returns boolean as $$
begin
  return exists (
    select 1 from public.users 
    where id = auth.uid()::text and role = 'Superadmin'
  ) or (auth.jwt() ->> 'email' = 'superadmin@catetin.com');
end;
$$ language plpgsql security definer;

-- Create secure, strict RLS policies for Central Users
create policy "Allow login email lookup" on public.users for select using (true);
create policy "Allow users to insert own registration" on public.users for insert with check (auth.uid()::text = id);
create policy "Allow users to edit own metadata" on public.users for update using (auth.uid()::text = id or public.is_superadmin()) with check (auth.uid()::text = id or public.is_superadmin());
create policy "Allow superadmin full control on users" on public.users for all using (public.is_superadmin());

-- Create Trigger to automatically capture Supabase Auth Sign Up into public.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, username, full_name, role, original_role, instansi, web_access, status, created_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'Pending',
    coalesce(new.raw_user_meta_data->>'original_role', 'Viewer'),
    coalesce(new.raw_user_meta_data->>'instansi', ''),
    coalesce(new.raw_user_meta_data->>'web_access', 'bendahara,absensi'),
    'Pending',
    now()
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Create Instansi Table (Operational Databases Registry)
create table if not exists public.instansi (
  id text primary key, -- key code (e.g. 'i1')
  instansi_name text not null,
  supabase_url text not null,
  supabase_anon_key text not null,
  appscriptbackuptreasurerweb text
);

alter table public.instansi enable row level security;
drop policy if exists "Allow public load in login" on public.instansi;
drop policy if exists "Allow public modify instansi" on public.instansi;
drop policy if exists "Allow logins to load config" on public.instansi;
drop policy if exists "Restrict instansi edits to Superadmin" on public.instansi;

create policy "Allow logins to load config" on public.instansi for select using (true);
create policy "Restrict instansi edits to Superadmin" on public.instansi for all using (public.is_superadmin()) with check (public.is_superadmin());
`;

const SUPABASE_OPERATIONAL_SQL = `-- =========================================================================
-- !!! PENGATURAN KUNCI KEAMANAN (ANON KEY INSTANSI BARU) !!!
-- GANTI 'ISI_DENGAN_SUPABASE_ANON_KEY_INSTANSI_ANDA_DISINI' DI BAWAH INI
-- DENGAN ANON PUBLIC KEY DARI INSTANSI SUPABASE CABANG YANG BARU DITAMBAHKAN!
-- =========================================================================
create table if not exists public.operational_config (
  key text primary key,
  value text
);
alter table public.operational_config enable row level security;
drop policy if exists "Block reading secure config" on public.operational_config;
create policy "Block reading secure config" on public.operational_config for select using (false);

-- SEED SYNC_TOKEN / ANON KEY INSTANSI BARU
-- Gantilah parameter kedua di bawah ini dengan ANON KEY Supabase Instansi Baru Anda:
insert into public.operational_config (key, value)
values ('sync_token', 'ISI_DENGAN_SUPABASE_ANON_KEY_INSTANSI_ANDA_DISINI')
on conflict (key) do update set value = excluded.value;


-- =========================================================================
-- 2. OPERATIONAL DATABASE TABLES (Struktur Data Penunjang Instansi Cabang Baru)
-- =========================================================================

-- users local cache table
create table if not exists public.users (
  id text primary key,
  email text,
  full_name text,
  role text,
  original_role text,
  status text,
  instansi text,
  web_access text,
  created_at text,
  active_session_token text,
  session_expires_at text
);

-- Retrofit old table versions if any
alter table public.users add column if not exists active_session_token text;
alter table public.users add column if not exists session_expires_at text;

alter table public.users enable row level security;
drop policy if exists "Allow session users" on public.users;
drop policy if exists "Allow dynamic user read" on public.users;
drop policy if exists "Allow updates only for active sessions" on public.users;
drop policy if exists "Allow updates for self or master sync" on public.users;

-- Standard cached users policies
create policy "Allow dynamic user read" on public.users for select using (true);
create policy "Allow updates for self or master sync" on public.users for all 
  using (auth.uid()::text = id or email = auth.jwt() ->> 'email' or auth.uid() is null or public.is_active_session()) 
  with check (auth.uid()::text = id or email = auth.jwt() ->> 'email' or auth.uid() is null or public.is_active_session());

-- Security helper function to check if user has an Active session in this Operational DB
create or replace function public.is_active_session()
returns boolean as $$
declare
  req_user_id text;
  req_session_token text;
begin
  -- Retrieve variables from request headers passed dynamically by Catet-In Web app
  begin
    req_user_id := coalesce(nullif(current_setting('request.headers', true)::json->>'x-user-id', ''), '');
    req_session_token := coalesce(nullif(current_setting('request.headers', true)::json->>'x-session-token', ''), '');
  exception when others then
    req_user_id := '';
    req_session_token := '';
  end;

  -- If headers are complete, verify token against users cache
  if req_user_id <> '' and req_session_token <> '' then
    return exists (
      select 1 from public.users 
      where id = req_user_id 
        and active_session_token = req_session_token 
        and status = 'Active'
        and (session_expires_at is null or session_expires_at::timestamp with time zone > now())
    );
  end if;

  -- Fallback to standard Supabase Auth session if authenticated in this DB
  return exists (
    select 1 from public.users 
    where (id = auth.uid()::text or email = auth.jwt() ->> 'email') and status = 'Active'
  );
end;
$$ language plpgsql security definer;

-- SSO Handshake register function
create extension if not exists pgcrypto;
create or replace function public.register_operational_session(
  p_user_id text,
  p_email text,
  p_full_name text,
  p_role text,
  p_original_role text,
  p_instansi text,
  p_web_access text,
  p_expires_at text,
  p_session_token text,
  p_signature text
)
returns json as $$
declare
  v_sync_token text;
  v_message text;
  v_computed_sig text;
begin
  -- Load secure sync token
  select value into v_sync_token from public.operational_config where key = 'sync_token';
  
  if v_sync_token is null then
    raise exception 'Database Instansi belum terkonfigurasi sync_token. Silakan hubungi Administrator.';
  end if;

  -- Message structure: id:email:role:expires_at:session_token
  v_message := p_user_id || ':' || coalesce(p_email, '') || ':' || p_role || ':' || p_expires_at || ':' || p_session_token;
  
  -- Compute SHA256 signature
  v_computed_sig := encode(digest(v_message || v_sync_token, 'sha256'), 'hex');

  if p_signature <> v_computed_sig then
    raise exception 'SSO Handshake Signature Mismatch. Sync Rejected.';
  end if;

  -- Handshake Valid! Write session and user data
  insert into public.users (
    id, email, full_name, role, original_role, status, instansi, web_access, created_at, active_session_token, session_expires_at
  ) values (
    p_user_id, p_email, p_full_name, p_role, p_original_role, 'Active', p_instansi, p_web_access, now(), p_session_token, p_expires_at
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    original_role = excluded.original_role,
    status = 'Active',
    instansi = excluded.instansi,
    web_access = excluded.web_access,
    active_session_token = excluded.active_session_token,
    session_expires_at = excluded.session_expires_at;

  return json_build_object('status', 'success', 'message', 'Sesi berhasil didaftarkan secara aman');
end;
$$ language plpgsql security definer;


-- transactions table
create table if not exists public.transactions (
  id text primary key,
  date text,
  formatted_date text,
  description text,
  type text,
  category text,
  project_name text,
  debit numeric default 0,
  credit numeric default 0,
  balance numeric default 0,
  amount numeric default 0,
  created_at text,
  created_by text,
  created_by_role text,
  edit_version integer default 0
);
alter table public.transactions enable row level security;
drop policy if exists "Allow full access user" on public.transactions;
drop policy if exists "Strict Operational Transactions RLS" on public.transactions;
create policy "Strict Operational Transactions RLS" on public.transactions for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- deleted_transactions audit
create table if not exists public.deleted_transactions (
  id text primary key,
  date text,
  formatted_date text,
  description text,
  type text,
  category text,
  project_name text,
  debit numeric default 0,
  credit numeric default 0,
  balance numeric default 0,
  amount numeric default 0,
  created_at text,
  created_by text,
  created_by_role text,
  edit_version integer default 0,
  delete_reason text,
  deleted_at text,
  delete_by text
);
alter table public.deleted_transactions enable row level security;
drop policy if exists "Allow full access data" on public.deleted_transactions;
drop policy if exists "Strict Operational Deleted Tx RLS" on public.deleted_transactions;
create policy "Strict Operational Deleted Tx RLS" on public.deleted_transactions for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- edit_history audit
create table if not exists public.edit_history (
  id text primary key,
  transaction_id text,
  project_name text,
  type text,
  old_description text,
  new_description text,
  old_value numeric default 0,
  new_value numeric default 0,
  edited_at text,
  edited_by text,
  version_number integer default 1
);
alter table public.edit_history enable row level security;
drop policy if exists "Allow edit logs access" on public.edit_history;
drop policy if exists "Strict Operational Edit History RLS" on public.edit_history;
create policy "Strict Operational Edit History RLS" on public.edit_history for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- projects table
create table if not exists public.projects (
  name text primary key,
  created_at text,
  status text default 'Aktif',
  approved_by text,
  approved_at text,
  approver_role text
);
alter table public.projects enable row level security;
drop policy if exists "Allow projects CRUD" on public.projects;
drop policy if exists "Strict Operational Projects RLS" on public.projects;
create policy "Strict Operational Projects RLS" on public.projects for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- categories table
create table if not exists public.categories (
  id text primary key,
  name text not null
);
alter table public.categories enable row level security;
drop policy if exists "Allow categories CRUD" on public.categories;
drop policy if exists "Strict Operational Categories RLS" on public.categories;
create policy "Strict Operational Categories RLS" on public.categories for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- approvals table
create table if not exists public.approvals (
  id text primary key,
  period_id text,
  project_name text,
  approved_by text,
  approve_date text
);
alter table public.approvals enable row level security;
drop policy if exists "Allow approvals CRUD" on public.approvals;
drop policy if exists "Strict Operational Approvals RLS" on public.approvals;
create policy "Strict Operational Approvals RLS" on public.approvals for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- daerahs table
create table if not exists public.daerahs (
  id text primary key,
  nama_daerah text not null,
  pimpinan text,
  keterangan text
);
alter table public.daerahs enable row level security;
drop policy if exists "Allow daerah CRUD" on public.daerahs;
drop policy if exists "Strict Operational Daerahs RLS" on public.daerahs;
create policy "Strict Operational Daerahs RLS" on public.daerahs for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- desas table
create table if not exists public.desas (
  id text primary key,
  nama_desa text not null,
  pimpinan text,
  alamat text,
  daerah_id text
);
alter table public.desas enable row level security;
drop policy if exists "Allow desa CRUD" on public.desas;
drop policy if exists "Strict Operational Desas RLS" on public.desas;
create policy "Strict Operational Desas RLS" on public.desas for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- kelompoks table
create table if not exists public.kelompoks (
  id text primary key,
  nama_kelompok text not null,
  pimpinan text,
  keterangan text,
  desa_id text
);
alter table public.kelompoks enable row level security;
drop policy if exists "Allow kelompoks CRUD" on public.kelompoks;
drop policy if exists "Strict Operational Kelompoks RLS" on public.kelompoks;
create policy "Strict Operational Kelompoks RLS" on public.kelompoks for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- age_categories table
create table if not exists public.age_categories (
  id text primary key,
  name text not null,
  description text
);
alter table public.age_categories enable row level security;
drop policy if exists "Allow ages CRUD" on public.age_categories;
drop policy if exists "Strict Operational Ages RLS" on public.age_categories;
create policy "Strict Operational Ages RLS" on public.age_categories for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- families table
create table if not exists public.families (
  id text primary key,
  nama_keluarga text not null,
  nomor_kk text
);
alter table public.families enable row level security;
drop policy if exists "Strict Operational Families RLS" on public.families;
create policy "Strict Operational Families RLS" on public.families for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- family_relationships table
create table if not exists public.family_relationships (
  id text primary key,
  name text not null,
  is_wali boolean default false
);
alter table public.family_relationships enable row level security;
drop policy if exists "Strict Operational Family Relationships RLS" on public.family_relationships;
create policy "Strict Operational Family Relationships RLS" on public.family_relationships for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- members table
create table if not exists public.members (
  id text primary key,
  daerah_id text,
  desa_id text,
  kelompok_id text,
  age_category_id text,
  nama_lengkap text not null,
  tempat_lahir text,
  tanggal_lahir text,
  no_hp_anggota text,
  jenis_kelamin text,
  alamat_rumah text,
  pendidikan text,
  kelas text,
  rfid text,
  rfid_ktp text,
  family_id text,
  relationship_id text,
  pekerjaan text
);
alter table public.members enable row level security;
drop policy if exists "Allow members CRUD" on public.members;
drop policy if exists "Strict Operational Members RLS" on public.members;
create policy "Strict Operational Members RLS" on public.members for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- attendance_logs table
create table if not exists public.attendance_logs (
  id text primary key,
  "memberId" text,
  "memberName" text,
  "ageName" text,
  "kelompokName" text,
  "desaName" text,
  "daerahName" text,
  date text,
  "dateInput" text,
  status text,
  note text,
  event_id text,
  metode text
);

-- Retrofit old table versions if any
alter table public.attendance_logs add column if not exists event_id text;
alter table public.attendance_logs add column if not exists metode text;
alter table public.members add column if not exists rfid text;
alter table public.members add column if not exists rfid_ktp text;
alter table public.members add column if not exists family_id text;
alter table public.members add column if not exists relationship_id text;
alter table public.members add column if not exists pekerjaan text;

alter table public.attendance_logs enable row level security;
drop policy if exists "Allow logs CRUD" on public.attendance_logs;
drop policy if exists "Strict Operational Attendance Logs RLS" on public.attendance_logs;
create policy "Strict Operational Attendance Logs RLS" on public.attendance_logs for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- events table
create table if not exists public.events (
  id text primary key,
  nama_kegiatan text not null,
  tanggal_kegiatan text,
  keterangan text,
  created_at timestamp with time zone default now()
);
alter table public.events enable row level security;
drop policy if exists "Strict Operational Events RLS" on public.events;
create policy "Strict Operational Events RLS" on public.events for all 
  using (public.is_active_session()) 
  with check (public.is_active_session());


-- Ensure the publication 'supabase_realtime' exists first
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Enable Realtime and Full Replica Identity strictly for the attendance_logs table (optimizing Supabase Free Plan limits)
alter table public.attendance_logs replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance_logs') then
    alter publication supabase_realtime add table public.attendance_logs;
  end if;
end $$;
`;

const SUPABASE_DDL_SQL = SUPABASE_CENTRAL_SQL + '\n\n' + SUPABASE_OPERATIONAL_SQL;

const CRON_JOBS_KEEP_ALIVE_SQL = `-- OPTION A: Enable internal pg_cron extension (For keeping PG instance awake)
create extension if not exists pg_cron;

-- Schedule a lightweight query to run every hour
select cron.schedule(
  'keep_awake_light_ping',
  '0 * * * *', -- hourly
  'SELECT count(*) FROM public.projects;'
);
`;

const SetupGuide: React.FC<SetupGuideProps> = ({ onLogout }) => {
  const [supabaseUrl, setSupabaseUrl] = useState(localStorage.getItem('supabase_central_url') || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(localStorage.getItem('supabase_central_key') || '');
  const [isSaved, setIsSaved] = useState(false);
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [showCentralDdlCode, setShowCentralDdlCode] = useState(false);
  const [showOperationalDdlCode, setShowOperationalDdlCode] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedDdl, setCopiedDdl] = useState('');

  const handleSaveCentralConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      window.alert("Masukkan Supabase URL dan Anon Key dengan benar!");
      return;
    }
    saveCentralConfig(supabaseUrl.trim(), supabaseAnonKey.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleCopyText = (code: string, type: string) => {
    navigator.clipboard.writeText(code);
    setCopiedDdl(type);
    setTimeout(() => setCopiedDdl(''), 2000);
  };

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar p-4 md:p-10 mx-auto pb-40 bg-slate-50">
      <div className="w-full max-w-5xl mx-auto bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-12 animate-in fade-in zoom-in-95 duration-500">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-slate-100 pb-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">System Configuration</h2>
            <div className="flex items-center space-x-2">
               <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[9px] font-black uppercase tracking-widest font-mono flex items-center gap-1">
                 <Sparkles size={10} />
                 SUPABASE ENTERPRISE DATABASE MIGRATION
               </span>
            </div>
          </div>
          {onLogout && (
            <button onClick={onLogout} className="px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm cursor-pointer">
              Keluar Sesi
            </button>
          )}
        </div>

        {/* 1. CENTRAL SUPABASE CREDENTIALS SETTING */}
        <div className="p-8 bg-indigo-50/50 rounded-[2rem] border border-indigo-100 space-y-6">
           <div className="flex items-center space-x-3 text-indigo-700">
              <Database size={24} className="shrink-0" />
              <h4 className="text-sm md:text-md font-black uppercase tracking-tight">1. PENGATURAN KREDENSIAL SUPABASE UTAMA</h4>
           </div>
           
           <p className="text-[11px] font-bold text-indigo-800 leading-relaxed max-w-3xl">
              Hubungkan aplikasi dengan database Supabase Utama Anda. Kredensial ini akan disimpan secara aman di browser Anda dan dipakai untuk mengautentikasi pengguna serta memetakan multi-database instansi cabang secara dinamis.
           </p>

           <form onSubmit={handleSaveCentralConfig} className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
             <div className="space-y-1.5">
               <label className="text-[9px] font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                 <Globe size={12} className="text-indigo-500" />
                 SUPABASE URL
               </label>
               <input 
                 type="url"
                 required
                 placeholder="Contoh: https://your-project-id.supabase.co"
                 value={supabaseUrl}
                 onChange={(e) => setSupabaseUrl(e.target.value)}
                 className="w-full px-4 py-3 text-xs font-semibold bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase placeholder:font-normal placeholder:lowercase shadow-sm"
               />
             </div>

             <div className="space-y-1.5">
               <label className="text-[9px] font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                 <Key size={12} className="text-indigo-500" />
                 SUPABASE ANON PUBLIC KEY
               </label>
               <input 
                 type="text"
                 required
                 placeholder="Masukkan Anon Public Key dari Dashboard Supabase"
                 value={supabaseAnonKey}
                 onChange={(e) => setSupabaseAnonKey(e.target.value)}
                 className="w-full px-4 py-3 text-xs font-semibold bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono shadow-sm"
               />
             </div>

             <div className="md:col-span-2 flex justify-end pt-2">
               <button 
                 type="submit"
                 className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-lg shadow-indigo-100"
               >
                 {isSaved ? (
                   <>
                     <CheckCircle2 size={14} className="text-emerald-400" />
                     <span>Berhasil Disimpan</span>
                   </>
                 ) : (
                   <>
                     <Save size={14} />
                     <span>Simpan Konfigurasi</span>
                   </>
                 )}
               </button>
             </div>
           </form>
        </div>

        {/* 2A. SQL SCHEMA DATABASE CENTRAL (Utama) */}
        <div className="p-8 bg-slate-900 rounded-[2rem] border border-slate-800 space-y-6 text-white">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3 text-indigo-400">
                 <ShieldCheck size={28} />
                 <div>
                   <h4 className="text-sm md:text-md font-black uppercase tracking-tight leading-none text-white">2A. SQL SCHEMA DATABASE CENTRAL (Utama)</h4>
                   <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-1">Hanya dijalankan sekali di proyek Supabase Utama / Central</p>
                 </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopyText(SUPABASE_CENTRAL_SQL, 'central_sql')}
                className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border ${copiedDdl === 'central_sql' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
              >
                {copiedDdl === 'central_sql' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedDdl === 'central_sql' ? 'Tersalin' : 'Copy SQL Central'}</span>
              </button>
           </div>
           
           <p className="text-[10px] font-medium text-slate-300 leading-relaxed font-sans">
             Jalankan script ini di <b>SQL Editor</b> proyek Supabase Utama/Central Anda. Script ini akan menginisialisasi tabel induk untuk <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-300">users</code> central, fungsi validator superadmin <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-300">is_superadmin()</code>, serta registrasi <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-300">instansi</code> untuk mengelola routing multi-database.
           </p>

           <div className="border-t border-slate-800 pt-3">
             <button
               type="button"
               onClick={() => setShowCentralDdlCode(!showCentralDdlCode)}
               className="w-full flex items-center justify-between text-slate-400 hover:text-white transition-colors py-2 text-[10px] font-bold uppercase tracking-wider focus:outline-none"
             >
               <span>{showCentralDdlCode ? 'Sembunyikan SQL Code Central' : 'Tampilkan Tinjauan SQL Central'}</span>
               {showCentralDdlCode ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
             </button>

             {showCentralDdlCode && (
               <div className="mt-4 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner max-h-80 overflow-y-auto no-scrollbar font-mono text-[9.5px] text-blue-300 text-left animate-in slide-in-from-top-1 duration-200">
                 <pre className="whitespace-pre-wrap">{SUPABASE_CENTRAL_SQL}</pre>
               </div>
             )}
           </div>
        </div>

        {/* 2B. SQL SCHEMA DATABASE PERINSTANSI (Cabang Baru) */}
        <div className="p-8 bg-slate-900 rounded-[2rem] border border-slate-800 space-y-6 text-white">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3 text-amber-400">
                 <Database size={28} />
                 <div>
                   <h4 className="text-sm md:text-md font-black uppercase tracking-tight leading-none text-white font-sans">2B. SQL SCHEMA DATABASE PERINSTANSI (Cabang Baru)</h4>
                   <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-1">Sangat mudah dikonfigurasi saat menambah instansi baru</p>
                 </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopyText(SUPABASE_OPERATIONAL_SQL, 'operational_sql')}
                className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border ${copiedDdl === 'operational_sql' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
              >
                {copiedDdl === 'operational_sql' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedDdl === 'operational_sql' ? 'Tersalin' : 'Copy SQL Perinstansi'}</span>
              </button>
           </div>
           
           <p className="text-[10px] font-medium text-slate-300 leading-relaxed font-sans">
              Ketika Anda menambahkan instansi/cabang baru, hubungkan proyek Supabase cabang tersebut dengan menyalin script di bawah ini ke <b>SQL Editor</b> proyek cabang Anda. <b>Kredensial keamanan (Anon Public Key/sync_token) sengaja diletakkan di bagian paling atas script</b> agar konfigurasi instansi/tenant baru menjadi sangat mudah dan cepat tanpa harus mencari di dalam ribuan baris skema di tengah-tengah!
           </p>

           <div className="border-t border-slate-800 pt-3">
             <button
               type="button"
               onClick={() => setShowOperationalDdlCode(!showOperationalDdlCode)}
               className="w-full flex items-center justify-between text-slate-400 hover:text-white transition-colors py-2 text-[10px] font-bold uppercase tracking-wider focus:outline-none"
             >
               <span>{showOperationalDdlCode ? 'Sembunyikan SQL Code Perinstansi' : 'Tampilkan Tinjauan SQL Perinstansi'}</span>
               {showOperationalDdlCode ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
             </button>

             {showOperationalDdlCode && (
               <div className="mt-4 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner max-h-80 overflow-y-auto no-scrollbar font-mono text-[9.5px] text-amber-300 text-left animate-in slide-in-from-top-1 duration-200">
                 <pre className="whitespace-pre-wrap">{SUPABASE_OPERATIONAL_SQL}</pre>
               </div>
             )}
           </div>
        </div>

        {/* 3. ALWAYS-ONLINE CRON JOB GUIDANCE CARD */}
        <div className="p-8 bg-rose-50 rounded-[2rem] border-2 border-rose-100 space-y-6 text-rose-950">
           <div className="flex items-center space-x-3 text-rose-700">
              <HeartPulse size={28} className="shrink-0" />
              <h4 className="text-sm md:text-md font-black uppercase tracking-tight">3. STRATEGI MEMPERTAHANKAN DATABASE SELALU ONLINE (ANTI-SLEEP/PAUSE)</h4>
           </div>

           <p className="text-[11px] font-bold leading-relaxed text-rose-800 max-w-3xl">
              Proyek Supabase dengan lisensi gratis (Free Tier) memiliki fitur hemat energi yang otomatis menidurkan / menonaktifkan database (Pause Database) jika tidak menerima trafik sama sekali dalam 1 minggu. Agar database Anda terus aktif selamanya bahkan ketika tidak diakses selama berbulan-bulan, Anda bisa menggunakan dua metode perlindungan di bawah ini:
           </p>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-rose-900 pt-2">
             {/* OPTION A: INTERNAL PG_CRON */}
             <div className="p-5 bg-white rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-between space-y-4">
               <div className="space-y-2">
                 <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-lg text-[8px] font-black uppercase tracking-widest font-mono">METODE JALUR INTERNAL SQL</span>
                 <h6 className="text-[11px] font-black uppercase tracking-tight text-rose-950 font-bold">A. Aktivasi pg_cron Supabase</h6>
                 <p className="text-[9.5px] text-rose-700 leading-relaxed font-semibold">
                   Supabase mendukung ekstensi <b>pg_cron</b> untuk menjalankan tugas rutin teratur langsung di Postgres. Salin script di bawah ini ke SQL Editor untuk menjadwalkan query keep-awake ringan harian:
                 </p>
               </div>

               <div className="space-y-2">
                 <div className="relative">
                   <button
                     type="button"
                     onClick={() => handleCopyText(CRON_JOBS_KEEP_ALIVE_SQL, 'cron_sql')}
                     className={`absolute right-2 top-2 bg-rose-50 p-1.5 rounded-lg border border-rose-100 active:scale-95 transition-all text-rose-600 hover:text-rose-800 flex items-center gap-1 shadow-sm focus:outline-none`}
                   >
                     {copiedDdl === 'cron_sql' ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                     <span className="text-[7.5px] font-black uppercase">{copiedDdl === 'cron_sql' ? 'Tersalin' : 'Copy'}</span>
                   </button>
                   <pre className="p-3 bg-rose-950 text-rose-100 font-mono text-[9px] rounded-lg overflow-x-auto leading-normal text-left max-h-32">
                     {CRON_JOBS_KEEP_ALIVE_SQL}
                   </pre>
                 </div>
               </div>
             </div>

             {/* OPTION B: EXTERNAL CRON API PINGER */}
             <div className="p-5 bg-white rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-between space-y-4">
               <div className="space-y-2">
                 <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-lg text-[8px] font-black uppercase tracking-widest font-mono">METODE PINGER JALUR API LUAR</span>
                 <h6 className="text-[11px] font-black uppercase tracking-tight text-rose-950 font-bold">B. Cron-Job / UptimeRobot REST Ping</h6>
                 <p className="text-[9.5px] text-rose-700 leading-relaxed font-semibold">
                   Cara paling kredibel & jaminan 100% database Anda tidak tidur adalah mendaftarkan URL HTTPS REST API Supabase ke layanan ping harian pihak ketiga yang gratis (seperti <b>cron-job.org</b> atau <b>UptimeRobot</b>).
                 </p>
               </div>

               <div className="bg-rose-50/50 p-4 border border-rose-150 rounded-xl space-y-2.5 text-[9px] font-bold text-rose-800">
                 <div><b>Panduan Setup Cron-Job.org:</b></div>
                 <ol className="list-decimal list-inside space-y-1 text-rose-700">
                   <li>Masuk dan buat akun gratis di <a href="https://cron-job.org" target="_blank" rel="noreferrer" className="text-rose-650 font-black underline">cron-job.org</a></li>
                   <li>Klik <b>Create Cronjob</b>, beri nama: <i>keep-supabase-awake</i></li>
                   <li>Silakan pilih interval / frekuensi eksekusi: <span className="text-rose-950">Setiap 1 hari</span></li>
                   <li>Di kolom Target URL, masukkan URL API Rest Anda: <br/>
                     <code className="bg-white/80 p-0.5 font-mono text-[8px] border border-rose-150 rounded select-all font-semibold">
                       {supabaseUrl ? `${supabaseUrl}/rest/v1/projects` : 'https://[your-supabase-url]/rest/v1/projects'}
                     </code>
                   </li>
                 </ol>
               </div>
             </div>
           </div>
        </div>

        {/* 4. GOOGLE SHEETS BACKUP GUIDE CARD */}
        <div className="p-8 bg-emerald-50 rounded-[2rem] border-2 border-emerald-200 space-y-8 text-emerald-950 mb-8">
           <div className="flex items-center space-x-3 text-emerald-600">
              <FileSpreadsheet className="w-6 h-6 flex-shrink-0" />
              <h4 className="text-sm md:text-md font-black uppercase tracking-tight leading-none text-emerald-950">4. GOOGLE SHEETS AUTOMATIC BACKUP</h4>
           </div>

           <p className="text-[11px] font-bold text-emerald-800 leading-relaxed">
              Aplikasi Anda juga mendukung Sinkronisasi Multi-Instansi & Backup Harian Otomatis ke Google Sheets secara dinamis melalui parameter instansi masing-masing cabang.
           </p>

           <div className="p-5 bg-white rounded-2xl border border-emerald-100 shadow-sm space-y-4">
              <div>
                 <h6 className="text-[10px] font-black uppercase tracking-tight text-emerald-950 flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    SINKRONISASI OTOMATIS BERBASIS PORTAL (PORTAL-MANAGED SYNC)
                 </h6>
                 <p className="text-[9.5px] text-emerald-700 leading-relaxed font-bold mt-2">
                    Sistem pencatatan otomatis membaca tautan langsung dari database utama di tabel instansi masing-masing (pada kolom: <code className="bg-emerald-50 px-1 py-0.5 rounded text-emerald-850 font-mono text-[9px]">appscriptbackuptreasurerweb</code>).
                 </p>
              </div>
           </div>

           <div className="border-t border-emerald-200/50 pt-6">
               <button
                 type="button"
                 onClick={() => setShowScriptCode(!showScriptCode)}
                 className="w-full flex items-center justify-between py-2 text-emerald-800 hover:text-emerald-950 transition-colors focus:outline-none"
               >
                 <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                    Cara Setup & Salin Kode Google Apps Script
                 </span>
                 {showScriptCode ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
               </button>

               {showScriptCode && (
                 <div className="mt-4 p-5 bg-white rounded-2xl border border-emerald-100 text-[10px] text-emerald-600 font-bold leading-relaxed space-y-4 animate-in slide-in-from-top-2 duration-300">
                   <ol className="list-decimal list-inside space-y-2 text-emerald-700 font-bold">
                     <li>Buka Google Spreadsheet tujuan backup harian Anda.</li>
                     <li>Buka menu <span className="font-extrabold text-emerald-950">Ekstensi</span> &gt; <span className="font-extrabold text-emerald-950">Apps Script</span>.</li>
                     <li>Hapus semua kode bawaan di dalam editor script.</li>
                     <li>Salin & tempel seluruh kode di bawah ini.</li>
                     <li>Klik tombol <b>Terapkan (Deploy)</b> &gt; <b>Penerapan baru (New Deployment)</b>.</li>
                     <li>Atur Tipe: <span className="font-extrabold text-emerald-950">Aplikasi Web</span>, Jalankan Sebagai: <span className="font-extrabold text-emerald-950">Saya (Email Anda)</span>, Akses: <span className="font-extrabold text-emerald-950">Siapa saja (Anyone)</span>.</li>
                     <li>Salin URL Aplikasi Web yang dihasilkan lalu tempelkan ke kolom <code className="bg-emerald-50 px-1.5 py-0.5 rounded font-mono text-emerald-800 text-[9px]">appscriptbackuptreasurerweb</code> di baris data instansi Supabase Anda!</li>
                   </ol>

                   <div className="relative mt-4">
                     <button
                       type="button"
                       onClick={() => handleCopyText(APPS_SCRIPT_CODE, 'backup_script')}
                       className="absolute right-3 top-3 bg-slate-50 p-2 rounded-lg border border-slate-200 active:scale-95 transition-all text-slate-500 hover:text-slate-800 flex items-center gap-1.5 shadow-sm focus:outline-none"
                     >
                       {copiedDdl === 'backup_script' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                       <span className="text-[8px] font-black uppercase">{copiedDdl === 'backup_script' ? 'Tersalin' : 'Salin Kode'}</span>
                     </button>
                     <pre className="p-4 bg-slate-900 text-slate-350 font-mono text-[8px] rounded-xl overflow-x-auto h-48 max-h-48 leading-normal text-left">
                       {APPS_SCRIPT_CODE}
                     </pre>
                   </div>
                 </div>
               )}
           </div>
        </div>

      </div>
    </div>
  );
};

export default SetupGuide;
export { SUPABASE_DDL_SQL };
