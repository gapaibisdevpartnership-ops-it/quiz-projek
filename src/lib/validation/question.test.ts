import { describe, expect, it } from "vitest";
import { questionSchema } from "./question";

type Opt = { answerText?: string; imageUrl?: string | null; isCorrect: boolean };

const opt = (text: string, isCorrect = false): Opt => ({
  answerText: text,
  isCorrect,
});

const base = { questionText: "What is 2 + 2?" };

const single = (options: Opt[]) => ({
  ...base,
  questionType: "single_choice" as const,
  options,
});
const multi = (options: Opt[]) => ({
  ...base,
  questionType: "multiple_choice" as const,
  options,
});

describe("question presentation", () => {
  it("rejects a question with neither text nor image", () => {
    const res = questionSchema.safeParse({
      questionType: "single_choice",
      questionText: "",
      options: [opt("a", true), opt("b")],
    });
    expect(res.success).toBe(false);
  });

  it("accepts an image-only question", () => {
    const res = questionSchema.safeParse({
      questionType: "single_choice",
      questionText: "",
      questionImageUrl: "https://example.com/x.png",
      options: [opt("a", true), opt("b")],
    });
    expect(res.success).toBe(true);
  });
});

describe("single choice", () => {
  it("rejects fewer than 2 options", () => {
    expect(questionSchema.safeParse(single([opt("a", true)])).success).toBe(
      false,
    );
  });

  it("rejects zero correct", () => {
    expect(
      questionSchema.safeParse(single([opt("a"), opt("b")])).success,
    ).toBe(false);
  });

  it("rejects multiple correct", () => {
    expect(
      questionSchema.safeParse(single([opt("a", true), opt("b", true)]))
        .success,
    ).toBe(false);
  });

  it("accepts exactly one correct of two", () => {
    expect(
      questionSchema.safeParse(single([opt("a", true), opt("b")])).success,
    ).toBe(true);
  });

  it("rejects an option with neither text nor image", () => {
    expect(
      questionSchema.safeParse(
        single([{ isCorrect: true }, opt("b")]),
      ).success,
    ).toBe(false);
  });
});

describe("multiple choice", () => {
  it("rejects zero correct", () => {
    expect(
      questionSchema.safeParse(multi([opt("a"), opt("b"), opt("c")])).success,
    ).toBe(false);
  });

  it("accepts two correct of three", () => {
    expect(
      questionSchema.safeParse(
        multi([opt("a", true), opt("b", true), opt("c")]),
      ).success,
    ).toBe(true);
  });
});

describe("dynamic option counts (2..6)", () => {
  for (const n of [2, 3, 4, 5, 6]) {
    it(`accepts ${n} options`, () => {
      const options = Array.from({ length: n }, (_, i) =>
        opt(`opt ${i}`, i === 0),
      );
      expect(questionSchema.safeParse(single(options)).success).toBe(true);
    });
  }
});

describe("true / false", () => {
  it("accepts exactly two options with one correct", () => {
    expect(
      questionSchema.safeParse({
        ...base,
        questionType: "true_false",
        options: [opt("True", true), opt("False")],
      }).success,
    ).toBe(true);
  });

  it("rejects three options", () => {
    expect(
      questionSchema.safeParse({
        ...base,
        questionType: "true_false",
        options: [opt("True", true), opt("False"), opt("Maybe")],
      }).success,
    ).toBe(false);
  });
});

describe("essay", () => {
  it("accepts text with no options", () => {
    expect(
      questionSchema.safeParse({
        ...base,
        questionType: "essay",
        sampleAnswer: "4",
      }).success,
    ).toBe(true);
  });
});
