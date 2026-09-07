/**
 * Deterministic date formatting for server-rendered output.
 *
 * `Date#toLocaleString()` uses the runtime's timezone/locale, which differs
 * between the Vercel server (UTC) and the viewer's browser and triggers React
 * hydration warnings. Render a fixed UTC string instead; a future
 * `<LocalTime>` client component can localise after mount if needed.
 */
export function formatDateTimeUTC(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}
