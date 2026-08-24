const SUPABASE_URL = 'https://xcpxyscqzdbqqsfsbtqs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHh5c2NxemRicXFzZnNidHFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDczOTAsImV4cCI6MjEwMjk4MzM5MH0.JYJgB4cXg7WMXtMx5-q_CmJCuR8MMZMA9fWTpALMB1k';

if (!window.supabase) {
  const banner = document.createElement('div');
  banner.style.cssText = 'background:#4a1414;color:#fff;padding:14px 16px;text-align:center;font-family:sans-serif;font-size:14px;';
  banner.textContent = 'Could not load the required library from the network. Check your connection and reload the page.';
  document.body.prepend(banner);
  throw new Error('Supabase JS library failed to load from CDN');
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function requireSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

async function getMyProfile() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data, error } = await sb.from('team_profiles').select('*').eq('id', session.user.id).single();
  if (error) return null;
  return data;
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = 'index.html';
}
