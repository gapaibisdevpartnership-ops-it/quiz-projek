import { z } from "zod";
import { ROLES, USER_STATUSES } from "@/lib/constants";

export const inviteUserSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required.").max(160),
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(ROLES),
  // Temporary password the admin communicates out-of-band. The user is forced
  // to change it on first login (profiles.must_change_password).
  password: z.string().min(8, "Use at least 8 characters."),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const adminResetPasswordSchema = z.object({
  password: z.string().min(8, "Use at least 8 characters."),
});
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required.").max(160),
  role: z.enum(ROLES),
  status: z.enum(USER_STATUSES),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
