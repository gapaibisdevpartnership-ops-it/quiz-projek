"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startGuestSession } from "@/features/assessment/actions";
import type { SessionInfo } from "@/features/assessment/service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { renderRichText } from "@/lib/rich-text";

export function CandidateEntryForm({
  token,
  session,
}: {
  token: string;
  session: SessionInfo;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    start(async () => {
      const res = await startGuestSession(token, session.quizId, name);
      if (!res.ok) return setError(res.error);
      router.push(`/assessment/${token}/attempt/${res.attemptId}`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{session.quizTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {session.instructions ? (
          <p className="text-muted-foreground text-sm">
            {renderRichText(session.instructions)}
          </p>
        ) : null}
        {session.durationMinutes ? (
          <p className="text-muted-foreground text-sm">
            Time limit: {session.durationMinutes} minutes once you start.
          </p>
        ) : null}
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <div className="space-y-1">
          <Label htmlFor="cname">Your full name</Label>
          <Input
            id="cname"
            autoFocus
            placeholder="e.g. Budi Santoso"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim() && !pending) submit();
            }}
          />
        </div>
        <Button
          onClick={submit}
          disabled={pending || !name.trim()}
          className="w-full"
        >
          {pending ? "Starting…" : "Start assessment"}
        </Button>
      </CardContent>
    </Card>
  );
}
