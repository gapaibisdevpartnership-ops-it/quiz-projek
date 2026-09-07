#!/usr/bin/env node
// Pre-deploy gate (docs/DEPLOYMENT.md "Pre-Deploy Checklist").
// Runs the checks that must be green before a Vercel deploy.
import { execSync } from "node:child_process";

const steps = [
  ["lint", "npm run lint"],
  ["typecheck", "npm run typecheck"],
  ["unit tests", "npm test"],
  ["production build", "npm run build"],
];

for (const [label, cmd] of steps) {
  process.stdout.write(`\n▶ ${label}: ${cmd}\n`);
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch {
    process.stdout.write(`\n✖ ${label} failed — aborting.\n`);
    process.exit(1);
  }
}

process.stdout.write(
  "\n✔ All pre-deploy checks passed.\n" +
    "  Remember: migration applied to the target DB, RLS reviewed, " +
    "Vercel env vars set (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
    "SUPABASE_SERVICE_ROLE_KEY).\n",
);
