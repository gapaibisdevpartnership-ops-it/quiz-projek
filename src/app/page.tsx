import Link from "next/link";
import { getDefaultLandingSession } from "@/features/assessment/service";
import { CandidateEntryForm } from "@/features/assessment/candidate-entry-form";
import { Alert } from "@/components/ui/alert";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * The plain domain root — always the public quiz landing for whichever
 * session link a trainer has marked "homepage"
 * (docs/ROOT_DOMAIN_LANDING_PLAN.md), regardless of login state. Staff use
 * /login explicitly; this route never redirects to /dashboard.
 *
 * Same minimal chrome as src/app/assessment/layout.tsx (no sidebar, no auth
 * gate) — duplicated inline since this page sits outside that segment.
 */
export default async function RootPage() {
  const result = await getDefaultLandingSession();

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="flex h-14 items-center justify-between border-b bg-background px-4">
        <BrandMark className="text-sm" />
        <div className="flex items-center gap-1">
          <Link
            href="/login"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Staff login
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        {result.ok ? (
          <CandidateEntryForm token={result.token} session={result.session} />
        ) : (
          <Alert>{result.error}</Alert>
        )}
      </div>
    </div>
  );
}
