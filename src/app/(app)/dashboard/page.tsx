import Link from "next/link";
import { requireProfile } from "@/features/auth/service";
import { isAdminRole } from "@/lib/constants";
import { getAdminKpis } from "@/features/analytics/service";
import { listMyAttempts } from "@/features/attempts/service";
import { listMyAssignedQuizzes } from "@/features/assignments/service";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
            : "Your training dashboard."}
        </p>
      </div>

      {admin ? <AdminStats /> : <SalesStats />}

      <Card>
        <CardHeader>
          <CardTitle>{admin ? "Quick links" : "Get started"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          {(admin
            ? [
                ["Question Bank", "/admin/questions"],
                ["Quizzes", "/admin/quizzes"],
                ["Grading", "/admin/grading"],
                ["Analytics", "/admin/analytics"],
              ]
            : [
                ["My quizzes", "/quizzes"],
                ["History", "/history"],
                ["Leaderboard", "/leaderboard"],
              ]
          ).map(([label, href]) => (
            <Link key={href} href={href} className="underline">
              {label}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

async function AdminStats() {
  const k = await getAdminKpis();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <StatCard label="Active sales" value={k.totalSales} />
      <StatCard label="Published quizzes" value={k.activeQuizzes} />
      <StatCard label="Completed attempts" value={k.completedAttempts} />
      <StatCard label="Pending reviews" value={k.pendingReviews} />
      <StatCard
        label="Average score"
        value={k.averageScore == null ? "—" : `${k.averageScore}%`}
      />
      <StatCard
        label="Pass rate"
        value={k.passRate == null ? "—" : `${k.passRate}%`}
      />
    </div>
  );
}

async function SalesStats() {
  const [attempts, assigned] = await Promise.all([
    listMyAttempts(),
    listMyAssignedQuizzes(),
  ]);
  const finished = attempts.filter((a) => a.status === "submitted");
  const scored = finished.filter((a) => a.percentage != null);
  const avg = scored.length
    ? Math.round(
        (scored.reduce((s, a) => s + (a.percentage as number), 0) /
          scored.length) *
          10,
      ) / 10
    : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Assigned quizzes" value={assigned.length} />
      <StatCard
        label="In progress"
        value={attempts.filter((a) => a.status === "in_progress").length}
      />
      <StatCard label="Completed" value={finished.length} />
      <StatCard label="Average score" value={avg == null ? "—" : `${avg}%`} />
    </div>
  );
}
