import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Deliberately outside the (app) route group — no requireProfile(), no
 * sidebar. See docs/PUBLIC_SESSION_LINK_PLAN.md: this whole segment is the
 * unauthenticated guest entry path, confirmed to sit outside both the
 * middleware path-allowlist (src/lib/supabase/middleware.ts) and the
 * (app) layout's auth gate.
 */
export default function AssessmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="flex h-14 items-center justify-between border-b bg-background px-4">
        <BrandMark className="text-sm" />
        <ThemeToggle />
      </header>
      <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">{children}</div>
    </div>
  );
}
