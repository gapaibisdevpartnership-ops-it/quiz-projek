import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sweeps abandoned `in_progress` attempts whose server-side deadline has passed
 * and finalises them (see the `expire_stale_attempts` RPC).
 *
 * Invoked by Vercel Cron (see `vercel.json`). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; we reject anything else so the endpoint
 * is not publicly triggerable. If `CRON_SECRET` is unset the route is disabled.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron-disabled" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("expire_stale_attempts");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expired: data ?? 0, time: new Date().toISOString() });
}
