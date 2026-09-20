import type { ReactNode } from "react";
import { requireAdmin } from "@/features/auth/service";

/** Gate for every write-capable /admin section (quizzes, questions, users,
 * teams, grading, analytics) — spv must never reach these, only /admin/results
 * (a sibling, outside this route group). */
export default async function AdminFullAccessLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
