"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Spinner } from "@workspace/ui/components/spinner";
import { toast } from "@workspace/ui/components/toast";
import { ROLES, STATUSES } from "@/components/users/user-options";
import { BmuMultiPicker, BmuSinglePicker, groupBmus, type BmuOption } from "@/components/users/bmu-picker";
import { api } from "@/trpc/react";
import { UpsertUserSchema, type UpsertUserSchemaType } from "@/validators/user.schema";

const ROLE_ITEMS = [{ label: "Select a role", value: null }, ...ROLES.map((r) => ({ label: r, value: r }))];

const EMPTY_USER: UpsertUserSchemaType = {
  _id: undefined,
  name: "",
  email: "",
  password: "",
  role: "",
  status: "active",
  bmuNames: [],
  userBmu: undefined,
  fisherId: "",
};

type StoredBmu = { _id: unknown; BMU: string };
type StoredUser = {
  _id: unknown;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  fisherId?: string;
  bmus?: StoredBmu[];
  userBmu?: StoredBmu | null;
};

function toFormValues(user: StoredUser): UpsertUserSchemaType {
  return {
    _id: String(user._id),
    name: user.name ?? "",
    email: user.email ?? "",
    password: "",
    role: user.role ?? "",
    status: user.status ?? "active",
    bmuNames: user.bmus?.map((b) => ({ value: String(b._id), label: b.BMU })) ?? [],
    userBmu: user.userBmu ? { value: String(user.userBmu._id), label: user.userBmu.BMU } : undefined,
    fisherId: user.fisherId ?? "",
  };
}

/** Create a user (no `userId`) or edit an existing one. */
export function UserDialog({
  open,
  userId,
  onOpenChange,
}: {
  open: boolean;
  userId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: bmus } = api.user.allBmus.useQuery(undefined, { enabled: open });
  const { data: user } = api.user.byId.useQuery({ id: userId ?? "" }, { enabled: open && !!userId });

  const groups = useMemo(() => groupBmus(bmus as { _id: unknown; BMU: string; group: string }[] | undefined), [bmus]);
  const options = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const toOption = (v: { value: string; label: string }): BmuOption =>
    options.find((o) => o.value === v.value) ?? { ...v, group: "" };
  const fromOption = ({ value, label }: BmuOption) => ({ value, label });

  const form = useForm<UpsertUserSchemaType>({
    resolver: zodResolver(UpsertUserSchema),
    defaultValues: EMPTY_USER,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(userId && user ? toFormValues(user as unknown as StoredUser) : EMPTY_USER);
  }, [open, userId, user, form]);

  const role = useWatch({ control: form.control, name: "role" });

  const upsert = api.user.upsert.useMutation({
    onSuccess: async () => {
      await utils.user.invalidate();
      onOpenChange(false);
      toast.add({ type: "success", title: "Successfully updated user" });
      router.refresh();
    },
    onError: (err) => {
      toast.add({
        type: "error",
        title: err?.data?.code === "UNAUTHORIZED" ? "You must be logged in to update users" : "Failed to update user",
      });
    },
  });

  const onSubmit = form.handleSubmit(
    (values) => {
      if (!values._id && !values.password) {
        form.setError("password", { message: "Password is required for new users" });
        toast.add({ type: "error", title: "Password is required for new users" });
        return;
      }
      upsert.mutate(values);
    },
    () => toast.add({ type: "error", title: "Failed to update user" })
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{userId ? "Edit User" : "Add User"}</DialogTitle>
        </DialogHeader>
        <form id="user-form" onSubmit={onSubmit}>
          <FieldGroup>
            {userId && (
              <Controller
                name="_id"
                control={form.control}
                render={({ field }) => (
                  <Field data-disabled>
                    <FieldLabel htmlFor="user-id">ID</FieldLabel>
                    <Input {...field} id="user-id" disabled />
                  </Field>
                )}
              />
            )}
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="user-name">Name</FieldLabel>
                  <Input {...field} id="user-name" aria-invalid={fieldState.invalid} autoComplete="off" />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="user-email">Email</FieldLabel>
                  <Input {...field} id="user-email" type="email" aria-invalid={fieldState.invalid} autoComplete="off" />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="user-password">Password</FieldLabel>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    id="user-password"
                    type="password"
                    aria-invalid={fieldState.invalid}
                    autoComplete="new-password"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="role"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="user-role">Role</FieldLabel>
                  <Select
                    items={ROLE_ITEMS}
                    name={field.name}
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                  >
                    <SelectTrigger id="user-role" aria-invalid={fieldState.invalid} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ROLE_ITEMS.filter((r) => r.value).map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            {role === "IIA" && (
              <Controller
                name="fisherId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="user-fisher-id">Fisher ID</FieldLabel>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      id="user-fisher-id"
                      placeholder="e.g. f_1001"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            )}
            <Controller
              name="bmuNames"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="user-bmus">BMUs</FieldLabel>
                  <BmuMultiPicker
                    id="user-bmus"
                    groups={groups}
                    value={field.value.map(toOption)}
                    onChange={(next) => field.onChange(next.map(fromOption))}
                    invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="userBmu"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="user-bmu">User BMU</FieldLabel>
                  <BmuSinglePicker
                    id="user-bmu"
                    groups={groups}
                    value={field.value ? toOption(field.value) : null}
                    onChange={(next) => field.onChange(next ? fromOption(next) : undefined)}
                  />
                </Field>
              )}
            />
            <Controller
              name="status"
              control={form.control}
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <FieldLegend variant="label">Status</FieldLegend>
                  <RadioGroup
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex gap-6"
                  >
                    {STATUSES.map((s) => (
                      <Field key={s.value} orientation="horizontal">
                        <RadioGroupItem value={s.value} id={`user-status-${s.value}`} />
                        <FieldLabel htmlFor={`user-status-${s.value}`} className="font-normal">
                          {s.label}
                        </FieldLabel>
                      </Field>
                    ))}
                  </RadioGroup>
                </FieldSet>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button type="submit" form="user-form" disabled={upsert.isPending}>
            {upsert.isPending && <Spinner data-icon="inline-start" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
