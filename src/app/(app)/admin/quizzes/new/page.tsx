import { listCategories } from "@/features/questions/service";
import { QuizSettingsForm } from "@/features/quizzes/quiz-settings-form";

export default async function NewQuizPage() {
  const categories = await listCategories();
  return <QuizSettingsForm categories={categories} />;
}
