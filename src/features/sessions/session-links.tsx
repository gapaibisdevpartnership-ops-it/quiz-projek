"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AssessmentSession } from "@/features/sessions/service";
import {
  closeSession,
  createSession,
  deleteSessionPermanently,
  reopenSession,
} from "@/features/sessions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeUTC } from "@/lib/format";

const EXPIRY_OPTIONS = [
  { value: "", label: "No expiry" },
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
];

const OPENS_OPTIONS = [
  { value: "", label: "Now" },
  { value: "1", label: "In 1 day" },
  { value: "3", label: "In 3 days" },
  { value: "7", label: "In 7 days" },
];

export function SessionLinks({
  quizId,
  sessions,
  viewerIsSuperAdmin,
}: {
  quizId: string;
  sessions: AssessmentSession[];
  viewerIsSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [expiryDays, setExpiryDays] = useState("");
  const [opensDays, setOpensDays] = useState("");
  const [rosterText, setRosterText] = useState("");
  const [maxCandidates, setMaxCandidates] = useState("");
  const [maxAttemptsOverride, setMaxAttemptsOverride] = useState("");

  function create() {
    setError(null);
    start(async () => {
      const res = await createSession({
        quizId,
        label,
        expiresInDays: expiryDays
          ? (Number(expiryDays) as 1 | 3 | 7 | 30)
          : null,
        opensInDays: opensDays ? (Number(opensDays) as 1 | 3 | 7 | 30) : null,
        rosterText,
        maxCandidates: maxCandidates ? Number(maxCandidates) : null,
        maxAttemptsOverride: maxAttemptsOverride
          ? Number(maxAttemptsOverride)
          : null,
      });
      if (!res.ok) return setError(res.error);
      toast.success("Session link created");
      setLabel("");
      setExpiryDays("");
      setOpensDays("");
      setRosterText("");
      setMaxCandidates("");
      setMaxAttemptsOverride("");
      router.refresh();
    });
  }

  function toggle(session: AssessmentSession) {
    setError(null);
    start(async () => {
      const res =
        session.status === "active"
          ? await closeSession(quizId, session.id)
          : await reopenSession(quizId, session.id);
      if (!res.ok) return setError(res.error);
      toast.success(
        session.status === "active" ? "Link closed" : "Link reopened",
      );
      router.refresh();
    });
  }

  function remove(session: AssessmentSession) {
    if (
      !window.confirm(
        `Delete "${session.label || "this link"}" permanently? This cannot be undone. The candidates who used it keep their results.`,
      )
    )
      return;
    setError(null);
    start(async () => {
      const res = await deleteSessionPermanently(quizId, session.id);
      if (!res.ok) return setError(res.error);
      toast.success(`"${session.label || "Link"}" deleted`);
      router.refresh();
    });
  }

  async function copyLink(session: AssessmentSession) {
    const url = `${window.location.origin}/assessment/${session.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(session.id);
    setTimeout(() => setCopiedId((id) => (id === session.id ? null : id)), 2000);
  }

  return (
    <div className="space-y-4">
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="slabel">Label (optional)</Label>
          <Input
            id="slabel"
            placeholder="e.g. Batch 3 onboarding"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sopens">Opens</Label>
          <Select
            id="sopens"
            value={opensDays}
            onChange={(e) => setOpensDays(e.target.value)}
          >
            {OPENS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="sexpiry">Expires</Label>
          <Select
            id="sexpiry"
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="smaxcand">Max candidates (optional)</Label>
          <Input
            id="smaxcand"
            type="number"
            min={1}
            placeholder="Unlimited"
            value={maxCandidates}
            onChange={(e) => setMaxCandidates(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="smaxattempts">
            Max attempts per candidate (optional)
          </Label>
          <Input
            id="smaxattempts"
            type="number"
            min={1}
            placeholder="Use quiz default"
            value={maxAttemptsOverride}
            onChange={(e) => setMaxAttemptsOverride(e.target.value)}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="sroster">
            Allowed names (optional — one per line, leave blank to let
            anyone with the link in)
          </Label>
          <Textarea
            id="sroster"
            className="min-h-24"
            placeholder={"Budi Santoso\nSiti Aminah"}
            value={rosterText}
            onChange={(e) => setRosterText(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={create} disabled={pending}>
            Generate link
          </Button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="text-muted-foreground text-sm">No session links yet.</p>
      ) : (
        <ul className="divide-y">
          {sessions.map((s) => (
            <li key={s.id} className="space-y-1.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm">
                  {s.label || "Untitled link"}
                </span>
                <Badge variant={s.status === "active" ? "default" : "outline"}>
                  {s.status}
                </Badge>
                {s.candidateRoster ? (
                  <span className="text-muted-foreground text-xs">
                    {s.candidateRoster.length} allowed name
                    {s.candidateRoster.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Open to anyone with the link
                  </span>
                )}
                {s.startsAt && new Date(s.startsAt) > new Date() ? (
                  <Badge variant="secondary">not open yet</Badge>
                ) : null}
                {s.maxCandidates != null &&
                s.candidatesUsed >= s.maxCandidates ? (
                  <Badge variant="destructive">full</Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs">
                Created {formatDateTimeUTC(s.createdAt)}
                {s.startsAt ? ` · opens ${formatDateTimeUTC(s.startsAt)}` : ""}
                {s.expiresAt ? ` · expires ${formatDateTimeUTC(s.expiresAt)}` : ""}
              </p>
              <p className="text-muted-foreground text-xs">
                {s.candidatesUsed}
                {s.maxCandidates != null ? ` of ${s.maxCandidates}` : ""}{" "}
                candidate{s.candidatesUsed === 1 && s.maxCandidates == null ? "" : "s"}
                {s.maxAttemptsOverride != null
                  ? ` · ${s.maxAttemptsOverride} attempt${s.maxAttemptsOverride === 1 ? "" : "s"} per candidate`
                  : ""}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copyLink(s)}>
                  {copiedId === s.id ? "Copied!" : "Copy link"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => toggle(s)}
                >
                  {s.status === "active" ? "Close" : "Reopen"}
                </Button>
                {viewerIsSuperAdmin ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() => remove(s)}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
