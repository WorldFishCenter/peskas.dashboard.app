import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { metaObject } from "@/config/site.config";

export const metadata = metaObject("Reset Password");

export default async function ResetPasswordPage(props: { params: Promise<{ lang: string; token: string }> }) {
  const { lang, token } = await props.params;
  return (
    <AuthShell lang={lang} title="Reset your password">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
