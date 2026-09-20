import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuiz, getQuizPreviewItems } from "@/features/quizzes/service";
import { QuestionRenderer } from "@/features/questions/renderer";

export default async function QuizPreviewPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const quiz = await getQuiz(quizId);
  if (!quiz) notFound();
  const items = await getQuizPreviewItems(quizId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Preview · {quiz.title}</h1>
          <p className="text-muted-foreground text-sm">
            Rendered as the sales user sees it. No attempt is created.
          </p>
        </div>
        <Link className="text-sm underline" href={`/admin/quizzes/${quizId}`}>
          Back to overview
        </Link>
      </div>

      {quiz.instructions ? (
        <div className="rounded-md border bg-muted/40 p-4 text-sm">
          {quiz.instructions}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          This quiz has no questions yet.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((it, i) => (
            <QuestionRenderer
              key={it.id}
              index={i}
              question={it.question}
              options={it.options}
              points={it.points}
              revealCorrect
            />
          ))}
        </div>
      )}
    </div>
  );
}
