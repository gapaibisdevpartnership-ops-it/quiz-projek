import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuiz } from "@/features/quizzes/service";
import { getQuestionAnalytics } from "@/features/analytics/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function QuizAnalyticsPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const quiz = await getQuiz(quizId);
  if (!quiz) notFound();
  const stats = await getQuestionAnalytics(quizId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{quiz.title} — questions</h1>
        <Link className="text-sm underline" href="/admin/analytics">
          Back to analytics
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Objective questions</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No answered objective questions yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left text-xs">
                <tr>
                  <th className="py-2">Question</th>
                  <th>Type</th>
                  <th>Answered</th>
                  <th>Correct</th>
                  <th>Correct rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="max-w-md py-2">
                      {s.questionText || "(image-only)"}
                    </td>
                    <td>{s.type.replace("_", " ")}</td>
                    <td>{s.answered}</td>
                    <td>{s.correct}</td>
                    <td>
                      {s.correctRate == null ? "—" : `${s.correctRate}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-muted-foreground mt-3 text-xs">
            Essay questions are excluded — they have no objective correct answer.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
