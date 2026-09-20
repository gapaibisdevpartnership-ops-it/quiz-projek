import type { ReactNode } from "react";
import { requireResultsViewer } from "@/features/auth/service";

/** Server-side gate for every /admin route: admin/super_admin/spv. The
 * write-capable sections (quizzes, questions, users, teams, grading,
 * analytics) re-gate themselves more strictly in
 * `admin/(full-access)/layout.tsx` — only /admin/results is reachable by
 * spv through this looser outer gate alone. RLS is still the real
 * boundary. */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireResultsViewer();
  return <>{children}</>;
}
