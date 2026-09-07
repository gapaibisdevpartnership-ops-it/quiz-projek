import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getServerEnv } from "@/lib/env";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 * Uses the anon key + the user's cookies, so RLS applies as the signed-in user.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getServerEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore when middleware
            // is responsible for refreshing the session cookie.
          }
        },
      },
    },
  );
}
