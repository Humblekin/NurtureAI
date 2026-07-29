import supabase from '../lib/supabase'

export async function getAntenatalVisits(pregnancyId) {
  const { data, error } = await supabase
    .from('antenatal_visits')
    .select('*')
    .eq('pregnancy_id', pregnancyId)
    .is('deleted_at', null)
    .order('visit_date', { ascending: false })

  return { data, error }
}
