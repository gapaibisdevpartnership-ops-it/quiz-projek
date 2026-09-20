import { describe, expect, it } from "vitest";
import { evaluateAttemptSchedule } from "./schedule";

describe("evaluateAttemptSchedule", () => {
  it("is within a session window that contains the start time", () => {
    expect(
      evaluateAttemptSchedule({
        startedAt: "2026-09-20T10:00:00Z",
        session: { startsAt: "2026-09-20T09:00:00Z", endsAt: "2026-09-20T12:00:00Z" },
        quiz: null,
      }),
    ).toBe("within");
  });

  it("is outside when started before the session opens", () => {
    expect(
      evaluateAttemptSchedule({
        startedAt: "2026-09-20T08:00:00Z",
        session: { startsAt: "2026-09-20T09:00:00Z", endsAt: "2026-09-20T12:00:00Z" },
        quiz: null,
      }),
    ).toBe("outside");
  });

  it("is outside when started after the session expires", () => {
    expect(
      evaluateAttemptSchedule({
        startedAt: "2026-09-20T13:00:00Z",
        session: { startsAt: "2026-09-20T09:00:00Z", endsAt: "2026-09-20T12:00:00Z" },
        quiz: null,
      }),
    ).toBe("outside");
  });

  it("is unknown when the session has no bounds at all (open link)", () => {
    expect(
      evaluateAttemptSchedule({
        startedAt: "2026-09-20T10:00:00Z",
        session: { startsAt: null, endsAt: null },
        quiz: { startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-01-02T00:00:00Z" },
      }),
    ).toBe("unknown");
  });

  it("falls back to the quiz's own window when there is no session", () => {
    expect(
      evaluateAttemptSchedule({
        startedAt: "2026-09-20T23:00:00Z",
        session: null,
        quiz: { startsAt: "2026-09-20T09:00:00Z", endsAt: "2026-09-20T17:00:00Z" },
      }),
    ).toBe("outside");
  });

  it("is unknown when neither session nor quiz has a window", () => {
    expect(
      evaluateAttemptSchedule({
        startedAt: "2026-09-20T10:00:00Z",
        session: null,
        quiz: { startsAt: null, endsAt: null },
      }),
    ).toBe("unknown");
  });

  it("is unknown when there is no started-at timestamp", () => {
    expect(
      evaluateAttemptSchedule({
        startedAt: null,
        session: { startsAt: "2026-09-20T09:00:00Z", endsAt: null },
        quiz: null,
      }),
    ).toBe("unknown");
  });

  it("is within an open-ended window with only a start bound", () => {
    expect(
      evaluateAttemptSchedule({
        startedAt: "2026-09-25T10:00:00Z",
        session: { startsAt: "2026-09-20T09:00:00Z", endsAt: null },
        quiz: null,
      }),
    ).toBe("within");
  });
});
