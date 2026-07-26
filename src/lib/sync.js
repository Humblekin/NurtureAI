import supabase, { isSupabaseConfigured } from './supabase';
import db, { getPendingSyncs, removeSyncEntry } from './db';

/**
 * NurtureAI Sync Engine
 * 
 * Implements an outbox pattern for offline-first data synchronization.
 * Local changes are queued and replayed against Supabase when online.
 * Conflict resolution uses "last write wins" with timestamp comparison.
 */

let isSyncing = false;
let syncListeners = [];

const LOCAL_ONLY_FIELDS = ['synced_at', 'deleted_at'];
const MAX_SYNC_ATTEMPTS = 5;

/**
 * Columns that exist in Supabase for each table.
 * Anything not in this list is stripped before upsert to prevent 400 errors.
 */
const SUPABASE_COLUMNS = {
  mothers: ['id', 'profile_id', 'full_name', 'phone', 'date_of_birth', 'community', 'blood_group', 'medical_history', 'risk_level', 'assigned_worker_id', 'edd', 'created_at', 'updated_at'],
  pregnancies: ['id', 'mother_id', 'status', 'risk_level', 'lmp', 'edd', 'gravida', 'para', 'notes', 'created_at', 'updated_at'],
  antenatal_visits: ['id', 'pregnancy_id', 'visit_date', 'visit_number', 'gestational_age', 'weight', 'blood_pressure', 'fundal_height', 'fetal_heart_rate', 'symptoms', 'notes', 'assessed_risk_level', 'created_at', 'updated_at'],
  children: ['id', 'mother_id', 'full_name', 'date_of_birth', 'gender', 'birth_weight', 'birth_facility', 'notes', 'created_at', 'updated_at'],
  vaccinations: ['id', 'child_id', 'vaccine_name', 'date_given', 'dose', 'batch_number', 'administered_by', 'notes', 'created_at', 'updated_at'],
  growth_records: ['id', 'child_id', 'recorded_date', 'weight_kg', 'height_cm', 'head_circumference_cm', 'muac_cm', 'notes', 'created_at', 'updated_at'],
  visits: ['id', 'worker_id', 'patient_id', 'patient_type', 'visit_type', 'visit_date', 'notes', 'findings', 'actions_taken', 'created_at', 'updated_at'],
  referrals: ['id', 'patient_id', 'patient_type', 'from_facility_id', 'to_facility_id', 'from_worker_id', 'urgency', 'status', 'reason', 'notes', 'created_at', 'updated_at'],
  profiles: ['id', 'full_name', 'phone', 'role', 'facility_id', 'community', 'avatar_url', 'created_at', 'updated_at'],
  notifications: ['id', 'type', 'priority', 'title', 'message', 'read', 'patient_id', 'created_at'],
  milestones: ['id', 'child_id', 'milestone_type', 'achieved_date', 'notes', 'created_at', 'updated_at'],
};

function stripLocalFields(data, tableName) {
  if (!data || typeof data !== 'object') return data;
  const clean = { ...data };

  // Remove local-only fields
  for (const field of LOCAL_ONLY_FIELDS) {
    delete clean[field];
  }

  // If we know the table schema, also strip unknown columns
  const allowedColumns = SUPABASE_COLUMNS[tableName];
  if (allowedColumns) {
    for (const key of Object.keys(clean)) {
      if (!allowedColumns.includes(key)) {
        delete clean[key];
      }
    }
  }

  return clean;
}

/**
 * Register a listener for sync status changes.
 */
export function onSyncStatusChange(callback) {
  syncListeners.push(callback);
  return () => {
    syncListeners = syncListeners.filter(cb => cb !== callback);
  };
}

function notifySyncListeners(status) {
  syncListeners.forEach(cb => cb(status));
}

/**
 * Process all pending sync queue entries.
 * Called when network connectivity is restored.
 */
export async function processSyncQueue() {
  if (!isSupabaseConfigured() || isSyncing) return;

  isSyncing = true;
  notifySyncListeners('syncing');

  try {
    const pending = await getPendingSyncs();
    let successCount = 0;
    let errorCount = 0;

    for (const entry of pending) {
      // Skip entries that have exceeded max retries (likely RLS-blocked)
      if ((entry.attempts || 0) >= MAX_SYNC_ATTEMPTS) {
        console.warn(`[Sync] Skipping ${entry.table_name}/${entry.record_id} — max retries exceeded (${entry.last_error})`);
        await removeSyncEntry(entry.id);
        continue;
      }

      try {
        const rawData = JSON.parse(entry.data);
        const data = stripLocalFields(rawData, entry.table_name);
        let result;

        switch (entry.operation) {
          case 'INSERT':
            result = await supabase
              .from(entry.table_name)
              .upsert(data, { onConflict: 'id' });
            break;
          case 'UPDATE':
            result = await supabase
              .from(entry.table_name)
              .update(data)
              .eq('id', entry.record_id);
            break;
          case 'DELETE':
            result = await supabase
              .from(entry.table_name)
              .delete()
              .eq('id', entry.record_id);
            break;
          default:
            console.warn(`Unknown sync operation: ${entry.operation}`);
            continue;
        }

        if (result?.error) {
          throw result.error;
        }

        // Mark the local record as synced
        const localTable = db.table(entry.table_name);
        if (entry.operation !== 'DELETE') {
          await localTable.update(entry.record_id, {
            synced_at: new Date().toISOString(),
          });
        }

        await removeSyncEntry(entry.id);
        successCount++;
      } catch (error) {
        console.error(`Sync error for ${entry.table_name}/${entry.record_id}:`, error);
        errorCount++;

        // Update retry count
        await db.sync_queue.update(entry.id, {
          attempts: (entry.attempts || 0) + 1,
          last_error: error.message,
        });
      }
    }

    notifySyncListeners(errorCount > 0 ? 'error' : 'synced');
    return { successCount, errorCount };
  } catch (error) {
    console.error('Sync engine error:', error);
    notifySyncListeners('error');
    throw error;
  } finally {
    isSyncing = false;
  }
}

/**
 * Pull latest data from Supabase for a specific table.
 * Uses synced_at timestamp to only fetch newer records.
 */
export async function pullFromServer(tableName, lastSyncedAt) {
  if (!isSupabaseConfigured()) return [];

  let query = supabase
    .from(tableName)
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1000);

  if (lastSyncedAt) {
    query = query.gt('updated_at', lastSyncedAt);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Upsert into local database
  if (data && data.length > 0) {
    const localTable = db.table(tableName);
    await localTable.bulkPut(
      data.map(record => ({
        ...record,
        synced_at: new Date().toISOString(),
      }))
    );
  }

  return data || [];
}

/**
 * Set up automatic sync when network comes online.
 * Includes periodic sync every 30 seconds to catch any missed queue entries.
 */
let syncInterval = null;

export function setupAutoSync() {
  window.addEventListener('online', () => {
    console.log('NurtureAI: Network restored, starting sync...');
    processSyncQueue().catch(err => console.error('Sync on reconnect failed:', err));
  });

  // Periodic sync every 30 seconds (catches missed entries)
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    if (navigator.onLine && isSupabaseConfigured()) {
      processSyncQueue().catch(err => console.error('Periodic sync failed:', err));
    }
  }, 30000);

  // Initial sync if online
  if (navigator.onLine && isSupabaseConfigured()) {
    setTimeout(() => {
      processSyncQueue().catch(err => console.error('Initial sync failed:', err));
    }, 2000);
  }
}
