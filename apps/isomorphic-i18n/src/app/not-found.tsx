import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { fontSans } from "@/app/fonts";
import { ThemeProvider } from "@/components/theme-provider";
import { siteConfig } from "@/config/site.config";

// Rendered outside [lang]/layout.tsx, so it provides its own document shell.
export default function NotFound() {
  return (
    <html lang="en" suppressHydrationWarning className={`${fontSans.variable} font-sans antialiased`}>
      <body className="flex min-h-svh items-center justify-center p-6">
        <ThemeProvider defaultTheme={siteConfig.defaultTheme} enableSystem={false}>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileQuestionIcon />
              </EmptyMedia>
              <EmptyTitle>Page not found</EmptyTitle>
              <EmptyDescription>The page you are looking for does not exist or has been moved.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button render={<Link href="/" />} nativeButton={false}>
                Back to home
              </Button>
            </EmptyContent>
          </Empty>
        </ThemeProvider>
      </body>
    </html>
  );
}
