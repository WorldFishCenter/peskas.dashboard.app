import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <AuthShell title="Sign In" description="Enter your credentials to access your account">
      <SignInForm />
    </AuthShell>
  );
}
