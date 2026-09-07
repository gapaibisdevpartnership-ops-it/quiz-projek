import { notFound } from "next/navigation";
import { getQuiz } from "@/features/quizzes/service";
import { listCategories } from "@/features/questions/service";
import { QuizSettingsForm } from "@/features/quizzes/quiz-settings-form";

export default async function EditQuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const [quiz, categories] = await Promise.all([
    getQuiz(quizId),
    listCategories(),
  ]);
  if (!quiz) notFound();
  return <QuizSettingsForm categories={categories} quiz={quiz} />;
}
