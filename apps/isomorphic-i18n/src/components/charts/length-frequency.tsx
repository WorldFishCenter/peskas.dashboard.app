import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@workspace/ui/components/chart";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_HEIGHT, ChartGate } from "@/components/charts/chart-state";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { activeCountry } from "@/config/countryConfig";
import {
  froeseBands,
  maturityPosition,
  MIN_MEASURED_TRIPS,
  shareInBand,
  type LengthClass,
  type MaturityPosition,
} from "@repo/domain/sizes";
import { formatPercent } from "@/lib/dashboard/format";
import { BELOW_MATURITY_COLOR, SPANNING_MATURITY_COLOR } from "@/lib/dashboard/palettes";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

const COLORS: Record<MaturityPosition, string> = {
  below: BELOW_MATURITY_COLOR,
  spanning: SPANNING_MATURITY_COLOR,
  above: "var(--primary)",
};

type ClassRow = { label: string; share: number; kg: number; position: MaturityPosition | null };

/**
 * Length-frequency of one species' recorded catch (share of its measured
 * weight in each length class), coloured against the length at maturity, with
 * Froese's shares below maturity, at optimum length and as large spawners.
 * Species measured on fewer than MIN_MEASURED_TRIPS landings are not offered.
 */
export function LengthFrequency({ className }: { className?: string }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const query = api.summaries.lengths.useQuery(scope.input, scope.options);
  const [picked, setPicked] = useState<string | null>(null);

  // Species measured on enough landings, most measured catch first.
  const species = useMemo(() => {
    const totals = new Map<string, { kg: number; trips: number }>();
    for (const m of query.data?.measured ?? []) {
      const s = totals.get(m.taxon) ?? { kg: 0, trips: 0 };
      s.kg += m.classes.reduce((sum, c) => sum + c.catch_kg, 0);
      s.trips += m.trips;
      totals.set(m.taxon, s);
    }
    return [...totals]
      .map(([taxon, s]) => ({ taxon, ...s }))
      .filter((s) => s.trips >= MIN_MEASURED_TRIPS)
      .sort((a, b) => b.kg - a.kg);
  }, [query.data]);

  // Open on the most-measured species with a maturity length.
  const selected =
    species.find((s) => s.taxon === picked) ?? species.find((s) => query.data?.maturity[s.taxon]) ?? species[0];
  const maturity = selected && query.data?.maturity[selected.taxon];
  const optimum = selected && query.data?.optimum[selected.taxon];

  const classes = useMemo(() => {
    const byMin = new Map<number, LengthClass>();
    for (const c of query.data?.measured.flatMap((m) => (m.taxon === selected?.taxon ? m.classes : [])) ?? []) {
      const k = byMin.get(c.length_min) ?? { length_min: c.length_min, length_max: c.length_max, catch_kg: 0 };
      k.catch_kg += c.catch_kg;
      byMin.set(c.length_min, k);
    }
    return [...byMin.values()].sort((a, b) => a.length_min - b.length_min);
  }, [query.data, selected]);

  const total = classes.reduce((sum, c) => sum + c.catch_kg, 0);
  const rows: ClassRow[] = classes.map((c) => ({
    label: c.length_max == null ? `≥${c.length_min}` : `${c.length_min}–${c.length_max}`,
    share: total ? (100 * c.catch_kg) / total : 0,
    kg: c.catch_kg,
    position: maturity ? maturityPosition(c, maturity) : null,
  }));

  const bands = froeseBands(maturity, optimum);
  const cm = (v: number) => Math.round(v).toString();
  const range = (band: { from: number; to: number } | null) => {
    const share = band && shareInBand(classes, band);
    if (!share) return null;
    const [least, most] = [formatPercent(100 * share.least, lang), formatPercent(100 * share.most, lang)];
    return least === most ? least : t("text-share-range", { least, most });
  };
  const indicators = [
    bands.immature && { label: t("text-band-immature", { to: cm(bands.immature.to) }), value: range(bands.immature) },
    bands.optimum && {
      label: t("text-band-optimum", { from: cm(bands.optimum.from), to: cm(bands.optimum.to) }),
      value: range(bands.optimum),
    },
    bands.megaspawners && { label: t("text-band-megaspawners", { from: cm(bands.megaspawners.from) }), value: range(bands.megaspawners) },
  ].filter((i): i is { label: string; value: string | null } => !!i);

  const items = species.map((s) => ({ value: s.taxon, label: s.taxon }));
  const emptyDescription =
    query.data?.available === false
      ? t("text-lengths-not-published")
      : query.data?.measured.length
        ? t("text-too-few-measured-species", { min: MIN_MEASURED_TRIPS })
        : t("text-no-length-data-available");

  return (
    <ChartCard
      id="length-frequency"
      className={className}
      title={t("title-length-frequency")}
      description={t("text-length-frequency-description")}
      info="info-lengths"
      download={rows.map((r) => ({ species: selected?.taxon, length_class_cm: r.label, share_pct: r.share, catch_kg: r.kg }))}
      scope={scope}
      footer={
        <>
          {selected && <span>{t("text-measured-trips", { count: selected.trips })}</span>}
          {activeCountry.survey.meanLengths && <span>{t("text-lengths-means-note")}</span>}
        </>
      }
      action={
        items.length > 0 && (
          <Select<string> items={items} value={selected?.taxon ?? null} onValueChange={(v) => v && setPicked(v)}>
            <SelectTrigger size="sm" aria-label={t("text-species")} className="max-w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )
      }
    >
      <ChartGate query={query} isEmpty={!rows.length} emptyDescription={emptyDescription}>
        <>
          {indicators.length ? (
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              {indicators.map((i) => (
                <div key={i.label} className="contents">
                  <dt className="text-muted-foreground">{i.label}</dt>
                  <dd className="font-medium tabular-nums">{i.value ?? "-"}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm">{t("text-no-maturity-for-species")}</p>
          )}
          <ChartContainer
            config={{ share: { label: t("text-share-of-measured-catch") } }}
            className={`aspect-auto w-full ${CHART_HEIGHT}`}
          >
            <BarChart accessibilityLayer data={rows} margin={{ top: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => `${v}%`} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideIndicator
                    labelFormatter={(label) => `${label} cm`}
                    formatter={(_value, _name, item) => {
                      const row = item.payload as ClassRow;
                      return (
                        <div className="grid w-full gap-1.5">
                          <TooltipRow label={t("text-share-of-measured-catch")} value={formatPercent(row.share, lang)} />
                          <TooltipRow label={t("text-recorded-catch")} value={`${row.kg.toLocaleString(lang, { maximumFractionDigits: 0 })} kg`} />
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar dataKey="share" radius={[4, 4, 0, 0]}>
                {rows.map((r) => (
                  <Cell key={r.label} fill={COLORS[r.position ?? "above"]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          {maturity && (
            <div className="flex flex-wrap justify-center gap-4 text-xs">
              {(["below", "spanning", "above"] as const).map((position) => (
                <span key={position} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: COLORS[position] }} />
                  {t(`text-${position}-maturity-short`)}
                </span>
              ))}
            </div>
          )}
        </>
      </ChartGate>
    </ChartCard>
  );
}
