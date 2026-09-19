"use client";

import { useEffect, useState } from "react";
import { formatDateTimeUTC } from "@/lib/format";

function formatLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * Renders a timestamp in the viewer's local timezone without a
 * server/client hydration mismatch: the first paint matches
 * `formatDateTimeUTC` (identical to what the server rendered), then a
 * post-mount effect swaps it to the browser's local time. React only
 * warns on an *initial* render mismatch, so this update is silent.
 *
 * The exact UTC value stays available via the `title` tooltip.
 */
export function LocalTime({ iso }: { iso: string | null | undefined }) {
  const [text, setText] = useState(() => formatDateTimeUTC(iso));

  useEffect(() => {
    // Intentional: this is the documented pattern for a client-only value
    // that must differ from the server render to avoid a hydration
    // mismatch (https://react.dev/learn/you-might-not-need-an-effect) —
    // there's no external system to subscribe to here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (iso) setText(formatLocal(iso));
  }, [iso]);

  if (!iso) return <>—</>;
  return (
    <time dateTime={iso} title={formatDateTimeUTC(iso)}>
      {text}
    </time>
  );
}
