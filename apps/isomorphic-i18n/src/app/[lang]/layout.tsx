import { dir } from 'i18next';
import { getServerSession } from 'next-auth/next';
import { Toaster } from '@workspace/ui/components/toast';
import { TooltipProvider } from '@workspace/ui/components/tooltip';
import { cn } from '@workspace/ui/lib/utils';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { fontSans } from '@/app/fonts';
import LanguageInitializer from '@/app/i18n/language-initializer';
import { languages } from '@/app/i18n/settings';
import AuthProvider from '@/components/auth-provider';
import GoogleAnalytics from '@/components/google-analytics';
import { ThemeProvider } from '@/components/theme-provider';
import { TopLoader } from '@/components/top-loader';
import { siteConfig } from '@/config/site.config';
import { TRPCReactProvider } from '@/trpc/react';

export async function generateStaticParams() {
  return languages.map((lang) => ({ lang }));
}

export default async function LangLayout(props: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;
  const session = await getServerSession(authOptions);

  return (
    <html
      lang={lang}
      dir={dir(lang)}
      suppressHydrationWarning
      className={cn('antialiased font-sans', fontSans.variable)}
    >
      <body suppressHydrationWarning>
        <GoogleAnalytics />
        <TRPCReactProvider>
          <AuthProvider session={session}>
            <ThemeProvider defaultTheme={siteConfig.defaultTheme} enableSystem={false}>
              <TooltipProvider>
                <TopLoader />
                <LanguageInitializer lang={lang} />
                {props.children}
              </TooltipProvider>
              <Toaster />
            </ThemeProvider>
          </AuthProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
