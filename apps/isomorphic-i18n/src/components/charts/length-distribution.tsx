import { useMemo, useState } from "react";
import { InfoIcon, ListChecksIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@workspace/ui/components/combobox";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@workspace/ui/components/hover-card";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { categoryChartHeight, ChartGate } from "@/components/charts/chart-state";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { truncateLabel } from "@/lib/dashboard/format";
import { computeLengthStats, rankSpeciesByCatch, type LengthStats } from "@/lib/dashboard/length-stats";
import { BOX_LOWER_COLOR, BOX_UPPER_COLOR } from "@/lib/dashboard/palettes";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

const PRESETS = ["3", "5", "8", "10", "all"] as const;
type Preset = (typeof PRESETS)[number];
const MAX_CUSTOM = 15;

/** Whisker from min to max, with the Q1→median and median→Q3 boxes drawn on top. */
function BoxShape({ x = 0, y = 0, width = 0, height = 0, payload }: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: LengthStats;
}) {
  if (!payload) return null;
  const { min, max, q1, median, q3 } = payload;
  const px = (v: number) => (max > min ? x + ((v - min) / (max - min)) * width : x);
  const cy = y + height / 2;
  const boxHeight = height * 0.6;
  const top = cy - boxHeight / 2;
  return (
    <g className="stroke-foreground">
      <line x1={x} x2={x + width} y1={cy} y2={cy} />
      <line x1={x} x2={x} y1={top} y2={top + boxHeight} />
      <line x1={x + width} x2={x + width} y1={top} y2={top + boxHeight} />
      <rect x={px(q1)} y={top} width={px(median) - px(q1)} height={boxHeight} fill={BOX_LOWER_COLOR} />
      <rect x={px(median)} y={top} width={px(q3) - px(median)} height={boxHeight} fill={BOX_UPPER_COLOR} />
      <line x1={px(median)} x2={px(median)} y1={top} y2={top + boxHeight} strokeWidth={2} />
    </g>
  );
}

function AboutLengthDistribution() {
  const { t } = useT();
  return (
    <HoverCard>
      <HoverCardTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t("text-about-length-distribution")} />}>
        <InfoIcon />
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-80">
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium">{t("text-about-length-distribution")}</p>
          <p className="text-muted-foreground">{t("text-length-distribution-description")}</p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">{t("text-species-ranking")}</strong>{" "}
            {t("text-species-ranking-description")}
          </p>
          <p className="font-medium">{t("text-box-elements")}</p>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-muted-foreground">
            {(["box", "median", "whiskers"] as const).map((el) => (
              <li key={el}>
                <strong className="text-foreground">{t(`text-box-element-${el}`)}</strong>{" "}
                {t(`text-box-element-${el}-description`)}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">{t("text-length-distribution-summary")}</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/** Box plots of district mean lengths for the top species by catch, or a custom pick. */
export function LengthDistribution({ className }: { className?: string }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const [choice, setChoice] = useState<{ preset: Preset } | { custom: string[] }>({ preset: "10" });

  const query = api.summaries.taxa.useQuery({ ...scope.input, metrics: ["mean_length", "catch_kg"] }, scope.options);
  const { data } = query;
  const rows = useMemo(() => data ?? [], [data]);
  const ranked = useMemo(() => rankSpeciesByCatch(rows), [rows]);
  const scientificNames = useMemo(() => new Map(ranked.map((s) => [s.name, s.scientificName ?? ""])), [ranked]);
  // Search matches the common or the scientific name.
  const matchesSpecies = (name: string, query: string) => {
    const q = query.toLowerCase();
    return name.toLowerCase().includes(q) || (scientificNames.get(name) ?? "").toLowerCase().includes(q);
  };

  const selected = useMemo(
    () =>
      "preset" in choice
        ? (choice.preset === "all" ? ranked : ranked.slice(0, Number(choice.preset))).map((s) => s.name)
        : choice.custom,
    [choice, ranked]
  );
  const stats = useMemo(() => computeLengthStats(rows, selected), [rows, selected]);

  const chartConfig = { range: { label: t("text-length-distribution") } } satisfies ChartConfig;
  const cm = (v: number) => `${v.toLocaleString(lang, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} cm`;
  const custom = "custom" in choice;

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        value={"preset" in choice ? [choice.preset] : []}
        onValueChange={(v) => v[0] && setChoice({ preset: v[0] as Preset })}
      >
        {PRESETS.map((p) => (
          <ToggleGroupItem key={p} value={p}>
            {p === "all" ? t("text-all") : t(`text-top-${p}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Combobox
        items={ranked.map((s) => s.name)}
        multiple
        filter={matchesSpecies}
        value={selected}
        onValueChange={(next: string[]) => next.length <= MAX_CUSTOM && setChoice({ custom: next })}
      >
        <ComboboxTrigger render={<Button variant={custom ? "secondary" : "outline"} size="sm" />}>
          <ListChecksIcon data-icon="inline-start" />
          {custom ? `${selected.length} ${t("text-species-selected")}` : t("text-custom-selection")}
        </ComboboxTrigger>
        <ComboboxContent align="end" className="w-72">
          <ComboboxInput showTrigger={false} placeholder={t("text-search-by-name")} />
          <ComboboxEmpty>{t("text-no-species-found")}</ComboboxEmpty>
          <ComboboxList>
            {(name: string) => (
              <ComboboxItem
                key={name}
                value={name}
                disabled={!selected.includes(name) && selected.length >= MAX_CUSTOM}
              >
                {name}
              </ComboboxItem>
            )}
          </ComboboxList>
          <Separator />
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
            <span>
              {selected.length >= MAX_CUSTOM
                ? t("text-maximum-species-selected")
                : `${selected.length} ${t("text-species-selected")}`}
            </span>
            {selected.length > 0 && (
              <Button variant="ghost" size="xs" onClick={() => setChoice({ custom: [] })}>
                {t("text-clear-all")}
              </Button>
            )}
          </div>
        </ComboboxContent>
      </Combobox>
    </div>
  );

  return (
    <ChartCard className={className} title={t("text-length-distribution")} action={<AboutLengthDistribution />}>
      {controls}
      <ChartGate query={query} isEmpty={!ranked.length || !stats.length} emptyDescription={t(ranked.length ? "text-select-species-to-view" : "text-no-length-data-available")}>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto w-full"
          style={{ height: categoryChartHeight(stats.length) }}
        >
          <BarChart accessibilityLayer data={stats} layout="vertical" margin={{ right: 20, bottom: 24 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              label={{ value: t("text-length-cm"), position: "insideBottom", offset: -16, className: "fill-muted-foreground" }}
            />
            <YAxis dataKey="name" type="category" width={120} tickLine={false} axisLine={false} tickFormatter={(v: string) => truncateLabel(v)} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideIndicator
                  labelFormatter={(_, payload) => {
                    const s = payload?.[0]?.payload as LengthStats | undefined;
                    return (
                      <div className="grid">
                        <span>{s?.name ?? t("text-unknown")}</span>
                        {s?.scientificName && (
                          <span className="font-normal text-muted-foreground italic">{s.scientificName}</span>
                        )}
                      </div>
                    );
                  }}
                  formatter={(_value, _name, item) => {
                    const s = item.payload as LengthStats;
                    return (
                      <div className="grid w-full gap-1.5">
                        <TooltipRow label={t("text-mean")} value={cm(s.mean)} />
                        <TooltipRow label={t("text-median")} value={cm(s.median)} />
                        <TooltipRow label={t("text-q1")} color={BOX_LOWER_COLOR} value={cm(s.q1)} />
                        <TooltipRow label={t("text-q3")} color={BOX_UPPER_COLOR} value={cm(s.q3)} />
                        <TooltipRow label={t("text-range")} value={`${cm(s.min)} – ${cm(s.max)}`} />
                        <TooltipRow label={t("text-districts")} value={s.districts} />
                        {s.totalCatch > 0 && (
                          <TooltipRow
                            label={t("text-total-catch")}
                            value={`${s.totalCatch.toLocaleString(lang, { maximumFractionDigits: 1 })} kg`}
                          />
                        )}
                      </div>
                    );
                  }}
                />
              }
            />
            <Bar dataKey={(d: LengthStats) => [d.min, d.max]} name="range" shape={<BoxShape />} />
          </BarChart>
        </ChartContainer>
      </ChartGate>
    </ChartCard>
  );
}
