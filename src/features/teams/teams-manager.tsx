"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Trash2, ToggleLeft, ToggleRight, Users as UsersIcon } from "lucide-react";
import type { Profile } from "@/types/domain";
import type { TeamWithCount, TeamMemberProfile } from "@/features/teams/service";
import {
  addTeamMember,
  createTeam,
  deleteTeamPermanently,
  removeTeamMember,
  updateTeam,
} from "@/features/teams/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TeamBundle {
  team: TeamWithCount;
  members: TeamMemberProfile[];
}

export function TeamsManager({
  teams,
  allUsers,
  viewerIsSuperAdmin,
}: {
  teams: TeamBundle[];
  allUsers: Profile[];
  viewerIsSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [membersTeamId, setMembersTeamId] = useState<string | null>(null);
  const [pick, setPick] = useState("");

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    successMessage?: string,
  ) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Action failed.");
        return;
      }
      if (successMessage) toast.success(successMessage);
      router.refresh();
    });

  const activeBundle = teams.find((t) => t.team.id === membersTeamId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Teams</h1>
          <p className="text-muted-foreground text-sm">
            {teams.length} team{teams.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="New team name"
            className="w-48"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            disabled={pending || !name.trim()}
            className="gap-1.5"
            onClick={() =>
              run(async () => {
                const r = await createTeam({
                  name,
                  description: "",
                  isActive: true,
                });
                if (r.ok) setName("");
                return r;
              }, `"${name}" created`)
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Create team
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {teams.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              No teams yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map(({ team }) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>
                      <button
                        className="text-muted-foreground hover:text-foreground hover:underline"
                        onClick={() => setMembersTeamId(team.id)}
                      >
                        {team.memberCount} member
                        {team.memberCount === 1 ? "" : "s"}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={team.isActive ? "default" : "outline"}>
                        {team.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={pending}
                            aria-label={`Actions for ${team.name}`}
                          >
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setPick("");
                              setMembersTeamId(team.id);
                            }}
                          >
                            <UsersIcon aria-hidden="true" />
                            Manage members
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              run(
                                () =>
                                  updateTeam(team.id, {
                                    name: team.name,
                                    description: team.description ?? "",
                                    isActive: !team.isActive,
                                  }),
                                team.isActive
                                  ? `"${team.name}" deactivated`
                                  : `"${team.name}" activated`,
                              )
                            }
                          >
                            {team.isActive ? (
                              <ToggleLeft aria-hidden="true" />
                            ) : (
                              <ToggleRight aria-hidden="true" />
                            )}
                            {team.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          {viewerIsSuperAdmin ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `Delete "${team.name}" permanently? This cannot be undone.`,
                                    )
                                  )
                                    return;
                                  run(
                                    () => deleteTeamPermanently(team.id),
                                    `"${team.name}" deleted`,
                                  );
                                }}
                              >
                                <Trash2 aria-hidden="true" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={activeBundle != null}
        onOpenChange={(o) => {
          if (!o) setMembersTeamId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeBundle?.team.name} members</DialogTitle>
            <DialogDescription>
              Add or remove people from this team.
            </DialogDescription>
          </DialogHeader>

          {activeBundle ? (
            <div className="space-y-4">
              <ul className="divide-y text-sm">
                {activeBundle.members.length === 0 ? (
                  <li className="text-muted-foreground py-2">No members yet.</li>
                ) : null}
                {activeBundle.members.map((m) => (
                  <li
                    key={m.memberId}
                    className="flex items-center justify-between py-2"
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
                        run(
                          () => removeTeamMember(activeBundle.team.id, m.memberId),
                          `${m.profile.fullName || m.profile.email} removed`,
                        )
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Select
                  className="h-9 py-1.5"
                  value={pick}
                  onChange={(e) => setPick(e.target.value)}
                >
                  <option value="">Add a member…</option>
                  {allUsers
                    .filter(
                      (u) =>
                        !activeBundle.members.some(
                          (m) => m.profile.userId === u.userId,
                        ),
                    )
                    .map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.fullName || u.email}
                      </option>
                    ))}
                </Select>
                <Button
                  disabled={pending || !pick}
                  onClick={() => {
                    const added = allUsers.find((u) => u.userId === pick);
                    run(async () => {
                      const r = await addTeamMember(activeBundle.team.id, pick);
                      if (r.ok) setPick("");
                      return r;
                    }, `${added?.fullName || added?.email || "Member"} added`);
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
