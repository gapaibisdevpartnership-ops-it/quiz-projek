import type { ReactNode } from "react";
import { requireAdmin } from "@/features/auth/service";

/** Server-side gate for every /admin route. RLS is still the real boundary. */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
