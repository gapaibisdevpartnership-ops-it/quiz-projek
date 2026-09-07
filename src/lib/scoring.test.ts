import { describe, expect, it } from "vitest";
import { isPass, percentage, scoreLabel } from "./scoring";

describe("percentage", () => {
  it("computes a rounded percentage", () => {
    expect(percentage(8, 10)).toBe(80);
    expect(percentage(1, 3)).toBe(33.33);
  });
  it("is 0 when there are no points", () => {
    expect(percentage(0, 0)).toBe(0);
  });
});

describe("isPass", () => {
  it("passes at or above the threshold", () => {
    expect(isPass(80, 80)).toBe(true);
    expect(isPass(79.99, 80)).toBe(false);
  });
});

describe("scoreLabel", () => {
  it("formats a fraction or a dash", () => {
    expect(scoreLabel(7, 10)).toBe("7 / 10");
    expect(scoreLabel(null, 10)).toBe("—");
  });
});
