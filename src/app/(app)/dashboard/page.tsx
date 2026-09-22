import Link from "next/link";
import { Suspense } from "react";
import {
  BarChart3,
  BookOpen,
  CheckSquare,
  ClipboardList,
  History,
  Trophy,
} from "lucide-react";
import { requireProfile } from "@/features/auth/service";
import { isAdminRole } from "@/lib/constants";
import { getAdminKpis } from "@/features/analytics/service";
import { listMyAttempts } from "@/features/attempts/service";
import { listMyAssignedQuizzes } from "@/features/assignments/service";
import { StatCard } from "@/components/stat-card";
import { RecentActivity } from "@/components/recent-activity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ADMIN_LINKS = [
  {
    label: "Question Bank",
    href: "/admin/questions",
    description: "Manage reusable questions",
    icon: BookOpen,
  },
  {
    label: "Quizzes",
    href: "/admin/quizzes",
    description: "Build and publish quizzes",
    icon: ClipboardList,
  },
  {
    label: "Grading",
    href: "/admin/grading",
    description: "Review pending essay answers",
    icon: CheckSquare,
  },
  {
    label: "Analytics",
    href: "/admin/analytics",
    description: "See performance trends",
    icon: BarChart3,
  },
];

const SALES_LINKS = [
  {
    label: "My quizzes",
    href: "/quizzes",
    description: "See what's assigned to you",
    icon: ClipboardList,
  },
  {
    label: "History",
    href: "/history",
    description: "Review your past attempts",
    icon: History,
  },
  {
    label: "Leaderboard",
    href: "/leaderboard",
    description: "See how you rank",
    icon: Trophy,
  },
];

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

      <Suspense fallback={<StatsSkeleton admin={admin} />}>
        {admin ? <AdminStats /> : <SalesStats />}
      </Suspense>

      {admin ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Suspense fallback={<RecentActivitySkeleton />}>
            <RecentActivity />
          </Suspense>
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Quick links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {ADMIN_LINKS.map(({ label, href, description, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="hover:bg-accent/50 flex items-center gap-3 rounded-md p-2 -mx-2 transition-colors"
                >
                  <div className="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-muted-foreground text-xs">
                      {description}
                    </p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-medium">Get started</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SALES_LINKS.map(({ label, href, description, icon: Icon }) => (
              <Link key={href} href={href}>
                <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/50">
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-muted-foreground text-xs">
                        {description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

async function AdminStats() {
  const k = await getAdminKpis();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Active sales" value={k.totalSales} />
      <StatCard label="Published quizzes" value={k.activeQuizzes} />
      <StatCard label="Completed attempts" value={k.completedAttempts} />
      <StatCard
        label="Pending reviews"
        value={k.pendingReviews}
        href="/admin/grading"
        emphasize={k.pendingReviews > 0}
        hint={k.pendingReviews > 0 ? "Needs grading" : undefined}
      />
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
  const inProgress = attempts.filter((a) => a.status === "in_progress").length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Assigned quizzes" value={assigned.length} />
      <StatCard
        label="In progress"
        value={inProgress}
        emphasize={inProgress > 0}
        hint={inProgress > 0 ? "Pick up where you left off" : undefined}
      />
      <StatCard label="Completed" value={finished.length} />
      <StatCard label="Average score" value={avg == null ? "—" : `${avg}%`} />
    </div>
  );
}

const ADMIN_STAT_LABELS = [
  "Active sales",
  "Published quizzes",
  "Completed attempts",
  "Pending reviews",
  "Average score",
  "Pass rate",
];

const SALES_STAT_LABELS = [
  "Assigned quizzes",
  "In progress",
  "Completed",
  "Average score",
];

function StatsSkeleton({ admin }: { admin: boolean }) {
  const labels = admin ? ADMIN_STAT_LABELS : SALES_STAT_LABELS;
  return (
    <div
      className={cn(
        "grid gap-4",
        admin
          ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          : "sm:grid-cols-2 lg:grid-cols-4",
      )}
    >
      {labels.map((label) => (
        <StatCard key={label} label={label} loading />
      ))}
    </div>
  );
}

function RecentActivitySkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent activity</CardTitle>
        <span className="text-muted-foreground text-sm">View all</span>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center justify-between gap-4 py-2.5">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-12" />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
