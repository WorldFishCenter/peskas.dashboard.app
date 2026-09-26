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
import { useLocalizedHref, useT } from "@/i18n/use-lang";

export default function NotFoundPage() {
  const localized = useLocalizedHref();
  const { t } = useT();
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon />
          </EmptyMedia>
          <EmptyTitle>{t("text-page-not-found")}</EmptyTitle>
          <EmptyDescription>{t("text-page-not-found-description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link to={localized("/")} />} nativeButton={false}>
            {t("text-back-home")}
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
