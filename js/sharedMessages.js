const SUPABASE_URL = 'https://yyizocyaehmqrottmnaz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5aXpvY3lhZWhtcXJvdHRtbmF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MTA3NzEsImV4cCI6MjA4NjA4Njc3MX0.t8pdlYMBlRS2r8QmmB3d-omk3i_-tj-zO__zS6qhqB4';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

/**
 * Fetch all shared messages from Supabase.
 * Returns array of message arrays (each is 8 or 12 lines).
 */
export async function fetchSharedMessages() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/wow_shared_messages?select=lines,shared_by&order=created_at.desc`,
      { headers }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map(r => ({
      lines: r.lines,
      sharedBy: r.shared_by,
    }));
  } catch {
    return [];
  }
}

/**
 * Share a message to Supabase so all family members see it.
 */
export async function shareMessage(lines, sharedBy) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/wow_shared_messages`,
      {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({ lines, shared_by: sharedBy || 'Anonymous' }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
