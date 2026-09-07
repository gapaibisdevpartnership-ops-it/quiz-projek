import { describe, expect, it } from "vitest";
import { assignmentSchema } from "./assignment";
import { inviteUserSchema, updateUserSchema } from "./user";
import { teamSchema } from "./team";

const quizId = "00000000-0000-0000-0000-000000000001";
const id = "00000000-0000-0000-0000-000000000002";

describe("assignmentSchema", () => {
  it("accepts a user assignment", () => {
    expect(
      assignmentSchema.safeParse({ quizId, mode: "user", userId: id }).success,
    ).toBe(true);
  });

  it("accepts a team assignment", () => {
    expect(
      assignmentSchema.safeParse({ quizId, mode: "team", teamId: id }).success,
    ).toBe(true);
  });

  it("rejects user mode without a userId", () => {
    expect(
      assignmentSchema.safeParse({ quizId, mode: "user" }).success,
    ).toBe(false);
  });

  it("rejects team mode without a teamId", () => {
    expect(
      assignmentSchema.safeParse({ quizId, mode: "team" }).success,
    ).toBe(false);
  });
});

describe("inviteUserSchema", () => {
  it("accepts a valid invite", () => {
    expect(
      inviteUserSchema.safeParse({
        fullName: "Jane",
        email: "jane@example.com",
        role: "sales",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown role", () => {
    expect(
      inviteUserSchema.safeParse({
        fullName: "Jane",
        email: "jane@example.com",
        role: "owner",
      }).success,
    ).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("requires a valid status", () => {
    expect(
      updateUserSchema.safeParse({
        fullName: "Jane",
        role: "admin",
        status: "banned",
      }).success,
    ).toBe(false);
  });
});

describe("teamSchema", () => {
  it("rejects a blank name", () => {
    expect(teamSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});
