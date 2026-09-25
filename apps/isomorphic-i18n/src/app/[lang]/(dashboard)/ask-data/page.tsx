"use client";

import { MessageCircleQuestionIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { useT } from "@/app/i18n/use-lang";

export default function AskDataPage() {
  const { t } = useT();
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageCircleQuestionIcon />
        </EmptyMedia>
        <EmptyTitle>{t("text-coming-soon")}</EmptyTitle>
        <EmptyDescription>{t("text-feature-under-development")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
