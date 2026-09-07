import { z } from "zod";

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});
export type TeamInput = z.infer<typeof teamSchema>;
