import { describe, expect, it } from "vitest";
import { resetPasswordSchema, signInSchema } from "./auth";

describe("signInSchema", () => {
  it("accepts a valid email + password", () => {
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "x" }).success,
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(
      signInSchema.safeParse({ email: "nope", password: "x" }).success,
    ).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("requires 8+ characters", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "short",
        confirmPassword: "short",
      }).success,
    ).toBe(false);
  });

  it("requires matching confirmation", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "longenough",
        confirmPassword: "different1",
      }).success,
    ).toBe(false);
  });

  it("accepts a matching 8+ char password", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "longenough",
        confirmPassword: "longenough",
      }).success,
    ).toBe(true);
  });
});
