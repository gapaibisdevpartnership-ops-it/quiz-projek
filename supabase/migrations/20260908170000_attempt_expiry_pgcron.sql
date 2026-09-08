-- P1 #4 — drive the abandoned-attempt sweep from pg_cron instead of Vercel Cron.
--
-- The Vercel project is on the Hobby plan, which only allows once-a-day cron
-- jobs, so the `*/5 * * * *` entry in vercel.json was rejected at deploy time
-- and the sweep would never have run. pg_cron is available on all Supabase
-- plans and keeps the schedule next to the function it calls.
--
-- `vercel.json` no longer declares a cron. The GET /api/cron/expire-attempts
-- route stays as a manual / backup trigger.

create extension if not exists pg_cron;

-- Re-running this migration must not error on an existing job.
do $$
begin
  perform cron.unschedule('expire-stale-attempts');
exception
  when others then null;
end $$;

select cron.schedule(
  'expire-stale-attempts',
  '*/5 * * * *',
  $$ select public.expire_stale_attempts() $$
);
