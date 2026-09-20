import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mapProfile, type Profile, type ProfileRow } from "@/types/domain";
import { isAdminRole, isResultsViewerRole } from "@/lib/constants";

/**
 * Current signed-in user's profile, or null. Cached per request.
 * Authorization still lives in RLS — this only drives UI/route shape.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();

  if (error || !data) return null;
  return mapProfile(data);
});

/** Require an authenticated, active profile or redirect to /login. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "active") redirect("/inactive");
  return profile;
}

/** Require an admin/trainer profile or redirect. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!isAdminRole(profile.role)) redirect("/dashboard");
  return profile;
}

/** Require a super_admin profile or redirect. */
export async function requireSuperAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") redirect("/dashboard");
  return profile;
}

/** Require an admin/trainer or spv (read-only results viewer) profile. */
export async function requireResultsViewer(): Promise<Profile> {
  const profile = await requireProfile();
  if (!isResultsViewerRole(profile.role)) redirect("/dashboard");
  return profile;
}
