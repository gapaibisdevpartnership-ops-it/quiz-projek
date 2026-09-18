import "server-only";
import { createClient } from "@/lib/supabase/server";
import { mapProfile, type Profile, type ProfileRow } from "@/types/domain";

export async function listUsers(): Promise<Profile[]> {
  const supabase = await createClient();
  // TODO: re-add `.eq("is_guest", false)` once
  // supabase/migrations/20260918090000_public_session_link.sql is applied
  // to production (docs/PUBLIC_SESSION_LINK_PLAN.md) — the column doesn't
  // exist yet, and this file is loaded by every `npm run dev` regardless
  // of branch since local dev points at the same production database.
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");
  if (error) throw error;
  return (data as ProfileRow[]).map(mapProfile);
}

export async function getUser(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();
  if (error) throw error;
  return data ? mapProfile(data) : null;
}
