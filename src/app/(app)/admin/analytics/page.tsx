import Link from "next/link";
import {
  getAdminKpis,
  getQuizAnalytics,
  getSalesPerformance,
} from "@/features/analytics/service";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const pct = (n: number | null) => (n == null ? "—" : `${n}%`);

export default async function AnalyticsPage() {
  const [kpis, quizzes, sales] = await Promise.all([
    getAdminKpis(),
    getQuizAnalytics(),
    getSalesPerformance(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Analytics</h1>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Active sales" value={kpis.totalSales} />
        <StatCard label="Published quizzes" value={kpis.activeQuizzes} />
        <StatCard label="Completed attempts" value={kpis.completedAttempts} />
        <StatCard label="Pending reviews" value={kpis.pendingReviews} />
        <StatCard label="Average score" value={pct(kpis.averageScore)} />
        <StatCard label="Pass rate" value={pct(kpis.passRate)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By quiz</CardTitle>
        </CardHeader>
        <CardContent>
          {quizzes.length === 0 ? (
            <p className="text-muted-foreground text-sm">No quizzes.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left text-xs">
                <tr>
                  <th className="py-2">Quiz</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Finished</th>
                  <th>Pending</th>
                  <th>Avg</th>
                  <th>Pass rate</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((q) => (
                  <tr key={q.quizId} className="border-t">
                    <td className="py-2">
                      <Link
                        href={`/admin/analytics/${q.quizId}`}
                        className="font-medium hover:underline"
                      >
                        {q.title}
                      </Link>
                    </td>
                    <td>{q.status}</td>
                    <td>{q.attempts}</td>
                    <td>{q.finished}</td>
                    <td>{q.pending}</td>
                    <td>{pct(q.avgPercentage)}</td>
                    <td>{pct(q.passRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales performance</CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sales users.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left text-xs">
                <tr>
                  <th className="py-2">Name</th>
                  <th>Attempts</th>
                  <th>Passed</th>
                  <th>Avg score</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.userId} className="border-t">
                    <td className="py-2 font-medium">{s.name}</td>
                    <td>{s.attempts}</td>
                    <td>{s.passed}</td>
                    <td>{pct(s.avgPercentage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
