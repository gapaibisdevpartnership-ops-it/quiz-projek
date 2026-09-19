"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Profile, Team } from "@/types/domain";
import type { ResolvedAssignment } from "@/features/assignments/service";
import { assignQuiz, unassignQuiz } from "@/features/assignments/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";

export function QuizAssignments({
  quizId,
  assignments,
  users,
  teams,
}: {
  quizId: string;
  assignments: ResolvedAssignment[];
  users: Profile[];
  teams: Team[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"user" | "team">("user");
  const [userId, setUserId] = useState("");
  const [teamId, setTeamId] = useState("");

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    successMessage?: string,
  ) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Action failed.");
      else {
        if (successMessage) toast.success(successMessage);
        router.refresh();
      }
    });

  return (
    <div className="space-y-3">
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <div className="flex flex-wrap items-end gap-2">
        <Select
          className="h-9 w-28"
          value={mode}
          onChange={(e) => setMode(e.target.value as "user" | "team")}
        >
          <option value="user">User</option>
          <option value="team">Team</option>
        </Select>

        {mode === "user" ? (
          <Select
            className="h-9 min-w-52"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Choose a user…</option>
            {users.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.fullName || u.email} ({u.role})
              </option>
            ))}
          </Select>
        ) : (
          <Select
            className="h-9 min-w-52"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            <option value="">Choose a team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}

        <Button
          size="sm"
          disabled={
            pending || (mode === "user" ? !userId : !teamId)
          }
          onClick={() => {
            const target =
              mode === "user"
                ? users.find((u) => u.userId === userId)
                : teams.find((t) => t.id === teamId);
            const label =
              target && "fullName" in target
                ? target.fullName || target.email
                : target?.name;
            run(
              () =>
                assignQuiz({
                  quizId,
                  mode,
                  userId: mode === "user" ? userId : undefined,
                  teamId: mode === "team" ? teamId : undefined,
                }),
              `Assigned to ${label ?? "target"}`,
            );
          }}
        >
          Assign
        </Button>
      </div>

      <ul className="divide-y text-sm">
        {assignments.length === 0 ? (
          <li className="text-muted-foreground py-2">Not assigned to anyone yet.</li>
        ) : null}
        {assignments.map((a) => (
          <li key={a.id} className="flex items-center justify-between py-2">
            <span>{a.targetLabel}</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(
                  () => unassignQuiz(quizId, a.id),
                  `${a.targetLabel} removed`,
                )
              }
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
