import { Fragment } from "react";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { Line, LineChart, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@workspace/ui/components/chart";
import { useT } from "@/i18n/use-lang";
import { InfoPopover, type ChartInfo } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { numberLocale } from "@/lib/dashboard/format";

/**
 * The change on a year earlier, without judging it: a rise in catch is not
 * good news by itself, so no green or red.
 */
export function Change({ pct, previous }: { pct: number; previous?: string }) {
  const { t, lang } = useT();
  const Icon = Math.abs(pct) < 1 ? MinusIcon : pct > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  const signed = `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct).toLocaleString(numberLocale(lang), { maximumFractionDigits: 0 })}%`;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Icon className="size-3.5" aria-hidden />
        <span className="font-medium tabular-nums">{signed}</span>
      </span>
      {previous && (
        <span className="text-muted-foreground">{t("text-change-vs", { previous })}</span>
      )}
    </span>
  );
}

/** A figure's change on a year earlier (none where it isn't shown) and the earlier figure. */
type YearChange = { pct: number | null; previous: string };

const sparkConfig = { value: { label: "value" } } satisfies ChartConfig;

/** A month-by-month line under a figure, with no axes: its shape, not its values. */
export function Sparkline({ values }: { values: (number | null)[] }) {
  const points = values.map((value, i) => ({ i, value }));
  if (points.filter((p) => p.value != null).length < 3) return null;
  return (
    <ChartContainer config={sparkConfig} className="aspect-auto h-10 w-full">
      <LineChart data={points} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line
          dataKey="value"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

/**
 * One headline figure: its name, value and unit, the change on the same
 * months a year earlier, and optionally its explanation and a sparkline.
 * An estimate both methods make shows each method's figure (`methods`),
 * keyed by its line in the charts. The caller supplies the frame (a card,
 * or a toggle when tiles pick a metric).
 */
export function StatTile({
  id,
  label,
  value,
  unit,
  methods,
  change,
  note,
  info,
  spark,
}: {
  id: string;
  label: string;
  value: string;
  unit?: string;
  /** Each method with a figure, and its change where it has one. */
  methods?: { label: string; color: string; value: string; change: YearChange }[];
  change?: YearChange | null;
  note?: React.ReactNode;
  info?: ChartInfo;
  spark?: (number | null)[];
}) {
  return (
    <div className="flex w-full flex-col gap-1 text-left">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        {info && <InfoPopover id={id} title={label} info={info} />}
      </div>
      {methods ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3">
          {methods.map((m) => (
            <Fragment key={m.label}>
              <dt>
                <Legend items={[{ label: m.label, color: m.color, shape: "line" }]} />
              </dt>
              <dd className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-2xl leading-8 font-semibold tracking-tight">{m.value}</span>
                {unit && <span className="text-[13px] text-muted-foreground">{unit}</span>}
                {m.change.pct != null && (
                  <span className="text-[13px]">
                    <Change pct={m.change.pct} previous={m.change.previous} />
                  </span>
                )}
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[2rem] leading-10 font-semibold tracking-tight">{value}</span>
          {unit && <span className="text-[15px] text-muted-foreground">{unit}</span>}
        </div>
      )}
      <div className="min-h-5 text-[13px]">
        {change?.pct != null ? <Change pct={change.pct} previous={change.previous} /> : note}
      </div>
      {spark && <Sparkline values={spark} />}
    </div>
  );
}
