"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types/domain";
import type { TeamWithCount, TeamMemberProfile } from "@/features/teams/service";
import {
  addTeamMember,
  createTeam,
  removeTeamMember,
  updateTeam,
} from "@/features/teams/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TeamBundle {
  team: TeamWithCount;
  members: TeamMemberProfile[];
}

export function TeamsManager({
  teams,
  allUsers,
}: {
  teams: TeamBundle[];
  allUsers: Profile[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Action failed.");
      else router.refresh();
    });

  return (
    <div className="space-y-6">
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Create a team</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Team name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            disabled={pending || !name.trim()}
            onClick={() =>
              run(async () => {
                const r = await createTeam({
                  name,
                  description: "",
                  isActive: true,
                });
                if (r.ok) setName("");
                return r;
              })
            }
          >
            Create
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teams ({teams.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {teams.length === 0 ? (
            <p className="text-muted-foreground text-sm">No teams yet.</p>
          ) : null}
          {teams.map(({ team, members }) => {
            const memberIds = new Set(members.map((m) => m.profile.userId));
            const candidates = allUsers.filter((u) => !memberIds.has(u.userId));
            const isOpen = open === team.id;
            return (
              <div key={team.id} className="rounded-md border">
                <div className="flex items-center justify-between p-3">
                  <button
                    className="text-left text-sm font-medium hover:underline"
                    onClick={() => setOpen(isOpen ? null : team.id)}
                  >
                    {team.name}{" "}
                    <span className="text-muted-foreground font-normal">
                      · {team.memberCount} member
                      {team.memberCount === 1 ? "" : "s"}
                      {team.isActive ? "" : " · inactive"}
                    </span>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        updateTeam(team.id, {
                          name: team.name,
                          description: team.description ?? "",
                          isActive: !team.isActive,
                        }),
                      )
                    }
                  >
                    {team.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>

                {isOpen ? (
                  <div className="space-y-3 border-t p-3">
                    <ul className="divide-y text-sm">
                      {members.length === 0 ? (
                        <li className="text-muted-foreground py-1">
                          No members.
                        </li>
                      ) : null}
                      {members.map((m) => (
                        <li
                          key={m.memberId}
                          className="flex items-center justify-between py-1"
                        >
                          <span>
                            {m.profile.fullName || m.profile.email}{" "}
                            <span className="text-muted-foreground text-xs">
                              ({m.profile.role})
                            </span>
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() =>
                              run(() => removeTeamMember(team.id, m.memberId))
                            }
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <Select
                        className="h-9"
                        value={pick[team.id] ?? ""}
                        onChange={(e) =>
                          setPick({ ...pick, [team.id]: e.target.value })
                        }
                      >
                        <option value="">Add a member…</option>
                        {candidates.map((u) => (
                          <option key={u.userId} value={u.userId}>
                            {u.fullName || u.email}
                          </option>
                        ))}
                      </Select>
                      <Button
                        size="sm"
                        disabled={pending || !pick[team.id]}
                        onClick={() =>
                          run(async () => {
                            const r = await addTeamMember(
                              team.id,
                              pick[team.id],
                            );
                            if (r.ok)
                              setPick({ ...pick, [team.id]: "" });
                            return r;
                          })
                        }
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
