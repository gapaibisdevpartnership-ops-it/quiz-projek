import { redirect } from "next/navigation";

/**
 * Landing target for a guest session with no token in the URL — e.g. a
 * guest manually navigating to /assessment (often via stale browser
 * address-bar autocomplete pointing at an old link), or redirected here
 * from (app)/layout.tsx after trying to reach an account-based page
 * (docs/PUBLIC_SESSION_LINK_PLAN.md). `/` is now the standing public quiz
 * landing (docs/ROOT_DOMAIN_LANDING_PLAN.md), so send them there instead
 * of a dead end.
 */
export default function AssessmentIndexPage() {
  redirect("/");
}
