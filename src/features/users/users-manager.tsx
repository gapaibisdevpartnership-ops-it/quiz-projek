"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROLES } from "@/lib/constants";
import type { Profile } from "@/types/domain";
import { inviteUser, updateUser } from "@/features/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function UsersManager({ users }: { users: Profile[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [inv, setInv] = useState({
    fullName: "",
    email: "",
    role: "sales" as (typeof ROLES)[number],
  });

  function invite() {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await inviteUser(inv);
      if (!res.ok) return setError(res.error);
      setInv({ fullName: "", email: "", role: "sales" });
      setNotice(`Invited ${inv.email}. They can reset their password via "Forgot password".`);
      router.refresh();
    });
  }

  function save(u: Profile, patch: Partial<Pick<Profile, "role" | "status">>) {
    setError(null);
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

  return (
    <div className="space-y-6">
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Invite a user</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
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
          <div className="flex items-end">
            <Button
              onClick={invite}
              disabled={pending || !inv.email || !inv.fullName}
            >
              Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {users.map((u) => (
              <li
                key={u.userId}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {u.fullName || "—"}
                  </p>
                  <p className="text-muted-foreground text-xs">{u.email}</p>
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
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
