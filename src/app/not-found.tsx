import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted/40 p-4 text-center">
      <BrandMark />
      <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <CompassIcon className="size-6" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">This page doesn&apos;t exist</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          The link may be old or mistyped. Check the address, or head back to
          your dashboard.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  );
}
