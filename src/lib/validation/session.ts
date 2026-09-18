import { z } from "zod";

export const createSessionSchema = z.object({
  quizId: z.string().uuid(),
  label: z.string().trim().max(120).optional().or(z.literal("")),
  // Relative expiry, resolved to an absolute timestamp server-side — avoids
  // the datetime-local/timezone bug tracked in
  // docs/IMPROVEMENT_BACKLOG.md P2 #31.
  expiresInDays: z.union([z.literal(1), z.literal(3), z.literal(7), z.literal(30), z.null()]),
  // One name per line in the textarea; empty/whitespace-only = open link.
  rosterText: z.string().trim().max(5000).optional().or(z.literal("")),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
