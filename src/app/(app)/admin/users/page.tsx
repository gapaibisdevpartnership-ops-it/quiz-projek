import { listUsers } from "@/features/users/service";
import { UsersManager } from "@/features/users/users-manager";

export default async function UsersPage() {
  const users = await listUsers();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Users</h1>
      <UsersManager users={users} />
    </div>
  );
}
