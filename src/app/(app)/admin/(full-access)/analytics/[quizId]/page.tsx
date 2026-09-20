import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuiz } from "@/features/quizzes/service";
import { getQuestionAnalytics } from "@/features/analytics/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Answered</TableHead>
                  <TableHead>Correct</TableHead>
                  <TableHead>Correct rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((s, i) => (
                  <TableRow key={i} className="align-top">
                    <TableCell className="max-w-md whitespace-normal">
                      {s.questionText || "(image-only)"}
                    </TableCell>
                    <TableCell>{s.type.replace("_", " ")}</TableCell>
                    <TableCell>{s.answered}</TableCell>
                    <TableCell>{s.correct}</TableCell>
                    <TableCell>
                      {s.correctRate == null ? "—" : `${s.correctRate}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-muted-foreground mt-3 text-xs">
            Essay questions are excluded — they have no objective correct answer.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
