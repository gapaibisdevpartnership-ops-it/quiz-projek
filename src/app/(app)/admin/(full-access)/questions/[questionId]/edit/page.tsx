import { notFound } from "next/navigation";
import { getQuestion, listCategories } from "@/features/questions/service";
import { QuestionEditor } from "@/features/questions/question-editor";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const { questionId } = await params;
  const [question, categories] = await Promise.all([
    getQuestion(questionId),
    listCategories(),
  ]);
  if (!question) notFound();

  return (
    <QuestionEditor
      categories={categories}
      scopeId={question.id}
      question={question}
    />
  );
}
