import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Sales Training Quiz Platform</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Phase 0 scaffold — Next.js, TypeScript, Tailwind, Supabase, TanStack
          Query, React Hook Form, Zod, Recharts.
        </p>
      </div>
      <div className="flex gap-3 text-sm">
        <Link className="underline" href="/login">
          Login
        </Link>
        <Link className="underline" href="/dashboard">
          Dashboard
        </Link>
      </div>
    </main>
  );
}
