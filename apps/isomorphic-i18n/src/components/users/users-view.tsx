"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { toast } from "@workspace/ui/components/toast";
import { UserDialog } from "@/components/users/user-dialog";
import { UserTable, type UserRow } from "@/components/users/user-table";
import { api } from "@/trpc/react";

export function UsersView({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const utils = api.useUtils();
  const [dialog, setDialog] = useState<{ open: boolean; userId?: string }>({ open: false });
  const [toDelete, setToDelete] = useState<UserRow | null>(null);

  const deleteUser = api.user.delete.useMutation({
    onSuccess: async () => {
      toast.add({ type: "success", title: "User deleted successfully" });
      setToDelete(null);
      await utils.user.invalidate();
      router.refresh();
    },
    onError: (error) => {
      toast.add({ type: "error", title: error.message || "Failed to delete user" });
      setToDelete(null);
    },
  });

  const handleEdit = useCallback((user: UserRow) => setDialog({ open: true, userId: user._id }), []);
  const handleDelete = useCallback((user: UserRow) => setToDelete(user), []);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true })}>
          <PlusIcon data-icon="inline-start" />
          Add User
        </Button>
      </div>
      <UserTable users={users} onEdit={handleEdit} onDelete={handleDelete} />
      <UserDialog
        open={dialog.open}
        userId={dialog.userId}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the user from the system, revokes their access to the platform and deletes
              their settings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteUser.isPending}
              onClick={() => toDelete && deleteUser.mutate({ id: toDelete._id })}
            >
              {deleteUser.isPending && <Spinner data-icon="inline-start" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
