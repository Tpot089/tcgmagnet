import { createClient } from "@supabase/supabase-js";

let cached: ReturnType<typeof createClient> | null = null;

// Production-safe fallback for the TCG Magnet Supabase project.
const FALLBACK_SUPABASE_URL = "https://tcagoxedvwozgjicdrms.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Lb0FYEZfUZ9BogaYekEHZg_7NP2Fraz";

export function getSupabaseAdmin() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    FALLBACK_SUPABASE_PUBLISHABLE_KEY;

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
