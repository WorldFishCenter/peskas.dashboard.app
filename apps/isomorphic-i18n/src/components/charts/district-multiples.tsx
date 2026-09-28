import { useMemo } from "react";
import { Line, LineChart, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@workspace/ui/components/chart";
import { cn } from "@workspace/ui/lib/utils";
import { combine, FEW_LANDINGS, METRICS, type MetricKey } from "@repo/domain/metrics";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { Legend } from "@/components/charts/legend";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { WarningIcon } from "@/components/charts/warning-icon";
import { formatNumber, landingsCount, monthTooltipLabel } from "@/lib/dashboard/format";
import { metricTitle, metricUnit } from "@/lib/dashboard/metrics";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

type Point = { month: string; value: number | null; overall: number | null; thin: boolean };
type DotProps = { cx?: number; cy?: number; value?: unknown; payload?: Point; index?: number };

/**
 * One small chart per selected district, all on the same axis and sorted by
 * the window's value, with the average district in grey behind each: a
 * district is read against the others without eleven crossing lines. For an
 * average metric that is the selection's figure (weighted by landings); for a
 * total, the mean of the districts, since their sum would dwarf every panel.
 */
export function DistrictMultiples({ metric }: { metric: MetricKey }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const monthly = api.summaries.monthly.useQuery({ ...scope.input, metric }, scope.options);
  const districts = api.summaries.byDistrict.useQuery(scope.input, scope.options);

  const total = METRICS[metric].overDistricts === "sum";
  const { panels, max, anyThin } = useMemo(() => {
    const rows = monthly.data?.rows ?? [];
    const selection = new Map((monthly.data?.overall ?? []).map((p) => [p.month, p.value]));
    const reference = new Map(
      rows.map((r) => {
        const values = Object.entries(r).flatMap(([k, v]) => (k === "month" ? [] : [v as number]));
        return [r.month, total ? combine(values, "mean") : selection.get(r.month) ?? null];
      }),
    );
    const thin = new Set(monthly.data?.thin);
    const panels = (districts.data ?? [])
      .filter((d) => rows.some((r) => r[d.district] != null))
      .map((d) => ({
        district: d.district,
        value: d[metric],
        landings: d.n_submissions ?? 0,
        points: rows.map(
          (r): Point => ({
            month: r.month,
            value: (r[d.district] as number | undefined) ?? null,
            overall: reference.get(r.month) ?? null,
            thin: thin.has(`${r.month}|${d.district}`),
          }),
        ),
      }))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const max = Math.max(
      0,
      ...panels.flatMap((p) => p.points.flatMap((q) => [q.value ?? 0, q.overall ?? 0])),
    );
    const anyThin = panels.some((p) => p.points.some((q) => q.thin && q.value != null));
    return { panels, max, anyThin };
  }, [monthly.data, districts.data, metric, total]);

  // One district is already the whole trend above.
  if (scope.input.districts.length === 1) return null;
  const unit = metricUnit(t, metric);
  const format = (v: unknown) => formatNumber(v, lang);

  return (
    <ChartCard
      id={`districts-${metric}`}
      title={t("title-district-multiples")}
      description={t("text-district-multiples-description", { metric: metricTitle(t, metric) })}
      footer={
        <>
          <Legend
            items={[
              { label: t("text-multiples-district"), color: "var(--chart-1)", shape: "line" },
              {
                label: t(total ? "text-selection-average" : "text-selection-average-weighted"),
                color: "var(--context-muted)",
                shape: "line",
              },
              ...(anyThin
                ? [
                    {
                      label: t("text-thin-month", { min: FEW_LANDINGS }),
                      color: "var(--chart-1)",
                      shape: "hollow" as const,
                    },
                  ]
                : []),
            ]}
          />
          <p>{t("text-multiples-axis", { max: `${format(max)}${unit ? ` ${unit}` : ""}` })}</p>
        </>
      }
    >
      <ChartGate query={monthly} isEmpty={!panels.length}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {panels.map((p) => {
            const thin = p.landings < FEW_LANDINGS;
            return (
              <div key={p.district} className="flex min-w-0 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate font-medium" title={p.district}>
                    {p.district}
                  </span>
                  <span className="tabular-nums">{format(p.value)}</span>
                </div>
                <ChartContainer
                  config={{
                    value: { label: p.district },
                    overall: { label: t("text-selection-average") },
                  }}
                  className="aspect-auto h-20 w-full"
                >
                  <LineChart
                    data={p.points}
                    margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                    syncId="district-multiples"
                  >
                    <YAxis hide domain={[0, max || 1]} />
                    <ChartTooltip
                      cursor={{ stroke: "var(--border)" }}
                      content={
                        <ChartTooltipContent
                          labelFormatter={monthTooltipLabel(lang)}
                          formatter={(value, name, item) => (
                            <TooltipRow
                              color={item.color}
                              label={name === "overall" ? t("text-selection-average") : p.district}
                              value={format(value)}
                            />
                          )}
                        />
                      }
                    />
                    <Line
                      dataKey="overall"
                      stroke="var(--context-muted)"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      dataKey="value"
                      stroke="var(--chart-1)"
                      strokeWidth={1.75}
                      isAnimationActive={false}
                      // A month without a value draws no dot; one on few landings is hollow.
                      dot={({ cx, cy, value, payload, index }: DotProps) =>
                        value == null || cy == null ? (
                          <g key={index} />
                        ) : (
                          <circle
                            key={index}
                            cx={cx}
                            cy={cy}
                            r={2.5}
                            stroke="var(--chart-1)"
                            strokeWidth={1.5}
                            fill={payload?.thin ? "var(--background)" : "var(--chart-1)"}
                          />
                        )
                      }
                    />
                  </LineChart>
                </ChartContainer>
                <span className={cn("flex items-center gap-1 text-xs text-muted-foreground")}>
                  {thin && <WarningIcon label={t("text-scope-few-landings")} />}
                  {landingsCount(t, lang, p.landings)}
                </span>
              </div>
            );
          })}
        </div>
      </ChartGate>
    </ChartCard>
  );
}
