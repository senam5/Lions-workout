/* ══════════════════════════════════════════════════════════
   Supabase connection — fill these in from your Supabase project
   (Project Settings > API) before anything else will work.
   ══════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://xcpxyscqzdbqqsfsbtqs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHh5c2NxemRicXFzZnNidHFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDczOTAsImV4cCI6MjEwMjk4MzM5MH0.JYJgB4cXg7WMXtMx5-q_CmJCuR8MMZMA9fWTpALMB1k';

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
