import type { ReactNode } from "react";
import { requireProfile } from "@/features/auth/service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Trainer",
  sales: "Sales",
  spv: "Supervisor",
};

export default async function ProfilePage() {
  const profile = await requireProfile();

  const rows: [string, ReactNode][] = [
    ["Name", profile.fullName || "—"],
    ["Email", profile.email],
    [
      "Role",
      <Badge key="role" variant="secondary">
        {ROLE_LABEL[profile.role] ?? profile.role}
      </Badge>,
    ],
    [
      "Status",
      <Badge
        key="status"
        variant={profile.status === "active" ? "default" : "outline"}
      >
        {profile.status}
      </Badge>,
    ],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Profile</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Account details</CardTitle>
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
        </CardContent>
      </Card>
    </div>
  );
}
