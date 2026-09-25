import { useParams } from "react-router";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  const { token = "" } = useParams();
  return (
    <AuthShell title="Reset your password">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
