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

export function navForRole(role: Role): NavItem[] {
  return isAdminRole(role) ? ADMIN_NAV : SALES_NAV;
}
