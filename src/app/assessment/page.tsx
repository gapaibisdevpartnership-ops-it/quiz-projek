import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Landing target for a guest session with no token in the URL — e.g. a
 * guest manually navigating to /assessment, or redirected here from
 * (app)/layout.tsx after trying to reach an account-based page
 * (docs/PUBLIC_SESSION_LINK_PLAN.md).
 */
export default function AssessmentIndexPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nothing here</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Use the assessment link your trainer sent you to start.
        </p>
      </CardContent>
    </Card>
  );
}
