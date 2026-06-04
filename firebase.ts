import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, 
  collection, getDocFromServer, initializeFirestore, persistentLocalCache, 
  persistentMultipleTabManager, query, where, writeBatch, orderBy, limit,
  onSnapshot, runTransaction 
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { 
  Transaction, DeletedTransaction, EditHistory, ProjectMetadata, 
  AbsensiMember, AttendanceLog, DesaData, KelompokData, AgeCategoryData, DaerahData 
} from './types';

// Initialize Firebase Central App/Database (Master Directory for Accounts)
const centralApp = initializeApp(firebaseConfig);
const centralDbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

export const centralDb = centralDbId 
  ? initializeFirestore(centralApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    }, centralDbId)
  : initializeFirestore(centralApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });

export const auth = getAuth(centralApp);

// Active operational database. Defaults to centralDb, but changes to the institution's DB when logged in.
export let db = centralDb;

// Helper definitions for Separated Databases Layout (under one project)
// - web bendahara : /treasurer-web/data/<collectionName>/<documentId>
// - web absensi   : /attendance-web/data/<collectionName>/<documentId>
export function getCollectionRef(colName: string) {
  const bendaharaCols = ['transactions', 'deletedTransactions', 'editHistory', 'projects', 'categories', 'approvals'];
  const absensiCols = ['members', 'attendanceLogs', 'desas', 'kelompoks', 'ageCategories', 'daerahs', 'attendanceSummaries'];
  
  if (bendaharaCols.includes(colName)) {
    return collection(db, `treasurer-web/data/${colName}`);
  } else if (absensiCols.includes(colName)) {
    return collection(db, `attendance-web/data/${colName}`);
  } else {
    return collection(db, colName);
  }
}

export function getDocRef(colName: string, docId: string) {
  const bendaharaCols = ['transactions', 'deletedTransactions', 'editHistory', 'projects', 'categories', 'approvals'];
  const absensiCols = ['members', 'attendanceLogs', 'desas', 'kelompoks', 'ageCategories', 'daerahs', 'attendanceSummaries'];
  
  if (bendaharaCols.includes(colName)) {
    return doc(db, `treasurer-web/data/${colName}/${docId}`);
  } else if (absensiCols.includes(colName)) {
    return doc(db, `attendance-web/data/${colName}/${docId}`);
  } else {
    return doc(db, colName, docId);
  }
}

// Helper to get active Firestore instance for a specific configuration
export function getFirestoreForConfig(config: any | null) {
  if (!config || !config.projectId || config.projectId === firebaseConfig.projectId) {
    return centralDb;
  }
  try {
    const appName = `instansi_${config.projectId}`;
    let appInstance;
    const existingApps = getApps();
    const foundApp = existingApps.find(a => a.name === appName);
    const dbId = config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
      ? config.firestoreDatabaseId
      : undefined;
    if (foundApp) {
      appInstance = foundApp;
      return dbId ? getFirestore(appInstance, dbId) : getFirestore(appInstance);
    } else {
      appInstance = initializeApp(config, appName);
      return initializeFirestore(appInstance, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      }, dbId);
    }
  } catch (err) {
    console.error("Failed to connect to dynamic institution database, using Central Db fallback:", err);
    return centralDb;
  }
}

export let activeAuth = auth;

export function getAuthForConfig(config: any | null) {
  if (!config || !config.projectId || config.projectId === firebaseConfig.projectId) {
    return auth;
  }
  try {
    const appName = `instansi_${config.projectId}`;
    let appInstance;
    const existingApps = getApps();
    const foundApp = existingApps.find(a => a.name === appName);
    if (foundApp) {
      appInstance = foundApp;
    } else {
      appInstance = initializeApp(config, appName);
    }
    return getAuth(appInstance);
  } catch (err) {
    console.error("Failed to connect to dynamic institution auth:", err);
    return auth;
  }
}

// Export initializeDynamicDb to allow App component to register a separate tenant database project
export function initializeDynamicDb(config: any | null) {
  db = getFirestoreForConfig(config);
  activeAuth = getAuthForConfig(config);
  console.log("Dynamically initialized active operational database connection and credentials session.");
}

// Operational Error Enums and Custom Handlers
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL CONSTRAINT: Test connection to Firestore on boot
export async function testConnection() {
  try {
    // Reading from 'instansi' path which is publicly allowed (allow read: if true)
    // to avoid false negatives / permission-denied blocks from security rules
    await getDocFromServer(doc(centralDb, 'instansi', '_test_connection'));
    console.log("Firebase connection established successfully.");
  } catch (error) {
    if (error instanceof Error) {
      console.warn("Firebase testing error detail:", error.message);
      if (error.message.includes('the client is offline') || error.message.includes('Failed to get document')) {
        console.error("Please check your Firebase configuration. Client is offline. Ensure that Cloud Firestore is created and enabled in your Firebase Console for project 'catetin-354', and that your API key is not restricted from 'Cloud Firestore API'.");
      }
    }
  }
}

// --- Dynamic Seeding Helper for initial login convenience ---
export async function seedInitialDataIfNeeded() {
  try {
    const superRef = doc(centralDb, 'users', 'superadmin');
    const docSnap = await getDoc(superRef);
    if (!docSnap.exists()) {
      // Seed default accounts
      await setDoc(doc(centralDb, 'users', 'superadmin'), {
        username: 'superadmin',
        password: 'superadmin354', // plain-text or hashed password for compatibility with existing UI
        full_name: 'Super Admin Portal',
        role: 'Superadmin',
        original_role: 'Superadmin',
        instansi: 'Catet-In (Master)',
        web_access: 'bendahara,absensi'
      });
      // Seed default categories
      const categories = ['Konsumsi', 'Operasional', 'Peralatan', 'Transportasi', 'Sponsorship', 'Dana Hibah', 'Lain-lain'];
      for (const cat of categories) {
        await setDoc(getDocRef('categories', cat.toLowerCase().replace(/ /g, '_')), {
          name: cat
        });
      }
      // Seed general settings or master data
      await setDoc(getDocRef('projects', 'kas_umum'), {
        name: 'KAS UMUM',
        created_at: new Date().toISOString(),
        status: 'Aktif'
      });
      // Seed Desas, Kelompoks, Ages
      await setDoc(getDocRef('desas', 'd1'), { id: 'd1', nama_desa: 'Salak Krajan', pimpinan: 'Bpk. Ahmad', alamat: 'RT 01 RW 02' });
      await setDoc(getDocRef('kelompoks', 'k1'), { id: 'k1', nama_kelompok: 'Kelompok Utara', pimpinan: 'Sdr. Bagus', keterangan: 'Muda mudi wilayah utara' });
      await setDoc(getDocRef('ageCategories', 'a1'), { id: 'a1', name: 'Remaja', description: 'Usia 13-17 tahun' });
      
      console.log('Firebase Database seeded successfully with default Admin, projects, and metadata on Central DB.');
    }
  } catch (e: any) {
    if (e?.code === 'permission-denied' || e?.message?.includes('permission')) {
      console.log('Central Database is secured. Seeding skipped.');
    } else {
      console.warn('Initial seeding was skipped or failed:', e);
    }
  }
}

// Run test connection right away (non-blocking)
testConnection();
seedInitialDataIfNeeded();

// Bootstrap dynamic connection from localStorage if it exists during initial package load
try {
  const savedConfigStr = localStorage.getItem('instansi_db_config');
  if (savedConfigStr) {
    const config = JSON.parse(savedConfigStr);
    initializeDynamicDb(config);
  }
} catch (e) {
  console.error("Failed to load saved dynamic database configuration on boot:", e);
}

// --- Firestore General CRUD Wrappers with type integrity & centralized logging ---

// 1. Users Operations (Always run on centralDb because the users list database is master)
export async function dbGetUserDoc(uid: string) {
  const collectionName = 'users';
  try {
    const d = doc(centralDb, collectionName, uid);
    const snap = await getDoc(d);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    return handleFirestoreError(err, OperationType.GET, `${collectionName}/${uid}`);
  }
}

export async function dbGetUser(username: string) {
  const collectionName = 'users';
  try {
    const d = doc(centralDb, collectionName, username.toLowerCase().trim());
    const snap = await getDoc(d);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    return handleFirestoreError(err, OperationType.GET, `${collectionName}/${username}`);
  }
}

export async function dbUpdateUserPassword(username: string, pass: string) {
  const collectionName = 'users';
  try {
    const d = doc(centralDb, collectionName, username.toLowerCase().trim());
    await updateDoc(d, { password: pass });
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${username}`);
  }
}

// 2. Transactions Operations
export async function dbGetTransactions(limitDateStr?: string, projectName?: string, endDateStr?: string, createdAfterStr?: string) {
  const collectionName = 'transactions';
  try {
    const col = getCollectionRef(collectionName);
    let q = col as any;
    if (createdAfterStr) {
      q = query(col, where('created_at', '>=', createdAfterStr));
    } else if (projectName && limitDateStr && endDateStr) {
      q = query(col, where('project_name', '==', projectName), where('date', '>=', limitDateStr), where('date', '<=', endDateStr));
    } else if (projectName && limitDateStr) {
      q = query(col, where('project_name', '==', projectName), where('date', '>=', limitDateStr));
    } else if (projectName) {
      q = query(col, where('project_name', '==', projectName));
    } else if (limitDateStr && endDateStr) {
      q = query(col, where('date', '>=', limitDateStr), where('date', '<=', endDateStr));
    } else if (limitDateStr) {
      q = query(col, where('date', '>=', limitDateStr));
    }
    const snap = await getDocs(q);
    const items: Transaction[] = [];
    snap.forEach(d => {
      items.push({ id: d.id, ...(d.data() as any) });
    });
    return items;
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

export async function dbAddTransaction(tx: Transaction) {
  const collectionName = 'transactions';
  try {
    await setDoc(getDocRef(collectionName, tx.id), tx);
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${tx.id}`);
  }
}

export async function dbDeleteTransaction(id: string) {
  const collectionName = 'transactions';
  try {
    await deleteDoc(getDocRef(collectionName, id));
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

// 3. Deleted Transactions Audit
export async function dbGetDeletedTransactions() {
  const collectionName = 'deletedTransactions';
  try {
    const col = getCollectionRef(collectionName);
    const snap = await getDocs(col);
    const items: DeletedTransaction[] = [];
    snap.forEach(d => {
      items.push({ id: d.id, ...d.data() } as any);
    });
    return items;
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

export async function dbAddDeletedTransaction(dtx: DeletedTransaction) {
  const collectionName = 'deletedTransactions';
  try {
    await setDoc(getDocRef(collectionName, dtx.id), dtx);
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${dtx.id}`);
  }
}

// 4. Edits History Audit
export async function dbGetEditHistory() {
  const collectionName = 'editHistory';
  try {
    const col = getCollectionRef(collectionName);
    const snap = await getDocs(col);
    const items: EditHistory[] = [];
    snap.forEach(d => {
      items.push({ history_id: d.id, ...d.data() } as any);
    });
    return items;
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

export async function dbAddEditHistory(eh: EditHistory) {
  const collectionName = 'editHistory';
  try {
    await setDoc(getDocRef(collectionName, eh.history_id), eh);
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${eh.history_id}`);
  }
}

// 5. Projects
export async function dbGetProjects() {
  const collectionName = 'projects';
  try {
    const col = getCollectionRef(collectionName);
    const snap = await getDocs(col);
    const items: ProjectMetadata[] = [];
    snap.forEach(d => {
      items.push(d.data() as ProjectMetadata);
    });
    return items;
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

export async function dbAddProject(proj: ProjectMetadata) {
  const collectionName = 'projects';
  try {
    const docId = proj.name.toLowerCase().replace(/ /g, '_');
    await setDoc(getDocRef(collectionName, docId), proj);
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${proj.name}`);
  }
}

// 6. Categories
export async function dbGetCategories() {
  const collectionName = 'categories';
  try {
    const col = getCollectionRef(collectionName);
    const snap = await getDocs(col);
    const items: string[] = [];
    snap.forEach(d => {
      items.push(d.data().name as string);
    });
    return items;
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

export async function dbAddCategory(name: string) {
  const collectionName = 'categories';
  const docId = name.toLowerCase().replace(/ /g, '_');
  try {
    await setDoc(getDocRef(collectionName, docId), { name });
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${docId}`);
  }
}

// 7. Period Approvals
export async function dbGetApprovals() {
  const collectionName = 'approvals';
  try {
    const col = getCollectionRef(collectionName);
    const snap = await getDocs(col);
    const items: any[] = [];
    snap.forEach(d => {
      items.push(d.data());
    });
    return items;
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

export async function dbAddApproval(appr: any) {
  const collectionName = 'approvals';
  try {
    const id = `${appr.period_id}-${appr.project_name.toLowerCase().replace(/ /g, '_')}`;
    await setDoc(getDocRef(collectionName, id), appr);
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${appr.period_id}`);
  }
}

export async function dbDeleteApproval(periodId: string, projectName: string) {
  const collectionName = 'approvals';
  try {
    const id = `${periodId}-${projectName.toLowerCase().replace(/ /g, '_')}`;
    await deleteDoc(getDocRef(collectionName, id));
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${periodId}`);
  }
}

export async function dbUpdateProjectStatus(name: string, status: string) {
  const collectionName = 'projects';
  const docId = name.toLowerCase().replace(/ /g, '_');
  try {
    await updateDoc(getDocRef(collectionName, docId), { status });
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${docId}`);
  }
}

// 8. Attendance Members
export async function dbGetMembers() {
  const collectionName = 'members';
  try {
    const col = getCollectionRef(collectionName);
    const snap = await getDocs(col);
    const items: AbsensiMember[] = [];
    snap.forEach(d => {
      items.push(d.data() as AbsensiMember);
    });
    return items;
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

export async function dbAddMember(mbr: AbsensiMember) {
  const collectionName = 'members';
  try {
    await setDoc(getDocRef(collectionName, mbr.id), mbr);
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${mbr.id}`);
  }
}

export async function dbUpdateMember(id: string, mbr: Partial<AbsensiMember>) {
  const collectionName = 'members';
  try {
    await updateDoc(getDocRef(collectionName, id), mbr);
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
  }
}

// 9. Attendance Marking Logs
export async function dbGetAttendanceLogs(limitCount?: number) {
  const collectionName = 'attendanceLogs';
  try {
    const col = getCollectionRef(collectionName);
    let q = col as any;
    if (limitCount && limitCount > 0) {
      q = query(col, orderBy('date', 'desc'), limit(limitCount));
    } else {
      q = query(col, orderBy('date', 'desc'));
    }
    const snap = await getDocs(q);
    const items: AttendanceLog[] = [];
    snap.forEach(d => {
      items.push(d.data() as AttendanceLog);
    });
    return items;
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

export async function dbUpdateAttendanceSummaries(logs: AttendanceLog[], change: number) {
  if (logs.length === 0) return;
  const dbInst = db;

  // 1. Resolve missing fields (like gender, areas) for all logs by fetching members if needed
  const resolvedLogs: any[] = [];
  for (const log of logs) {
    let gender = (log as any).gender;
    let ageCategoryId = (log as any).ageCategoryId;
    let kelompokId = (log as any).kelompokId;
    let desaId = (log as any).desaId;
    let daerahId = (log as any).daerahId;

    if (!gender || !desaId || !kelompokId || !ageCategoryId || !daerahId) {
      try {
        const mSnap = await getDoc(getDocRef('members', log.memberId));
        if (mSnap.exists()) {
          const mData = mSnap.data();
          gender = gender || mData.jenis_kelamin || 'L';
          ageCategoryId = ageCategoryId || mData.age_category_id || 'Unknown';
          kelompokId = kelompokId || mData.kelompok_id || 'Unknown';
          desaId = desaId || mData.desa_id || 'Unknown';
          daerahId = daerahId || mData.daerah_id || 'Unknown';
        }
      } catch (err) {
        console.warn("Pre-resolve member details warning:", err);
      }
    }

    resolvedLogs.push({
      ...log,
      gender: gender || 'L',
      ageCategoryId: ageCategoryId || 'Unknown',
      kelompokId: kelompokId || 'Unknown',
      desaId: desaId || 'Unknown',
      daerahId: daerahId || 'Unknown'
    });
  }

  // 2. Group logs by core date (YYYY-MM-DD)
  const logsByDate: { [date: string]: any[] } = {};
  for (const log of resolvedLogs) {
    const rawDate = log.date || '';
    const d = rawDate.split(' ')[0] || rawDate.split('T')[0];
    if (d) {
      if (!logsByDate[d]) logsByDate[d] = [];
      logsByDate[d].push(log);
    }
  }

  // 3. Update summaries in a Firestore transaction per unique date
  const collectionName = 'attendanceSummaries';
  for (const [dateStr, dateLogs] of Object.entries(logsByDate)) {
    const docRef = getDocRef(collectionName, dateStr);
    try {
      await runTransaction(dbInst, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        let data: any = {
          date: dateStr,
          totalCount: 0,
          statusCounts: { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 },
          genderCounts: {},
          daerahCounts: {},
          desaCounts: {},
          kelompokCounts: {},
          ageCategoryCounts: {}
        };

        if (docSnap.exists()) {
          data = docSnap.data();
          if (!data.statusCounts) data.statusCounts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 };
          if (!data.genderCounts) data.genderCounts = {};
          if (!data.daerahCounts) data.daerahCounts = {};
          if (!data.desaCounts) data.desaCounts = {};
          if (!data.kelompokCounts) data.kelompokCounts = {};
          if (!data.ageCategoryCounts) data.ageCategoryCounts = {};
        }

        for (const log of dateLogs) {
          const status = log.status;
          if (!status) continue;

          // Normalize gender for statistics grouping
          const gender = log.gender === 'Laki-laki' || log.gender === 'L' ? 'L' : 'P';
          const ageId = log.ageCategoryId || 'Unknown';
          const kelompokId = log.kelompokId || 'Unknown';
          const desaId = log.desaId || 'Unknown';
          const daerahId = log.daerahId || 'Unknown';

          // A. Update global totals
          data.totalCount = Math.max(0, (data.totalCount || 0) + change);
          data.statusCounts[status] = Math.max(0, (data.statusCounts[status] || 0) + change);

          // B. Sub-map nested property updates
          const updateSubMap = (subMap: any, idKey: string) => {
            if (!subMap[idKey]) {
              subMap[idKey] = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 };
            }
            subMap[idKey][status] = Math.max(0, (subMap[idKey][status] || 0) + change);
          };

          updateSubMap(data.genderCounts, gender);
          updateSubMap(data.daerahCounts, daerahId);
          updateSubMap(data.desaCounts, desaId);
          updateSubMap(data.kelompokCounts, kelompokId);
          updateSubMap(data.ageCategoryCounts, ageId);
        }

        transaction.set(docRef, data);
      });
    } catch (err) {
      console.error(`Error updating daily summary transaction for date ${dateStr}:`, err);
    }
  }
}

export async function dbAddAttendanceLog(log: AttendanceLog) {
  const collectionName = 'attendanceLogs';
  try {
    const docRef = getDocRef(collectionName, log.id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      // It's an update! Re-align summary counts
      const oldLog = snap.data() as AttendanceLog;
      await dbUpdateAttendanceSummaries([oldLog], -1);
      await dbUpdateAttendanceSummaries([log], 1);
    } else {
      // New log! Add to summary
      await dbUpdateAttendanceSummaries([log], 1);
    }
    await setDoc(docRef, log);
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${log.id}`);
  }
}

export async function dbAddAttendanceLogs(logs: AttendanceLog[]) {
  const collectionName = 'attendanceLogs';
  try {
    const batch = writeBatch(db);
    for (const log of logs) {
      batch.set(getDocRef(collectionName, log.id), log);
    }
    await batch.commit();
    // Increment daily counts in batch
    await dbUpdateAttendanceSummaries(logs, 1);
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.WRITE, `${collectionName}/batch`);
  }
}

export async function dbDeleteAttendanceLog(id: string) {
  const collectionName = 'attendanceLogs';
  try {
    const docRef = getDocRef(collectionName, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const log = snap.data() as AttendanceLog;
      // Decrement counts in summary
      await dbUpdateAttendanceSummaries([log], -1);
      // Delete document
      await deleteDoc(docRef);
    }
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

// 9b. Daerahs (Regions) Meta
export async function dbGetDaerahs() {
  const collectionName = 'daerahs';
  try {
    const col = getCollectionRef(collectionName);
    const snap = await getDocs(col);
    const items: DaerahData[] = [];
    snap.forEach(d => {
      items.push(d.data() as DaerahData);
    });
    return items;
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

export async function dbAddDaerah(daerah: DaerahData) {
  const collectionName = 'daerahs';
  try {
    await setDoc(getDocRef(collectionName, daerah.id), daerah);
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${daerah.id}`);
  }
}

export async function dbDeleteDaerah(id: string) {
  const collectionName = 'daerahs';
  try {
    await deleteDoc(getDocRef(collectionName, id));
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

// 10. Desas (Villages) Meta
export async function dbGetDesas() {
  const collectionName = 'desas';
  try {
    const col = getCollectionRef(collectionName);
    const snap = await getDocs(col);
    const items: DesaData[] = [];
    snap.forEach(d => {
      items.push(d.data() as DesaData);
    });
    return items;
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

export async function dbAddDesa(desa: DesaData) {
  const collectionName = 'desas';
  try {
    await setDoc(getDocRef(collectionName, desa.id), desa);
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${desa.id}`);
  }
}

export async function dbDeleteDesa(id: string) {
  const collectionName = 'desas';
  try {
    await deleteDoc(getDocRef(collectionName, id));
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

// 11. Kelompoks (Groups) Meta
export async function dbGetKelompoks() {
  const collectionName = 'kelompoks';
  try {
    const col = getCollectionRef(collectionName);
    const snap = await getDocs(col);
    const items: KelompokData[] = [];
    snap.forEach(d => {
      items.push(d.data() as KelompokData);
    });
    return items;
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

export async function dbAddKelompok(group: KelompokData) {
  const collectionName = 'kelompoks';
  try {
    await setDoc(getDocRef(collectionName, group.id), group);
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${group.id}`);
  }
}

export async function dbDeleteKelompok(id: string) {
  const collectionName = 'kelompoks';
  try {
    await deleteDoc(getDocRef(collectionName, id));
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

// 12. Age Categories Meta
export async function dbGetAgeCategories() {
  const collectionName = 'ageCategories';
  try {
    const col = getCollectionRef(collectionName);
    const snap = await getDocs(col);
    const items: AgeCategoryData[] = [];
    snap.forEach(d => {
      items.push(d.data() as AgeCategoryData);
    });
    return items;
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

export async function dbAddAgeCategory(ageCat: AgeCategoryData) {
  const collectionName = 'ageCategories';
  try {
    await setDoc(getDocRef(collectionName, ageCat.id), ageCat);
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${ageCat.id}`);
  }
}

export async function dbDeleteAgeCategory(id: string) {
  const collectionName = 'ageCategories';
  try {
    await deleteDoc(getDocRef(collectionName, id));
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
  }
}
export async function dbDeleteMember(id: string) {
  const collectionName = 'members';
  try {
    await deleteDoc(getDocRef(collectionName, id));
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

export async function dbBatchUpdateMemberFields(
  fieldIdName: 'daerah_id' | 'desa_id' | 'kelompok_id' | 'age_category_id',
  idValue: string,
  fieldNameMap: 'daerah_name' | 'desa_name' | 'kelompok_name' | 'age_category_name',
  newFieldNameValue: string
) {
  const collectionName = 'members';
  try {
    const colRef = getCollectionRef(collectionName);
    const q = query(colRef, where(fieldIdName, '==', idValue));
    const snap = await getDocs(q);
    
    const docsToUpdate: { ref: any, id: string }[] = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data[fieldNameMap] !== newFieldNameValue) {
        docsToUpdate.push({ ref: docSnap.ref, id: docSnap.id });
      }
    });

    if (docsToUpdate.length === 0) return true;

    // Split into chunks of 500 automatically as requested
    const chunkSize = 500;
    for (let i = 0; i < docsToUpdate.length; i += chunkSize) {
      const chunk = docsToUpdate.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.update(item.ref, { [fieldNameMap]: newFieldNameValue });
      });
      await batch.commit();
    }
    return true;
  } catch (err) {
    return handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/batch_update`);
  }
}

// 14. Real-time Subscription Observers for Cost-Optimization and Instant Sync
export function dbSubscribeMembers(callback: (members: AbsensiMember[]) => void, onError: (err: any) => void) {
  const collectionName = 'members';
  const col = getCollectionRef(collectionName);
  return onSnapshot(col, (snap) => {
    const items: AbsensiMember[] = [];
    snap.forEach(d => {
      items.push(d.data() as AbsensiMember);
    });
    callback(items);
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.LIST, collectionName);
    } catch (e) {
      onError(e);
    }
  });
}

export function dbSubscribeDaerahs(callback: (data: DaerahData[]) => void, onError: (err: any) => void) {
  const collectionName = 'daerahs';
  const col = getCollectionRef(collectionName);
  return onSnapshot(col, (snap) => {
    const items: DaerahData[] = [];
    snap.forEach(d => {
      items.push(d.data() as DaerahData);
    });
    callback(items);
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.LIST, collectionName);
    } catch (e) {
      onError(e);
    }
  });
}

export function dbSubscribeDesas(callback: (data: DesaData[]) => void, onError: (err: any) => void) {
  const collectionName = 'desas';
  const col = getCollectionRef(collectionName);
  return onSnapshot(col, (snap) => {
    const items: DesaData[] = [];
    snap.forEach(d => {
      items.push(d.data() as DesaData);
    });
    callback(items);
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.LIST, collectionName);
    } catch (e) {
      onError(e);
    }
  });
}

export function dbSubscribeKelompoks(callback: (data: KelompokData[]) => void, onError: (err: any) => void) {
  const collectionName = 'kelompoks';
  const col = getCollectionRef(collectionName);
  return onSnapshot(col, (snap) => {
    const items: KelompokData[] = [];
    snap.forEach(d => {
      items.push(d.data() as KelompokData);
    });
    callback(items);
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.LIST, collectionName);
    } catch (e) {
      onError(e);
    }
  });
}

export function dbSubscribeAgeCategories(callback: (data: AgeCategoryData[]) => void, onError: (err: any) => void) {
  const collectionName = 'ageCategories';
  const col = getCollectionRef(collectionName);
  return onSnapshot(col, (snap) => {
    const items: AgeCategoryData[] = [];
    snap.forEach(d => {
      items.push(d.data() as AgeCategoryData);
    });
    callback(items);
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.LIST, collectionName);
    } catch (e) {
      onError(e);
    }
  });
}

export function dbSubscribeAttendanceLogs(limitCount: number, callback: (logs: AttendanceLog[]) => void, onError: (err: any) => void) {
  const collectionName = 'attendanceLogs';
  const col = getCollectionRef(collectionName);
  const q = query(col, orderBy('date', 'desc'), limit(limitCount));
  return onSnapshot(q, (snap) => {
    const items: AttendanceLog[] = [];
    snap.forEach(d => {
      items.push(d.data() as AttendanceLog);
    });
    callback(items);
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.LIST, collectionName);
    } catch (e) {
      onError(e);
    }
  });
}

export async function dbGetAttendanceSummaries() {
  const collectionName = 'attendanceSummaries';
  try {
    const col = getCollectionRef(collectionName);
    const q = query(col, orderBy('date', 'desc'));
    const snap = await getDocs(q);
    const items: any[] = [];
    snap.forEach(d => {
      items.push(d.data());
    });
    return items;
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

export function dbSubscribeAttendanceSummaries(callback: (summaries: any[]) => void, onError: (err: any) => void) {
  const collectionName = 'attendanceSummaries';
  const col = getCollectionRef(collectionName);
  const q = query(col, orderBy('date', 'desc'));
  return onSnapshot(q, (snap) => {
    const items: any[] = [];
    snap.forEach(d => {
      items.push(d.data());
    });
    callback(items);
  }, (err) => {
    try {
      handleFirestoreError(err, OperationType.LIST, collectionName);
    } catch (e) {
      onError(e);
    }
  });
}
