import { listUsers } from "@/features/users/service";
import { UsersManager } from "@/features/users/users-manager";

export default async function UsersPage() {
  const users = await listUsers();
  return <UsersManager users={users} />;
}
