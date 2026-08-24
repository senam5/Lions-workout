/* ══════════════════════════════════════════════════════════
   Supabase connection — fill these in from your Supabase project
   (Project Settings > API) before anything else will work.
   ══════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}
