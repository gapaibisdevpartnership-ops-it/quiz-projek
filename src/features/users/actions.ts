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

/** Friendly copy for the errors raised by the admin_update_user RPC. */
const RPC_ERRORS: Record<string, string> = {
  UNAUTHORIZED: "You are not allowed to manage users.",
  INVALID_ROLE: "Pick a valid role.",
  INVALID_STATUS: "Pick a valid status.",
  INVALID_NAME: "Name is required.",
  USER_NOT_FOUND: "That user no longer exists.",
  SUPER_ADMIN_REQUIRED:
    "Only a super admin can grant or remove the super admin role.",
  CANNOT_DEMOTE_SELF: "You cannot remove your own admin role.",
  CANNOT_DEACTIVATE_SELF: "You cannot deactivate your own account.",
  LAST_SUPER_ADMIN:
    "There must be at least one active super admin. Promote another first.",
};

function mapRpcError(message: string): string {
  const key = Object.keys(RPC_ERRORS).find((k) => message.includes(k));
  return key ? RPC_ERRORS[key] : "Could not update the user.";
}

/**
 * Provision a new user. Uses the service-role Admin API (no public sign-up —
 * docs/SECURITY_RLS.md); authorization is checked first with requireAdmin().
 * The database trigger always creates the profile as 'sales'; an elevated role
 * is then applied through admin_update_user().
 */
export async function inviteUser(
  input: InviteUserInput,
): Promise<UserMutationResult> {
  const me = await requireAdmin();
  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };

  if (parsed.data.role === "super_admin" && me.role !== "super_admin") {
    return {
      ok: false,
      error: "Only a super admin can create a super admin.",
    };
  }

  const admin = createAdminClient();
  const password =
    parsed.data.password ?? `Aa1!${crypto.randomUUID().slice(0, 16)}`;

  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error || !data.user) {
    return { ok: false, error: "Could not create the account." };
  }

  // The trigger created the profile as 'sales'/'active'. Apply the chosen name
  // and role with the service role (authorization already checked above; this
  // is a brand-new account so the RPC's self / last-super-admin guards don't
  // apply).
  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: parsed.data.fullName, role: parsed.data.role })
    .eq("user_id", data.user.id);
  if (profileError) {
    revalidatePath("/admin/users");
    return {
      ok: false,
      error: "Account created, but its profile could not be finalized.",
    };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateUser(
  userId: string,
  input: UpdateUserInput,
): Promise<UserMutationResult> {
  await requireAdmin();
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_user", {
    target_user_id: userId,
    new_full_name: parsed.data.fullName,
    new_role: parsed.data.role,
    new_status: parsed.data.status,
  });
  if (error) return { ok: false, error: mapRpcError(error.message) };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}
