import supabase, { isSupabaseConfigured } from './supabase';
import db, { getPendingSyncs, removeSyncEntry } from './db';

/**
 * NurtureAI Sync Engine
 *
 * Outbox pattern: local writes → sync_queue → push to Supabase when online.
 * Also pulls from Supabase to keep local IndexedDB up-to-date across devices.
 */

let isSyncing = false;
let syncListeners = [];

const LOCAL_ONLY_FIELDS = ['synced_at', 'deleted_at'];
const MAX_SYNC_ATTEMPTS = 10;
const MIN_RETRY_DELAY = 5000;
const MAX_RETRY_DELAY = 60000;

function isAuthError(error) {
  const msg = error?.message?.toLowerCase() || '';
  const status = error?.status || error?.code || 0;
  return status === 401 || status === 403 || status === 429
    || msg.includes('auth') || msg.includes('jwt') || msg.includes('token')
    || msg.includes('unauthorized') || msg.includes('forbidden')
    || msg.includes('rate limit') || msg.includes('too many requests');
}

function getRetryDelay(attempts) {
  return Math.min(MIN_RETRY_DELAY * Math.pow(2, attempts), MAX_RETRY_DELAY);
}

const PULL_TABLES = [
  'profiles', 'mothers', 'pregnancies', 'antenatal_visits',
  'children', 'vaccinations', 'growth_records', 'milestones',
  'visits', 'referrals', 'facilities', 'districts',
  'weekly_journals',
];

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
  milestones: ['id', 'child_id', 'milestone_type', 'achieved_date', 'notes', 'created_at', 'updated_at'],
  weekly_journals: ['id', 'user_id', 'pregnancy_id', 'week_number', 'entry_date', 'mother_feeling', 'baby_movement', 'symptoms', 'mood', 'sleep_quality', 'nutrition_notes', 'water_intake', 'exercise_notes', 'medication_notes', 'weight', 'blood_pressure', 'additional_notes', 'created_at', 'updated_at'],
};

function stripLocalFields(data, tableName) {
  if (!data || typeof data !== 'object') return data;
  const clean = { ...data };
  for (const field of LOCAL_ONLY_FIELDS) {
    delete clean[field];
  }
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
 * Process all pending sync queue entries (push local changes to Supabase).
 */
export async function processSyncQueue() {
  if (!isSupabaseConfigured()) {
    console.warn('[Sync] Supabase not configured — sync disabled');
    return;
  }
  if (isSyncing) return;

  isSyncing = true;
  notifySyncListeners('syncing');

  try {
    const pending = await getPendingSyncs();
    if (pending.length === 0) {
      notifySyncListeners('synced');
      return;
    }

    console.log(`[Sync] Processing ${pending.length} pending entries...`);
    let successCount = 0;
    let errorCount = 0;

    for (const entry of pending) {
      if (entry.next_retry_at && new Date(entry.next_retry_at) > new Date()) {
        continue;
      }

      if ((entry.attempts || 0) >= MAX_SYNC_ATTEMPTS && !isAuthError({ message: entry.last_error })) {
        console.warn(`[Sync] Giving up on ${entry.table_name}/${entry.record_id} after ${entry.attempts} attempts: ${entry.last_error}`);
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
            continue;
        }

        if (result?.error) {
          throw result.error;
        }

        if (entry.operation !== 'DELETE') {
          const localTable = db.table(entry.table_name);
          await localTable.update(entry.record_id, {
            synced_at: new Date().toISOString(),
          }).catch(() => {});
        }

        await removeSyncEntry(entry.id);
        successCount++;
      } catch (error) {
        console.error(`Sync error for ${entry.table_name}/${entry.record_id}:`, error);
        errorCount++;

        const isAuth = isAuthError(error);
        const delay = getRetryDelay(entry.attempts || 0);

        await db.sync_queue.update(entry.id, {
          attempts: isAuth ? (entry.attempts || 0) : (entry.attempts || 0) + 1,
          last_error: error.message,
          next_retry_at: isAuth ? new Date(Date.now() + delay).toISOString() : null,
        });

        if (isAuth) {
          console.log(`[Sync] Auth error, will retry in ${delay}ms (attempt ${(entry.attempts || 0) + 1})`);
        }
      }
    }

    console.log(`[Sync] Done: ${successCount} synced, ${errorCount} failed out of ${pending.length}`);
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
 * Pull data FROM Supabase into local IndexedDB.
 * Fetches records updated since lastSyncedAt for each table.
 */
export async function pullFromServer(tableName, lastSyncedAt) {
  if (!isSupabaseConfigured()) return [];

  try {
    const useCreated_at = ['ai_conversations'];
    const orderCol = useCreated_at.includes(tableName) ? 'created_at' : 'updated_at';

    let query = supabase
      .from(tableName)
      .select('*')
      .order(orderCol, { ascending: false })
      .limit(1000);

    if (lastSyncedAt) {
      query = query.gt(orderCol, lastSyncedAt);
    }

    const { data, error } = await query;
    if (error) {
      console.warn(`[Sync] Pull error for ${tableName}:`, error.message);
      return [];
    }

    const count = data?.length || 0;
    console.log(`[Sync] Pull ${tableName}: ${count} rows`);

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
  } catch (err) {
    console.warn(`[Sync] Pull failed for ${tableName}:`, err.message);
    return [];
  }
}

/**
 * Pull all tables from Supabase into local IndexedDB.
 * This is the key function for multi-device sync.
 */
export async function pullAllTables() {
  if (!isSupabaseConfigured()) return;

  notifySyncListeners('syncing');

  try {
    for (const table of PULL_TABLES) {
      await pullFromServer(table);
    }
    notifySyncListeners('synced');
  } catch (error) {
    console.error('[Sync] Pull all tables failed:', error);
    notifySyncListeners('error');
  }
}

/**
 * Full sync: push local changes, then pull remote changes.
 */
export async function fullSync() {
  if (!isSupabaseConfigured()) return;

  try {
    await processSyncQueue();
    await pullAllTables();
  } catch (error) {
    console.error('[Sync] Full sync failed:', error);
  }
}

/**
 * Re-queue all locally saved records that haven't been synced yet.
 * Run this on app init to recover entries that were lost due to sync failures.
 */
export async function requeueAllUnsynced() {
  if (!isSupabaseConfigured()) return;

  const tables = db.tables.filter(t => t.name !== 'sync_queue' && t.name !== 'settings' && t.name !== 'notifications' && t.name !== 'ai_conversations');

  let total = 0;
  for (const table of tables) {
    try {
      const unsynced = await table
        .filter(item => !item.synced_at && item.id)
        .toArray();

      for (const item of unsynced) {
        const existing = await db.sync_queue
          .where({ table_name: table.name, record_id: item.id })
          .first();
        if (!existing) {
          await queueSync(table.name, item.id, 'INSERT', item);
          total++;
        }
      }
    } catch (err) {
      console.warn(`[Sync] Re-queue failed for ${table.name}:`, err.message);
    }
  }

  if (total > 0) {
    console.log(`[Sync] Re-queued ${total} unsynced records`);
  }
  return total;
}

// ---- Auto-sync setup ----

let syncInterval = null;
let onlineHandler = null;

export function setupAutoSync() {
  // Clean up previous listeners
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler);
  }

  onlineHandler = () => {
    console.log('[Sync] Network restored, syncing...');
    fullSync().catch(err => console.error('[Sync] Reconnect sync failed:', err));
  };
  window.addEventListener('online', onlineHandler);

  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    if (navigator.onLine && isSupabaseConfigured()) {
      fullSync().catch(err => console.error('[Sync] Periodic sync failed:', err));
    }
  }, 30000);

  // Initial sync after short delay
  if (navigator.onLine && isSupabaseConfigured()) {
    setTimeout(() => {
      fullSync().catch(err => console.error('[Sync] Initial sync failed:', err));
    }, 2000);
  }
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }
}
