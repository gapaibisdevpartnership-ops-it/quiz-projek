/**
 * Deterministic Fisher–Yates shuffle. Same `seed` → same order, so question /
 * answer order stays stable across re-renders and page refreshes within one
 * attempt.
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const rand = () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Milliseconds → `MM:SS`, clamped at zero. */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

/**
 * Client/server clock skew, captured once when a timer starts — `clientNow`
 * minus `offsetMs` gives an ongoing estimate of the server's current time as
 * real time passes, the same technique the whole-attempt timer uses.
 */
export function clockOffsetMs(serverNow: string, clientNow: number): number {
  return clientNow - new Date(serverNow).getTime();
}

/**
 * Milliseconds left on a question's own time limit, anchored on when the
 * candidate first viewed it (server-stamped, so it survives a reload).
 * `offsetMs` must come from `clockOffsetMs`, captured once per timer
 * (not recomputed every tick) — otherwise it cancels itself out and the
 * countdown never ticks down.
 */
export function questionRemainingMs({
  viewedAt,
  timeLimitSeconds,
  offsetMs,
  clientNow,
}: {
  viewedAt: string;
  timeLimitSeconds: number;
  offsetMs: number;
  /** `Date.now()` at the moment of this calculation. */
  clientNow: number;
}): number {
  const deadline = new Date(viewedAt).getTime() + timeLimitSeconds * 1000;
  return deadline - (clientNow - offsetMs);
}
