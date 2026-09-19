import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckSquare2, ChevronLeft, Square } from "lucide-react";
import { getAttemptDetail } from "@/features/results/service";
import { EssayGradeForm } from "@/features/grading/essay-grade-form";
import { scoreLabel } from "@/lib/scoring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
  pending_review: "Pending review",
  submitted: "Submitted",
  expired: "Expired",
};

export default async function AttemptDetailPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const d = await getAttemptDetail(attemptId);
  if (!d) notFound();

  const hasResult = d.passed != null;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/results"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        All results
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{d.quizTitle}</h1>
          <p className="text-muted-foreground text-sm">
            {d.userName}
            {d.isGuest ? (
              <Badge variant="secondary" className="ml-1.5 align-middle">
                via session link
              </Badge>
            ) : null}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Badge variant="outline">Attempt #{d.attemptNumber}</Badge>
          <Badge variant={d.status === "submitted" ? "default" : "outline"}>
            {STATUS_LABEL[d.status] ?? d.status}
          </Badge>
        </div>
      </div>

      {hasResult ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-4 rounded-xl border p-6",
            d.passed
              ? "border-primary/30 bg-primary/5"
              : "border-destructive/30 bg-destructive/5",
          )}
        >
          <div>
            <p
              className={cn(
                "text-4xl font-semibold tabular-nums",
                d.passed ? "text-primary" : "text-destructive",
              )}
            >
              {d.percentage != null ? `${d.percentage}%` : "—"}
            </p>
            <p
              className={cn(
                "mt-1 text-sm font-medium",
                d.passed ? "text-primary" : "text-destructive",
              )}
            >
              {d.passed ? "Passed" : "Not passed"}
            </p>
          </div>
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-muted-foreground">Objective</dt>
              <dd className="font-medium tabular-nums">
                {scoreLabel(d.autoScore, d.totalPoints)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Manual (essays)</dt>
              <dd className="font-medium tabular-nums">
                {d.manualScore != null ? d.manualScore : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Final</dt>
              <dd className="font-medium tabular-nums">
                {scoreLabel(d.finalScore, d.totalPoints)}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-center text-sm">
            {d.status === "pending_review"
              ? "Awaiting essay grading before a final score can be shown."
              : "This attempt has no score yet."}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {d.questions.map((q, i) => (
          <Card key={q.attemptQuestionId}>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                <span className="text-muted-foreground">{i + 1}.</span>{" "}
                {q.text || "(image-only)"}
              </CardTitle>
              <p className="text-muted-foreground text-xs">
                {q.type.replace("_", " ")} · {q.points} pt
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {q.type === "essay" ? (
                <>
                  <div>
                    <p className="text-muted-foreground text-xs">Answer</p>
                    <p className="whitespace-pre-wrap">
                      {q.essay?.text || <em>No answer submitted</em>}
                    </p>
                  </div>
                  {q.sampleAnswer ? (
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Sample answer
                      </p>
                      <p className="whitespace-pre-wrap">{q.sampleAnswer}</p>
                    </div>
                  ) : null}
                  {q.gradingNotes ? (
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Grading notes
                      </p>
                      <p className="whitespace-pre-wrap">{q.gradingNotes}</p>
                    </div>
                  ) : null}
                  {q.essay?.answerId ? (
                    <EssayGradeForm
                      answerId={q.essay.answerId}
                      attemptId={d.id}
                      maxPoints={q.points}
                      currentScore={q.essay.manualScore}
                      currentFeedback={q.essay.feedback}
                      keywords={q.keywords}
                      answerText={q.essay.text}
                    />
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      No answer row to grade — the trainee left this blank.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <ul className="space-y-1.5">
                    {q.options.map((o) => (
                      <li
                        key={o.id}
                        className={cn(
                          "flex items-center gap-2 rounded-md border p-2",
                          o.isCorrect && "border-primary bg-primary/5",
                          o.selected &&
                            !o.isCorrect &&
                            "border-destructive bg-destructive/5",
                        )}
                      >
                        {o.selected ? (
                          <CheckSquare2
                            className="text-foreground size-4 shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <Square
                            className="text-muted-foreground size-4 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <span>{o.text || "(image)"}</span>
                        {o.isCorrect ? (
                          <Badge className="ml-auto">Correct</Badge>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs">
                    Awarded: <strong>{q.awardedObjective}</strong> / {q.points}
                  </p>
                </>
              )}
              {q.explanation ? (
                <p className="text-muted-foreground text-xs">
                  <span className="font-medium">Explanation: </span>
                  {q.explanation}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
