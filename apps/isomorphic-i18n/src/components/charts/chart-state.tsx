import { ChartNoAxesColumnIcon, TriangleAlertIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/utils";
import { useAtomValue } from "jotai";
import { useT } from "@/i18n/use-lang";
import { districtsAtom } from "@/store/filters";

/** Chart height for the analysis cards, as in the official shadcn chart examples. */
export const CHART_HEIGHT = "h-[250px]";

/** Height for a horizontal bar chart: one row per category plus the axis, never below 160px. */
export const categoryChartHeight = (rows: number, rowHeight = 28) => Math.max(160, rows * rowHeight + 56);

export type ChartStatus = "loading" | "error" | "empty";

/** Placeholder shown in a chart's slot while it loads, fails, or has no data. */
export function ChartState({
  status,
  className = CHART_HEIGHT,
  description,
}: {
  status: ChartStatus;
  className?: string;
  description?: string;
}) {
  const { t } = useT();

  if (status === "loading") return <Skeleton className={cn("w-full", className)} />;

  const isError = status === "error";
  return (
    <Empty className={cn("border", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {isError ? <TriangleAlertIcon /> : <ChartNoAxesColumnIcon />}
        </EmptyMedia>
        <EmptyTitle>{isError ? t("text-error") : t("text-no-data")}</EmptyTitle>
        <EmptyDescription>
          {description ?? (isError ? t("text-no-data-available") : t("text-no-data-available-for-filters"))}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/**
 * Renders `children` only when the chart has something to draw; otherwise the
 * matching placeholder: pick districts, loading, error, or no data.
 */
export function ChartGate({
  isLoading,
  error,
  isEmpty,
  emptyDescription,
  className,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyDescription?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useT();
  const districts = useAtomValue(districtsAtom);

  if (!districts.length) {
    return <ChartState status="empty" className={className} description={t("text-select-districts")} />;
  }
  if (isLoading) return <ChartState status="loading" className={className} />;
  if (error) return <ChartState status="error" className={className} />;
  if (isEmpty) return <ChartState status="empty" className={className} description={emptyDescription} />;
  return children;
}
