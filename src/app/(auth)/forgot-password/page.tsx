import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot your password?</CardTitle>
        <CardDescription>
          This is an internal tool with no automated email reset.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          Ask your trainer or a super admin to set a new temporary password for
          your account from the Users screen. You&apos;ll be asked to choose your
          own password the next time you sign in.
        </p>
        <p className="text-muted-foreground text-center">
          <Link className="underline" href="/login">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
