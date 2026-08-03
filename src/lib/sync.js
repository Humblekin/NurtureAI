import supabase, { isSupabaseConfigured } from './supabase';

/**
 * NurtureAI — Data Access (online + offline)
 *
 * Writes go directly to Supabase when possible. If the device is offline
 * (or the request fails with a network error), the write is queued in a
 * localStorage outbox and pushed to Supabase automatically once the
 * connection is back. This keeps the app usable without an internet
 * connection.
 */

const OUTBOX_KEY = 'nurtureai_outbox_v1';
const RETRY_INTERVAL_MS = 30000;

function isBrowser() {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function readOutbox() {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('[Sync] Failed to read outbox:', error);
    return [];
  }
}

function writeOutbox(ops) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  } catch (error) {
    console.error('[Sync] Failed to persist outbox:', error);
  }
}

function isNetworkError(error) {
  const name = error?.name || '';
  const msg = String(error?.message || '').toLowerCase();
  return name === 'TypeError'
    || msg.includes('failed to fetch')
    || msg.includes('network')
    || msg.includes('load failed');
}

function enqueue(operation, tableName, recordId, data) {
  const ops = readOutbox().filter((op) => op.table !== tableName || op.recordId !== recordId);
  ops.push({
    op: operation,
    table: tableName,
    recordId,
    data: operation === 'UPSERT' ? data : undefined,
    ts: Date.now(),
  });
  writeOutbox(ops);
  console.warn(`[Sync] Offline — ${operation} for ${tableName}/${recordId} queued for later sync.`);
}

async function writeDirect(op) {
  if (op.op === 'DELETE') {
    const { error } = await supabase.from(op.table).delete().eq('id', op.recordId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from(op.table).upsert(op.data, { onConflict: 'id' });
    if (error) throw error;
  }
}

/**
 * Insert or update a record. Saves directly to Supabase when online;
 * otherwise queues the write so it syncs automatically later.
 * @param {string} tableName - The Supabase table name
 * @param {object} data - The full record data (must include an `id`)
 * @returns {Promise<boolean>} Resolves true once the write is accepted (saved or queued).
 */
export async function upsertRecord(tableName, data) {
  if (!data || !data.id) {
    throw new Error(`upsertRecord requires data with an 'id' (received ${tableName}).`);
  }

  if (!isSupabaseConfigured() || (isBrowser() && navigator.onLine === false)) {
    enqueue('UPSERT', tableName, data.id, data);
    return true;
  }

  try {
    const { error } = await supabase.from(tableName).upsert(data, { onConflict: 'id' });
    if (error) throw error;
    return true;
  } catch (error) {
    if (isNetworkError(error)) {
      enqueue('UPSERT', tableName, data.id, data);
      return true;
    }
    console.error(`[Supabase] Upsert failed for ${tableName}/${data.id}:`, error.message);
    throw error;
  }
}

/**
 * Delete a record. Deletes directly from Supabase when online;
 * otherwise queues the delete so it syncs automatically later.
 * @param {string} tableName - The Supabase table name
 * @param {string} id - The record's ID
 * @returns {Promise<boolean>} Resolves true once the delete is accepted (done or queued).
 */
export async function deleteRecord(tableName, id) {
  if (!isSupabaseConfigured() || (isBrowser() && navigator.onLine === false)) {
    enqueue('DELETE', tableName, id);
    return true;
  }

  try {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    if (isNetworkError(error)) {
      enqueue('DELETE', tableName, id);
      return true;
    }
    console.error(`[Supabase] Delete failed for ${tableName}/${id}:`, error.message);
    throw error;
  }
}

/**
 * Pending writes waiting to be pushed to Supabase.
 * @returns {Array<object>}
 */
export function getPendingSyncs() {
  return readOutbox();
}

/**
 * Number of pending writes waiting to be pushed to Supabase.
 * @returns {number}
 */
export function getPendingSyncCount() {
  return readOutbox().length;
}

/**
 * Push queued writes to Supabase (FIFO). Permanently failing entries are
 * dropped so they don't block the queue forever; on a network error it
 * stops and keeps the rest for the next attempt.
 * @returns {Promise<{flushed: number, remaining: number}>}
 */
export async function flushPendingSyncs() {
  if (!isSupabaseConfigured() || (isBrowser() && navigator.onLine === false)) {
    return { flushed: 0, remaining: getPendingSyncCount() };
  }

  const ops = readOutbox();
  if (ops.length === 0) return { flushed: 0, remaining: 0 };

  let flushed = 0;
  const remaining = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    try {
      await writeDirect(op);
      flushed++;
    } catch (error) {
      if (isNetworkError(error)) {
        remaining.push(...ops.slice(i));
        break;
      }
      console.error(`[Sync] Dropping failed ${op.op} for ${op.table}/${op.recordId}:`, error.message);
    }
  }
  writeOutbox(remaining);

  if (flushed > 0) {
    console.log(`[Sync] Synced ${flushed} pending ${flushed === 1 ? 'change' : 'changes'}.`);
  }
  if (remaining.length > 0) {
    console.warn(`[Sync] ${flushed} synced, ${remaining.length} still pending.`);
  }
  return { flushed, remaining: remaining.length };
}

let autoFlushStarted = false;
function startAutoFlush() {
  if (autoFlushStarted || !isBrowser()) return;
  autoFlushStarted = true;

  if (document.readyState === 'complete') {
    flushPendingSyncs();
  } else {
    window.addEventListener('load', () => flushPendingSyncs());
  }
  window.addEventListener('online', () => flushPendingSyncs());
  window.setInterval(() => {
    if (getPendingSyncCount() > 0) flushPendingSyncs();
  }, RETRY_INTERVAL_MS);
}
startAutoFlush();

export default { upsertRecord, deleteRecord, flushPendingSyncs, getPendingSyncs, getPendingSyncCount };
