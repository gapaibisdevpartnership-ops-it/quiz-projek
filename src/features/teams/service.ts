import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  mapProfile,
  mapTeam,
  type Profile,
  type ProfileRow,
  type Team,
  type TeamRow,
} from "@/types/domain";

export interface TeamWithCount extends Team {
  memberCount: number;
}

export async function listTeams(): Promise<TeamWithCount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("*, team_members(count)")
    .order("name");
  if (error) throw error;

  return (
    data as (TeamRow & { team_members: { count: number }[] })[]
  ).map((row) => ({
    ...mapTeam(row),
    memberCount: row.team_members?.[0]?.count ?? 0,
  }));
}

export async function getTeam(id: string): Promise<Team | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("id", id)
    .maybeSingle<TeamRow>();
  if (error) throw error;
  return data ? mapTeam(data) : null;
}

export interface TeamMemberProfile {
  memberId: string;
  profile: Profile;
}

export async function listTeamMembers(
  teamId: string,
): Promise<TeamMemberProfile[]> {
  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("team_members")
    .select("id, user_id")
    .eq("team_id", teamId);
  if (error) throw error;
  if (!members?.length) return [];

  const ids = (members as { id: string; user_id: string }[]).map(
    (m) => m.user_id,
  );
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("*")
    .in("user_id", ids);
  if (pErr) throw pErr;

  const byUser = new Map(
    (profiles as ProfileRow[]).map((p) => [p.user_id, mapProfile(p)]),
  );
  return (members as { id: string; user_id: string }[])
    .filter((m) => byUser.has(m.user_id))
    .map((m) => ({ memberId: m.id, profile: byUser.get(m.user_id)! }));
}
