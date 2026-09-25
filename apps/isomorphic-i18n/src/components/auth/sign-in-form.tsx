import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSetAtom } from "jotai";
import { RESET } from "jotai/utils";
import { CircleAlertIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { useLocalizedHref } from "@/i18n/use-lang";
import { PasswordInput } from "@/components/auth/password-input";
import { routes } from "@/config/routes";
import { districtsAtom } from "@/store/filters";
import { api } from "@/trpc/react";
import { loginSchema, type LoginType } from "@/validators/login.schema";

export function SignInForm() {
  const navigate = useNavigate();
  const localized = useLocalizedHref();
  const setDistricts = useSetAtom(districtsAtom);
  const [error, setError] = useState("");
  const signIn = api.auth.signIn.useMutation();
  const form = useForm<LoginType>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    setError("");
    try {
      await signIn.mutateAsync(data);
      // A different user may have a different default district selection.
      setDistricts(RESET);
      navigate(localized(routes.home));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  });

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="sign-in-email">Email</FieldLabel>
              <Input
                {...field}
                id="sign-in-email"
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex items-center">
                <FieldLabel htmlFor="sign-in-password">Password</FieldLabel>
                <Link
                  to={localized(routes.forgotPassword)}
                  className="ml-auto text-sm underline-offset-4 hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <PasswordInput
                {...field}
                id="sign-in-password"
                placeholder="Enter your password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="rememberMe"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox id="sign-in-remember" checked={!!field.value} onCheckedChange={field.onChange} />
              <FieldLabel htmlFor="sign-in-remember" className="font-normal">
                Remember me
              </FieldLabel>
            </Field>
          )}
        />
        <Field>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
            Sign in
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
