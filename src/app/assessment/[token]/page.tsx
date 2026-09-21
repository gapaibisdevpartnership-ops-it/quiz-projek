import Link from "next/link";
import { validateSessionToken } from "@/features/assessment/service";
import { CandidateEntryForm } from "@/features/assessment/candidate-entry-form";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function AssessmentLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await validateSessionToken(token);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground text-xs underline"
        >
          Staff login
        </Link>
      </div>
      {result.ok ? (
        <CandidateEntryForm token={token} session={result.session} />
      ) : (
        <Alert variant="destructive">{result.error}</Alert>
      )}
    </div>
  );
}
