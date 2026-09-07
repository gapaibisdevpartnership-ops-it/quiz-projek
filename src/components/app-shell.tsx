"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/features/auth/nav";
import { signOutAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

interface Props {
  nav: NavItem[];
  userName: string;
  roleLabel: string;
  children: ReactNode;
}

export function AppShell({ nav, userName, roleLabel, children }: Props) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-4 p-3">
          <span className="font-semibold">Sales Quiz</span>
          <nav className="flex flex-1 flex-wrap gap-1 text-sm">
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 hover:bg-accent",
                    active && "bg-accent font-medium",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground hidden sm:inline">
              {userName} · {roleLabel}
            </span>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
