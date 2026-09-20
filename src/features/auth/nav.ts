import type { Role } from "@/lib/constants";
import { isAdminRole } from "@/lib/constants";

export interface NavItem {
  href: string;
  label: string;
}

const SALES_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/quizzes", label: "Quizzes" },
  { href: "/history", label: "History" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/profile", label: "Profile" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/admin/quizzes", label: "Quizzes" },
  { href: "/admin/questions", label: "Question Bank" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/results", label: "Results" },
  { href: "/admin/grading", label: "Grading" },
  { href: "/admin/analytics", label: "Analytics" },
];

// Supervisors only ever open results — no create/manage flow, no
// Dashboard (built for quiz-takers, not a fit for spv).
const SPV_NAV: NavItem[] = [{ href: "/admin/results", label: "Results" }];

export function navForRole(role: Role): NavItem[] {
  if (role === "spv") return SPV_NAV;
  return isAdminRole(role) ? ADMIN_NAV : SALES_NAV;
}
