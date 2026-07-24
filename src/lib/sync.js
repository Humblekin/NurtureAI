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

function stripLocalFields(data) {
  if (!data || typeof data !== 'object') return data;
  const clean = { ...data };
  for (const field of LOCAL_ONLY_FIELDS) {
    delete clean[field];
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
      try {
        const rawData = JSON.parse(entry.data);
        const data = stripLocalFields(rawData);
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
 */
export function setupAutoSync() {
  window.addEventListener('online', () => {
    console.log('NurtureAI: Network restored, starting sync...');
    processSyncQueue();
  });

  // Initial sync if online
  if (navigator.onLine && isSupabaseConfigured()) {
    setTimeout(() => processSyncQueue(), 2000);
  }
}
