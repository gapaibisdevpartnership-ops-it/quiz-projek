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

  if (!result.ok) {
    return <Alert variant="destructive">{result.error}</Alert>;
  }

  return <CandidateEntryForm token={token} session={result.session} />;
}
