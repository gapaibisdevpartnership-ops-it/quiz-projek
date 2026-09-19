import Link from "next/link";
import { listQuizzes } from "@/features/quizzes/service";
import { listCategories } from "@/features/questions/service";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline"
> = {
  draft: "secondary",
  published: "default",
  archived: "outline",
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
        <div>
          <h1 className="text-xl font-semibold">Quiz Management</h1>
          <p className="text-muted-foreground text-sm">
            {quizzes.length} quiz{quizzes.length === 1 ? "" : "zes"}
          </p>
        </div>
        <Button asChild className="gap-1.5">
          <Link href="/admin/quizzes/new">
            <span aria-hidden="true">+</span> New quiz
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {quizzes.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              No quizzes yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Passing score</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quizzes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Link
                        href={`/admin/quizzes/${q.id}`}
                        className="font-medium hover:underline"
                      >
                        {q.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {q.categoryId ? catName.get(q.categoryId) ?? "—" : "—"}
                    </TableCell>
                    <TableCell>{q.passingScore}%</TableCell>
                    <TableCell>
                      {q.maxAttempts} attempt{q.maxAttempts === 1 ? "" : "s"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[q.status] ?? "outline"}>
                        {q.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
