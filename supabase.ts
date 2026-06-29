import { createClient, SupabaseClient } from '@supabase/supabase-js';
import supabaseConfigRaw from './supabase-applet-config.json';
import { 
  Transaction, DeletedTransaction, EditHistory, ProjectMetadata, 
  AbsensiMember, AttendanceLog, DesaData, KelompokData, AgeCategoryData, DaerahData, EventData,
  Family, FamilyRelationship
} from './types';

// Load Supabase central configurations
const config = supabaseConfigRaw as { supabaseUrl?: string; supabaseAnonKey?: string };
const centralUrl = config.supabaseUrl || localStorage.getItem('supabase_central_url') || '';
const centralAnonKey = config.supabaseAnonKey || localStorage.getItem('supabase_central_key') || '';

// Define Central and Active Supabase Client
export let centralClient: SupabaseClient | null = null;
if (centralUrl && centralAnonKey) {
  centralClient = createClient(centralUrl, centralAnonKey, {
    auth: { storageKey: 'sb-central-token', persistSession: true }
  });
}

// Active dynamic client. Defaults to centralClient but changes to the institution's client when logged in.
export let db: SupabaseClient = centralClient as any;

// Fallback checking to allow immediate setup
export function getActiveDb(): SupabaseClient {
  if (db) return db;
  // Fallback to local reconstruction if configured on the boundary
  const url = centralUrl || localStorage.getItem('supabase_central_url') || '';
  const key = centralAnonKey || localStorage.getItem('supabase_central_key') || '';
  if (url && key) {
    const freshCentral = createClient(url, key, {
      auth: { storageKey: 'sb-central-token', persistSession: true }
    });
    db = freshCentral;
    return freshCentral;
  }
  throw new Error("Supabase is not configured. Clean UI settings or config file required.");
}

// Compatible Auth object
export const activeAuth = {
  currentUser: null as any,
  signOut: async () => {
    try {
      if (centralClient) {
        await centralClient.auth.signOut();
      }
    } catch (e) {
      console.warn("Failed to sign out of central client:", e);
    }
    try {
      const client = getActiveDb();
      if (client && client !== centralClient) {
        await client.auth.signOut();
      }
    } catch (e) {
      console.warn("Failed to sign out of active client:", e);
    }
    localStorage.removeItem('supabase_session');
    localStorage.removeItem('instansi_db_config');
    localStorage.removeItem('user_id');
    localStorage.removeItem('active_session_token');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    localStorage.removeItem('full_name');
    localStorage.removeItem('role');
    localStorage.removeItem('original_role');
    localStorage.removeItem('instansi');
    localStorage.removeItem('web_access');
    console.log("Logged out of all Supabase DBs and cleared session cache.");
  }
};

// Map dynamic operational credentials per tenant session
export function initializeDynamicDb(config: any | null) {
  if (!config || !config.supabaseUrl || !config.supabaseAnonKey) {
    db = centralClient as any;
    console.log("Database connection set back to Central master client.");
    return;
  }
  try {
    const sessionToken = localStorage.getItem('active_session_token') || '';
    const userId = localStorage.getItem('user_id') || '';

    db = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      global: {
        headers: {
          'x-session-token': sessionToken,
          'x-user-id': userId
        }
      },
      auth: { storageKey: 'sb-operational-token', persistSession: true }
    });
    console.log("Dynamically initialized active operational Supabase connection with secure SSO headers.");
  } catch (err) {
    console.error("Failed to connect to dynamic institution database, using Central Db fallback:", err);
    db = centralClient as any;
  }
}

// Auto load configured dynamic database on module load if cached
const cachedDbConfigRaw = localStorage.getItem('instansi_db_config');
if (cachedDbConfigRaw) {
  try {
    const cachedConfig = JSON.parse(cachedDbConfigRaw);
    if (cachedConfig && cachedConfig.supabaseUrl && cachedConfig.supabaseAnonKey) {
      const sessionToken = localStorage.getItem('active_session_token') || '';
      const userId = localStorage.getItem('user_id') || '';

      db = createClient(cachedConfig.supabaseUrl, cachedConfig.supabaseAnonKey, {
        global: {
          headers: {
            'x-session-token': sessionToken,
            'x-user-id': userId
          }
        },
        auth: { storageKey: 'sb-operational-token', persistSession: true }
      });
      console.log("Automatically auto-initialized active operational database connection from cache with secure SSO headers.");
    }
  } catch (e) {
    console.error("Failed to parse cached database configuration on module load:", e);
  }
}

// Custom handler for unified errors
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleSupabaseError(error: any, operationType: OperationType, path: string): never {
  const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
  console.error(`[Supabase Error] During ${operationType} on ${path}:`, errMsg);
  throw new Error(JSON.stringify({
    error: errMsg,
    operationType,
    path
  }));
}

// Ensure Central configuration can be saved
export function saveCentralConfig(url: string, key: string) {
  localStorage.setItem('supabase_central_url', url);
  localStorage.setItem('supabase_central_key', key);
  centralClient = createClient(url, key);
  if (!db) {
    db = centralClient;
  }
  console.log("Central Supabase configurations persisted.");
}

// --- Dynamic Seeding Helper for Initial Superadmin Account Setup ---
export async function seedInitialDataIfNeeded() {
  try {
    const client = getActiveDb();
    
    // Check if users table exists and has any data
    const { data: users, error } = await client.from('users').select('*').limit(1);
    if (error) {
      if (error.code === 'PFRAP' || error.message.includes('relation "users" does not exist')) {
        console.warn("Table 'users' is not ready yet in Supabase.");
        return;
      }
      console.warn("Seeding verification skipped:", error.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log("Seeding initial superadmin record to Supabase table...");
      const superData = {
        id: 'superadmin',
        username: 'superadmin',
        password: 'superadmin354',
        full_name: 'Super Admin Portal',
        role: 'Superadmin',
        original_role: 'Superadmin',
        instansi: 'Catet-In (Master)',
        web_access: 'bendahara,absensi',
        status: 'Active',
        created_at: new Date().toISOString()
      };

      await client.from('users').upsert([superData]);
      
      // Seed fallback categories
      const categories = ['Konsumsi', 'Operasional', 'Peralatan', 'Transportasi', 'Sponsorship', 'Dana Hibah', 'Lain-lain'];
      await client.from('categories').upsert(categories.map(name => ({
        id: name.toLowerCase().replace(/ /g, '_'),
        name
      })));

      // Seed general settings
      await client.from('projects').upsert([{
        name: 'KAS UMUM',
        created_at: new Date().toISOString(),
        status: 'Aktif'
      }]);

      await client.from('desas').upsert([{ id: 'd1', nama_desa: 'Salak Krajan', pimpinan: 'Bpk. Ahmad', alamat: 'RT 01 RW 02' }]);
      await client.from('kelompoks').upsert([{ id: 'k1', nama_kelompok: 'Kelompok Utara', pimpinan: 'Sdr. Bagus', keterangan: 'Muda mudi wilayah utara' }]);
      await client.from('age_categories').upsert([{ id: 'a1', name: 'Remaja', description: 'Usia 13-17 tahun' }]);
      
      // Seed default family relationships
      await client.from('family_relationships').upsert([
        { id: 'r1', name: 'Ayah', is_wali: true },
        { id: 'r2', name: 'Ibu', is_wali: true },
        { id: 'r3', name: 'Anak', is_wali: false },
        { id: 'r4', name: 'Kakek', is_wali: false },
        { id: 'r5', name: 'Nenek', is_wali: false },
        { id: 'r6', name: 'Wali Lainnya', is_wali: true }
      ]);

      console.log('Seeded Supabase successfully with initial admin account and default projects.');
    }
  } catch (e) {
    console.warn("Database seeding deferred:", e);
  }
}

// --- Supabase General CRUD Wrappers with Type Compatibility ---

// 1. Users Operations (Always on central database)
export async function dbGetUserDoc(uid: string) {
  try {
    const client = centralClient || getActiveDb();
    const { data, error } = await client.from('users').select('*').eq('id', uid).maybeSingle();
    if (error) return handleSupabaseError(error, OperationType.GET, `users/${uid}`);
    return data;
  } catch (err) {
    return null;
  }
}

export async function dbGetUser(username: string) {
  try {
    const client = centralClient || getActiveDb();
    const { data, error } = await client
      .from('users')
      .select('*')
      .or(`username.eq.${username.toLowerCase().trim()},email.eq.${username.toLowerCase().trim()}`)
      .maybeSingle();
    if (error) return handleSupabaseError(error, OperationType.GET, `users/${username}`);
    return data;
  } catch (err) {
    return null;
  }
}

export async function dbUpdateUserPassword(username: string, pass: string) {
  try {
    const client = centralClient || getActiveDb();
    const { error } = await client
      .from('users')
      .update({ password: pass })
      .or(`username.eq.${username.toLowerCase().trim()},email.eq.${username.toLowerCase().trim()}`);
    if (error) return handleSupabaseError(error, OperationType.UPDATE, `users/${username}`);
    return true;
  } catch (err) {
    return false;
  }
}

// 2. Transactions Operations
export async function dbGetTransactions(limitDateStr?: string, projectName?: string, endDateStr?: string, createdAfterStr?: string) {
  try {
    const client = getActiveDb();
    let query = client.from('transactions').select('*');
    
    if (createdAfterStr) {
      query = query.gte('created_at', createdAfterStr);
    } else if (projectName && limitDateStr && endDateStr) {
      query = query.eq('project_name', projectName).gte('date', limitDateStr).lte('date', endDateStr);
    } else if (projectName && limitDateStr) {
      query = query.eq('project_name', projectName).gte('date', limitDateStr);
    } else if (projectName) {
      query = query.eq('project_name', projectName);
    } else if (limitDateStr && endDateStr) {
      query = query.gte('date', limitDateStr).lte('date', endDateStr);
    } else if (limitDateStr) {
      query = query.gte('date', limitDateStr);
    }
    
    // Sort transactions by date descending to align with finance views
    query = query.order('date', { ascending: false });

    const { data, error } = await query;
    if (error) return handleSupabaseError(error, OperationType.LIST, 'transactions');
    
    const mapped = (data || []).map((row: any) => ({
      ...row,
      formattedDate: row.formatted_date || row.formattedDate || '',
    }));
    return mapped as Transaction[];
  } catch (err) {
    return [];
  }
}

export async function dbAddTransaction(tx: Transaction) {
  try {
    const client = getActiveDb();
    const { formattedDate, is_approve, approve_by, approve_date, approver_role, ...rest } = tx as any;
    const dbTx = {
      ...rest,
      formatted_date: formattedDate || tx.formattedDate || (tx as any).formatted_date || '',
    };
    const { error } = await client.from('transactions').upsert([dbTx]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `transactions/${tx.id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbDeleteTransaction(id: string) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('transactions').delete().eq('id', id);
    if (error) return handleSupabaseError(error, OperationType.DELETE, `transactions/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

// 3. Deleted Transactions Audit
export async function dbGetDeletedTransactions() {
  try {
    const client = getActiveDb();
    const { data, error } = await client.from('deleted_transactions').select('*').order('deleted_at', { ascending: false });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'deleted_transactions');
    
    const mapped = (data || []).map((row: any) => ({
      ...row,
      formattedDate: row.formatted_date || row.formattedDate || '',
    }));
    return mapped as DeletedTransaction[];
  } catch (err) {
    return [];
  }
}

export async function dbAddDeletedTransaction(dtx: DeletedTransaction) {
  try {
    const client = getActiveDb();
    const { formattedDate, ...rest } = dtx as any;
    const dbDtx = {
      ...rest,
      formatted_date: formattedDate || dtx.formattedDate || (dtx as any).formatted_date || '',
    };
    const { error } = await client.from('deleted_transactions').upsert([dbDtx]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `deleted_transactions/${dtx.id}`);
    return true;
  } catch (err) {
    return false;
  }
}

// 4. Edits History Audit
export async function dbGetEditHistory() {
  try {
    const client = getActiveDb();
    const { data, error } = await client.from('edit_history').select('*').order('edited_at', { ascending: false });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'edit_history');
    return (data || []) as EditHistory[];
  } catch (err) {
    return [];
  }
}

export async function dbAddEditHistory(eh: EditHistory) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('edit_history').upsert([eh]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `edit_history/${eh.id}`);
    return true;
  } catch (err) {
    return false;
  }
}

// 5. Projects
export async function dbGetProjects() {
  try {
    const client = getActiveDb();
    const { data, error } = await client.from('projects').select('*').order('name', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'projects');
    return (data || []) as ProjectMetadata[];
  } catch (err) {
    return [];
  }
}

export async function dbAddProject(proj: ProjectMetadata) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('projects').upsert([proj]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `projects/${proj.name}`);
    return true;
  } catch (err) {
    return false;
  }
}

// 6. Categories
export async function dbGetCategories() {
  try {
    const client = getActiveDb();
    const { data, error } = await client.from('categories').select('name').order('name', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'categories');
    return (data || []).map(row => row.name) as string[];
  } catch (err) {
    return ['Konsumsi', 'Operasional', 'Peralatan', 'Transportasi', 'Sponsorship', 'Dana Hibah', 'Lain-lain'];
  }
}

export async function dbAddCategory(name: string) {
  try {
    const client = getActiveDb();
    const id = name.toLowerCase().replace(/ /g, '_');
    const { error } = await client.from('categories').upsert([{ id, name }]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `categories/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

// 7. Period Approvals
export async function dbGetApprovals() {
  try {
    const client = getActiveDb();
    const { data, error } = await client.from('approvals').select('*');
    if (error) return handleSupabaseError(error, OperationType.LIST, 'approvals');
    return data || [];
  } catch (err) {
    return [];
  }
}

export async function dbAddApproval(appr: any) {
  try {
    const client = getActiveDb();
    const id = `${appr.period_id}-${appr.project_name.toLowerCase().replace(/ /g, '_')}`;
    const { error } = await client.from('approvals').upsert([{ id, ...appr }]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `approvals/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbDeleteApproval(periodId: string, projectName: string) {
  try {
    const client = getActiveDb();
    const id = `${periodId}-${projectName.toLowerCase().replace(/ /g, '_')}`;
    const { error } = await client.from('approvals').delete().eq('id', id);
    if (error) return handleSupabaseError(error, OperationType.DELETE, `approvals/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbUpdateProjectStatus(name: string, status: string) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('projects').update({ status }).eq('name', name);
    if (error) return handleSupabaseError(error, OperationType.UPDATE, `projects/${name}`);
    return true;
  } catch (err) {
    return false;
  }
}

// 8. Attendance Members
export async function dbGetMembers() {
  try {
    const client = getActiveDb();
    const { data, error } = await client.from('members').select('*').order('nama_lengkap', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'members');
    return (data || []) as AbsensiMember[];
  } catch (err) {
    return [];
  }
}

export async function dbAddMember(mbr: AbsensiMember) {
  const client = getActiveDb();
  const { daerah_name, desa_name, kelompok_name, age_category_name, family_name, relationship_name, is_wali, ...cleanMbr } = mbr;
  const { error } = await client.from('members').upsert([cleanMbr]);
  if (error) {
    console.error(`[Supabase Error] During write on members/${mbr.id}:`, error.message);
    throw new Error(error.message);
  }
  return true;
}

export async function dbUpdateMember(id: string, mbr: Partial<AbsensiMember>) {
  const client = getActiveDb();
  const { daerah_name, desa_name, kelompok_name, age_category_name, family_name, relationship_name, is_wali, ...cleanMbr } = mbr as any;
  const { error } = await client.from('members').update(cleanMbr).eq('id', id);
  if (error) {
    console.error(`[Supabase Error] During update on members/${id}:`, error.message);
    throw new Error(error.message);
  }
  return true;
}

// 8b. Families & Family Relationships
export async function dbGetFamilies() {
  try {
    const client = getActiveDb();
    const { data, error } = await client.from('families').select('*').order('nama_keluarga', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'families');
    return (data || []) as Family[];
  } catch (err) {
    return [];
  }
}

export async function dbAddFamily(fam: Family) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('families').upsert([fam]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `families/${fam.id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbDeleteFamily(id: string) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('families').delete().eq('id', id);
    if (error) return handleSupabaseError(error, OperationType.DELETE, `families/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbGetFamilyRelationships() {
  try {
    const client = getActiveDb();
    const { data, error } = await client.from('family_relationships').select('*').order('name', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'family_relationships');
    return (data || []) as FamilyRelationship[];
  } catch (err) {
    return [];
  }
}

export async function dbAddFamilyRelationship(rel: FamilyRelationship) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('family_relationships').upsert([rel]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `family_relationships/${rel.id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbDeleteFamilyRelationship(id: string) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('family_relationships').delete().eq('id', id);
    if (error) return handleSupabaseError(error, OperationType.DELETE, `family_relationships/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

// 9. Attendance Marking Logs
export async function dbGetAttendanceLogs(limitCount?: number) {
  try {
    const client = getActiveDb();
    let query = client.from('attendance_logs').select('*').order('date', { ascending: false });
    if (limitCount && limitCount > 0) {
      query = query.limit(limitCount);
    }
    const { data, error } = await query;
    if (error) return handleSupabaseError(error, OperationType.LIST, 'attendance_logs');
    return (data || []) as AttendanceLog[];
  } catch (err) {
    return [];
  }
}

export async function dbAddAttendanceLog(log: AttendanceLog) {
  const client = getActiveDb();
  const cleanLog = {
    id: log.id,
    memberId: log.memberId,
    memberName: log.memberName,
    ageName: log.ageName,
    kelompokName: log.kelompokName,
    desaName: log.desaName,
    daerahName: log.daerahName || null,
    date: log.date,
    dateInput: log.dateInput,
    status: log.status,
    note: log.note,
    event_id: log.event_id || null,
    metode: log.metode || 'manual'
  };
  const { error } = await client.from('attendance_logs').upsert([cleanLog]);
  if (error) {
    handleSupabaseError(error, OperationType.WRITE, `attendance_logs/${log.id}`);
  }
  return true;
}

export async function dbAddAttendanceLogs(logs: AttendanceLog[]) {
  const client = getActiveDb();
  const cleanLogs = logs.map((log: any) => ({
    id: log.id,
    memberId: log.memberId,
    memberName: log.memberName,
    ageName: log.ageName,
    kelompokName: log.kelompokName,
    desaName: log.desaName,
    daerahName: log.daerahName || null,
    date: log.date,
    dateInput: log.dateInput,
    status: log.status,
    note: log.note,
    event_id: log.event_id || null,
    metode: log.metode || 'manual'
  }));
  const { error } = await client.from('attendance_logs').upsert(cleanLogs);
  if (error) {
    handleSupabaseError(error, OperationType.WRITE, `attendance_logs/batch`);
  }
  return true;
}

export async function dbDeleteAttendanceLog(id: string) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('attendance_logs').delete().eq('id', id);
    if (error) return handleSupabaseError(error, OperationType.DELETE, `attendance_logs/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

// 9.5 Events Management (Kegiatan)
export async function dbGetEvents() {
  try {
    const client = getActiveDb();
    const { data, error } = await client.from('events').select('*').order('created_at', { ascending: false });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'events');
    return (data || []) as EventData[];
  } catch (err) {
    return [];
  }
}

export async function dbAddEvent(event: EventData) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('events').upsert([event]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `events/${event.id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbDeleteEvent(id: string) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('events').delete().eq('id', id);
    if (error) return handleSupabaseError(error, OperationType.DELETE, `events/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export function dbSubscribeEvents(callback: (events: EventData[]) => void, onError: (err: any) => void) {
  // Free tier budget optimization: Only load events once on mount, no active subscription
  dbGetEvents().then(callback).catch(onError);
  return () => {};
}

// 9b. Daerahs Meta
export async function dbGetDaerahs() {
  try {
    const client = getActiveDb();
    const { data, error } = await client.from('daerahs').select('*').order('nama_daerah', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'daerahs');
    return (data || []) as DaerahData[];
  } catch (err) {
    return [];
  }
}

export async function dbAddDaerah(daerah: DaerahData) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('daerahs').upsert([daerah]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `daerahs/${daerah.id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbDeleteDaerah(id: string) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('daerahs').delete().eq('id', id);
    if (error) return handleSupabaseError(error, OperationType.DELETE, `daerahs/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

// 10. Desas Location Meta
export async function dbGetDesas() {
  try {
    const client = getActiveDb();
    const { data, error } = await client.from('desas').select('*').order('nama_desa', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'desas');
    return (data || []) as DesaData[];
  } catch (err) {
    return [];
  }
}

export async function dbAddDesa(desa: DesaData) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('desas').upsert([desa]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `desas/${desa.id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbDeleteDesa(id: string) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('desas').delete().eq('id', id);
    if (error) return handleSupabaseError(error, OperationType.DELETE, `desas/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

// 11. Kelompoks Meta
export async function dbGetKelompoks() {
  try {
    const client = getActiveDb();
    const { data, error } = await client.from('kelompoks').select('*').order('nama_kelompok', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'kelompoks');
    return (data || []) as KelompokData[];
  } catch (err) {
    return [];
  }
}

export async function dbAddKelompok(group: KelompokData) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('kelompoks').upsert([group]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `kelompoks/${group.id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbDeleteKelompok(id: string) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('kelompoks').delete().eq('id', id);
    if (error) return handleSupabaseError(error, OperationType.DELETE, `kelompoks/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

// 12. Age Categories Meta
export async function dbGetAgeCategories() {
  try {
    const client = getActiveDb();
    const { data, error } = await client.from('age_categories').select('*').order('name', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'age_categories');
    return (data || []) as AgeCategoryData[];
  } catch (err) {
    return [];
  }
}

export async function dbAddAgeCategory(ageCat: AgeCategoryData) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('age_categories').upsert([ageCat]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `age_categories/${ageCat.id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbDeleteAgeCategory(id: string) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('age_categories').delete().eq('id', id);
    if (error) return handleSupabaseError(error, OperationType.DELETE, `age_categories/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbDeleteMember(id: string) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('members').delete().eq('id', id);
    if (error) return handleSupabaseError(error, OperationType.DELETE, `members/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbBatchUpdateMemberFields(
  fieldIdName: 'daerah_id' | 'desa_id' | 'kelompok_id' | 'age_category_id',
  idValue: string,
  fieldNameMap: 'daerah_name' | 'desa_name' | 'kelompok_name' | 'age_category_name',
  newFieldNameValue: string
) {
  return true;
}



// 14. Real-time Subscription Observers for Cost-Optimization and Instant Sync
export function dbSubscribeMembers(callback: (members: AbsensiMember[]) => void, onError: (err: any) => void) {
  // Free tier budget optimization: Only load members once on mount, no active subscription
  dbGetMembers().then(callback).catch(onError);
  return () => {};
}

export function dbSubscribeDaerahs(callback: (data: DaerahData[]) => void, onError: (err: any) => void) {
  // Free tier budget optimization: Only load daerahs once on mount, no active subscription
  dbGetDaerahs().then(callback).catch(onError);
  return () => {};
}

export function dbSubscribeDesas(callback: (data: DesaData[]) => void, onError: (err: any) => void) {
  // Free tier budget optimization: Only load desas once on mount, no active subscription
  dbGetDesas().then(callback).catch(onError);
  return () => {};
}

export function dbSubscribeKelompoks(callback: (data: KelompokData[]) => void, onError: (err: any) => void) {
  // Free tier budget optimization: Only load kelompoks once on mount, no active subscription
  dbGetKelompoks().then(callback).catch(onError);
  return () => {};
}

export function dbSubscribeAgeCategories(callback: (data: AgeCategoryData[]) => void, onError: (err: any) => void) {
  // Free tier budget optimization: Only load age categories once on mount, no active subscription
  dbGetAgeCategories().then(callback).catch(onError);
  return () => {};
}

export function dbSubscribeAttendanceLogs(limitCount: number, callback: (logs: AttendanceLog[]) => void, onError: (err: any) => void) {
  dbGetAttendanceLogs(limitCount).then(callback).catch(onError);
  
  const client = getActiveDb();
  const sub = client
    .channel('realtime_logs')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
      dbGetAttendanceLogs(limitCount).then(callback).catch(onError);
    })
    .subscribe();

  return () => {
    sub.unsubscribe();
  };
}



// compatible onAuthStateChanged mapper
export function onAuthStateChanged(authInstance: any, callback: (user: any) => void) {
  try {
    const client = getActiveDb();
    
    // Subscribe to auth events
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        callback({
          uid: session.user.id,
          email: session.user.email,
          displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
        });
      } else {
        callback(null);
      }
    });

    // Run initial retrieval
    client.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        callback({
          uid: session.user.id,
          email: session.user.email,
          displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
        });
      } else {
        callback(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  } catch (err) {
    console.warn("Auth initialization skipped until URL keys set.");
    callback(null);
    return () => {};
  }
}

// Run test connections and boot sequencers safely
try {
  seedInitialDataIfNeeded();
} catch (e) {
  console.warn("Startup seeding delayed:", e);
}
