import { UsersView } from "@/components/users/users-view";
import { api } from "@/trpc/server";

export default async function UsersPage() {
  const users = await api.user.all();
  return <UsersView users={users} />;
}
