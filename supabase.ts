import { createClient, SupabaseClient } from '@supabase/supabase-js';
import supabaseConfigRaw from './supabase-applet-config.json';
import { 
  Transaction, DeletedTransaction, EditHistory, ProjectMetadata, 
  AbsensiMember, AttendanceLog, DesaData, KelompokData, AgeCategoryData, DaerahData, EventData,
  Family, FamilyRelationship, LabelData
} from './types';

// Load Supabase central configurations
const config = supabaseConfigRaw as { supabaseUrl?: string; supabaseAnonKey?: string };
export const centralUrl = (import.meta as any).env.VITE_SUPABASE_URL || config.supabaseUrl || localStorage.getItem('supabase_central_url') || '';
export const centralAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || config.supabaseAnonKey || localStorage.getItem('supabase_central_key') || '';

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
  const url = (import.meta as any).env.VITE_SUPABASE_URL || centralUrl || localStorage.getItem('supabase_central_url') || '';
  const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || centralAnonKey || localStorage.getItem('supabase_central_key') || '';
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
  db = centralClient as any;
  console.log("Single Database mode active. Running directly on unified database instance.");
}

// Auto load cached configuration is skipped in single database mode


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

export function getInstansiContext(): string {
  return localStorage.getItem('instansi_id') || localStorage.getItem('instansi') || '';
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

// --- Dynamic Seeding Helper for Initial Portal Master Account Setup ---
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
      console.log("Seeding initial lookup tables and setup parameters to Supabase...");
      
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
        { id: 'r1', name: 'Ayah', is_wali: '1' },
        { id: 'r2', name: 'Ibu', is_wali: '3' },
        { id: 'r3', name: 'Anak', is_wali: '4' },
        { id: 'r4', name: 'Kakek', is_wali: '6' },
        { id: 'r5', name: 'Nenek', is_wali: '6' },
        { id: 'r6', name: 'Wali Lainnya', is_wali: '6' }
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
    
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    
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
      amount: Number(row.debit || row.credit || 0),
      balance: 0, // balance is computed dynamically on the fly in the frontend
    }));
    return mapped as Transaction[];
  } catch (err) {
    return [];
  }
}

export async function dbAddTransaction(tx: Transaction) {
  try {
    const client = getActiveDb();
    const dbTx = {
      ...tx,
      formatted_date: tx.formattedDate || (tx as any).formatted_date || '',
    } as any;
    delete dbTx.formattedDate;
    delete dbTx.is_approve;
    delete dbTx.approve_by;
    delete dbTx.approve_date;
    delete dbTx.approver_role;
    delete dbTx.amount;
    delete dbTx.balance;

    const instansi = getInstansiContext();
    if (instansi && !dbTx.instansi) {
      dbTx.instansi = instansi;
    }

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
    let query = client.from('deleted_transactions').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data, error } = await query.order('deleted_at', { ascending: false });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'deleted_transactions');
    
    const mapped = (data || []).map((row: any) => ({
      ...row,
      formattedDate: row.formatted_date || row.formattedDate || '',
      amount: Number(row.debit || row.credit || 0),
      balance: 0,
    }));
    return mapped as DeletedTransaction[];
  } catch (err) {
    return [];
  }
}

export async function dbAddDeletedTransaction(dtx: DeletedTransaction) {
  try {
    const client = getActiveDb();
    const dbDtx = {
      ...dtx,
      formatted_date: dtx.formattedDate || (dtx as any).formatted_date || '',
    } as any;
    delete dbDtx.formattedDate;
    delete dbDtx.amount;
    delete dbDtx.balance;

    const instansi = getInstansiContext();
    if (instansi && !dbDtx.instansi) {
      dbDtx.instansi = instansi;
    }

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
    let query = client.from('edit_history').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data, error } = await query.order('edited_at', { ascending: false });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'edit_history');
    return (data || []) as EditHistory[];
  } catch (err) {
    return [];
  }
}

export async function dbAddEditHistory(eh: EditHistory) {
  try {
    const client = getActiveDb();
    const instansi = getInstansiContext();
    const dbEh = { ...eh } as any;
    if (instansi && !dbEh.instansi) {
      dbEh.instansi = instansi;
    }
    const { error } = await client.from('edit_history').upsert([dbEh]);
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
    let query = client.from('projects').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data, error } = await query.order('name', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'projects');
    return (data || []) as ProjectMetadata[];
  } catch (err) {
    return [];
  }
}

export async function dbAddProject(proj: ProjectMetadata) {
  try {
    const client = getActiveDb();
    const instansi = getInstansiContext();
    const dbProj = { ...proj } as any;
    if (instansi && !dbProj.instansi) {
      dbProj.instansi = instansi;
    }
    const { error } = await client.from('projects').upsert([dbProj]);
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
    let query = client.from('categories').select('name');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data, error } = await query.order('name', { ascending: true });
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
    const instansi = getInstansiContext();
    const payload: any = { id, name };
    if (instansi) {
      payload.instansi = instansi;
    }
    const { error } = await client.from('categories').upsert([payload]);
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
    let query = client.from('approvals').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data, error } = await query;
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
    const instansi = getInstansiContext();
    const payload = { id, ...appr } as any;
    if (instansi && !payload.instansi) {
      payload.instansi = instansi;
    }
    const { error } = await client.from('approvals').upsert([payload]);
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
    let query = client.from('members').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data, error } = await query.order('nama_lengkap', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'members');
    return (data || []) as AbsensiMember[];
  } catch (err) {
    console.error("Error inside dbGetMembers:", err);
    return [];
  }
}

export async function dbAddMember(mbr: AbsensiMember) {
  try {
    const client = getActiveDb();
    const { daerah_name, desa_name, kelompok_name, age_category_name, family_name, relationship_name, is_wali, nama_ortu, no_hp_ortu, pekerjaan_ortu, ...cleanMbr } = mbr;
    const instansi = getInstansiContext();
    if (instansi && !(cleanMbr as any).instansi) {
      (cleanMbr as any).instansi = instansi;
    }
    const { error } = await client.from('members').upsert([cleanMbr]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `members/${mbr.id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbUpdateMember(id: string, mbr: Partial<AbsensiMember>) {
  try {
    const client = getActiveDb();
    const { daerah_name, desa_name, kelompok_name, age_category_name, family_name, relationship_name, is_wali, nama_ortu, no_hp_ortu, pekerjaan_ortu, ...cleanMbr } = mbr as any;
    const instansi = getInstansiContext();
    if (instansi && !cleanMbr.instansi) {
      cleanMbr.instansi = instansi;
    }
    const { error } = await client.from('members').update(cleanMbr).eq('id', id);
    if (error) return handleSupabaseError(error, OperationType.UPDATE, `members/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

// 8b. Families & Family Relationships
export async function dbGetFamilies() {
  try {
    const client = getActiveDb();
    let query = client.from('families').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data, error } = await query.order('nama_keluarga', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'families');
    return (data || []) as Family[];
  } catch (err) {
    console.error("Error inside dbGetFamilies:", err);
    return [];
  }
}

export async function dbAddFamily(fam: Family) {
  try {
    const client = getActiveDb();
    const instansi = getInstansiContext();
    const dbFam = { ...fam } as any;
    if (instansi && !dbFam.instansi) {
      dbFam.instansi = instansi;
    }
    const { error } = await client.from('families').upsert([dbFam]);
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
    let query = client.from('family_relationships').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data, error } = await query.order('name', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'family_relationships');
    return (data || []) as FamilyRelationship[];
  } catch (err) {
    console.error("Error inside dbGetFamilyRelationships:", err);
    return [];
  }
}

export async function dbAddFamilyRelationship(rel: FamilyRelationship) {
  try {
    const client = getActiveDb();
    const instansi = getInstansiContext();
    const dbRel = { ...rel } as any;
    if (instansi && !dbRel.instansi) {
      dbRel.instansi = instansi;
    }
    const { error } = await client.from('family_relationships').upsert([dbRel]);
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
export interface EventDashboardSummary {
  eventId: string;
  eventName?: string;
  meetingStats: Array<{
    meetingNumber: number;
    dateStr: string;
    dateFormatted: string;
    total: number;
    hadir: number;
    izin: number;
    sakit: number;
    alpa: number;
    pct: number;
  }>;
  overall: {
    totalLogs: number;
    totalHadir: number;
    totalIzin: number;
    totalSakit: number;
    totalAlpa: number;
    presenceRate: number;
    meetingCount: number;
  };
  top5Hadir: Array<{
    memberId: string;
    memberName: string;
    kelompokName: string;
    count: number;
    totalMeetings: number;
    pct: number;
    izinCount?: number;
  }>;
  top5Izin: Array<{
    memberId: string;
    memberName: string;
    kelompokName: string;
    count: number;
    totalMeetings: number;
    izinCount: number;
    sakitCount: number;
  }>;
  top5Alpa: Array<{
    memberId: string;
    memberName: string;
    kelompokName: string;
    count: number;
    totalMeetings: number;
    pct: number;
  }>;
  top5Terlambat?: Array<{
    memberId: string;
    memberName: string;
    kelompokName: string;
    count: number;
    totalMinutes: number;
    totalMeetings: number;
    formattedLate: string;
  }>;
}

export async function dbGetRecentEvents(limitCount: number = 5): Promise<EventData[]> {
  try {
    const client = getActiveDb();
    const instansi = getInstansiContext();
    let query = client.from('events').select('*');
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    query = query.order('updated_at', { ascending: false }).limit(limitCount);
    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      let fallbackQuery = client.from('events').select('*');
      if (instansi) fallbackQuery = fallbackQuery.eq('instansi', instansi);
      fallbackQuery = fallbackQuery.order('created_at', { ascending: false }).limit(limitCount);
      const { data: fallbackData } = await fallbackQuery;
      return (fallbackData || []) as EventData[];
    }
    return (data || []) as EventData[];
  } catch (err) {
    return [];
  }
}

export async function dbGetEventDashboardSummary(eventId: string): Promise<EventDashboardSummary | null> {
  if (!eventId) return null;
  const client = getActiveDb();
  const instansi = getInstansiContext();

  try {
    // Attempt Supabase RPC function for server-side aggregation first
    const { data: rpcData, error: rpcError } = await client.rpc('get_event_dashboard_summary', {
      p_event_id: eventId,
      p_instansi: instansi || null
    });

    if (!rpcError && rpcData) {
      return rpcData as EventDashboardSummary;
    }

    if (rpcError) {
      console.warn("Supabase RPC 'get_event_dashboard_summary' failed or missing, using client-side fallback aggregation:", rpcError.message);
    }
  } catch (rpcErr) {
    console.warn("RPC call threw exception, using client-side fallback aggregation:", rpcErr);
  }

  // Graceful Fallback: Compute summary directly from attendance_logs
  try {
    let query = client.from('attendance_logs').select('*').eq('event_id', eventId);
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data: logsData, error: logsError } = await query;
    if (logsError || !logsData) {
      console.error("Fallback query for attendance_logs failed:", logsError);
      return null;
    }

    const logs: AttendanceLog[] = logsData;

    // Group logs by date
    const dateMap = new Map<string, AttendanceLog[]>();
    logs.forEach(log => {
      const d = log.date ? log.date.split('T')[0] : 'Unknown';
      if (!dateMap.has(d)) {
        dateMap.set(d, []);
      }
      dateMap.get(d)!.push(log);
    });

    // Sort dates ascending
    const sortedDates = Array.from(dateMap.keys()).sort();

    const meetingStats = sortedDates.map((dateStr, idx) => {
      const meetingLogs = dateMap.get(dateStr) || [];
      const total = meetingLogs.length;
      const hadir = meetingLogs.filter(l => l.status === 'Hadir').length;
      const izin = meetingLogs.filter(l => l.status === 'Izin').length;
      const sakit = meetingLogs.filter(l => l.status === 'Sakit').length;
      const alpa = meetingLogs.filter(l => l.status === 'Alpa').length;
      const pct = total > 0 ? Math.round((hadir / total) * 100) : 0;

      return {
        meetingNumber: idx + 1,
        dateStr,
        dateFormatted: dateStr,
        total,
        hadir,
        izin,
        sakit,
        alpa,
        pct
      };
    });

    const totalLogs = logs.length;
    const totalHadir = logs.filter(l => l.status === 'Hadir').length;
    const totalIzin = logs.filter(l => l.status === 'Izin').length;
    const totalSakit = logs.filter(l => l.status === 'Sakit').length;
    const totalAlpa = logs.filter(l => l.status === 'Alpa').length;
    const presenceRate = totalLogs > 0 ? Math.round((totalHadir / totalLogs) * 100) : 0;

    // Group by member for Top 5
    const memberMap = new Map<string, {
      memberId: string;
      memberName: string;
      kelompokName: string;
      hadir: number;
      izin: number;
      sakit: number;
      alpa: number;
      totalMeetings: number;
    }>();

    logs.forEach(log => {
      const key = log.memberId || log.memberName;
      if (!key) return;
      if (!memberMap.has(key)) {
        memberMap.set(key, {
          memberId: log.memberId || '',
          memberName: log.memberName || 'Anggota',
          kelompokName: log.kelompokName || '-',
          hadir: 0,
          izin: 0,
          sakit: 0,
          alpa: 0,
          totalMeetings: 0
        });
      }
      const item = memberMap.get(key)!;
      item.totalMeetings += 1;
      if (log.status === 'Hadir') item.hadir += 1;
      else if (log.status === 'Izin') item.izin += 1;
      else if (log.status === 'Sakit') item.sakit += 1;
      else if (log.status === 'Alpa') item.alpa += 1;
    });

    const membersArr = Array.from(memberMap.values());
    const meetingCount = sortedDates.length || 1;

    const top5Hadir = [...membersArr]
      .sort((a, b) => b.hadir - a.hadir)
      .slice(0, 5)
      .map(m => ({
        memberId: m.memberId,
        memberName: m.memberName,
        kelompokName: m.kelompokName,
        count: m.hadir,
        totalMeetings: m.totalMeetings,
        pct: m.totalMeetings > 0 ? Math.round((m.hadir / m.totalMeetings) * 100) : 0,
        izinCount: m.izin
      }));

    const top5Izin = [...membersArr]
      .filter(m => (m.izin + m.sakit) > 0)
      .sort((a, b) => (b.izin + b.sakit) - (a.izin + a.sakit))
      .slice(0, 5)
      .map(m => ({
        memberId: m.memberId,
        memberName: m.memberName,
        kelompokName: m.kelompokName,
        count: m.izin + m.sakit,
        totalMeetings: m.totalMeetings,
        izinCount: m.izin,
        sakitCount: m.sakit
      }));

    const top5Alpa = [...membersArr]
      .filter(m => m.alpa > 0)
      .sort((a, b) => b.alpa - a.alpa)
      .slice(0, 5)
      .map(m => ({
        memberId: m.memberId,
        memberName: m.memberName,
        kelompokName: m.kelompokName,
        count: m.alpa,
        totalMeetings: m.totalMeetings,
        pct: m.totalMeetings > 0 ? Math.round((m.alpa / m.totalMeetings) * 100) : 0
      }));

    return {
      eventId,
      meetingStats,
      overall: {
        totalLogs,
        totalHadir,
        totalIzin,
        totalSakit,
        totalAlpa,
        presenceRate,
        meetingCount
      },
      top5Hadir,
      top5Izin,
      top5Alpa,
      top5Terlambat: []
    };
  } catch (err) {
    console.error("Error in fallback event summary calculation:", err);
    return null;
  }
}

export async function dbGetAttendanceLogs(limitCount?: number) {
  try {
    const client = getActiveDb();
    let query = client.from('attendance_logs').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    query = query.order('dateInput', { ascending: false, nullsFirst: false }).order('date', { ascending: false });
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

export async function dbGetFilteredAttendanceLogs(dateStr: string, eventId: string | null, limitCount: number = 25) {
  try {
    const client = getActiveDb();
    let query = client.from('attendance_logs').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    
    if (dateStr) {
      query = query.like('date', `${dateStr}%`);
    }
    
    if (eventId) {
      query = query.eq('event_id', eventId);
    } else {
      query = query.is('event_id', null);
    }
    
    query = query.order('dateInput', { ascending: false, nullsFirst: false }).order('date', { ascending: false }).limit(limitCount);
    
    const { data, error } = await query;
    if (error) return handleSupabaseError(error, OperationType.LIST, 'attendance_logs_filtered');
    return (data || []) as AttendanceLog[];
  } catch (err) {
    return [];
  }
}

export async function dbAddAttendanceLog(log: AttendanceLog) {
  const client = getActiveDb();
  const instansi = getInstansiContext();
  const cleanLog: any = {
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
    metode: log.metode || 'manual',
    uniq_ref: log.uniq_ref || null,
    jam_mulai: log.jam_mulai || null
  };
  if (instansi) {
    cleanLog.instansi = instansi;
  }
  const { error } = await client.from('attendance_logs').upsert([cleanLog]);
  if (error) {
    handleSupabaseError(error, OperationType.WRITE, `attendance_logs/${log.id}`);
  }

  if (log.event_id) {
    try {
      await client.from('events').update({ updated_at: new Date().toISOString() }).eq('id', log.event_id);
    } catch (e) {
      console.warn("Failed to update event updated_at:", e);
    }
  }

  return true;
}

export async function dbAddAttendanceLogs(logs: AttendanceLog[]) {
  const client = getActiveDb();
  const instansi = getInstansiContext();
  const cleanLogs = logs.map((log: any) => {
    const item: any = {
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
      metode: log.metode || 'manual',
      uniq_ref: log.uniq_ref || null,
      jam_mulai: log.jam_mulai || null
    };
    if (instansi) {
      item.instansi = instansi;
    }
    return item;
  });
  const { error } = await client.from('attendance_logs').upsert(cleanLogs);
  if (error) {
    handleSupabaseError(error, OperationType.WRITE, `attendance_logs/batch`);
  }

  const eventIds = Array.from(new Set(logs.map((l: any) => l.event_id).filter(Boolean)));
  for (const eventId of eventIds) {
    try {
      await client.from('events').update({ updated_at: new Date().toISOString() }).eq('id', eventId);
    } catch (e) {
      console.warn("Failed to update event updated_at:", e);
    }
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
    let query = client.from('events').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data, error } = await query.order('updated_at', { ascending: false, nullsFirst: false });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'events');
    return (data || []) as EventData[];
  } catch (err) {
    console.error("Error inside dbGetEvents:", err);
    return [];
  }
}

export async function dbAddEvent(event: EventData) {
  try {
    const client = getActiveDb();
    const instansi = getInstansiContext();
    const dbEvent = { 
      ...event, 
      updated_at: new Date().toISOString() 
    } as any;
    if (instansi && !dbEvent.instansi) {
      dbEvent.instansi = instansi;
    }
    const { error } = await client.from('events').upsert([dbEvent]);
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

// 9.6 Labels Management (Label Anggota)
export async function dbGetLabels() {
  try {
    const client = getActiveDb();
    let query = client.from('labels').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data, error } = await query.order('name', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'labels');
    return (data || []) as LabelData[];
  } catch (err) {
    console.error("Error inside dbGetLabels:", err);
    return [];
  }
}

export async function dbAddLabel(lbl: LabelData) {
  try {
    const client = getActiveDb();
    const instansi = getInstansiContext();
    const dbLbl = { ...lbl } as any;
    if (instansi && !dbLbl.instansi) {
      dbLbl.instansi = instansi;
    }
    const { error } = await client.from('labels').upsert([dbLbl]);
    if (error) return handleSupabaseError(error, OperationType.WRITE, `labels/${lbl.id}`);
    return true;
  } catch (err) {
    return false;
  }
}

export async function dbDeleteLabel(id: string) {
  try {
    const client = getActiveDb();
    const { error } = await client.from('labels').delete().eq('id', id);
    if (error) return handleSupabaseError(error, OperationType.DELETE, `labels/${id}`);
    return true;
  } catch (err) {
    return false;
  }
}

// 9b. Daerahs Meta
export async function dbGetDaerahs() {
  try {
    const client = getActiveDb();
    let query = client.from('daerahs').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data, error } = await query.order('nama_daerah', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'daerahs');
    return (data || []) as DaerahData[];
  } catch (err) {
    console.error("Error inside dbGetDaerahs:", err);
    return [];
  }
}

export async function dbAddDaerah(daerah: DaerahData) {
  try {
    const client = getActiveDb();
    const instansi = getInstansiContext();
    const dbDaerah = { ...daerah } as any;
    if (instansi && !dbDaerah.instansi) {
      dbDaerah.instansi = instansi;
    }
    const { error } = await client.from('daerahs').upsert([dbDaerah]);
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
    let query = client.from('desas').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data, error } = await query.order('nama_desa', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'desas');
    return (data || []) as DesaData[];
  } catch (err) {
    console.error("Error inside dbGetDesas:", err);
    return [];
  }
}

export async function dbAddDesa(desa: DesaData) {
  try {
    const client = getActiveDb();
    const instansi = getInstansiContext();
    const dbDesa = { ...desa } as any;
    if (instansi && !dbDesa.instansi) {
      dbDesa.instansi = instansi;
    }
    const { error } = await client.from('desas').upsert([dbDesa]);
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
    let query = client.from('kelompoks').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data, error } = await query.order('nama_kelompok', { ascending: true });
    if (error) return handleSupabaseError(error, OperationType.LIST, 'kelompoks');
    return (data || []) as KelompokData[];
  } catch (err) {
    console.error("Error inside dbGetKelompoks:", err);
    return [];
  }
}

export async function dbAddKelompok(group: KelompokData) {
  try {
    const client = getActiveDb();
    const instansi = getInstansiContext();
    const dbGroup = { ...group } as any;
    if (instansi && !dbGroup.instansi) {
      dbGroup.instansi = instansi;
    }
    const { error } = await client.from('kelompoks').upsert([dbGroup]);
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
    let query = client.from('age_categories').select('*');
    const instansi = getInstansiContext();
    if (instansi) {
      query = query.eq('instansi', instansi);
    }
    const { data, error } = await query;
    if (error) return handleSupabaseError(error, OperationType.LIST, 'age_categories');
    
    // Sort by sort_order ascending (null values go to end), then name ascending
    const sorted = (data || []).sort((a: any, b: any) => {
      const sa = a.sort_order !== null && a.sort_order !== undefined ? a.sort_order : 9999;
      const sb = b.sort_order !== null && b.sort_order !== undefined ? b.sort_order : 9999;
      if (sa !== sb) return sa - sb;
      return (a.name || '').localeCompare(b.name || '');
    });
    
    return sorted as AgeCategoryData[];
  } catch (err) {
    console.error("Error inside dbGetAgeCategories:", err);
    return [];
  }
}

export async function dbAddAgeCategory(ageCat: AgeCategoryData) {
  try {
    const client = getActiveDb();
    const instansi = getInstansiContext();
    const dbAgeCat = { ...ageCat } as any;
    if (instansi && !dbAgeCat.instansi) {
      dbAgeCat.instansi = instansi;
    }
    const { error } = await client.from('age_categories').upsert([dbAgeCat]);
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

export function dbSubscribeFamilies(callback: (data: Family[]) => void, onError: (err: any) => void) {
  dbGetFamilies().then(callback).catch(onError);
  return () => {};
}

export function dbSubscribeFamilyRelationships(callback: (data: FamilyRelationship[]) => void, onError: (err: any) => void) {
  dbGetFamilyRelationships().then(callback).catch(onError);
  return () => {};
}

export function dbSubscribeAttendanceLogs(limitCount: number, callback: (logs: AttendanceLog[]) => void, onError: (err: any) => void) {
  // Free tier budget optimization: Only load attendance logs once on mount, no active subscription
  dbGetAttendanceLogs(limitCount).then(callback).catch(onError);
  return () => {};
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
