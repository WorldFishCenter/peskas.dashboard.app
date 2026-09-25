import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { metaObject } from "@/config/site.config";

export const metadata = metaObject("Forgot Password");

export default async function ForgotPasswordPage(props: { params: Promise<{ lang: string }> }) {
  const { lang } = await props.params;
  return (
    <AuthShell lang={lang} title="Forgot your password?" description="Enter your email and we will send you a reset link">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
