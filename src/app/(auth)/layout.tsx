import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold">Sales Training Quiz</h1>
          <p className="text-muted-foreground text-sm">Internal platform</p>
        </div>
        {children}
      </div>
    </div>
  );
}
