# Firebase Security Specifications: Optimum Sonar

This document defines the security specifications and test payloads ("The Dirty Dozen") to verify strict Attribute-Based Access Control (ABAC) and schema conformity of our Firestore instance.

## 1. Data Invariants

1. **Authentication Integrity**: Every write operation (unless creating a user profile) must be authenticated.
2. **Structural immutability**: Once created, `createdAt` and `id` keys of transactions, members, and historical records must be locked.
3. **Audit Ledger Consistency**: Critical changes (deletions and edits) must record proper auditing values (`deleted_at`, `edited_at`, `delete_by` etc.) matching the authenticate user's identity.
4. **Validation Constraints**: Transactions cannot exceed 100 billion IDR or specify negative values. String fields must have robust size limitations.

---

## 2. The "Dirty Dozen" Malicious Exploits

Below are the 12 specific payloads crafted by our adversarial red team to attempt to breach our security boundaries.

### Payload 1: Privilege Escalation (Self-Assign Role)
* **Target**: `/users/malicious_user`
* **Exploit**: Attempt to register or update a profile setting the `role` to `'Admin'`.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 2: Anonymous Ledger Pollution
* **Target**: `/transactions/hack_tx_1`
* **Exploit**: Writing a transaction document without authentication.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 3: Orphaned Data (Negative Transaction Value)
* **Target**: `/transactions/hack_tx_2`
* **Exploit**: Writing a transaction with a negative value for `amount` or `debit`.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 4: Overwriting Approved Financial Record
* **Target**: `/transactions/approved_tx_1`
* **Exploit**: Updating a locked or previously approved transaction period.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 5: Spoofing Owner / Actor Identity
* **Target**: `/transactions/tx_10`
* **Exploit**: Setting `created_by` or `delete_by` to `'admin_user'` when logged in as a normal user.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 6: Shadow Field Pollution
* **Target**: `/members/mbr_5`
* **Exploit**: Inserting a shadow field like `{ "isAdmin": true, "super_access": true }` into a member document.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 7: Denial of Wallet (Giant String Bomb ID)
* **Target**: `/transactions/VERY_LONG_STRING_BOMB_EXCEEDING_LIMIT_FOR_RESOURCE_EXHAUSTION_ATTACKS`
* **Exploit**: Supplying a huge string as the document ID.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 8: Corrupting Audit History
* **Target**: `/deletedTransactions/del_tx_5`
* **Exploit**: Creating a delete audit log where `delete_reason` is empty or omitted.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 9: Bypassing Immutable Timestamps
* **Target**: `/transactions/tx_11`
* **Exploit**: Modifying `created_at` timestamp during a transaction update.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 10: Unauthorized Attendance Marking
* **Target**: `/attendanceLogs/log_abc`
* **Exploit**: Creating an attendance log as a read-only "Viewer".
* **Expected Result**: `PERMISSION_DENIED`

### Payload 11: Cross-Tenant Data Hijacking
* **Target**: `/users/another_legitimate_user`
* **Exploit**: An authenticated viewer attempting to edit or delete another user's profile document.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 12: Terminal State Locking Bypass
* **Target**: `/approvals/period_1`
* **Exploit**: Creating or updating an approval period with arbitrary roles.
* **Expected Result**: `PERMISSION_DENIED`

---

## 3. Test Runner Outline (`firestore.rules.test.ts`)

A test suite wrapping `@firebase/rules-unit-testing` must assert that every action represented by these 12 malicious payloads fails with `PERMISSION_DENIED` synchrony.
