import { requireProfile } from "@/features/auth/service";
import { ChangePasswordForm } from "@/features/auth/change-password-form";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const profile = await requireProfile();

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-1 text-center">
          <BrandMark className="text-lg" textClassName="text-primary" />
          <p className="text-muted-foreground text-sm">
            {profile.fullName || profile.email}
          </p>
        </div>
        <ChangePasswordForm forced={profile.mustChangePassword} />
      </div>
    </div>
  );
}
