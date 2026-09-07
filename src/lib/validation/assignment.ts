import { z } from "zod";

export const assignmentSchema = z
  .object({
    quizId: z.string().uuid(),
    mode: z.enum(["user", "team"]),
    userId: z.string().uuid().optional(),
    teamId: z.string().uuid().optional(),
    dueAt: z.string().datetime().nullable().optional(),
  })
  .refine((v) => (v.mode === "user" ? !!v.userId : !!v.teamId), {
    message: "Pick who the quiz is assigned to.",
    path: ["userId"],
  });
export type AssignmentInput = z.infer<typeof assignmentSchema>;
