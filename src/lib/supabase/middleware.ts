import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getClientEnv } from "@/lib/env";

/**
 * Refreshes the Supabase auth session on every request and applies basic
 * route protection. Real authorization still lives in RLS / server code —
 * these guards are UX only (see docs/ROUTES.md).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Before .env.local is configured, skip auth handling instead of crashing.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }
  const env = getClientEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/quizzes") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/leaderboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/admin");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
