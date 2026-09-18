"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireSuperAdmin } from "@/features/auth/service";
import {
  adminResetPasswordSchema,
  inviteUserSchema,
  updateUserSchema,
  type AdminResetPasswordInput,
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

  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error || !data.user) {
    return { ok: false, error: "Could not create the account." };
  }

  // The trigger created the profile as 'sales'/'active'. Apply the chosen name
  // and role with the service role (authorization already checked above; this
  // is a brand-new account so the RPC's self / last-super-admin guards don't
  // apply). Force a password change on first login.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      role: parsed.data.role,
      must_change_password: true,
    })
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

/**
 * Set a new temporary password for a user and force them to change it on next
 * login. Admin-only; a plain admin cannot reset a super_admin's password.
 */
export async function resetUserPassword(
  userId: string,
  input: AdminResetPasswordInput,
): Promise<UserMutationResult> {
  const me = await requireAdmin();
  const parsed = adminResetPasswordSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };

  const admin = createAdminClient();

  const { data: target, error: lookupError } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle<{ role: string }>();
  if (lookupError || !target) {
    return { ok: false, error: "That user no longer exists." };
  }
  if (target.role === "super_admin" && me.role !== "super_admin") {
    return {
      ok: false,
      error: "Only a super admin can reset a super admin's password.",
    };
  }

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    password: parsed.data.password,
  });
  if (authError) {
    return { ok: false, error: "Could not set the new password." };
  }

  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("user_id", userId);

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
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

/**
 * Permanently delete a user (docs/HARD_DELETE_USER_PLAN.md) — super_admin
 * only, deliberately not exposed to admin/trainer at all. Content the user
 * authored/assigned/graded/generated survives (attribution set to null,
 * supabase/migrations/20260921090000_hard_delete_user_prep.sql); only the
 * target's own account and their own attempt history are gone, which is
 * the intended meaning of "permanent" here.
 */
export async function deleteUserPermanently(
  userId: string,
): Promise<UserMutationResult> {
  const me = await requireSuperAdmin();

  if (userId === me.userId) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  const supabase = await createClient();
  const { data: target, error: lookupError } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("user_id", userId)
    .maybeSingle<{ role: string; status: string }>();
  if (lookupError || !target) {
    return { ok: false, error: "That user no longer exists." };
  }

  if (target.role === "super_admin" && target.status === "active") {
    const { count } = await supabase
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "super_admin")
      .eq("status", "active")
      .neq("user_id", userId);
    if (!count) {
      return {
        ok: false,
        error:
          "There must be at least one active super admin. Promote another first.",
      };
    }
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return { ok: false, error: "Could not delete the account." };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}
