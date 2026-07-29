import supabase from '../lib/supabase'

export async function getMotherProfile(userId) {
  const { data, error } = await supabase
    .from('mothers')
    .select('*')
    .eq('profile_id', userId)
    .maybeSingle()

  return { data, error }
}

export async function getMotherPregnancies(motherId) {
  const { data, error } = await supabase
    .from('pregnancies')
    .select('*')
    .eq('mother_id', motherId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return { data, error }
}

export async function getMotherChildren(motherId) {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('mother_id', motherId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return { data, error }
}
