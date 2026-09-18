import Link from "next/link";
import { notFound } from "next/navigation";
import { getAttemptDetail } from "@/features/results/service";
import { EssayGradeForm } from "@/features/grading/essay-grade-form";
import { scoreLabel } from "@/lib/scoring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function AttemptDetailPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const d = await getAttemptDetail(attemptId);
  if (!d) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{d.quizTitle}</h1>
          <p className="text-muted-foreground text-sm">
            {d.userName}
            {d.isGuest ? " (via session link)" : ""} · attempt #
            {d.attemptNumber} · {d.status.replace("_", " ")}
          </p>
        </div>
        <Link className="text-sm underline" href="/admin/results">
          All results
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Score</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            {[
              ["Objective", scoreLabel(d.autoScore, d.totalPoints)],
              ["Manual (essays)", d.manualScore != null ? String(d.manualScore) : "—"],
              ["Final", scoreLabel(d.finalScore, d.totalPoints)],
              ["Percentage", d.percentage != null ? `${d.percentage}%` : "—"],
              [
                "Result",
                d.passed == null ? "—" : d.passed ? "Passed" : "Not passed",
              ],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b py-1">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {d.questions.map((q, i) => (
          <Card key={q.attemptQuestionId}>
            <CardHeader>
              <CardTitle className="text-base">
                {i + 1}. {q.text || "(image-only)"}{" "}
                <span className="text-muted-foreground text-xs font-normal">
                  · {q.type.replace("_", " ")} · {q.points} pt
                </span>
              </CardTitle>
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
                  <ul className="space-y-1">
                    {q.options.map((o) => (
                      <li
                        key={o.id}
                        className={cn(
                          "flex items-center gap-2 rounded border p-2",
                          o.isCorrect && "border-emerald-500/60 bg-emerald-500/5",
                          o.selected && !o.isCorrect &&
                            "border-destructive/60 bg-destructive/5",
                        )}
                      >
                        <span className="text-xs">
                          {o.selected ? "☑" : "☐"}
                        </span>
                        <span>{o.text || "(image)"}</span>
                        {o.isCorrect ? (
                          <span className="ml-auto text-xs text-emerald-600">
                            correct
                          </span>
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
