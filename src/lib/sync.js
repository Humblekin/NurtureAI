import supabase, { isSupabaseConfigured } from './supabase';
import useAppStore from '../stores/appStore';

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
const MAX_ATTEMPTS = 5;

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

function updateSyncCounts() {
  if (!isBrowser()) return;
  const count = getPendingSyncCount();
  useAppStore.getState().setPendingSyncCount(count);
}

function enqueue(operation, tableName, recordId, data) {
  const ops = readOutbox();
  const existingIndex = ops.findIndex((op) => op.table === tableName && op.recordId === recordId);
  if (existingIndex >= 0) {
    const existing = ops[existingIndex];
    ops[existingIndex] = {
      ...existing,
      op: operation,
      data: operation === 'UPSERT' ? data : undefined,
      ts: Date.now(),
    };
  } else {
    ops.push({
      op: operation,
      table: tableName,
      recordId,
      data: operation === 'UPSERT' ? data : undefined,
      attempts: 0,
      ts: Date.now(),
    });
  }
  writeOutbox(ops);
  updateSyncCounts();
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
    useAppStore.getState().markDataChanged();
    return true;
  }

  try {
    const { error } = await supabase.from(tableName).upsert(data, { onConflict: 'id' });
    if (error) throw error;
    useAppStore.getState().markDataChanged();
    return true;
  } catch (error) {
    if (isNetworkError(error)) {
      enqueue('UPSERT', tableName, data.id, data);
      useAppStore.getState().markDataChanged();
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
    useAppStore.getState().markDataChanged();
    return true;
  }

  try {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) throw error;
    useAppStore.getState().markDataChanged();
    return true;
  } catch (error) {
    if (isNetworkError(error)) {
      enqueue('DELETE', tableName, id);
      useAppStore.getState().markDataChanged();
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
 * Push queued writes to Supabase (FIFO). On a network error it stops and
 * keeps the rest for the next attempt. A write that keeps failing for other
 * reasons (e.g. a rejected RLS rule) is never dropped — it is moved to the
 * end of the queue so it cannot block the other pending writes, and the
 * sync status is set to 'error' so the user is alerted that something did
 * not reach the cloud.
 * @returns {Promise<{flushed: number, remaining: number}>}
 */
export async function flushPendingSyncs() {
  if (!isSupabaseConfigured() || (isBrowser() && navigator.onLine === false)) {
    return { flushed: 0, remaining: getPendingSyncCount() };
  }

  // Only sync while a user is signed in. After sign-out the outbox is
  // cleared, but this guards the race window where a flush is in flight.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { flushed: 0, remaining: getPendingSyncCount() };
    }
  } catch {
    return { flushed: 0, remaining: getPendingSyncCount() };
  }

  const ops = readOutbox();
  if (ops.length === 0) {
    useAppStore.getState().setSyncStatus('synced');
    return { flushed: 0, remaining: 0 };
  }

  useAppStore.getState().setSyncStatus('syncing');

  let flushed = 0;
  let hasErrors = false;
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
      hasErrors = true;
      const attempts = (op.attempts || 0) + 1;
      console.error(`[Sync] Sync failed for ${op.op} ${op.table}/${op.recordId} (attempt ${attempts}/${MAX_ATTEMPTS}):`, error.message);
      if (attempts < MAX_ATTEMPTS) {
        remaining.push({ ...op, attempts });
      } else {
        // Keep the data, never drop it: park the op at the end of the queue
        // so it doesn't block the rest, and surface a visible sync error.
        remaining.push({ ...op, attempts, stalled: true });
      }
    }
  }
  writeOutbox(remaining);
  updateSyncCounts();

  useAppStore.getState().setSyncStatus(hasErrors ? 'error' : 'synced');

  if (flushed > 0) {
    console.log(`[Sync] Synced ${flushed} pending ${flushed === 1 ? 'change' : 'changes'}.`);
  }
  if (remaining.length > 0) {
    console.warn(`[Sync] ${flushed} synced, ${remaining.length} still pending.`);
  }
  return { flushed, remaining: remaining.length };
}

/**
 * Remove every queued write from this device. Called on sign-out so queued
 * records from one user can never be pushed to the cloud under another user's
 * session.
 */
export function clearOutbox() {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(OUTBOX_KEY);
    updateSyncCounts();
    useAppStore.getState().setSyncStatus('idle');
  } catch (error) {
    console.error('[Sync] Failed to clear outbox:', error);
  }
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

export default { upsertRecord, deleteRecord, flushPendingSyncs, getPendingSyncs, getPendingSyncCount, clearOutbox };
