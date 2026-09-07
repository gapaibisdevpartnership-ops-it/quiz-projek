import { describe, expect, it } from "vitest";
import { isAdminRole } from "./constants";

describe("isAdminRole", () => {
  it("is true for admin and super_admin", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("super_admin")).toBe(true);
  });

  it("is false for sales and nullish", () => {
    expect(isAdminRole("sales")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});
