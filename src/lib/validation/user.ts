import { z } from "zod";
import { ROLES, USER_STATUSES } from "@/lib/constants";

export const inviteUserSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required.").max(160),
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(ROLES),
  // Optional: if omitted, a random password is generated and the user must
  // reset it via "forgot password".
  password: z.string().min(8, "Use at least 8 characters.").optional(),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required.").max(160),
  role: z.enum(ROLES),
  status: z.enum(USER_STATUSES),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
