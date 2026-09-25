import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { Link } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Spinner } from "@workspace/ui/components/spinner";
import { useLocalizedHref, useT } from "@/i18n/use-lang";
import { PasswordInput } from "@/components/auth/password-input";
import { routes } from "@/config/routes";
import { api } from "@/trpc/react";
import { ResetPasswordSchema, type ResetPasswordType } from "@/validators/reset-password.schema";

const FIELDS = [
  { name: "newPassword", label: "New Password", placeholder: "Enter your new password" },
  { name: "confirmPassword", label: "Confirm Password", placeholder: "Confirm your password" },
] as const;

export function ResetPasswordForm({ token }: { token: string }) {
  const localized = useLocalizedHref();
  // Validation messages are keys in the `form` namespace.
  const { t } = useT("form");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const form = useForm<ResetPasswordType>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "", token },
  });

  const resetPassword = api.user.resetPassword.useMutation({
    onSuccess: () => setResult({ ok: true, message: "Password reset successful." }),
    onError: () => setResult({ ok: false, message: "Invalid token." }),
  });

  const onSubmit = form.handleSubmit((data) => {
    setResult(null);
    resetPassword.mutate(data);
    form.reset({ newPassword: "", confirmPassword: "", token });
  });

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        {result && (
          <Alert variant={result.ok ? "default" : "destructive"}>
            {result.ok ? <CircleCheckIcon /> : <CircleAlertIcon />}
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}
        {FIELDS.map(({ name, label, placeholder }) => (
          <Controller
            key={name}
            name={name}
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`reset-${name}`}>{label}</FieldLabel>
                <PasswordInput
                  {...field}
                  id={`reset-${name}`}
                  placeholder={placeholder}
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[{ message: t(fieldState.error?.message ?? "") }]} />
                )}
              </Field>
            )}
          />
        ))}
        <Field>
          <Button type="submit" disabled={resetPassword.isPending}>
            {resetPassword.isPending && <Spinner data-icon="inline-start" />}
            Reset Password
          </Button>
          <FieldDescription className="text-center">
            <Link to={localized(routes.signIn)}>Back to sign in</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
