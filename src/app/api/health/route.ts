import { NextResponse } from "next/server";

/** Lightweight readiness probe: confirms required env vars are present. */
export function GET() {
  const ok =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  return NextResponse.json(
    { status: ok ? "ok" : "missing-env", time: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
