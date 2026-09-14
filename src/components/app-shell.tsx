"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  History,
  LayoutDashboard,
  Library,
  LineChart,
  LogOut,
  PenSquare,
  Trophy,
  User,
  Users,
  UsersRound,
} from "lucide-react";
import type { NavItem } from "@/features/auth/nav";
import { signOutAction } from "@/features/auth/actions";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type Icon = ComponentType<{ className?: string }>;

/** href -> icon. Kept here (client) so `nav.ts` stays serialisable RSC data. */
const NAV_ICONS: Record<string, Icon> = {
  "/dashboard": LayoutDashboard,
  "/quizzes": ClipboardList,
  "/admin/quizzes": ClipboardList,
  "/admin/questions": Library,
  "/admin/users": Users,
  "/admin/teams": UsersRound,
  "/admin/results": ClipboardCheck,
  "/admin/grading": PenSquare,
  "/admin/analytics": LineChart,
  "/history": History,
  "/leaderboard": Trophy,
  "/profile": User,
};

interface Props {
  nav: NavItem[];
  userName: string;
  roleLabel: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function AppShell({
  nav,
  userName,
  roleLabel,
  defaultOpen = true,
  children,
}: Props) {
  const pathname = usePathname();

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader>
          <div className="flex h-8 items-center px-2">
            <BrandMark textClassName="group-data-[collapsible=icon]:hidden" />
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <nav aria-label="Main" className="px-2 py-1">
            <SidebarMenu>
              {nav.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const Icon = NAV_ICONS[item.href] ?? BarChart3;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                    >
                      <Link href={item.href} aria-current={active ? "page" : undefined}>
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </nav>
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter>
          <div className="flex items-center justify-between gap-2 px-2 group-data-[collapsible=icon]:justify-center">
            <span className="truncate text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
              {userName} · {roleLabel}
            </span>
            <ThemeToggle className="shrink-0 text-sidebar-foreground/80" />
          </div>
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="w-full text-foreground group-data-[collapsible=icon]:px-0"
            >
              <LogOut className="size-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">
                Sign out
              </span>
            </Button>
          </form>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <BrandMark className="text-sm" />
        </header>
        <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
