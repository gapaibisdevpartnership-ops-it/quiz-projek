import { z } from "zod";

/**
 * Centralised, validated environment access.
 *
 * Validation is lazy: it runs the first time you read a value, not at import
 * time, so `next build` still works before `.env.local` is filled in.
 * Use `getClientEnv()` in browser/shared code and `getServerEnv()` in server
 * code only.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = clientSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown, scope: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `[env] Invalid or missing ${scope} environment variables: ${missing}. ` +
        `Copy .env.example to .env.local and fill in the values.`,
    );
  }
  return result.data;
}

export function getClientEnv() {
  return parseOrThrow(
    clientSchema,
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    "client",
  );
}

export function getServerEnv() {
  return parseOrThrow(
    serverSchema,
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    "server",
  );
}
