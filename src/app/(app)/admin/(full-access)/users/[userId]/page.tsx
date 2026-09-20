import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/features/users/service";
import { listTeams } from "@/features/teams/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/local-time";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Trainer",
  sales: "Sales",
  spv: "Supervisor",
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await getUser(userId);
  if (!user) notFound();
  const teams = await listTeams();

  const rows: [string, ReactNode][] = [
    ["Name", user.fullName || "—"],
    ["Email", user.email],
    [
      "Role",
      <Badge key="role" variant="secondary">
        {ROLE_LABEL[user.role] ?? user.role}
      </Badge>,
    ],
    [
      "Status",
      <Badge key="status" variant={user.status === "active" ? "default" : "outline"}>
        {user.status}
      </Badge>,
    ],
    ["Joined", <LocalTime key="joined" iso={user.createdAt} />],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{user.fullName || user.email}</h1>
        <Link className="text-sm underline" href="/admin/users">
          Back to users
        </Link>
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground mt-3 text-xs">
            Change role or status from the{" "}
            <Link className="underline" href="/admin/users">
              Users list
            </Link>
            . Team membership is managed on{" "}
            <Link className="underline" href="/admin/teams">
              Teams
            </Link>{" "}
            ({teams.length} team{teams.length === 1 ? "" : "s"}).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
