import { requireProfile } from "@/features/auth/service";
import { ChangePasswordForm } from "@/features/auth/change-password-form";

export const metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const profile = await requireProfile();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold">Sales Training Quiz</h1>
          <p className="text-muted-foreground text-sm">
            {profile.fullName || profile.email}
          </p>
        </div>
        <ChangePasswordForm forced={profile.mustChangePassword} />
      </div>
    </div>
  );
}
