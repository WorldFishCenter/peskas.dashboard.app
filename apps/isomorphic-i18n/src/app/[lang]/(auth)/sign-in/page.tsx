import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { metaObject } from "@/config/site.config";

export const metadata = metaObject("Sign In");

export default async function SignInPage(props: { params: Promise<{ lang: string }> }) {
  const { lang } = await props.params;
  return (
    <AuthShell lang={lang} title="Sign In" description="Enter your credentials to access your account">
      <SignInForm />
    </AuthShell>
  );
}
