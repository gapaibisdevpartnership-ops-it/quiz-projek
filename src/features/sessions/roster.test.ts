import { describe, expect, it } from "vitest";
import { parseRoster } from "./roster";

describe("parseRoster", () => {
  it("returns null for empty/blank input (open link)", () => {
    expect(parseRoster(undefined)).toBeNull();
    expect(parseRoster("")).toBeNull();
    expect(parseRoster("   \n  \n ")).toBeNull();
  });

  it("splits one name per line and trims whitespace", () => {
    expect(parseRoster("Budi Santoso\n  Siti Aminah  \nAndi")).toEqual([
      "Budi Santoso",
      "Siti Aminah",
      "Andi",
    ]);
  });

  it("drops blank lines", () => {
    expect(parseRoster("Budi\n\n\nSiti\n")).toEqual(["Budi", "Siti"]);
  });

  it("dedupes exact-match names", () => {
    expect(parseRoster("Budi\nSiti\nBudi")).toEqual(["Budi", "Siti"]);
  });
});
