import { requireProfile } from "@/features/auth/service";
import { getLeaderboard } from "@/features/analytics/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LeaderboardPage() {
  const me = await requireProfile();
  const rows = await getLeaderboard(20);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Leaderboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Top sales by average score</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No finalized attempts yet.
            </p>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
