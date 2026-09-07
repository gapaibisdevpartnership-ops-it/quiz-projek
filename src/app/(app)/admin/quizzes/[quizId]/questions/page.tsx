import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuiz, getQuizQuestions } from "@/features/quizzes/service";
import { listQuestions } from "@/features/questions/service";
import { QuizQuestionsBuilder } from "@/features/quizzes/quiz-questions-builder";

export default async function QuizQuestionsPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const quiz = await getQuiz(quizId);
  if (!quiz) notFound();

  const [attached, allActive] = await Promise.all([
    getQuizQuestions(quizId),
    listQuestions({ status: "active" }),
  ]);
  const attachedIds = new Set(attached.map((a) => a.questionId));
  const available = allActive.filter((q) => !attachedIds.has(q.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{quiz.title}</h1>
          <p className="text-muted-foreground text-sm">Build the question set</p>
        </div>
        <Link className="text-sm underline" href={`/admin/quizzes/${quizId}`}>
          Back to overview
        </Link>
      </div>
      <QuizQuestionsBuilder
        quizId={quizId}
        attached={attached}
        available={available}
      />
    </div>
  );
}
