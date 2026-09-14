"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ROLES } from "@/lib/constants";
import type { Profile } from "@/types/domain";
import {
  inviteUser,
  resetUserPassword,
  updateUser,
} from "@/features/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function UsersManager({ users }: { users: Profile[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const [inv, setInv] = useState({
    fullName: "",
    email: "",
    role: "sales" as (typeof ROLES)[number],
    password: "",
  });

  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  function invite() {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await inviteUser(inv);
      if (!res.ok) return setError(res.error);
      setInv({ fullName: "", email: "", role: "sales", password: "" });
      setNotice(
        `Created ${inv.email}. Give them the temporary password — they must change it on first sign-in.`,
      );
      router.refresh();
    });
  }

  function save(u: Profile, patch: Partial<Pick<Profile, "role" | "status">>) {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await updateUser(u.userId, {
        fullName: u.fullName,
        role: patch.role ?? u.role,
        status: patch.status ?? u.status,
      });
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  function resetPassword(u: Profile) {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await resetUserPassword(u.userId, { password: newPassword });
      if (!res.ok) return setError(res.error);
      setResettingId(null);
      setNewPassword("");
      setNotice(
        `Password reset for ${u.email}. Give them the new one — they must change it on next sign-in.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <Button
          onClick={() => setInviteOpen(true)}
          className="gap-1.5"
        >
          <Plus className="size-4" aria-hidden="true" /> Invite User
        </Button>
      </div>

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {notice && !inviteOpen ? <Alert variant="success">{notice}</Alert> : null}

      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => {
          setInviteOpen(o);
          if (!o) {
            setError(null);
            setNotice(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
            <DialogDescription>
              Create a new user account with a temporary password.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 py-4">
            <div className="space-y-1">
              <Label htmlFor="iname">Name</Label>
              <Input
                id="iname"
                value={inv.fullName}
                onChange={(e) => setInv({ ...inv, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="iemail">Email</Label>
              <Input
                id="iemail"
                type="email"
                value={inv.email}
                onChange={(e) => setInv({ ...inv, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="irole">Role</Label>
              <Select
                id="irole"
                value={inv.role}
                onChange={(e) =>
                  setInv({ ...inv, role: e.target.value as typeof inv.role })
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ipw">Temporary password</Label>
              <Input
                id="ipw"
                type="text"
                autoComplete="off"
                placeholder="min. 8 characters"
                value={inv.password}
                onChange={(e) => setInv({ ...inv, password: e.target.value })}
              />
            </div>
          </div>
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          {notice ? (
            <div className="space-y-3">
              <Alert variant="success">{notice}</Alert>
              <Button
                onClick={() => {
                  setInviteOpen(false);
                  setNotice(null);
                }}
                className="w-full"
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                onClick={invite}
                disabled={
                  pending ||
                  !inv.email ||
                  !inv.fullName ||
                  inv.password.length < 8
                }
              >
                Create user
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {users.map((u) => (
              <li key={u.userId} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {u.fullName || "—"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {u.email}
                      {u.mustChangePassword ? " · must change password" : ""}
                    </p>
                  </div>
                  <Select
                    value={u.role}
                    disabled={pending}
                    className="h-8 w-36"
                    onChange={(e) =>
                      save(u, { role: e.target.value as Profile["role"] })
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant={u.status === "active" ? "outline" : "default"}
                    disabled={pending}
                    onClick={() =>
                      save(u, {
                        status: u.status === "active" ? "inactive" : "active",
                      })
                    }
                  >
                    {u.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      setResettingId(
                        resettingId === u.userId ? null : u.userId,
                      );
                      setNewPassword("");
                    }}
                  >
                    Reset password
                  </Button>
                </div>

                {resettingId === u.userId ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`pw-${u.userId}`}>
                        New temporary password
                      </Label>
                      <Input
                        id={`pw-${u.userId}`}
                        type="text"
                        autoComplete="off"
                        placeholder="min. 8 characters"
                        className="h-8 w-56"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={pending || newPassword.length < 8}
                      onClick={() => resetPassword(u)}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        setResettingId(null);
                        setNewPassword("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
