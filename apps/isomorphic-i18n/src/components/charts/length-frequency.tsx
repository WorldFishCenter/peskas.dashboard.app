import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { Button } from "@workspace/ui/components/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@workspace/ui/components/combobox";
import { cn } from "@workspace/ui/lib/utils";
import {
  froeseBands,
  maturityPosition,
  MIN_MEASURED_TRIPS,
  measuredSpecies,
  shareInBand,
  type LengthClass,
  type MeasuredSpecies as Measured,
} from "@repo/domain/sizes";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { MaturityLegend, RangeBar } from "@/components/charts/inline-bars";
import { activeCountry } from "@/config/countryConfig";
import { formatPercent, landingsCount, numberLocale, shareRange } from "@/lib/dashboard/format";
import { MATURITY_FILL, useSpeciesName } from "@/lib/dashboard/species";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

/**
 * Sizes at capture: one species' length-frequency against its length at
 * maturity and optimum length, and beside it every species measured on
 * enough landings, ranked by how much of its catch is below maturity.
 * Species measured on fewer than MIN_MEASURED_TRIPS landings are left out.
 */
export function SpeciesSizes() {
  const { t } = useT();
  const scope = useDistrictScope();
  const query = api.summaries.lengths.useQuery(scope.input, scope.options);
  const name = useSpeciesName();
  const [picked, setPicked] = useState<string | null>(null);

  const species = useMemo(
    () =>
      query.data
        ? measuredSpecies(query.data.measured, query.data.maturity, query.data.optimum)
        : [],
    [query.data],
  );

  // Open on the most-measured species with a maturity length.
  const selected =
    species.find((s) => s.taxon === picked) ?? species.find((s) => s.maturity) ?? species[0];
  const emptyDescription =
    query.data?.available === false
      ? t("text-lengths-not-published")
      : query.data?.measured.length
        ? t("text-too-few-measured-species", { min: MIN_MEASURED_TRIPS })
        : t("text-no-length-data-available");

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <ChartCard
        id="length-frequency"
        title={
          selected
            ? t("title-length-frequency-species", { species: name(selected.taxon) })
            : t("title-length-frequency")
        }
        description={t("text-length-frequency-description")}
        info="info-lengths"
        download={selected?.classes.map((c) => ({
          species: selected.taxon,
          length_min_cm: c.length_min,
          length_max_cm: c.length_max,
          catch_kg: c.catch_kg,
        }))}
        footer={
          <>
            {selected && <span>{t("text-measured-trips", { count: selected.trips })}</span>}
            {activeCountry.survey.meanLengths && <span>{t("text-lengths-means-note")}</span>}
          </>
        }
        action={
          species.length > 0 && (
            <SpeciesPicker species={species} selected={selected} onPick={setPicked} />
          )
        }
      >
        <ChartGate
          query={query}
          isEmpty={!selected}
          emptyDescription={emptyDescription}
          className="h-[380px]"
        >
          {selected && <LengthChart species={selected} />}
        </ChartGate>
      </ChartCard>
      <SmallCatch
        species={species}
        selected={selected?.taxon}
        onPick={setPicked}
        query={query}
        emptyDescription={emptyDescription}
      />
    </div>
  );
}

/** Species search over common and scientific names. */
function SpeciesPicker({
  species,
  selected,
  onPick,
}: {
  species: Measured[];
  selected?: Measured;
  onPick: (taxon: string) => void;
}) {
  const { t } = useT();
  const name = useSpeciesName();
  const items = species.map((s) => ({ value: s.taxon, label: name(s.taxon) }));
  const value = items.find((i) => i.value === selected?.taxon) ?? null;
  return (
    <Combobox
      items={items}
      value={value}
      onValueChange={(item) => item && onPick(item.value)}
      itemToStringLabel={(item) => item.label}
      itemToStringValue={(item) => `${item.label} ${item.value}`}
    >
      <ComboboxTrigger
        render={
          <Button variant="outline" size="sm" className="max-w-64 justify-between font-normal" />
        }
        aria-label={t("text-species")}
      >
        <span className="truncate">
          <ComboboxValue />
        </span>
      </ComboboxTrigger>
      <ComboboxContent align="end" className="w-80">
        <ComboboxInput showTrigger={false} placeholder={t("text-search-species")} />
        <ComboboxEmpty>{t("text-no-species-found")}</ComboboxEmpty>
        <ComboboxList>
          {(item: (typeof items)[number]) => (
            <ComboboxItem key={item.value} value={item}>
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{item.label}</span>
                {item.label !== item.value && (
                  <span className="truncate text-xs text-muted-foreground italic">
                    {item.value}
                  </span>
                )}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

/** Width of an element, following resizes. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const HEIGHT = 300;
const M = { top: 28, right: 12, bottom: 40, left: 48 };

/**
 * A histogram on a real length axis: classes are 5 to 50 cm wide, so each
 * bar is as wide as its class and as tall as its share of the measured catch
 * per cm, and its area is its share. The open top class is drawn one class
 * wide. Shading marks the lengths below maturity and at optimum length.
 */
function LengthChart({ species }: { species: Measured }) {
  const { t, lang } = useT();
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const { classes, maturity, optimum } = species;

  const total = classes.reduce((sum, c) => sum + c.catch_kg, 0);
  const upper = (c: LengthClass, i: number) =>
    c.length_max ?? c.length_min + (i > 0 ? c.length_min - classes[i - 1].length_min : 10);
  const bars = classes.map((c, i) => {
    const hi = upper(c, i);
    const share = total ? (100 * c.catch_kg) / total : 0;
    return {
      ...c,
      hi,
      share,
      density: share / (hi - c.length_min),
      position: maturity ? maturityPosition(c, maturity) : null,
    };
  });
  const bands = froeseBands(maturity, optimum);
  const shares = {
    immature: bands.immature && shareInBand(classes, bands.immature),
    optimum: bands.optimum && shareInBand(classes, bands.optimum),
    megaspawners: bands.megaspawners && shareInBand(classes, bands.megaspawners),
  };

  const lo = Math.min(...bars.map((b) => b.length_min));
  const hi = Math.max(...bars.map((b) => b.hi), maturity ?? 0, bands.optimum?.to ?? 0);
  const x = scaleLinear()
    .domain([Math.max(0, lo - 5), hi + 5])
    .range([M.left, Math.max(M.left + 1, width - M.right)])
    .nice();
  const y = scaleLinear()
    .domain([0, Math.max(...bars.map((b) => b.density))])
    .range([HEIGHT - M.bottom, M.top])
    .nice();
  const [x0, x1] = x.domain();
  const cm = (v: number) => Math.round(v).toLocaleString(numberLocale(lang));
  const hovered = hover != null ? bars[hover] : null;

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-3 gap-4">
        {(
          [
            ["immature", bands.immature && t("text-band-immature", { to: cm(bands.immature.to) })],
            [
              "optimum",
              bands.optimum &&
                t("text-band-optimum", { from: cm(bands.optimum.from), to: cm(bands.optimum.to) }),
            ],
            [
              "megaspawners",
              bands.megaspawners &&
                t("text-band-megaspawners", { from: cm(bands.megaspawners.from) }),
            ],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex flex-col">
            <dt className="text-[13px] text-muted-foreground">
              {label || t(`text-band-${key}-none`)}
            </dt>
            <dd className="text-2xl font-semibold">
              {label ? shareRange(t, lang, shares[key]) : "-"}
            </dd>
          </div>
        ))}
      </dl>
      {!maturity && (
        <p className="text-sm text-muted-foreground">{t("text-no-maturity-for-species")}</p>
      )}
      <div ref={ref} className="relative w-full">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            role="img"
            aria-label={t("text-length-frequency-description")}
            className="overflow-visible print:h-auto print:w-full"
          >
            {bands.immature && (
              <rect
                x={x(x0)}
                y={M.top}
                width={Math.max(0, x(Math.min(bands.immature.to, x1)) - x(x0))}
                height={HEIGHT - M.top - M.bottom}
                fill="var(--concern-1)"
                opacity={0.12}
              />
            )}
            {bands.optimum && (
              <rect
                x={x(bands.optimum.from)}
                y={M.top}
                width={x(Math.min(bands.optimum.to, x1)) - x(bands.optimum.from)}
                height={HEIGHT - M.top - M.bottom}
                fill="var(--chart-1)"
                opacity={0.1}
              />
            )}
            {y.ticks(4).map((v) => (
              <g key={v}>
                <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke="var(--border)" />
                <text
                  x={M.left - 8}
                  y={y(v)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground text-xs"
                >
                  {formatPercent(v, lang)}
                </text>
              </g>
            ))}
            {bars.map((b, i) => (
              <rect
                key={b.length_min}
                x={x(b.length_min) + 1}
                y={y(b.density)}
                width={Math.max(1, x(b.hi) - x(b.length_min) - 2)}
                height={Math.max(0, y(0) - y(b.density))}
                rx={2}
                fill={MATURITY_FILL[b.position ?? "above"]}
                opacity={hover == null || hover === i ? 1 : 0.5}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
            {maturity && maturity <= x1 && (
              <g>
                <line
                  x1={x(maturity)}
                  x2={x(maturity)}
                  y1={M.top - 10}
                  y2={HEIGHT - M.bottom}
                  stroke="var(--foreground)"
                  strokeWidth={1.5}
                />
                <text
                  x={x(maturity) - 6}
                  y={M.top - 14}
                  textAnchor="end"
                  className="fill-foreground text-xs"
                >
                  {t("text-maturity-line", { cm: cm(maturity) })}
                </text>
              </g>
            )}
            {bands.optimum && bands.optimum.from <= x1 && (
              <text
                x={x(bands.optimum.from) + 6}
                y={M.top - 14}
                className="fill-muted-foreground text-xs"
              >
                {t("text-optimum-band")}
              </text>
            )}
            {x.ticks(8).map((v) => (
              <text
                key={v}
                x={x(v)}
                y={HEIGHT - M.bottom + 18}
                textAnchor="middle"
                className="fill-muted-foreground text-xs"
              >
                {cm(v)}
              </text>
            ))}
            <text
              x={(M.left + width - M.right) / 2}
              y={HEIGHT - 4}
              textAnchor="middle"
              className="fill-muted-foreground text-xs"
            >
              {t("text-length-axis")}
            </text>
          </svg>
        )}
        {hovered && (
          <div
            data-slot="chart-tooltip"
            className="pointer-events-none absolute z-10 rounded-md border px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
            style={{
              left: Math.min(x((hovered.length_min + hovered.hi) / 2), width - 160),
              top: Math.max(0, y(hovered.density) - 56),
            }}
          >
            <div className="font-medium">
              {t("text-length-class", { from: cm(hovered.length_min), to: cm(hovered.hi) })}
            </div>
            <div>{t("text-class-share", { share: formatPercent(hovered.share, lang) })}</div>
            <div className="text-muted-foreground">{`${hovered.catch_kg.toLocaleString(numberLocale(lang), { maximumFractionDigits: 0 })} kg`}</div>
          </div>
        )}
      </div>
      {maturity && <MaturityLegend positions={["below", "spanning", "above"]} />}
    </div>
  );
}

/**
 * Every species measured on enough landings and with a known length at
 * maturity, by the share of its measured catch below it: the least as a solid
 * bar, the most as its lighter extension (classes straddle the maturity length).
 */
function SmallCatch({
  species,
  selected,
  onPick,
  query,
  emptyDescription,
}: {
  species: Measured[];
  selected?: string;
  onPick: (taxon: string) => void;
  query: Parameters<typeof ChartGate>[0]["query"];
  emptyDescription: string;
}) {
  const { t, lang } = useT();
  const name = useSpeciesName();
  const rows = species
    .filter((s) => s.maturity)
    .map((s) => ({ ...s, share: shareInBand(s.classes, { from: 0, to: s.maturity! }) }))
    .filter((s) => s.share)
    .sort((a, b) => b.share!.most - a.share!.most || b.share!.least - a.share!.least);

  return (
    <ChartCard
      id="caught-small"
      title={t("title-caught-small")}
      description={t("text-caught-small-description", { min: MIN_MEASURED_TRIPS })}
      info="info-maturity"
      download={rows.map((r) => ({
        species: r.taxon,
        landings_measured: r.trips,
        below_maturity_least: r.share!.least,
        below_maturity_most: r.share!.most,
      }))}
      footer={rows.length > 0 && <MaturityLegend />}
    >
      <ChartGate
        query={query}
        isEmpty={!rows.length}
        emptyDescription={emptyDescription}
        className="h-40"
      >
        <ul className="-mx-2 flex max-h-[420px] flex-col overflow-y-auto">
          {rows.map((r) => (
            <li key={r.taxon}>
              <button
                type="button"
                onClick={() => onPick(r.taxon)}
                aria-pressed={r.taxon === selected}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted",
                  r.taxon === selected && "bg-muted",
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{name(r.taxon)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {name(r.taxon) !== r.taxon && <i>{r.taxon} · </i>}
                    {landingsCount(t, lang, r.trips)}
                  </span>
                </span>
                <span className="flex flex-col gap-1">
                  <RangeBar least={r.share!.least} most={r.share!.most} />
                  <span className="text-xs tabular-nums">{shareRange(t, lang, r.share)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </ChartGate>
    </ChartCard>
  );
}
