import { describe, expect, it } from "vitest";
import {
  clockOffsetMs,
  formatCountdown,
  questionRemainingMs,
  seededShuffle,
} from "./shuffle";

describe("seededShuffle", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];

  it("is deterministic for the same seed", () => {
    expect(seededShuffle(items, "attempt-abc")).toEqual(
      seededShuffle(items, "attempt-abc"),
    );
  });

  it("usually differs for different seeds", () => {
    expect(seededShuffle(items, "a")).not.toEqual(seededShuffle(items, "b"));
  });

  it("keeps the same elements", () => {
    expect([...seededShuffle(items, "x")].sort((a, b) => a - b)).toEqual(items);
  });

  it("does not mutate the input", () => {
    const copy = [...items];
    seededShuffle(items, "x");
    expect(items).toEqual(copy);
  });
});

describe("formatCountdown", () => {
  it("formats mm:ss", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(65_000)).toBe("01:05");
    expect(formatCountdown(600_000)).toBe("10:00");
  });

  it("clamps negatives to zero", () => {
    expect(formatCountdown(-5000)).toBe("00:00");
  });
});

describe("clockOffsetMs / questionRemainingMs", () => {
  it("ticks down as clientNow advances, holding offset fixed", () => {
    const serverNow = "2026-09-23T10:00:00.000Z";
    const clientAtLoad = new Date("2026-09-23T10:00:00.000Z").getTime();
    const offsetMs = clockOffsetMs(serverNow, clientAtLoad);

    const viewedAt = "2026-09-23T10:00:00.000Z";
    const first = questionRemainingMs({
      viewedAt,
      timeLimitSeconds: 30,
      offsetMs,
      clientNow: clientAtLoad,
    });
    const fiveSecondsLater = questionRemainingMs({
      viewedAt,
      timeLimitSeconds: 30,
      offsetMs,
      clientNow: clientAtLoad + 5000,
    });
    expect(first).toBe(30_000);
    expect(fiveSecondsLater).toBe(25_000);
  });

  it("corrects for a client clock that's ahead of the server", () => {
    // Client thinks it's 10 seconds later than the server does.
    const serverNow = "2026-09-23T10:00:00.000Z";
    const clientAtLoad = new Date("2026-09-23T10:00:10.000Z").getTime();
    const offsetMs = clockOffsetMs(serverNow, clientAtLoad);

    const remaining = questionRemainingMs({
      viewedAt: "2026-09-23T10:00:00.000Z",
      timeLimitSeconds: 30,
      offsetMs,
      clientNow: clientAtLoad,
    });
    // Corrected to the server's view of time: only 0s elapsed, not 10s.
    expect(remaining).toBe(30_000);
  });

  it("goes negative once the limit has passed", () => {
    const serverNow = "2026-09-23T10:00:00.000Z";
    const clientAtLoad = new Date(serverNow).getTime();
    const offsetMs = clockOffsetMs(serverNow, clientAtLoad);

    const remaining = questionRemainingMs({
      viewedAt: "2026-09-23T09:59:00.000Z", // viewed a minute before "now"
      timeLimitSeconds: 30,
      offsetMs,
      clientNow: clientAtLoad,
    });
    expect(remaining).toBeLessThan(0);
  });
});
