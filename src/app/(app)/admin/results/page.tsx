import Link from "next/link";
import { listAllAttempts } from "@/features/results/service";
import { formatDateTimeUTC } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ResultsPage() {
  const attempts = await listAllAttempts();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Results</h1>
      <Card>
        <CardHeader>
          <CardTitle>Attempts ({attempts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No attempts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-left text-xs">
                  <tr>
                    <th className="py-2">Quiz</th>
                    <th>User</th>
                    <th>#</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="py-2 whitespace-nowrap">
                        <Link
                          href={`/admin/results/${a.id}`}
                          className="font-medium hover:underline"
                        >
                          {a.quizTitle}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">
                        {a.userName}
                        {a.isGuest ? (
                          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            via session link
                          </span>
                        ) : null}
                      </td>
                      <td>{a.attemptNumber}</td>
                      <td className="whitespace-nowrap">
                        {a.status.replace("_", " ")}
                      </td>
                      <td className="whitespace-nowrap">
                        {a.percentage != null ? `${a.percentage}%` : "—"}
                        {a.passed == null
                          ? ""
                          : a.passed
                            ? " ✓"
                            : " ✗"}
                      </td>
                      <td className="text-muted-foreground whitespace-nowrap text-xs">
                        {formatDateTimeUTC(a.submittedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
