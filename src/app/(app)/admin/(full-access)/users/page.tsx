import { requireProfile } from "@/features/auth/service";
import { listUsers } from "@/features/users/service";
import { UsersManager } from "@/features/users/users-manager";

export default async function UsersPage() {
  const [profile, users] = await Promise.all([requireProfile(), listUsers()]);
  return (
    <UsersManager
      users={users}
      viewerId={profile.userId}
      viewerIsSuperAdmin={profile.role === "super_admin"}
    />
  );
}
