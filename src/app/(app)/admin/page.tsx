import { redirect } from "next/navigation";
import { requireResultsViewer } from "@/features/auth/service";
import { isAdminRole } from "@/lib/constants";

export default async function Page() {
  const profile = await requireResultsViewer();
  redirect(isAdminRole(profile.role) ? "/admin/quizzes" : "/admin/results");
}
