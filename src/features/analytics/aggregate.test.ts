import { describe, expect, it } from "vitest";
import { average, rate, round1 } from "./aggregate";

describe("round1", () => {
  it("rounds to one decimal", () => {
    expect(round1(66.666)).toBe(66.7);
    expect(round1(50)).toBe(50);
  });
});

describe("average", () => {
  it("averages and rounds", () => {
    expect(average([80, 90, 100])).toBe(90);
    expect(average([1, 2])).toBe(1.5);
  });
  it("is null for an empty list", () => {
    expect(average([])).toBeNull();
  });
});

describe("rate", () => {
  it("computes a percentage", () => {
    expect(rate(3, 4)).toBe(75);
  });
  it("is null when the denominator is zero", () => {
    expect(rate(0, 0)).toBeNull();
  });
});
