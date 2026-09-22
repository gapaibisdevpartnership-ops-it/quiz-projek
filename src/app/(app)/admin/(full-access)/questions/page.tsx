import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireProfile } from "@/features/auth/service";
import { listCategories, listQuestions } from "@/features/questions/service";
import { QUESTION_TYPE_LABELS } from "@/lib/validation/question";
import { CategoryManager } from "@/features/questions/category-manager";
import { QuestionRowActions } from "@/features/questions/question-row-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TableRowsSkeleton } from "@/components/table-rows-skeleton";

export default function QuestionBankPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Question Bank</h1>
          <Suspense fallback={<Skeleton className="mt-1 h-4 w-20" />}>
            <QuestionCount />
          </Suspense>
        </div>
        <Button asChild className="gap-1.5">
          <Link href="/admin/questions/new">
            <Plus className="size-4" aria-hidden="true" />
            New question
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <Suspense fallback={<TableRowsSkeleton columns={4} />}>
                  <QuestionRows />
                </Suspense>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-24 w-full" />}>
              <Categories />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function QuestionCount() {
  const questions = await listQuestions({ status: "active" });
  return (
    <p className="text-muted-foreground text-sm">
      {questions.length} question{questions.length === 1 ? "" : "s"}
    </p>
  );
}

async function QuestionRows() {
  const [profile, questions, categories] = await Promise.all([
    requireProfile(),
    listQuestions({ status: "active" }),
    listCategories(),
  ]);
  const viewerIsSuperAdmin = profile.role === "super_admin";
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  if (questions.length === 0) {
    return (
      <TableRow>
        <TableCell
          colSpan={4}
          className="text-muted-foreground p-6 text-center text-sm"
        >
          No questions yet. Create your first reusable question.
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {questions.map((q) => (
        <TableRow key={q.id}>
          <TableCell className="max-w-xs truncate whitespace-normal">
            {q.questionText || "(image-only question)"}
          </TableCell>
          <TableCell className="text-muted-foreground">
            {QUESTION_TYPE_LABELS[q.questionType]}
            {q.difficulty ? (
              <Badge variant="outline" className="ml-1.5">
                {q.difficulty}
              </Badge>
            ) : null}
          </TableCell>
          <TableCell className="text-muted-foreground">
            {q.categoryId ? categoryName.get(q.categoryId) ?? "—" : "—"}
          </TableCell>
          <TableCell>
            <QuestionRowActions
              questionId={q.id}
              questionText={q.questionText}
              viewerIsSuperAdmin={viewerIsSuperAdmin}
            />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

async function Categories() {
  const [profile, categories] = await Promise.all([
    requireProfile(),
    listCategories(),
  ]);
  return (
    <CategoryManager
      categories={categories}
      viewerIsSuperAdmin={profile.role === "super_admin"}
    />
  );
}
