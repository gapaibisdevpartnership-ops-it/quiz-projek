import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SEED_PASSWORD } from "./seed";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True when the integration suite has everything it needs to run. */
export const hasSupabaseEnv = Boolean(url && anonKey);

const noPersist = {
  auth: { persistSession: false, autoRefreshToken: false },
};

export function anonClient(): SupabaseClient {
  return createClient(url!, anonKey!, noPersist);
}

export function serviceClient(): SupabaseClient {
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url!, serviceKey, noPersist);
}

/** A fresh client already authenticated as the given seed user. */
export async function signInAs(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password: SEED_PASSWORD,
  });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

/** Postgres "relation does not exist" — table not migrated yet. */
export function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01";
}
