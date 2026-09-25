import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { Link } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { useLocalizedHref } from "@/i18n/use-lang";
import { routes } from "@/config/routes";
import { api } from "@/trpc/react";
import {
  GenerateResetPasswordTokenSchema,
  type GenerateResetPasswordTokenType,
} from "@/validators/forget-password.schema";

export function ForgotPasswordForm() {
  const localized = useLocalizedHref();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const form = useForm<GenerateResetPasswordTokenType>({
    resolver: zodResolver(GenerateResetPasswordTokenSchema),
    defaultValues: { email: "" },
  });

  const generateToken = api.user.generateResetPasswordToken.useMutation({
    onSuccess: () => setResult({ ok: true, message: "Please check your email." }),
    onError: (err) => setResult({ ok: false, message: err.message }),
  });

  const onSubmit = form.handleSubmit((data) => {
    setResult(null);
    generateToken.mutate(data);
    form.reset();
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
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
              <Input
                {...field}
                id="forgot-email"
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Field>
          <Button type="submit" disabled={generateToken.isPending}>
            {generateToken.isPending && <Spinner data-icon="inline-start" />}
            Send reset link
          </Button>
          <FieldDescription className="text-center">
            Remembered it? <Link to={localized(routes.signIn)}>Sign in</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
