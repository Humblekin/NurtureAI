import Dexie from 'dexie';

/**
 * NurtureAI Local Database (IndexedDB via Dexie.js)
 * 
 * This is the offline-first data layer. All reads/writes go through
 * this database first, then sync to Supabase when online.
 * 
 * Schema mirrors critical Supabase tables with additional sync metadata.
 */
export const db = new Dexie('NurtureAI');

db.version(1).stores({
  // ---- User & Auth ----
  profiles: 'id, role, full_name, phone, facility_id, community, synced_at',

  // ---- Healthcare Entities ----
  mothers: 'id, profile_id, full_name, community, risk_level, assigned_worker_id, synced_at',
  pregnancies: 'id, mother_id, status, risk_level, edd, synced_at',
  antenatal_visits: 'id, pregnancy_id, visit_date, visit_number, synced_at',
  children: 'id, mother_id, full_name, birth_date, gender, synced_at',
  vaccinations: 'id, child_id, vaccine_name, date_given, synced_at',
  growth_records: 'id, child_id, recorded_date, synced_at',
  milestones: 'id, child_id, milestone_type, achieved_date, synced_at',

  // ---- Health Worker Operations ----
  visits: 'id, worker_id, patient_id, patient_type, visit_type, visit_date, synced_at',
  referrals: 'id, patient_id, from_facility_id, to_facility_id, urgency, status, synced_at',

  // ---- AI ----
  ai_conversations: 'id, user_id, created_at, synced_at',

  // ---- System ----
  facilities: 'id, name, type, district_id, synced_at',
  districts: 'id, name, region, synced_at',

  // ---- Sync Queue (outbox pattern) ----
  sync_queue: '++id, table_name, record_id, operation, created_at, next_retry_at, [table_name+record_id]',

  // ---- App Settings ----
  settings: 'key',

  // ---- Notifications / Reminders ----
  notifications: 'id, type, priority, read, created_at, patient_id',
});

// Version 2: Add deleted_at for soft delete support
db.version(2).stores({
  mothers: 'id, profile_id, full_name, community, risk_level, assigned_worker_id, deleted_at, synced_at',
  pregnancies: 'id, mother_id, status, risk_level, edd, deleted_at, synced_at',
  antenatal_visits: 'id, pregnancy_id, visit_date, visit_number, deleted_at, synced_at',
  children: 'id, mother_id, full_name, birth_date, gender, deleted_at, synced_at',
  vaccinations: 'id, child_id, vaccine_name, date_given, deleted_at, synced_at',
  growth_records: 'id, child_id, recorded_date, deleted_at, synced_at',
  visits: 'id, worker_id, patient_id, patient_type, visit_type, visit_date, deleted_at, synced_at',
  referrals: 'id, patient_id, from_facility_id, to_facility_id, urgency, status, deleted_at, synced_at',
  facilities: 'id, name, type, district_id, deleted_at, synced_at',
});

// Version 3: Add weekly_journals for mother weekly check-ins
db.version(3).stores({
  weekly_journals: 'id, user_id, pregnancy_id, week_number, entry_date, synced_at',
});

/**
 * Add a record to the sync queue for later upload.
 * @param {string} tableName - The Supabase table name
 * @param {string} recordId - The record's ID
 * @param {'INSERT'|'UPDATE'|'DELETE'} operation - The operation type
 * @param {object} data - The full record data
 */
export async function queueSync(tableName, recordId, operation, data) {
  await db.sync_queue.add({
    table_name: tableName,
    record_id: recordId,
    operation,
    data: JSON.stringify(data),
    created_at: new Date().toISOString(),
    attempts: 0,
    last_error: null,
  });
}

/**
 * Get all pending sync operations, ordered by creation time.
 */
export async function getPendingSyncs() {
  return db.sync_queue.orderBy('created_at').toArray();
}

/**
 * Remove a sync queue entry after successful upload.
 */
export async function removeSyncEntry(id) {
  await db.sync_queue.delete(id);
}

/**
 * Generate a UUID v4 for local record creation.
 */
export function generateId() {
  return crypto.randomUUID();
}

export default db;
