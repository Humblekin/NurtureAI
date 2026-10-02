import supabase, { isSupabaseConfigured } from './supabase';
import useAppStore from '../stores/appStore';

/** Direct-to-database writes. The outbox reader only drains records queued by
 * older app versions; new offline writes are never stored locally. */

const OUTBOX_KEY = 'nurtureai_outbox_v1';

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
 * Insert or update a record. Resolves only after Supabase accepts the write.
 * @param {string} tableName - The Supabase table name
 * @param {object} data - The full record data (must include an `id`)
 * @returns {Promise<boolean>} Resolves true once the write is saved to Supabase.
 */
export async function upsertRecord(tableName, data) {
  if (!data || !data.id) {
    throw new Error(`upsertRecord requires data with an 'id' (received ${tableName}).`);
  }

  assertDatabaseAvailable();

  try {
    const { error } = await supabase.from(tableName).upsert(data, { onConflict: 'id' });
    if (error) throw error;
    useAppStore.getState().markDataChanged();
    return true;
  } catch (error) {
    if (isNetworkError(error)) throw new Error('Could not reach the database. Nothing was saved. Check your connection and try again.');
    console.error(`[Supabase] Upsert failed for ${tableName}/${data.id}:`, error.message);
    throw error;
  }
}

/**
 * Delete a record directly from Supabase.
 * @param {string} tableName - The Supabase table name
 * @param {string} id - The record's ID
 * @returns {Promise<boolean>} Resolves true once the delete is saved to Supabase.
 */
export async function deleteRecord(tableName, id) {
  assertDatabaseAvailable();

  try {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) throw error;
    useAppStore.getState().markDataChanged();
    return true;
  } catch (error) {
    if (isNetworkError(error)) throw new Error('Could not reach the database. Nothing was deleted. Check your connection and try again.');
    console.error(`[Supabase] Delete failed for ${tableName}/${id}:`, error.message);
    throw error;
  }
}

function assertDatabaseAvailable() {
  if (!isSupabaseConfigured()) {
    throw new Error('Database is not configured. Nothing was saved.');
  }
  if (isBrowser() && navigator.onLine === false) {
    throw new Error('Internet connection required. Nothing was saved. Reconnect and try again.');
  }
}

let legacyFlushRunning = false;
async function flushLegacyOutbox() {
  if (legacyFlushRunning || !isSupabaseConfigured() || !isBrowser() || navigator.onLine === false) return;
  legacyFlushRunning = true;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const ops = readOutbox();
    if (ops.length === 0) return;

    let flushed = 0;
    const remaining = [];
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      try {
        await writeDirect(op);
        flushed++;
      } catch (error) {
        console.warn(`[Sync migration] Could not move legacy ${op.op} ${op.table}/${op.recordId} to the database:`, error.message);
        remaining.push(...ops.slice(i));
        break;
      }
    }
    writeOutbox(remaining);

    if (flushed > 0) {
      console.log(`[Sync migration] Moved ${flushed} legacy ${flushed === 1 ? 'change' : 'changes'} to the database.`);
    }
    if (remaining.length > 0) {
      console.warn(`[Sync migration] ${remaining.length} legacy changes remain on this device.`);
    }
  } catch (error) {
    console.warn('[Sync migration] Could not check for legacy changes:', error.message);
  } finally {
    legacyFlushRunning = false;
  }
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
  } catch (error) {
    console.error('[Sync] Failed to clear outbox:', error);
  }
}

function migrateLegacyOutbox() {
  if (!isBrowser()) return;
  const flush = () => { void flushLegacyOutbox(); };
  if (document.readyState === 'complete') flush();
  else window.addEventListener('load', flush, { once: true });
  window.addEventListener('online', flush);
  supabase?.auth.onAuthStateChange((event) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') setTimeout(flush, 0);
  });
}
migrateLegacyOutbox();

export default { upsertRecord, deleteRecord, clearOutbox };
