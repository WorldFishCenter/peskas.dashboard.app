import { FileQuestionIcon } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { useLocalizedHref } from "@/i18n/use-lang";

export default function NotFoundPage() {
  const localized = useLocalizedHref();
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon />
          </EmptyMedia>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>The page you are looking for does not exist or has been moved.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link to={localized("/")} />} nativeButton={false}>
            Back to home
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
