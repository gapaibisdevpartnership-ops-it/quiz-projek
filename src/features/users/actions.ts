"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/features/auth/service";
import {
  inviteUserSchema,
  updateUserSchema,
  type InviteUserInput,
  type UpdateUserInput,
} from "@/lib/validation/user";

export type UserMutationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Provision a new user. Uses the service-role Admin API (no public sign-up —
 * docs/SECURITY_RLS.md); authorization is checked first with requireAdmin().
 */
export async function inviteUser(
  input: InviteUserInput,
): Promise<UserMutationResult> {
  await requireAdmin();
  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };

  const admin = createAdminClient();
  const password =
    parsed.data.password ?? `Aa1!${crypto.randomUUID().slice(0, 16)}`;

  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
      role: parsed.data.role,
    },
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateUser(
  userId: string,
  input: UpdateUserInput,
): Promise<UserMutationResult> {
  const me = await requireAdmin();
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };

  // Don't let an admin lock themselves out.
  if (userId === me.userId) {
    if (parsed.data.status !== "active")
      return { ok: false, error: "You cannot deactivate your own account." };
    if (parsed.data.role === "sales")
      return { ok: false, error: "You cannot remove your own admin role." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      role: parsed.data.role,
      status: parsed.data.status,
    })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}
