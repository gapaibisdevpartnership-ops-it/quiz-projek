import { z } from "zod";

const optionalText = z.string().trim().max(4000).optional().or(z.literal(""));

export const quizSettingsSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200),
    description: optionalText,
    instructions: optionalText,
    categoryId: z.string().uuid().nullable().optional(),
    coverImageUrl: z.string().url().nullable().optional(),
    durationMinutes: z.coerce
      .number()
      .int()
      .positive("Duration must be greater than 0.")
      .nullable()
      .optional(),
    passingScore: z.coerce
      .number()
      .min(0, "Passing score is 0–100.")
      .max(100, "Passing score is 0–100."),
    maxAttempts: z.coerce
      .number()
      .int()
      .min(1, "At least 1 attempt is required."),
    shuffleQuestions: z.boolean().default(false),
    shuffleAnswers: z.boolean().default(false),
    showResult: z.boolean().default(true),
    showCorrectAnswer: z.boolean().default(false),
    startAt: z.string().datetime().nullable().optional(),
    endAt: z.string().datetime().nullable().optional(),
  })
  .refine(
    (v) => !v.startAt || !v.endAt || new Date(v.endAt) > new Date(v.startAt),
    { message: "End must be after start.", path: ["endAt"] },
  );
export type QuizSettingsInput = z.infer<typeof quizSettingsSchema>;

export const quizQuestionPointsSchema = z.object({
  points: z.coerce.number().positive("Points must be greater than 0."),
});
