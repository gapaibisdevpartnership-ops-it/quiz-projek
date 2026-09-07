import { z } from "zod";
import { QUESTION_TYPES } from "@/lib/constants";

// Points are assigned per-quiz in the Quiz Builder (quiz_questions.points),
// not on the reusable question — see docs/DATABASE_SCHEMA.md.

// Category --------------------------------------------------------------

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categorySchema>;

// Option --------------------------------------------------------------

const optionSchema = z
  .object({
    id: z.string().uuid().optional(),
    answerText: z.string().trim().max(500).optional().default(""),
    imageUrl: z.string().url().nullable().optional(),
    isCorrect: z.boolean().default(false),
  })
  .refine((o) => o.answerText.length > 0 || !!o.imageUrl, {
    message: "Each option needs text or an image.",
    path: ["answerText"],
  });

// Question base ------------------------------------------------------

const baseFields = {
  categoryId: z.string().uuid().nullable().optional(),
  questionText: z.string().trim().max(4000).optional().default(""),
  questionImageUrl: z.string().url().nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
  explanation: z.string().trim().max(2000).optional().or(z.literal("")),
};

const hasPresentation = (v: {
  questionText: string;
  questionImageUrl?: unknown;
}) => v.questionText.length > 0 || !!v.questionImageUrl;

const presentationRefine = {
  message: "Provide question text or an image.",
  path: ["questionText"] as (string | number)[],
};

const choiceOptions = (opts: {
  min: number;
  exactCorrect?: number;
  minCorrect?: number;
}) =>
  z.array(optionSchema).superRefine((options, ctx) => {
    if (options.length < opts.min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `At least ${opts.min} options are required.`,
      });
    }
    const correct = options.filter((o) => o.isCorrect).length;
    if (opts.exactCorrect !== undefined && correct !== opts.exactCorrect) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Exactly ${opts.exactCorrect} option must be marked correct.`,
      });
    }
    if (opts.minCorrect !== undefined && correct < opts.minCorrect) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Mark at least ${opts.minCorrect} correct option.`,
      });
    }
  });

export const singleChoiceSchema = z
  .object({
    questionType: z.literal("single_choice"),
    ...baseFields,
    options: choiceOptions({ min: 2, exactCorrect: 1 }),
  })
  .refine(hasPresentation, presentationRefine);

export const multipleChoiceSchema = z
  .object({
    questionType: z.literal("multiple_choice"),
    ...baseFields,
    options: choiceOptions({ min: 2, minCorrect: 1 }),
  })
  .refine(hasPresentation, presentationRefine);

export const trueFalseSchema = z
  .object({
    questionType: z.literal("true_false"),
    ...baseFields,
    options: choiceOptions({ min: 2, exactCorrect: 1 }).refine(
      (o) => o.length === 2,
      { message: "True/False must have exactly two options." },
    ),
  })
  .refine(hasPresentation, presentationRefine);

export const essaySchema = z
  .object({
    questionType: z.literal("essay"),
    ...baseFields,
    sampleAnswer: z.string().trim().max(4000).optional().or(z.literal("")),
    gradingNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine(hasPresentation, presentationRefine);

// z.union (not discriminatedUnion) because each member is refined (ZodEffects).
export const questionSchema = z.union([
  singleChoiceSchema,
  multipleChoiceSchema,
  trueFalseSchema,
  essaySchema,
]);
export type QuestionInput = z.infer<typeof questionSchema>;
export type ChoiceQuestionInput = z.infer<
  typeof singleChoiceSchema | typeof multipleChoiceSchema | typeof trueFalseSchema
>;

export const QUESTION_TYPE_LABELS: Record<
  (typeof QUESTION_TYPES)[number],
  string
> = {
  single_choice: "Single Choice",
  multiple_choice: "Multiple Choice",
  true_false: "True / False",
  essay: "Essay",
};
