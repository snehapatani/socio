// Frontend Supabase client — used for auth only (data goes through FastAPI).
// Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in frontend/.env

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn("Supabase env vars missing — auth will not work.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:    true,    // keep session in localStorage across reloads
    autoRefreshToken:  true,    // auto-refresh expiring JWTs
    detectSessionInUrl: true,   // for OAuth callbacks / email confirm links
  },
});
