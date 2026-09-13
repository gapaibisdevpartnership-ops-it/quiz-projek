import Link from "next/link";
import { listCategories, listQuestions } from "@/features/questions/service";
import { QUESTION_TYPE_LABELS } from "@/lib/validation/question";
import { CategoryManager } from "@/features/questions/category-manager";
import { QuestionRowActions } from "@/features/questions/question-row-actions";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function QuestionBankPage() {
  const [questions, categories] = await Promise.all([
    listQuestions({ status: "active" }),
    listCategories(),
  ]);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Question Bank</h1>
        <Link href="/admin/questions/new" className={buttonVariants()}>
          + New question
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Questions ({questions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {questions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No questions yet. Create your first reusable question.
              </p>
            ) : (
              <ul className="divide-y">
                {questions.map((q) => (
                  <li
                    key={q.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {q.questionText || "(image-only question)"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {QUESTION_TYPE_LABELS[q.questionType]}
                        {q.categoryId
                          ? ` · ${categoryName.get(q.categoryId) ?? "—"}`
                          : ""}
                        {q.difficulty ? ` · ${q.difficulty}` : ""}
                      </p>
                    </div>
                    <QuestionRowActions questionId={q.id} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryManager categories={categories} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
