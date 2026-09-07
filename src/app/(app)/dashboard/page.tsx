import { requireProfile } from "@/features/auth/service";
import { isAdminRole } from "@/lib/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const admin = isAdminRole(profile.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">
          Welcome, {profile.fullName || profile.email}
        </h1>
        <p className="text-muted-foreground text-sm">
          {admin
            ? "Trainer workspace. Build quizzes, assign them, and review results."
            : "Your training dashboard. Assigned quizzes will appear here."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(admin
          ? ["Total Sales", "Active Quizzes", "Completed Attempts", "Pending Reviews"]
          : ["Available", "In Progress", "Completed", "Average Score"]
        ).map((label) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">—</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase 1 complete</CardTitle>
          <CardDescription>
            Auth, profiles, roles, route protection and the RLS baseline are in
            place. Question bank and quiz builder come next.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Signed in as <span className="font-medium">{profile.role}</span>.
        </CardContent>
      </Card>
    </div>
  );
}
