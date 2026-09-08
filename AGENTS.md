<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project rules

- After every phase or notable change, write a Markdown report under
  `docs/reports/`.
- Deployment is documented, not ad hoc. Follow the runbook in
  `docs/DEPLOYMENT.md`, and append a row to `docs/reports/DEPLOY_LOG.md` after
  every production `vercel --prod` (date, commit, `dpl_…` id, what shipped,
  migrations applied, smoke result). Record failed attempts / incidents in its
  Notes section.
