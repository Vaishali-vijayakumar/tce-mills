import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Export effectively null or a dummy if credentials are missing. 
// This prevents the entire app from crashing on load in environments where 
// these variables are not yet set (like a new Vercel deployment).
export const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

if (!supabase) {
    console.warn("Supabase credentials missing. Real-time updates will be disabled.");
}
