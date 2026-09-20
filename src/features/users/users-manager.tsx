"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, MoreHorizontal, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { ROLES } from "@/lib/constants";
import type { Profile } from "@/types/domain";
import {
  deleteUserPermanently,
  inviteUser,
  resetUserPassword,
  updateUser,
} from "@/features/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
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

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Trainer",
  sales: "Sales",
  spv: "Supervisor",
};

function initials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0][0], parts[1][0]] : [source[0]];
  return letters.join("").toUpperCase();
}

export function UsersManager({
  users,
  viewerId,
  viewerIsSuperAdmin,
}: {
  users: Profile[];
  viewerId: string;
  viewerIsSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  const [inv, setInv] = useState({
    fullName: "",
    email: "",
    role: "sales" as (typeof ROLES)[number],
    password: "",
  });

  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeSuperAdminCount = users.filter(
    (u) => u.role === "super_admin" && u.status === "active",
  ).length;

  function deactivateBlockedReason(u: Profile): string | null {
    if (u.status !== "active") return null;
    if (u.userId === viewerId) return "You cannot deactivate your own account.";
    if (u.role === "super_admin" && activeSuperAdminCount <= 1)
      return "There must be at least one active super admin.";
    return null;
  }

  function invite() {
    setInviteError(null);
    setInviteNotice(null);
    start(async () => {
      const res = await inviteUser(inv);
      if (!res.ok) return setInviteError(res.error);
      setInv({ fullName: "", email: "", role: "sales", password: "" });
      setInviteNotice(
        `Created ${inv.email}. Give them the temporary password — they must change it on first sign-in.`,
      );
      router.refresh();
    });
  }

  function save(u: Profile, patch: Partial<Pick<Profile, "role" | "status">>) {
    start(async () => {
      const res = await updateUser(u.userId, {
        fullName: u.fullName,
        role: patch.role ?? u.role,
        status: patch.status ?? u.status,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (patch.status) {
        toast.success(
          patch.status === "active"
            ? `${u.email} activated`
            : `${u.email} deactivated`,
        );
      } else if (patch.role) {
        toast.success(`${u.email} is now ${ROLE_LABEL[patch.role] ?? patch.role}`);
      }
      router.refresh();
    });
  }

  function resetPassword() {
    if (!resetTarget) return;
    setResetError(null);
    start(async () => {
      const res = await resetUserPassword(resetTarget.userId, {
        password: newPassword,
      });
      if (!res.ok) return setResetError(res.error);
      toast.success(`Password reset for ${resetTarget.email}`);
      setResetTarget(null);
      setNewPassword("");
      router.refresh();
    });
  }

  function deleteForever() {
    if (!deleteTarget) return;
    setDeleteError(null);
    start(async () => {
      const res = await deleteUserPermanently(deleteTarget.userId);
      if (!res.ok) return setDeleteError(res.error);
      toast.success(`${deleteTarget.email} was permanently deleted`);
      setDeleteTarget(null);
      setConfirmEmail("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-muted-foreground text-sm">
            {users.length} account{users.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-1.5">
          <Plus className="size-4" aria-hidden="true" /> Invite user
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground"
                        aria-hidden="true"
                      >
                        {initials(u.fullName ?? "", u.email)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {u.fullName || "—"}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {u.email}
                        </p>
                      </div>
                      {u.mustChangePassword ? (
                        <Badge variant="outline" className="shrink-0">
                          must change password
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      disabled={pending}
                      className="h-8 w-36 py-1"
                      aria-label={`Role for ${u.email}`}
                      onChange={(e) =>
                        save(u, { role: e.target.value as Profile["role"] })
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r] ?? r}
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.status === "active" ? "default" : "outline"}>
                      {u.status}
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
                          aria-label={`Actions for ${u.email}`}
                        >
                          <MoreHorizontal className="size-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={deactivateBlockedReason(u) !== null}
                          title={deactivateBlockedReason(u) ?? undefined}
                          onClick={() =>
                            save(u, {
                              status: u.status === "active" ? "inactive" : "active",
                            })
                          }
                        >
                          {u.status === "active" ? (
                            <UserX aria-hidden="true" />
                          ) : (
                            <UserCheck aria-hidden="true" />
                          )}
                          {u.status === "active" ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setResetError(null);
                            setNewPassword("");
                            setResetTarget(u);
                          }}
                        >
                          <KeyRound aria-hidden="true" />
                          Reset password
                        </DropdownMenuItem>
                        {viewerIsSuperAdmin && u.userId !== viewerId ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                setDeleteError(null);
                                setConfirmEmail("");
                                setDeleteTarget(u);
                              }}
                            >
                              <Trash2 aria-hidden="true" />
                              Delete permanently
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
        </CardContent>
      </Card>

      {/* Invite */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => {
          setInviteOpen(o);
          if (!o) {
            setInviteError(null);
            setInviteNotice(null);
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
                    {ROLE_LABEL[r] ?? r}
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
          {inviteError ? <Alert variant="destructive">{inviteError}</Alert> : null}
          {inviteNotice ? (
            <div className="space-y-3">
              <Alert variant="success">{inviteNotice}</Alert>
              <Button
                onClick={() => {
                  setInviteOpen(false);
                  setInviteNotice(null);
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

      {/* Reset password */}
      <Dialog
        open={resetTarget != null}
        onOpenChange={(o) => {
          if (!o) {
            setResetTarget(null);
            setResetError(null);
            setNewPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new temporary password for{" "}
              <strong>{resetTarget?.email}</strong>. They must change it on
              their next sign-in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="newpw">New temporary password</Label>
            <Input
              id="newpw"
              type="text"
              autoComplete="off"
              placeholder="min. 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          {resetError ? <Alert variant="destructive">{resetError}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setResetTarget(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={pending || newPassword.length < 8}
              onClick={resetPassword}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog
        open={deleteTarget != null}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
            setDeleteError(null);
            setConfirmEmail("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user permanently</DialogTitle>
            <DialogDescription>
              This permanently deletes <strong>{deleteTarget?.email}</strong>{" "}
              — it cannot be undone. Their own quiz attempts are deleted too.
              Content they created, assigned, or graded (questions, quizzes,
              assignments, session links) is kept, just no longer attributed
              to them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="delconfirm">
              Type <span className="font-mono">{deleteTarget?.email}</span> to
              confirm
            </Label>
            <Input
              id="delconfirm"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
            />
          </div>
          {deleteError ? <Alert variant="destructive">{deleteError}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || confirmEmail !== deleteTarget?.email}
              onClick={deleteForever}
            >
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
