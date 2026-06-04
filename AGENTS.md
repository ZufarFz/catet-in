# Custom Rules & Persistent Instructions

## Core Architecture Constraints

1. **NO AUTO DEPLOYMENT OF FIREBASE RULES**
   - **CRITICAL:** You are strictly forbidden from executing automated tools to deploy or modify `firestore.rules` (e.g., using `deploy_firebase` tool or command line tools). 
   - Rules can ONLY be edited inside `/components/other/SetupGuide.tsx` so the user can copy-paste them manually from the application UI.

2. **DATABASE IS STRICTLY MULTI-DB (TENANT-ISOLATED) BY DEFAULT**
   - The "Sistem Tunggal" (Single Unified Database) option is completely retired/removed.
   - Always prepare and display database configuration and rules expecting independent central/operational database architectures.

3. **CENTRAL DATABASE RESTRICTION**
   - The central User Accounts database MUST contain exactly **two** collections:
     - `/users/{userId}`: For routing identity, role permissions, and assigned `instansi` keys.
     - `/instansi/{instansiId}`: For storing specific operational database configurations.
   - Under no circumstances should any operational collections (e.g., `transactions`, `members`, `attendanceLogs`) ever be active, modeled, or written to in the central account database.

4. **OPERATIONAL DATABASE ARCHITECTURE**
   - All transactions, presensi, members, delete logs, and edit histories live in the tenant's isolated, dynamic database which is connected dynamically using the environment configuration stored inside `/instansi/{instansiId}` doc and initialized per user session.
