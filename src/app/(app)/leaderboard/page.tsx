import { Suspense } from "react";
import { requireProfile } from "@/features/auth/service";
import { getLeaderboard } from "@/features/analytics/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeaderboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Leaderboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Top sales by average score</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LeaderboardRowsSkeleton />}>
            <LeaderboardRows />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function LeaderboardRows() {
  const [me, rows] = await Promise.all([requireProfile(), getLeaderboard(20)]);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No finalized attempts yet.
      </p>
    );
  }

  return (
    <ol className="divide-y">
      {rows.map((r, i) => (
        <li
          key={r.userId}
          className={
            "flex items-center justify-between py-2 text-sm " +
            (r.userId === me.userId ? "font-semibold" : "")
          }
        >
          <span>
            <span className="text-muted-foreground mr-2 tabular-nums">
              {i + 1}.
            </span>
            {r.name}
            {r.userId === me.userId ? " (you)" : ""}
          </span>
          <span className="text-muted-foreground">
            {r.avgPercentage == null ? "—" : `${r.avgPercentage}%`} ·{" "}
            {r.passedCount}/{r.attempts} passed
          </span>
        </li>
      ))}
    </ol>
  );
}

function LeaderboardRowsSkeleton() {
  return (
    <ol className="divide-y">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center justify-between py-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
        </li>
      ))}
    </ol>
  );
}
