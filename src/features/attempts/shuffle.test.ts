import { describe, expect, it } from "vitest";
import { formatCountdown, seededShuffle } from "./shuffle";

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
