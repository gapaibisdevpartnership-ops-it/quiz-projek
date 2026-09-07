import type { ReactNode } from "react";
import { requireProfile } from "@/features/auth/service";
import { navForRole } from "@/features/auth/nav";
import { AppShell } from "@/components/app-shell";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Trainer",
  sales: "Sales",
};

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <AppShell
      nav={navForRole(profile.role)}
      userName={profile.fullName || profile.email}
      roleLabel={ROLE_LABELS[profile.role] ?? profile.role}
    >
      {children}
    </AppShell>
  );
}
