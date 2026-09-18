import { z } from "zod";

const RELATIVE_DAYS = z.union([
  z.literal(1),
  z.literal(3),
  z.literal(7),
  z.literal(30),
  z.null(),
]);

export const createSessionSchema = z.object({
  quizId: z.string().uuid(),
  label: z.string().trim().max(120).optional().or(z.literal("")),
  // Relative expiry/open date, resolved to an absolute timestamp
  // server-side — avoids the datetime-local/timezone bug tracked in
  // docs/IMPROVEMENT_BACKLOG.md P2 #31.
  expiresInDays: RELATIVE_DAYS,
  opensInDays: RELATIVE_DAYS,
  // One name per line in the textarea; empty/whitespace-only = open link.
  rosterText: z.string().trim().max(5000).optional().or(z.literal("")),
  // Both null = unlimited / use the quiz's own max_attempts.
  maxCandidates: z.number().int().positive().max(100_000).nullable(),
  maxAttemptsOverride: z.number().int().positive().max(1000).nullable(),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
