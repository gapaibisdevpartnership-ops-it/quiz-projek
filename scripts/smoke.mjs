#!/usr/bin/env node
// Post-deploy smoke test. Usage: node scripts/smoke.mjs https://your-app.vercel.app
// Covers the checks that don't need a logged-in session; the rest of
// docs/DEPLOYMENT.md "Post-Deploy Smoke Test" is manual for now.

const base = (process.argv[2] || process.env.SMOKE_URL || "").replace(/\/$/, "");
if (!base) {
  console.error("Pass the deployment URL: node scripts/smoke.mjs https://…");
  process.exit(2);
}

let failed = 0;
const check = async (name, fn) => {
  try {
    await fn();
    console.log(`✔ ${name}`);
  } catch (err) {
    failed++;
    console.log(`✖ ${name} — ${err.message}`);
  }
};

await check("GET /api/health → 200 ok", async () => {
  const res = await fetch(`${base}/api/health`);
  const body = await res.json();
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  if (body.status !== "ok")
    throw new Error(`status=${body.status} (Supabase env vars missing?)`);
});

await check("GET /login → 200 with sign-in form", async () => {
  const res = await fetch(`${base}/login`);
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  const html = await res.text();
  if (!/sign in/i.test(html)) throw new Error("no sign-in text in HTML");
});

await check("GET /dashboard (no session) → redirects to /login", async () => {
  const res = await fetch(`${base}/dashboard`, { redirect: "manual" });
  const loc = res.headers.get("location") || "";
  if (![301, 302, 303, 307, 308].includes(res.status) || !loc.includes("/login"))
    throw new Error(`status ${res.status}, location "${loc}"`);
});

console.log(
  failed ? `\n${failed} check(s) failed.` : "\nAll smoke checks passed.",
);
process.exit(failed ? 1 : 0);
