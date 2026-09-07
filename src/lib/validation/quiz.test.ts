import { describe, expect, it } from "vitest";
import { quizSettingsSchema } from "./quiz";

const valid = {
  title: "Product Knowledge",
  passingScore: 80,
  maxAttempts: 2,
  shuffleQuestions: false,
  shuffleAnswers: false,
  showResult: true,
  showCorrectAnswer: false,
};

describe("quizSettingsSchema", () => {
  it("accepts a minimal valid quiz", () => {
    expect(quizSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(
      quizSettingsSchema.safeParse({ ...valid, title: "  " }).success,
    ).toBe(false);
  });

  it("rejects passing score outside 0..100", () => {
    expect(
      quizSettingsSchema.safeParse({ ...valid, passingScore: 120 }).success,
    ).toBe(false);
  });

  it("rejects max attempts below 1", () => {
    expect(
      quizSettingsSchema.safeParse({ ...valid, maxAttempts: 0 }).success,
    ).toBe(false);
  });

  it("rejects zero / negative duration when provided", () => {
    expect(
      quizSettingsSchema.safeParse({ ...valid, durationMinutes: 0 }).success,
    ).toBe(false);
  });

  it("rejects an end date that is not after the start date", () => {
    const res = quizSettingsSchema.safeParse({
      ...valid,
      startAt: "2026-01-02T00:00:00.000Z",
      endAt: "2026-01-01T00:00:00.000Z",
    });
    expect(res.success).toBe(false);
  });

  it("accepts a valid availability window", () => {
    const res = quizSettingsSchema.safeParse({
      ...valid,
      startAt: "2026-01-01T00:00:00.000Z",
      endAt: "2026-01-02T00:00:00.000Z",
    });
    expect(res.success).toBe(true);
  });
});
