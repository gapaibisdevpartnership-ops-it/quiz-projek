import { describe, expect, it } from "vitest";
import { matchKeywords } from "./keyword-match";

describe("matchKeywords", () => {
  it("returns null when no keywords are set", () => {
    expect(matchKeywords(null, "some answer")).toBeNull();
    expect(matchKeywords("", "some answer")).toBeNull();
    expect(matchKeywords("  ,  ,", "some answer")).toBeNull();
  });

  it("is case-insensitive", () => {
    const result = matchKeywords("Awareness, Interest", "AWARENESS and interest");
    expect(result).toEqual({ label: "likely_correct", matched: 2, total: 2 });
  });

  it("labels >=60% match as likely_correct", () => {
    const result = matchKeywords(
      "awareness, interest, decision, conversion, loyalty",
      "in the awareness stage we build interest then reach a decision",
    );
    expect(result).toEqual({ label: "likely_correct", matched: 3, total: 5 });
  });

  it("labels a partial (1-59%) match as partial", () => {
    const result = matchKeywords(
      "awareness, interest, decision, conversion, loyalty",
      "we start with awareness",
    );
    expect(result).toEqual({ label: "partial", matched: 1, total: 5 });
  });

  it("labels a zero match as likely_incorrect", () => {
    const result = matchKeywords(
      "awareness, interest, decision",
      "totally unrelated response",
    );
    expect(result).toEqual({ label: "likely_incorrect", matched: 0, total: 3 });
  });

  it("treats a null/empty answer as no matches", () => {
    expect(matchKeywords("awareness, interest", null)).toEqual({
      label: "likely_incorrect",
      matched: 0,
      total: 2,
    });
    expect(matchKeywords("awareness, interest", "")).toEqual({
      label: "likely_incorrect",
      matched: 0,
      total: 2,
    });
  });

  it("trims whitespace around keywords", () => {
    const result = matchKeywords("  awareness  ,   interest  ", "awareness");
    expect(result).toEqual({ label: "partial", matched: 1, total: 2 });
  });
});
