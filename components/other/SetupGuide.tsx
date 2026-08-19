import React, { useState } from 'react';
import { 
  Copy, Globe, ShieldCheck, CheckCircle2, FileSpreadsheet, ChevronUp, ChevronDown, Check,
  Database, Key, Save, AlertCircle, Sparkles, HeartPulse, RefreshCw
} from 'lucide-react';
import { saveCentralConfig, getActiveDb } from '../../supabase';

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

export const SUPABASE_UNIFIED_MASTER_SQL = `-- =========================================================================
-- MASTER SQL SCHEMA & STORED PROCEDURES (ALL-IN-ONE COMPLETE SETUP)
-- Sistem Informasi Absensi & Keuangan Instansi (Catet-In)
-- =========================================================================
-- Cukup salin & jalankan seluruh script ini di SQL Editor Supabase baru Anda.
-- Script ini sudah mencakup:
-- 1. Ekstensi Keamanan & Enkripsi (pgcrypto)
-- 2. Manajemen Pengguna, Auth Trigger, & Master Instansi (users, instansi)
-- 3. Seluruh Tabel Operasional Keuangan & Absensi Terpadu
-- 4. Keamanan Row Level Security (RLS) Multi-Tenancy Terisolasi
-- 5. Tabel Supabase Keep-Alive (Untuk Cron Job Anti-Sleep)
-- 6. Stored Procedure get_event_dashboard_summary (Dashboard RPC)
-- 7. Stored Procedure get_attendance_analysis_summary (Analisis Presensi RPC)
-- =========================================================================

-- 1. UTILS & EXTENSIONS
create extension if not exists pgcrypto;

-- 2. CENTRAL TABLES & SECURITY
create table if not exists public.users (
  id text primary key, -- mapped from auth.users UID
  email text,
  username text,
  full_name text,
  role text default 'Pending',
  original_role text,
  instansi text, -- reference instance Id
  web_access text default 'bendahara,absensi', -- comma-separated (e.g. 'bendahara,absensi')
  status text default 'Pending',
  restricted_daerah_id text, -- granular access constraint: Daerah
  restricted_desa_id text, -- granular access constraint: Desa
  restricted_kelompok_id text, -- granular access constraint: Kelompok
  restricted_age_category_id text, -- granular access constraint: Kategori Usia
  grouping_write_permissions jsonb default '{}'::jsonb, -- jsonb grouping write permissions
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Security Definer function to resolve username to email securely
create or replace function public.resolve_username_to_email(p_username text)
returns text as $$
begin
  return (select email from public.users where lower(username) = lower(p_username) limit 1);
end;
$$ language plpgsql security definer;

create or replace function public.is_portal_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.users 
    where id = auth.uid()::text and role = 'PortalMaster'
  ) or (auth.jwt() ->> 'email' = 'portal_master@catetin.com');
end;
$$ language plpgsql security definer;

-- Helper functions for RLS multi-tenancy
create or replace function public.get_user_instansi()
returns text as $$
begin
  return coalesce((select instansi from public.users where id = auth.uid()::text), '');
end;
$$ language plpgsql security definer;

create or replace function public.get_user_role()
returns text as $$
begin
  return coalesce((select role from public.users where id = auth.uid()::text), '');
end;
$$ language plpgsql security definer;

alter table public.users enable row level security;
drop policy if exists "Allow select authenticated users" on public.users;
drop policy if exists "Allow select to everyone" on public.users;
drop policy if exists "Allow users to insert own registration" on public.users;
drop policy if exists "Allow users to edit own metadata" on public.users;
drop policy if exists "Allow portal admin full control on users" on public.users;

create policy "Allow select authenticated users" on public.users for select to authenticated using (true);
create policy "Allow users to insert own registration" on public.users for insert to authenticated with check (auth.uid()::text = id);
create policy "Allow users to edit own metadata" on public.users for update to authenticated using (auth.uid()::text = id or public.is_portal_admin()) with check (auth.uid()::text = id or public.is_portal_admin());
create policy "Allow portal admin full control on users" on public.users for all to authenticated using (public.is_portal_admin());

-- Trigger to automatically capture Supabase Auth Sign Up into public.users
create or replace function public.handle_new_user()
returns trigger as $$
declare
  is_first_master boolean;
  assigned_role text;
  assigned_status text;
begin
  -- Check if there is already a PortalMaster in the system
  select not exists (select 1 from public.users where role = 'PortalMaster') into is_first_master;
  
  if is_first_master then
    assigned_role := 'PortalMaster';
    assigned_status := 'Active';
  else
    assigned_role := coalesce(new.raw_user_meta_data->>'original_role', 'Pending');
    if assigned_role = 'PortalMaster' then
      -- Prevent self-promotion to PortalMaster if one already exists
      assigned_role := 'Pending';
    end if;
    assigned_status := 'Pending';
  end if;

  insert into public.users (id, email, username, full_name, role, original_role, instansi, web_access, status, created_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    assigned_role,
    assigned_role,
    coalesce(new.raw_user_meta_data->>'instansi', 'Catet-In (Master)'),
    coalesce(new.raw_user_meta_data->>'web_access', 'bendahara,absensi'),
    assigned_status,
    now()
  )
  on conflict (id) do update set
    role = excluded.role,
    original_role = excluded.original_role,
    status = excluded.status;
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
  appscriptbackuptreasurerweb text
);

alter table public.instansi enable row level security;
drop policy if exists "Allow logins to load config" on public.instansi;
drop policy if exists "Restrict instansi edits to Portal Admin" on public.instansi;

create policy "Allow logins to load config" on public.instansi for select using (true);
create policy "Restrict instansi edits to Portal Admin" on public.instansi for all to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin());


-- 3. OPERATIONAL MULTI-TENANT TABLES

-- transactions
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
  created_at text,
  created_by text,
  created_by_role text,
  edit_version integer default 0,
  instansi text not null default public.get_user_instansi()
);

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
  created_at text,
  created_by text,
  created_by_role text,
  edit_version integer default 0,
  delete_reason text,
  deleted_at text,
  delete_by text,
  instansi text not null default public.get_user_instansi()
);

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
  version_number integer default 1,
  instansi text not null default public.get_user_instansi()
);

-- projects table
create table if not exists public.projects (
  name text,
  created_at text,
  status text default 'Aktif',
  approved_by text,
  approved_at text,
  approver_role text,
  instansi text not null default public.get_user_instansi(),
  primary key (name, instansi)
);

-- categories table
create table if not exists public.categories (
  id text,
  name text not null,
  instansi text not null default public.get_user_instansi(),
  primary key (id, instansi)
);

-- approvals table
create table if not exists public.approvals (
  id text primary key,
  period_id text,
  project_name text,
  approved_by text,
  approve_date text,
  opening_balance numeric default 0,
  instansi text not null default public.get_user_instansi()
);

-- daerahs table
create table if not exists public.daerahs (
  id text primary key,
  nama_daerah text not null,
  pimpinan text,
  keterangan text,
  instansi text not null default public.get_user_instansi()
);

-- desas table
create table if not exists public.desas (
  id text primary key,
  nama_desa text not null,
  pimpinan text,
  alamat text,
  daerah_id text,
  instansi text not null default public.get_user_instansi()
);

-- kelompoks table
create table if not exists public.kelompoks (
  id text primary key,
  nama_kelompok text not null,
  pimpinan text,
  keterangan text,
  desa_id text,
  instansi text not null default public.get_user_instansi()
);

-- age_categories table
create table if not exists public.age_categories (
  id text primary key,
  name text not null,
  description text,
  sort_order integer default 0,
  instansi text not null default public.get_user_instansi()
);

-- families table
create table if not exists public.families (
  id text primary key,
  nama_keluarga text not null,
  nomor_kk text,
  instansi text not null default public.get_user_instansi()
);

-- family_relationships table
create table if not exists public.family_relationships (
  id text primary key,
  name text not null,
  is_wali text default '4',
  instansi text not null default public.get_user_instansi()
);

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
  pekerjaan text,
  status text,
  labels text[],
  instansi text not null default public.get_user_instansi()
);

-- labels table
create table if not exists public.labels (
  id text primary key,
  name text not null,
  created_at timestamp with time zone default now(),
  instansi text not null default public.get_user_instansi()
);

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
  metode text,
  uniq_ref text unique,
  jam_mulai text,
  created_by text,
  instansi text not null default public.get_user_instansi()
);

-- events table
create table if not exists public.events (
  id text primary key,
  nama_kegiatan text not null,
  keterangan text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  jam_mulai text,
  target_labels text[],
  instansi text not null default public.get_user_instansi()
);


-- 4. ROW LEVEL SECURITY (RLS) POLICIES FOR OPERATIONAL TABLES

-- TRANSACTIONS
alter table public.transactions enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.transactions;
drop policy if exists "Strict Instansi Insert RLS" on public.transactions;
drop policy if exists "Strict Instansi Update RLS" on public.transactions;
drop policy if exists "Strict Instansi Delete RLS" on public.transactions;
create policy "Strict Instansi Select RLS" on public.transactions for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.transactions for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.transactions for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.transactions for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- DELETED_TRANSACTIONS
alter table public.deleted_transactions enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.deleted_transactions;
drop policy if exists "Strict Instansi Insert RLS" on public.deleted_transactions;
drop policy if exists "Strict Instansi Update RLS" on public.deleted_transactions;
drop policy if exists "Strict Instansi Delete RLS" on public.deleted_transactions;
create policy "Strict Instansi Select RLS" on public.deleted_transactions for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.deleted_transactions for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.deleted_transactions for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.deleted_transactions for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- EDIT_HISTORY
alter table public.edit_history enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.edit_history;
drop policy if exists "Strict Instansi Insert RLS" on public.edit_history;
drop policy if exists "Strict Instansi Update RLS" on public.edit_history;
drop policy if exists "Strict Instansi Delete RLS" on public.edit_history;
create policy "Strict Instansi Select RLS" on public.edit_history for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.edit_history for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.edit_history for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.edit_history for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- PROJECTS
alter table public.projects enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.projects;
drop policy if exists "Strict Instansi Insert RLS" on public.projects;
drop policy if exists "Strict Instansi Update RLS" on public.projects;
drop policy if exists "Strict Instansi Delete RLS" on public.projects;
create policy "Strict Instansi Select RLS" on public.projects for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.projects for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.projects for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.projects for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- CATEGORIES
alter table public.categories enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.categories;
drop policy if exists "Strict Instansi Insert RLS" on public.categories;
drop policy if exists "Strict Instansi Update RLS" on public.categories;
drop policy if exists "Strict Instansi Delete RLS" on public.categories;
create policy "Strict Instansi Select RLS" on public.categories for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.categories for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.categories for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.categories for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- APPROVALS
alter table public.approvals enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.approvals;
drop policy if exists "Strict Instansi Insert RLS" on public.approvals;
drop policy if exists "Strict Instansi Update RLS" on public.approvals;
drop policy if exists "Strict Instansi Delete RLS" on public.approvals;
create policy "Strict Instansi Select RLS" on public.approvals for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.approvals for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.approvals for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.approvals for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- DAERAHS
alter table public.daerahs enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.daerahs;
drop policy if exists "Strict Instansi Insert RLS" on public.daerahs;
drop policy if exists "Strict Instansi Update RLS" on public.daerahs;
drop policy if exists "Strict Instansi Delete RLS" on public.daerahs;
create policy "Strict Instansi Select RLS" on public.daerahs for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.daerahs for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.daerahs for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.daerahs for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- DESAS
alter table public.desas enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.desas;
drop policy if exists "Strict Instansi Insert RLS" on public.desas;
drop policy if exists "Strict Instansi Update RLS" on public.desas;
drop policy if exists "Strict Instansi Delete RLS" on public.desas;
create policy "Strict Instansi Select RLS" on public.desas for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.desas for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.desas for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.desas for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- KELOMPOKS
alter table public.kelompoks enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.kelompoks;
drop policy if exists "Strict Instansi Insert RLS" on public.kelompoks;
drop policy if exists "Strict Instansi Update RLS" on public.kelompoks;
drop policy if exists "Strict Instansi Delete RLS" on public.kelompoks;
create policy "Strict Instansi Select RLS" on public.kelompoks for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.kelompoks for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.kelompoks for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.kelompoks for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- AGE_CATEGORIES
alter table public.age_categories enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.age_categories;
drop policy if exists "Strict Instansi Insert RLS" on public.age_categories;
drop policy if exists "Strict Instansi Update RLS" on public.age_categories;
drop policy if exists "Strict Instansi Delete RLS" on public.age_categories;
create policy "Strict Instansi Select RLS" on public.age_categories for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.age_categories for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.age_categories for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.age_categories for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- FAMILIES
alter table public.families enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.families;
drop policy if exists "Strict Instansi Insert RLS" on public.families;
drop policy if exists "Strict Instansi Update RLS" on public.families;
drop policy if exists "Strict Instansi Delete RLS" on public.families;
create policy "Strict Instansi Select RLS" on public.families for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.families for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.families for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.families for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- FAMILY_RELATIONSHIPS
alter table public.family_relationships enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.family_relationships;
drop policy if exists "Strict Instansi Insert RLS" on public.family_relationships;
drop policy if exists "Strict Instansi Update RLS" on public.family_relationships;
drop policy if exists "Strict Instansi Delete RLS" on public.family_relationships;
create policy "Strict Instansi Select RLS" on public.family_relationships for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.family_relationships for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.family_relationships for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.family_relationships for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- MEMBERS
alter table public.members enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.members;
drop policy if exists "Strict Instansi Insert RLS" on public.members;
drop policy if exists "Strict Instansi Update RLS" on public.members;
drop policy if exists "Strict Instansi Delete RLS" on public.members;
create policy "Strict Instansi Select RLS" on public.members for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.members for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.members for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.members for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- LABELS
alter table public.labels enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.labels;
drop policy if exists "Strict Instansi Insert RLS" on public.labels;
drop policy if exists "Strict Instansi Update RLS" on public.labels;
drop policy if exists "Strict Instansi Delete RLS" on public.labels;
create policy "Strict Instansi Select RLS" on public.labels for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.labels for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.labels for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.labels for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- ATTENDANCE_LOGS
alter table public.attendance_logs enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.attendance_logs;
drop policy if exists "Strict Instansi Insert RLS" on public.attendance_logs;
drop policy if exists "Strict Instansi Update RLS" on public.attendance_logs;
drop policy if exists "Strict Instansi Delete RLS" on public.attendance_logs;
create policy "Strict Instansi Select RLS" on public.attendance_logs for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.attendance_logs for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.attendance_logs for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.attendance_logs for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());

-- EVENTS
alter table public.events enable row level security;
drop policy if exists "Strict Instansi Select RLS" on public.events;
drop policy if exists "Strict Instansi Insert RLS" on public.events;
drop policy if exists "Strict Instansi Update RLS" on public.events;
drop policy if exists "Strict Instansi Delete RLS" on public.events;
create policy "Strict Instansi Select RLS" on public.events for select to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Insert RLS" on public.events for insert to authenticated with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Update RLS" on public.events for update to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi()) with check (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());
create policy "Strict Instansi Delete RLS" on public.events for delete to authenticated using (public.get_user_role() = 'PortalMaster' or instansi = public.get_user_instansi());


-- 5. TABEL KEEP-ALIVE SUPABASE (Khusus RLS Bebas Tanpa Login / Public Untuk Cron Job)
create table if not exists public.supabase_keep_alive (
  id integer primary key,
  last_ping timestamp with time zone default timezone('utc'::text, now()),
  project_name text default 'Catet-In Keep Alive'
);

-- Masukkan data awal tunggal (single record) jika belum ada
insert into public.supabase_keep_alive (id, last_ping, project_name)
values (1, now(), 'Catet-In Keep Alive')
on conflict (id) do nothing;

-- Aktifkan Row Level Security (RLS) khusus untuk tabel keep_alive ini
alter table public.supabase_keep_alive enable row level security;
drop policy if exists "Allow public select on keep alive" on public.supabase_keep_alive;
create policy "Allow public select on keep alive" on public.supabase_keep_alive for select using (true);


-- 6. STORED PROCEDURE: get_event_dashboard_summary (Dashboard Aggregation)
create or replace function public.get_event_dashboard_summary(p_event_id text, p_instansi text default null)
returns jsonb as $$
declare
  v_last_5_dates text[];
  v_meeting_stats jsonb;
  v_overall jsonb;
  v_top_hadir jsonb;
  v_top_izin jsonb;
  v_top_alpa jsonb;
  v_top_terlambat jsonb;
  v_total_meetings int;
begin
  select array_agg(d) into v_last_5_dates
  from (
    select distinct split_part(date, ' ', 1) as d
    from public.attendance_logs
    where event_id = p_event_id
      and (p_instansi is null or instansi = p_instansi)
      and date is not null
    order by d desc
    limit 5
  ) t;

  if v_last_5_dates is null or array_length(v_last_5_dates, 1) = 0 then
    return jsonb_build_object(
      'eventId', p_event_id,
      'meetingStats', '[]'::jsonb,
      'overall', jsonb_build_object('totalLogs', 0, 'totalHadir', 0, 'totalIzin', 0, 'totalSakit', 0, 'totalAlpa', 0, 'presenceRate', 0, 'meetingCount', 0),
      'top5Hadir', '[]'::jsonb,
      'top5Izin', '[]'::jsonb,
      'top5Alpa', '[]'::jsonb,
      'top5Terlambat', '[]'::jsonb
    );
  end if;

  v_total_meetings := array_length(v_last_5_dates, 1);

  select jsonb_agg(
    jsonb_build_object(
      'meetingNumber', row_number,
      'dateStr', d,
      'dateFormatted', d,
      'total', coalesce(total, 0),
      'hadir', coalesce(hadir, 0),
      'izin', coalesce(izin, 0),
      'sakit', coalesce(sakit, 0),
      'alpa', coalesce(alpa, 0),
      'pct', case when coalesce(total,0) > 0 then round((coalesce(hadir,0)::numeric / total::numeric) * 100) else 0 end
    )
  ) into v_meeting_stats
  from (
    select 
      d,
      row_number() over (order by d asc) as row_number,
      count(*) as total,
      count(*) filter (where status = 'Hadir') as hadir,
      count(*) filter (where status = 'Izin') as izin,
      count(*) filter (where status = 'Sakit') as sakit,
      count(*) filter (where status = 'Alpa') as alpa
    from unnest(v_last_5_dates) as d
    left join public.attendance_logs l 
      on l.event_id = p_event_id 
     and (p_instansi is null or l.instansi = p_instansi)
     and l.date like d || '%'
    group by d
    order by d asc
  ) sub;

  select jsonb_build_object(
    'totalLogs', count(*),
    'totalHadir', count(*) filter (where status = 'Hadir'),
    'totalIzin', count(*) filter (where status = 'Izin'),
    'totalSakit', count(*) filter (where status = 'Sakit'),
    'totalAlpa', count(*) filter (where status = 'Alpa'),
    'presenceRate', case when count(*) > 0 then round((count(*) filter (where status = 'Hadir')::numeric / count(*)::numeric) * 100) else 0 end,
    'meetingCount', v_total_meetings
  ) into v_overall
  from public.attendance_logs
  where event_id = p_event_id
    and (p_instansi is null or instansi = p_instansi)
    and split_part(date, ' ', 1) = any(v_last_5_dates);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'memberId', coalesce("memberId", 'unknown'),
      'memberName', coalesce("memberName", 'Tanpa Nama'),
      'kelompokName', coalesce("kelompokName", '-'),
      'count', hadir_cnt,
      'totalMeetings', v_total_meetings,
      'pct', round((hadir_cnt::numeric / v_total_meetings::numeric) * 100),
      'izinCount', izin_cnt
    )
  ), '[]'::jsonb) into v_top_hadir
  from (
    select "memberId", "memberName", "kelompokName",
           count(*) filter (where status = 'Hadir') as hadir_cnt,
           count(*) filter (where status = 'Izin') as izin_cnt,
           count(*) as total_rec
    from public.attendance_logs
    where event_id = p_event_id
      and (p_instansi is null or instansi = p_instansi)
      and split_part(date, ' ', 1) = any(v_last_5_dates)
    group by "memberId", "memberName", "kelompokName"
    having count(*) filter (where status = 'Hadir') > 0
    order by hadir_cnt desc, total_rec desc
    limit 5
  ) t_h;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'memberId', coalesce("memberId", 'unknown'),
      'memberName', coalesce("memberName", 'Tanpa Nama'),
      'kelompokName', coalesce("kelompokName", '-'),
      'count', izin_sakit_cnt,
      'totalMeetings', v_total_meetings,
      'izinCount', izin_cnt,
      'sakitCount', sakit_cnt
    )
  ), '[]'::jsonb) into v_top_izin
  from (
    select "memberId", "memberName", "kelompokName",
           count(*) filter (where status in ('Izin', 'Sakit')) as izin_sakit_cnt,
           count(*) filter (where status = 'Izin') as izin_cnt,
           count(*) filter (where status = 'Sakit') as sakit_cnt
    from public.attendance_logs
    where event_id = p_event_id
      and (p_instansi is null or instansi = p_instansi)
      and split_part(date, ' ', 1) = any(v_last_5_dates)
    group by "memberId", "memberName", "kelompokName"
    having count(*) filter (where status in ('Izin', 'Sakit')) > 0
    order by izin_sakit_cnt desc
    limit 5
  ) t_i;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'memberId', coalesce("memberId", 'unknown'),
      'memberName', coalesce("memberName", 'Tanpa Nama'),
      'kelompokName', coalesce("kelompokName", '-'),
      'count', alpa_cnt,
      'totalMeetings', v_total_meetings,
      'pct', round((alpa_cnt::numeric / v_total_meetings::numeric) * 100)
    )
  ), '[]'::jsonb) into v_top_alpa
  from (
    select "memberId", "memberName", "kelompokName",
           count(*) filter (where status = 'Alpa') as alpa_cnt
    from public.attendance_logs
    where event_id = p_event_id
      and (p_instansi is null or instansi = p_instansi)
      and split_part(date, ' ', 1) = any(v_last_5_dates)
    group by "memberId", "memberName", "kelompokName"
    having count(*) filter (where status = 'Alpa') > 0
    order by alpa_cnt desc
    limit 5
  ) t_a;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'memberId', coalesce("memberId", 'unknown'),
      'memberName', coalesce("memberName", 'Tanpa Nama'),
      'kelompokName', coalesce("kelompokName", '-'),
      'count', late_cnt,
      'totalMinutes', total_late_min,
      'totalMeetings', v_total_meetings,
      'formattedLate', case 
        when total_late_min >= 60 then (total_late_min / 60)::text || 'j ' || (total_late_min % 60)::text || 'm'
        else total_late_min::text || 'm'
      end
    )
  ), '[]'::jsonb) into v_top_terlambat
  from (
    select 
      sub."memberId", 
      sub."memberName", 
      sub."kelompokName",
      count(*) as late_cnt,
      sum(sub.late_min)::int as total_late_min
    from (
      select 
        l."memberId",
        l."memberName",
        l."kelompokName",
        greatest(
          0,
          floor(
            extract(
              epoch from (
                (substring(coalesce(nullif(l.date, ''), nullif(l."dateInput", '')) from '([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)'))::time - 
                (substring(coalesce(nullif(l.jam_mulai, ''), nullif(e.jam_mulai, '')) from '([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)'))::time
              )
            ) / 60
          )
        ) as late_min
      from public.attendance_logs l
      left join public.events e on e.id = l.event_id
      where l.event_id = p_event_id
        and (p_instansi is null or l.instansi = p_instansi)
        and split_part(l.date, ' ', 1) = any(v_last_5_dates)
        and l.status = 'Hadir'
        and coalesce(nullif(l.jam_mulai, ''), nullif(e.jam_mulai, ''), '') ~ '[0-9]{1,2}:[0-9]{2}'
        and coalesce(nullif(l.date, ''), nullif(l."dateInput", ''), '') ~ '[0-9]{1,2}:[0-9]{2}'
    ) sub
    where sub.late_min > 0
    group by sub."memberId", sub."memberName", sub."kelompokName"
    order by total_late_min desc, late_cnt desc
    limit 5
  ) t_t;

  return jsonb_build_object(
    'eventId', p_event_id,
    'meetingStats', coalesce(v_meeting_stats, '[]'::jsonb),
    'overall', coalesce(v_overall, jsonb_build_object('totalLogs', 0, 'totalHadir', 0, 'totalIzin', 0, 'totalSakit', 0, 'totalAlpa', 0, 'presenceRate', 0, 'meetingCount', 0)),
    'top5Hadir', coalesce(v_top_hadir, '[]'::jsonb),
    'top5Izin', coalesce(v_top_izin, '[]'::jsonb),
    'top5Alpa', coalesce(v_top_alpa, '[]'::jsonb),
    'top5Terlambat', coalesce(v_top_terlambat, '[]'::jsonb)
  );
end;
$$ language plpgsql security definer;


-- 7. STORED PROCEDURE: get_attendance_analysis_summary (Analisis Presensi Multi-Dimensi RPC)
create or replace function public.get_attendance_analysis_summary(
  p_event_id text default null,
  p_dates text[] default null,
  p_instansi text default null
)
returns jsonb as $$
declare
  v_overall jsonb;
  v_per_date jsonb;
begin
  -- 1. Overall Aggregation
  with filtered_logs as (
    select 
      coalesce(nullif("kelompokName", ''), 'Tanpa Kelompok') as kelompok_name,
      coalesce(nullif("ageName", ''), 'Umum') as age_name,
      split_part(coalesce(nullif(date, ''), nullif("dateInput", '')), ' ', 1) as clean_date,
      lower(coalesce(status, '')) as status_clean
    from public.attendance_logs
    where (p_event_id is null or event_id = p_event_id)
      and (p_instansi is null or instansi = p_instansi)
      and (
        p_dates is null 
        or array_length(p_dates, 1) is null 
        or array_length(p_dates, 1) = 0
        or split_part(coalesce(nullif(date, ''), nullif("dateInput", '')), ' ', 1) = any(p_dates)
      )
  ),
  overall_counts as (
    select
      count(*) filter (where status_clean = 'hadir') as h,
      count(*) filter (where status_clean = 'izin') as i,
      count(*) filter (where status_clean = 'sakit') as s,
      count(*) filter (where status_clean = 'alpa') as a,
      count(*) as tot
    from filtered_logs
  ),
  overall_kelompok as (
    select
      kelompok_name as label,
      count(*) filter (where status_clean = 'hadir') as h,
      count(*) filter (where status_clean = 'izin') as i,
      count(*) filter (where status_clean = 'sakit') as s,
      count(*) filter (where status_clean = 'alpa') as a,
      count(*) as tot,
      case when count(*) > 0 
        then round((count(*) filter (where status_clean = 'hadir')::numeric / count(*)::numeric * 100), 1)::text || '%'
        else '0%'
      end as pct
    from filtered_logs
    group by kelompok_name
    order by kelompok_name asc
  ),
  overall_age as (
    select
      age_name as label,
      count(*) filter (where status_clean = 'hadir') as h,
      count(*) filter (where status_clean = 'izin') as i,
      count(*) filter (where status_clean = 'sakit') as s,
      count(*) filter (where status_clean = 'alpa') as a,
      count(*) as tot,
      case when count(*) > 0 
        then round((count(*) filter (where status_clean = 'hadir')::numeric / count(*)::numeric * 100), 1)::text || '%'
        else '0%'
      end as pct
    from filtered_logs
    group by age_name
    order by age_name asc
  )
  select jsonb_build_object(
    'totalHadir', c.h,
    'totalIzin', c.i,
    'totalSakit', c.s,
    'totalAlpa', c.a,
    'totalRecord', c.tot,
    'percentHadir', case when c.tot > 0 then round((c.h::numeric / c.tot::numeric * 100), 1)::text || '%' else '0%' end,
    'perKelompok', coalesce((select jsonb_agg(to_jsonb(k)) from overall_kelompok k), '[]'::jsonb),
    'perAgeCategory', coalesce((select jsonb_agg(to_jsonb(ag)) from overall_age ag), '[]'::jsonb)
  ) into v_overall
  from overall_counts c;

  -- 2. Per Date Aggregation
  with filtered_logs as (
    select 
      coalesce(nullif("kelompokName", ''), 'Tanpa Kelompok') as kelompok_name,
      coalesce(nullif("ageName", ''), 'Umum') as age_name,
      split_part(coalesce(nullif(date, ''), nullif("dateInput", '')), ' ', 1) as clean_date,
      lower(coalesce(status, '')) as status_clean
    from public.attendance_logs
    where (p_event_id is null or event_id = p_event_id)
      and (p_instansi is null or instansi = p_instansi)
      and (
        p_dates is null 
        or array_length(p_dates, 1) is null 
        or array_length(p_dates, 1) = 0
        or split_part(coalesce(nullif(date, ''), nullif("dateInput", '')), ' ', 1) = any(p_dates)
      )
  ),
  distinct_dates as (
    select distinct clean_date
    from filtered_logs
    where clean_date is not null and clean_date <> ''
    order by clean_date asc
  ),
  date_summary as (
    select
      d.clean_date as "dateStr",
      count(l.*) filter (where l.status_clean = 'hadir') as h,
      count(l.*) filter (where l.status_clean = 'izin') as i,
      count(l.*) filter (where l.status_clean = 'sakit') as s,
      count(l.*) filter (where l.status_clean = 'alpa') as a,
      count(l.*) as tot,
      case when count(l.*) > 0 
        then round((count(l.*) filter (where l.status_clean = 'hadir')::numeric / count(l.*)::numeric * 100), 1)::text || '%'
        else '0%'
      end as pct,
      coalesce((
        select jsonb_agg(to_jsonb(k)) from (
          select
            l_k.kelompok_name as label,
            count(*) filter (where l_k.status_clean = 'hadir') as h,
            count(*) filter (where l_k.status_clean = 'izin') as i,
            count(*) filter (where l_k.status_clean = 'sakit') as s,
            count(*) filter (where l_k.status_clean = 'alpa') as a,
            count(*) as tot,
            case when count(*) > 0 
              then round((count(*) filter (where l_k.status_clean = 'hadir')::numeric / count(*)::numeric * 100), 1)::text || '%'
              else '0%'
            end as pct
          from filtered_logs l_k
          where l_k.clean_date = d.clean_date
          group by l_k.kelompok_name
          order by l_k.kelompok_name asc
        ) k
      ), '[]'::jsonb) as "perKelompok",
      coalesce((
        select jsonb_agg(to_jsonb(ag)) from (
          select
            l_a.age_name as label,
            count(*) filter (where l_a.status_clean = 'hadir') as h,
            count(*) filter (where l_a.status_clean = 'izin') as i,
            count(*) filter (where l_a.status_clean = 'sakit') as s,
            count(*) filter (where l_a.status_clean = 'alpa') as a,
            count(*) as tot,
            case when count(*) > 0 
              then round((count(*) filter (where l_a.status_clean = 'hadir')::numeric / count(*)::numeric * 100), 1)::text || '%'
              else '0%'
            end as pct
          from filtered_logs l_a
          where l_a.clean_date = d.clean_date
          group by l_a.age_name
          order by l_a.age_name asc
        ) ag
      ), '[]'::jsonb) as "perAgeCategory"
    from distinct_dates d
    left join filtered_logs l on l.clean_date = d.clean_date
    group by d.clean_date
    order by d.clean_date asc
  )
  select coalesce(jsonb_agg(to_jsonb(ds)), '[]'::jsonb) into v_per_date
  from date_summary ds;

  return jsonb_build_object(
    'overall', coalesce(v_overall, jsonb_build_object('totalHadir', 0, 'totalIzin', 0, 'totalSakit', 0, 'totalAlpa', 0, 'totalRecord', 0, 'percentHadir', '0%', 'perKelompok', '[]'::jsonb, 'perAgeCategory', '[]'::jsonb)),
    'perDate', coalesce(v_per_date, '[]'::jsonb)
  );
end;
$$ language plpgsql security definer;
`;

export const SUPABASE_DDL_SQL = SUPABASE_UNIFIED_MASTER_SQL;
export const GET_ATTENDANCE_ANALYSIS_SUMMARY_SQL = SUPABASE_UNIFIED_MASTER_SQL;

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
  const [showMasterSqlCode, setShowMasterSqlCode] = useState(false);
  const [copiedDdl, setCopiedDdl] = useState('');

  // Portal Master registration states
  const [saUsername, setSaUsername] = useState('');
  const [saEmail, setSaEmail] = useState('');
  const [saFullName, setSaFullName] = useState('');
  const [saPassword, setSaPassword] = useState('');
  const [saToken, setSaToken] = useState('');
  const [saIsLoading, setSaIsLoading] = useState(false);
  const [saSuccessMsg, setSaSuccessMsg] = useState('');
  const [saErrorMsg, setSaErrorMsg] = useState('');

  const handleRegisterPortalMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaErrorMsg('');
    setSaSuccessMsg('');
    setSaIsLoading(false);

    try {
      const activeClient = getActiveDb();
      if (!activeClient) {
        throw new Error("Supabase belum dikonfigurasi. Hubungkan kredensial di atas terlebih dahulu.");
      }

      // Check the setup token
      const expectedToken = (import.meta as any).env.VITE_PORTAL_SETUP_TOKEN || 'BendaPintarPortalMasterTokenSecret123';
      if (saToken.trim() !== expectedToken.trim()) {
        throw new Error("Setup Token (Token Konfigurasi) salah! Silakan periksa file konfigurasi .env Anda.");
      }

      // Input validation
      const cleanUser = saUsername.trim().toLowerCase().replace(/\s+/g, '');
      const cleanEmail = saEmail.trim().toLowerCase();

      if (cleanUser.length < 3) {
        throw new Error("Username minimal harus 3 karakter!");
      }
      if (saPassword.length < 6) {
        throw new Error("Password minimal harus 6 karakter!");
      }

      setSaIsLoading(true);

      // Try to register user in Supabase Auth
      const { data: authResult, error: authErr } = await activeClient.auth.signUp({
        email: cleanEmail,
        password: saPassword,
        options: {
          data: {
            username: cleanUser,
            full_name: saFullName.trim(),
            original_role: 'PortalMaster',
            instansi: 'Catet-In (Master)',
            web_access: 'bendahara,absensi',
          }
        }
      });

      if (authErr) {
        throw new Error("Gagal mendaftar di Supabase Auth: " + authErr.message);
      }

      const superId = authResult?.user?.id || 'super-sa-' + Math.random().toString(36).substring(2, 11);

      // Save to users table with PortalMaster role
      const superData = {
        id: superId,
        username: cleanUser,
        email: cleanEmail,
        full_name: saFullName.trim(),
        role: 'PortalMaster',
        original_role: 'PortalMaster',
        instansi: 'Catet-In (Master)',
        web_access: 'bendahara,absensi',
        status: 'Active',
        created_at: new Date().toISOString()
      };

      try {
        const { error: insertErr } = await activeClient.from('users').upsert([superData]);
        if (insertErr) {
          console.warn("Profil Portal Master upsert error (safely ignored, handled by database trigger):", insertErr.message);
        }
      } catch (upsertErr) {
        console.warn("Profil Portal Master upsert threw error (safely ignored):", upsertErr);
      }

      if (!authResult?.session) {
        setSaSuccessMsg("Akun Portal Master pertama berhasil didaftarkan di Supabase Auth! Karena opsi 'Confirm Email' aktif di Supabase Anda secara default, silakan periksa email masuk Anda untuk melakukan verifikasi terlebih dahulu agar akun aktif di database public.users.");
      } else {
        setSaSuccessMsg("Akun Portal Master pertama berhasil didaftarkan! Silakan kembali ke halaman login utama dan masuk menggunakan akun baru ini.");
      }
      // Clear form
      setSaUsername('');
      setSaEmail('');
      setSaFullName('');
      setSaPassword('');
      setSaToken('');
    } catch (err: any) {
      console.error(err);
      setSaErrorMsg(err.message || String(err));
    } finally {
      setSaIsLoading(false);
    }
  };

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

        {/* 1B. INISIALISASI AKUN PORTAL MASTER UTAMA */}
        <div className="p-8 bg-amber-50/50 rounded-[2rem] border border-amber-100 space-y-6">
           <div className="flex items-center space-x-3 text-amber-700">
              <Sparkles size={24} className="shrink-0" />
              <h4 className="text-sm md:text-md font-black uppercase tracking-tight">1B. INISIALISASI AKUN PORTAL MASTER UTAMA</h4>
           </div>
           
           <p className="text-[11px] font-bold text-amber-800 leading-relaxed max-w-3xl">
              Daftarkan akun Portal Master pertama Anda untuk mengelola seluruh sistem. Untuk mendaftar, masukkan kredensial akun beserta <b>Setup Token</b> yang telah dikonfigurasi di file <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono text-[9.5px]">.env</code> Anda.
           </p>

           {saSuccessMsg && (
             <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-[11px] font-semibold">
               <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
               <span>{saSuccessMsg}</span>
             </div>
           )}

           {saErrorMsg && (
             <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-[11px] font-semibold">
               <AlertCircle size={18} className="text-rose-500 shrink-0" />
               <span>{saErrorMsg}</span>
             </div>
           )}

           <form onSubmit={handleRegisterPortalMaster} className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
             <div className="space-y-1.5">
               <label className="text-[9px] font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                 USERNAME PORTAL MASTER
               </label>
               <input 
                 type="text"
                 required
                 placeholder="Contoh: portalmaster"
                 value={saUsername}
                 onChange={(e) => setSaUsername(e.target.value)}
                 className="w-full px-4 py-3 text-xs font-semibold bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder:font-normal shadow-sm"
               />
             </div>

             <div className="space-y-1.5">
               <label className="text-[9px] font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                 EMAIL PORTAL MASTER
               </label>
               <input 
                 type="type"
                 required
                 placeholder="Contoh: master@catetin.com"
                 value={saEmail}
                 onChange={(e) => setSaEmail(e.target.value)}
                 className="w-full px-4 py-3 text-xs font-semibold bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder:font-normal shadow-sm"
               />
             </div>

             <div className="space-y-1.5">
               <label className="text-[9px] font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                 NAMA LENGKAP
               </label>
               <input 
                 type="text"
                 required
                 placeholder="Contoh: Portal Master"
                 value={saFullName}
                 onChange={(e) => setSaFullName(e.target.value)}
                 className="w-full px-4 py-3 text-xs font-semibold bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder:font-normal shadow-sm"
               />
             </div>

             <div className="space-y-1.5">
               <label className="text-[9px] font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                 PASSWORD PORTAL MASTER
               </label>
               <input 
                 type="password"
                 required
                 placeholder="Masukkan password portal master"
                 value={saPassword}
                 onChange={(e) => setSaPassword(e.target.value)}
                 className="w-full px-4 py-3 text-xs font-semibold bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder:font-normal shadow-sm"
               />
             </div>

             <div className="md:col-span-2 space-y-1.5">
               <label className="text-[9px] font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                 VITE_PORTAL_SETUP_TOKEN (TOKEN KONFIGURASI)
               </label>
               <input 
                 type="password"
                 required
                 placeholder="Masukkan Setup Token dari file .env Anda"
                 value={saToken}
                 onChange={(e) => setSaToken(e.target.value)}
                 className="w-full px-4 py-3 text-xs font-semibold bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono shadow-sm"
               />
             </div>

             <div className="md:col-span-2 flex justify-end pt-2">
               <button 
                 type="submit"
                 disabled={saIsLoading}
                 className="px-8 py-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-lg shadow-amber-100"
               >
                 {saIsLoading ? (
                   <>
                     <RefreshCw size={14} className="animate-spin" />
                     <span>Mendaftarkan...</span>
                   </>
                 ) : (
                   <>
                     <Sparkles size={14} />
                     <span>Daftar Akun Portal Master</span>
                   </>
                 )}
               </button>
             </div>
           </form>
        </div>

        {/* 2. MASTER SQL SCHEMA & STORED PROCEDURES (ALL-IN-ONE COMPLETE SETUP) */}
        <div className="p-8 bg-slate-900 rounded-[2rem] border border-slate-800 space-y-6 text-white">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3 text-sky-400">
                 <ShieldCheck size={32} className="shrink-0 text-sky-400" />
                 <div>
                   <h4 className="text-sm md:text-md font-black uppercase tracking-tight leading-none text-white font-sans">
                     2. MASTER SQL SCHEMA &amp; STORED PROCEDURES (ALL-IN-ONE SETUP)
                   </h4>
                   <p className="text-[9.5px] text-sky-300 uppercase font-bold tracking-widest mt-1.5 flex items-center gap-1">
                     <Sparkles size={11} className="text-sky-400" />
                     Cukup copy &amp; paste script tunggal ini ke SQL Editor Supabase baru Anda
                   </p>
                 </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopyText(SUPABASE_UNIFIED_MASTER_SQL, 'master_sql')}
                className={`flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border shadow-lg active:scale-95 ${
                  copiedDdl === 'master_sql' 
                    ? 'bg-emerald-600 border-emerald-500 text-white' 
                    : 'bg-sky-600 hover:bg-sky-500 border-sky-400 text-white shadow-sky-950/40 hover:shadow-sky-600/30'
                }`}
              >
                {copiedDdl === 'master_sql' ? <Check size={14} className="text-white" /> : <Copy size={14} />}
                <span>{copiedDdl === 'master_sql' ? 'Tersalin ke Clipboard' : 'Copy Master SQL (All-in-One)'}</span>
              </button>
           </div>
           
           <div className="p-5 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-3 text-slate-300 text-[11px] leading-relaxed">
             <p className="font-bold text-white flex items-center gap-2 text-xs">
               <Database size={15} className="text-sky-400" />
               Panduan Supabase Baru:
             </p>
             <p className="text-slate-300">
               Jika Anda membuat proyek Supabase yang baru, Anda <b>hanya perlu menjalankan satu script ini sekali saja</b> di menu <b>SQL Editor</b> dashboard Supabase lalu klik tombol <b>Run</b>. Script ini sudah 100% lengkap dan mencakup seluruh skema database:
             </p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono text-slate-200 pt-1">
               <div className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                 <Check size={13} className="text-emerald-400 shrink-0" />
                 <span>1. Ekstensi &amp; Keamanan pgcrypto</span>
               </div>
               <div className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                 <Check size={13} className="text-emerald-400 shrink-0" />
                 <span>2. Auth Trigger &amp; Manajemen Pengguna (users, instansi)</span>
               </div>
               <div className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                 <Check size={13} className="text-emerald-400 shrink-0" />
                 <span>3. Seluruh Tabel Keuangan &amp; Presensi Terpadu</span>
               </div>
               <div className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                 <Check size={13} className="text-emerald-400 shrink-0" />
                 <span>4. Row Level Security (RLS Multi-Tenancy Aman)</span>
               </div>
               <div className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                 <Check size={13} className="text-emerald-400 shrink-0" />
                 <span>5. Tabel Keep-Alive (Cron Job Anti-Sleep)</span>
               </div>
               <div className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                 <Check size={13} className="text-emerald-400 shrink-0" />
                 <span>6. Stored Procedure Aggregasi Dashboard &amp; Analisis</span>
               </div>
             </div>
           </div>

           <div className="border-t border-slate-800 pt-3">
             <button
               type="button"
               onClick={() => setShowMasterSqlCode(!showMasterSqlCode)}
               className="w-full flex items-center justify-between text-slate-400 hover:text-white transition-colors py-2 text-[10px] font-bold uppercase tracking-wider focus:outline-none cursor-pointer"
             >
               <span>{showMasterSqlCode ? 'Sembunyikan Tinjauan SQL Script' : 'Lihat / Preview Seluruh Isi SQL Script (All-in-One)'}</span>
               {showMasterSqlCode ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
             </button>

             {showMasterSqlCode && (
               <div className="mt-4 bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-inner max-h-96 overflow-y-auto no-scrollbar font-mono text-[9.5px] text-sky-300 text-left animate-in slide-in-from-top-1 duration-200">
                 <pre className="whitespace-pre-wrap leading-relaxed">{SUPABASE_UNIFIED_MASTER_SQL}</pre>
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
                 <h6 className="text-[11px] font-black uppercase tracking-tight text-rose-950 font-bold">B. Cron-Job / UptimeRobot REST Ping (Tabel Khusus)</h6>
                 <p className="text-[9.5px] text-rose-700 leading-relaxed font-semibold">
                   Cara paling kredibel & jaminan 100% database Anda tidak tidur adalah mendaftarkan URL HTTPS REST API Supabase ke layanan ping harian gratis (seperti <b>cron-job.org</b> atau <b>UptimeRobot</b>).
                  </p>
                  <p className="text-[8.5px] text-rose-600 font-bold leading-normal">
                    💡 Khusus tabel <code className="bg-rose-50 px-1 py-0.5 rounded text-rose-850 font-mono text-[8px]">supabase_keep_alive</code>, RLS diset publik tanpa perlu login (bebas diakses anonim) demi mempermudah cron-job eksternal. Sementara tabel operasional lainnya tetap terproteksi penuh oleh RLS login Anda!
                 </p>
               </div>

               <div className="bg-rose-50/50 p-4 border border-rose-150 rounded-xl space-y-2.5 text-[9px] font-bold text-rose-800">
                 <div><b>Panduan Setup Cron-Job.org:</b></div>
                 <ol className="list-decimal list-inside space-y-1 text-rose-700">
                   <li>Masuk dan buat akun gratis di <a href="https://cron-job.org" target="_blank" rel="noreferrer" className="text-rose-650 font-black underline">cron-job.org</a></li>
                   <li>Klik <b>Create Cronjob</b>, beri nama: <i>keep-supabase-awake</i></li>
                   <li>Silakan pilih interval / frekuensi eksekusi: <span className="text-rose-950">Setiap 1 hari / Setiap jam</span></li>
                   <li>Di kolom Target URL, masukkan URL Rest tabel keep-alive: <br/>
                     <code className="bg-white/80 p-0.5 font-mono text-[8px] border border-rose-150 rounded select-all font-semibold block mt-1 overflow-x-auto whitespace-nowrap">
                       {supabaseUrl ? `${supabaseUrl}/rest/v1/supabase_keep_alive?select=*` : 'https://[your-supabase-url]/rest/v1/supabase_keep_alive?select=*'}
                     </code>
                   </li>
                    <li className="mt-1">
                      Di bagian <b>Request Headers</b>, tambahkan dua header berikut agar lolos otentikasi REST Supabase secara publik:
                      <div className="mt-1 font-mono text-[8px] bg-slate-900 text-slate-200 p-2 rounded space-y-1 text-left">
                        <div><b>Key:</b> <code className="text-amber-300 font-mono">apikey</code></div>
                        <div className="truncate"><b>Value:</b> <code className="text-emerald-300 font-mono font-semibold select-all">{supabaseAnonKey || '[ANON_KEY_ANDA]'}</code></div>
                        <div className="border-t border-slate-700 my-1"></div>
                        <div><b>Key:</b> <code className="text-amber-300 font-mono">Authorization</code></div>
                        <div className="truncate"><b>Value:</b> <code className="text-emerald-300 font-mono font-semibold select-all">{supabaseAnonKey ? `Bearer ${supabaseAnonKey}` : 'Bearer [ANON_KEY_ANDA]'}</code></div>
                      </div>
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
