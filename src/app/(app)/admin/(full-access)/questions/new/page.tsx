import { randomUUID } from "node:crypto";
import { listCategories } from "@/features/questions/service";
import { QuestionEditor } from "@/features/questions/question-editor";

export default async function NewQuestionPage() {
  const categories = await listCategories();
  // Stable folder segment for any images uploaded before the row exists.
  return (
    <QuestionEditor categories={categories} scopeId={`draft-${randomUUID()}`} />
  );
}
