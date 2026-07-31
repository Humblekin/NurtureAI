import supabase, { isSupabaseConfigured } from './supabase';

/**
 * NurtureAI — Data Access
 *
 * Writes go DIRECTLY to Supabase. There is no local queue, no outbox,
 * and no offline persistence. If the write succeeds the record is in
 * the database; if it fails the error is returned to the caller.
 */

/**
 * Insert or update a record in Supabase.
 * @param {string} tableName - The Supabase table name
 * @param {object} data - The full record data
 */
export async function upsertRecord(tableName, data) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Data cannot be saved.');
  }
  const { error } = await supabase.from(tableName).upsert(data, { onConflict: 'id' });
  if (error) {
    console.error(`[Supabase] Upsert failed for ${tableName}/${data?.id}:`, error.message);
    throw error;
  }
  return true;
}

/**
 * Delete a record from Supabase.
 * @param {string} tableName - The Supabase table name
 * @param {string} id - The record's ID
 */
export async function deleteRecord(tableName, id) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Data cannot be deleted.');
  }
  const { error } = await supabase.from(tableName).delete().eq('id', id);
  if (error) {
    console.error(`[Supabase] Delete failed for ${tableName}/${id}:`, error.message);
    throw error;
  }
  return true;
}

export default { upsertRecord, deleteRecord };
