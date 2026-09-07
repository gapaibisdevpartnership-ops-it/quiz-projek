import Link from "next/link";
import { listQuizzes } from "@/features/quizzes/service";
import { listCategories } from "@/features/questions/service";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_STYLES: Record<string, string> = {
  draft: "text-muted-foreground",
  published: "text-emerald-600",
  archived: "text-muted-foreground line-through",
};

export default async function QuizzesPage() {
  const [quizzes, categories] = await Promise.all([
    listQuizzes(),
    listCategories(),
  ]);
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Quiz Management</h1>
        <Link href="/admin/quizzes/new" className={buttonVariants()}>
          + New quiz
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quizzes ({quizzes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {quizzes.length === 0 ? (
            <p className="text-muted-foreground text-sm">No quizzes yet.</p>
          ) : (
            <ul className="divide-y">
              {quizzes.map((q) => (
                <li
                  key={q.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/quizzes/${q.id}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {q.title}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {q.categoryId ? catName.get(q.categoryId) ?? "—" : "No category"}
                      {" · "}
                      {q.passingScore}% to pass · {q.maxAttempts} attempt
                      {q.maxAttempts === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium ${STATUS_STYLES[q.status] ?? ""}`}
                  >
                    {q.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
