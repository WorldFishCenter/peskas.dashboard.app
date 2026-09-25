import { Navigate } from "react-router";
import { UsersView } from "@/components/users/users-view";
import { routes } from "@/config/routes";
import { useLocalizedHref } from "@/i18n/use-lang";
import { api } from "@/trpc/react";

export default function UsersPage() {
  const localized = useLocalizedHref();
  // No retries: a 401 means "sign in", not a flaky network.
  const users = api.user.all.useQuery(undefined, { retry: false });

  if (users.error?.data?.code === "UNAUTHORIZED") return <Navigate replace to={localized(routes.signIn)} />;
  return <UsersView users={users.data ?? []} />;
}
