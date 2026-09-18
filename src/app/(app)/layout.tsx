import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
  // Opsi A — a freshly provisioned / reset account must pick its own password
  // before using the app. /change-password lives outside this layout.
  if (profile.mustChangePassword) redirect("/change-password");
  // A guest (Supabase Anonymous Auth, docs/PUBLIC_SESSION_LINK_PLAN.md) gets
  // a real, active profile — requireProfile() alone would let them into the
  // whole account-based app, including pages with no admin gate that still
  // expose real-account data (e.g. /leaderboard shows real sales reps' names
  // and scores). Guests belong only under /assessment/*, never here.
  if (profile.isGuest) redirect("/assessment");

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <AppShell
      nav={navForRole(profile.role)}
      userName={profile.fullName || profile.email}
      roleLabel={ROLE_LABELS[profile.role] ?? profile.role}
      defaultOpen={defaultOpen}
    >
      {children}
    </AppShell>
  );
}
