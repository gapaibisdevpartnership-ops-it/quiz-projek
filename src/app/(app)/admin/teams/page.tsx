import { requireProfile } from "@/features/auth/service";
import { listTeamMembers, listTeams } from "@/features/teams/service";
import { listUsers } from "@/features/users/service";
import { TeamsManager } from "@/features/teams/teams-manager";

export default async function TeamsPage() {
  const [profile, teams, allUsers] = await Promise.all([
    requireProfile(),
    listTeams(),
    listUsers(),
  ]);
  const bundles = await Promise.all(
    teams.map(async (team) => ({
      team,
      members: await listTeamMembers(team.id),
    })),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Teams</h1>
      <TeamsManager
        teams={bundles}
        allUsers={allUsers}
        viewerIsSuperAdmin={profile.role === "super_admin"}
      />
    </div>
  );
}
