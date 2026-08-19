import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egfdluvekjygfsnxczqi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnZmRsdXZla2p5Z2ZzbnhjenFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MTA0OTksImV4cCI6MjEwMDM4NjQ5OX0.I0X1aOPdwX0VFwoV-uRBZG-tTNeJjQPr99LHcR1DADM';

async function test() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const email = `test_${Date.now()}@nurtureai.local`;
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: 'Password123!'
  });
  
  if (authError) {
    console.error('Auth Error:', authError.message);
    return;
  }
  
  const token = authData.session.access_token;
  const functionUrl = `${SUPABASE_URL}/functions/v1/khaya?op=languages`;
  const res = await fetch(functionUrl, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const text = await res.text();
  console.log('Response:', text);
}

test();
