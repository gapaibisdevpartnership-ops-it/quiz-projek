import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 * Use only in trusted server code (RPC orchestration, admin jobs). Never import
 * this into a Client Component or expose its results without authorization checks.
 */
export function createAdminClient() {
  const env = getServerEnv();
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
