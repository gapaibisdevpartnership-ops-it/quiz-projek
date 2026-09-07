"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/auth/service";
import { teamSchema, type TeamInput } from "@/lib/validation/team";

export type TeamMutationResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createTeam(input: TeamInput): Promise<TeamMutationResult> {
  await requireAdmin();
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      is_active: parsed.data.isActive,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/teams");
  return { ok: true, id: data.id };
}

export async function updateTeam(
  id: string,
  input: TeamInput,
): Promise<TeamMutationResult> {
  await requireAdmin();
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      is_active: parsed.data.isActive,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/teams");
  return { ok: true, id };
}

export async function addTeamMember(
  teamId: string,
  userId: string,
): Promise<TeamMutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, user_id: userId });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "That user is already on this team."
          : error.message,
    };
  }
  revalidatePath("/admin/teams");
  return { ok: true, id: teamId };
}

export async function removeTeamMember(
  teamId: string,
  memberId: string,
): Promise<TeamMutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", memberId)
    .eq("team_id", teamId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/teams");
  return { ok: true, id: teamId };
}
