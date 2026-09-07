import { config } from "dotenv";

// Integration tests hit the real Supabase project. Load .env.test if present,
// otherwise fall back to .env.local.
config({ path: ".env.test" });
config({ path: ".env.local" });
