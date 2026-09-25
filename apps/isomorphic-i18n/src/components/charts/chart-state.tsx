import { Component, type ReactNode } from "react";
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
import { useT } from "@/i18n/use-lang";

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

/** The parts of a query result (React Query) that decide what a chart shows. */
type QueryState = { isPending: boolean; isFetching: boolean; error: unknown; dataUpdatedAt: number };

/**
 * Renders `children` once the query has something to draw, otherwise its
 * placeholder: the "select districts" prompt, loading, error or no data. A
 * pending query that isn't fetching was disabled, and only an empty district
 * selection disables one (useDistrictScope). A chart that throws while
 * rendering shows the error state instead of taking the page down.
 */
export function ChartGate({
  query,
  isEmpty,
  emptyDescription,
  className,
  children,
}: {
  query: QueryState;
  isEmpty: boolean;
  emptyDescription?: string;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useT();

  if (query.isPending && !query.isFetching) {
    return <ChartState status="empty" className={className} description={t("text-select-districts")} />;
  }
  if (query.isPending) return <ChartState status="loading" className={className} />;
  if (query.error) return <ChartState status="error" className={className} />;
  if (isEmpty) return <ChartState status="empty" className={className} description={emptyDescription} />;
  // New data remounts the guard, so a chart that failed on one response can draw the next.
  return (
    <RenderGuard key={query.dataUpdatedAt} fallback={<ChartState status="error" className={className} />}>
      {children}
    </RenderGuard>
  );
}

class RenderGuard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
