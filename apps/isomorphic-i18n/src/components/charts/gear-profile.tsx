import { useMemo } from "react";
import { Badge } from "@workspace/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";
import { FEW_LANDINGS } from "@repo/domain/metrics";
import { immatureByGear } from "@repo/domain/sizes";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { HeatCell } from "@/components/charts/heat-cell";
import { BarCell, MaturityLegend, RangeBar } from "@/components/charts/inline-bars";
import { WarningIcon } from "@/components/charts/warning-icon";
import { activeCountry } from "@/config/countryConfig";
import {
  formatNumber,
  formatPercent,
  gearLabel,
  landingsCount,
  shareRange,
} from "@/lib/dashboard/format";
import { compositionInfo, metricUnit } from "@/lib/dashboard/metrics";
import { useSpeciesName } from "@/lib/dashboard/species";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

/**
 * Every gear in one row, in order of use: how much it is used, what it
 * catches per hour and earns per hour, how much of its measured catch is
 * below the length at maturity, and its main species. One order for every
 * column, so a gear is read across rather than looked up in four charts.
 */
export function GearProfile() {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const gears = api.summaries.byGear.useQuery(scope.input, scope.options);
  const lengths = api.summaries.lengths.useQuery(scope.input, scope.options);
  const composition = api.summaries.gearComposition.useQuery(scope.input, scope.options);
  const name = useSpeciesName();

  const rows = useMemo(() => {
    const all = gears.data ?? [];
    const total = all.reduce((sum, g) => sum + g.landings, 0);
    const immature = new Map(
      lengths.data
        ? immatureByGear(lengths.data.measured, lengths.data.maturity).map((g) => [g.gear, g])
        : [],
    );
    const main = new Map<string | null, [string | null, number][]>();
    for (const s of composition.data?.rows ?? []) {
      for (const g of s.groups)
        (main.get(g.group) ?? main.set(g.group, []).get(g.group)!).push([s.taxon, g.value]);
    }
    return all.map((g) => ({
      ...g,
      share: total ? (100 * g.landings) / total : 0,
      immature: immature.get(g.gear) ?? null,
      main: (main.get(g.gear) ?? [])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([taxon]) => taxon),
    }));
  }, [gears.data, lengths.data, composition.data]);

  const max = (key: "share" | "cpue" | "rpue") => Math.max(0, ...rows.map((r) => r[key] ?? 0));
  const cpueUnit = metricUnit(t, "mean_cpue");
  const rpueUnit = metricUnit(t, "mean_rpue");

  return (
    <ChartCard
      id="gear-profile"
      title={t("title-gear-profile")}
      description={t("text-gear-profile-description")}
      info="info-gear-landings"
      download={rows.map((r) => ({
        gear: r.gear,
        landings: r.landings,
        share_of_landings_pct: r.share,
        cpue: r.cpue,
        rpue: r.rpue,
        below_maturity_least: r.immature?.least,
        below_maturity_most: r.immature?.most,
        main_species: r.main.join("; "),
      }))}
      footer={
        <>
          {rows.some((r) => r.immature) && <MaturityLegend />}
          {activeCountry.survey.meanLengths && <p>{t("text-lengths-means-note")}</p>}
        </>
      }
    >
      <ChartGate query={gears} isEmpty={!rows.length}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("text-gear")}</TableHead>
              <TableHead className="w-[16%] whitespace-normal">
                {t("text-share-of-landings")}
              </TableHead>
              <TableHead className="w-[16%] whitespace-normal">
                {t("text-catch-per-hour")}{" "}
                {cpueUnit && (
                  <span className="font-normal text-muted-foreground">({cpueUnit})</span>
                )}
              </TableHead>
              <TableHead className="w-[16%] whitespace-normal">
                {t("text-revenue-per-hour")}{" "}
                {rpueUnit && (
                  <span className="font-normal text-muted-foreground">({rpueUnit})</span>
                )}
              </TableHead>
              <TableHead className="w-[18%] whitespace-normal">
                {t("text-caught-below-maturity")}
              </TableHead>
              <TableHead>{t("text-main-catch")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const thin = r.landings < FEW_LANDINGS;
              return (
                <TableRow key={r.gear ?? "none"} className={cn(thin && "text-muted-foreground")}>
                  <TableCell className="whitespace-nowrap">
                    <div className="font-medium">{gearLabel(r.gear, t("text-unknown"))}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {thin && <WarningIcon label={t("text-scope-few-landings")} />}
                      {landingsCount(t, lang, r.landings)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <BarCell
                      value={r.share}
                      max={max("share")}
                      label={formatPercent(r.share, lang)}
                      faded={thin}
                    />
                  </TableCell>
                  <TableCell>
                    <BarCell
                      value={r.cpue}
                      max={max("cpue")}
                      label={formatNumber(r.cpue, lang)}
                      faded={thin}
                    />
                  </TableCell>
                  <TableCell>
                    <BarCell
                      value={r.rpue}
                      max={max("rpue")}
                      label={formatNumber(r.rpue, lang)}
                      faded={thin}
                    />
                  </TableCell>
                  <TableCell>
                    {r.immature ? (
                      <span
                        className="flex items-center gap-2"
                        title={t("text-measured-trips", { count: r.immature.trips })}
                      >
                        <span className="w-20 shrink-0 text-right text-xs tabular-nums">
                          {shareRange(t, lang, r.immature)}
                        </span>
                        <RangeBar least={r.immature.least} most={r.immature.most} />
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("text-too-few-measured")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {r.main.map((taxon) => (
                        <Badge key={taxon ?? "none"} variant="secondary" title={taxon ?? undefined}>
                          {name(taxon) || t("text-unknown")}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ChartGate>
    </ChartCard>
  );
}

const TOP_SPECIES = 10;
const TOP_GEARS = 8;

/** Share of each gear's recorded catch by species group, on one tint scale: which gear lands what. */
export function SpeciesGearMatrix() {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const gears = api.summaries.byGear.useQuery(scope.input, scope.options);
  const query = api.summaries.gearComposition.useQuery(scope.input, scope.options);
  const name = useSpeciesName();

  const { columns, species, shares, max } = useMemo(() => {
    const rows = query.data?.rows ?? [];
    const catchOf = new Map<string | null, number>();
    for (const s of rows)
      for (const g of s.groups) catchOf.set(g.group, (catchOf.get(g.group) ?? 0) + g.value);
    // The most-used gears that have recorded catch, in the gear table's order.
    const columns = (gears.data ?? [])
      .map((g) => g.gear)
      .filter((g) => catchOf.get(g))
      .slice(0, TOP_GEARS);
    const species = rows.slice(0, TOP_SPECIES);
    const shares = new Map(
      species.flatMap((s) =>
        s.groups.map(
          (g) => [`${s.taxon}|${g.group}`, (100 * g.value) / (catchOf.get(g.group) || 1)] as const,
        ),
      ),
    );
    const max = Math.max(0, ...[...shares.values()]);
    return { columns, species, shares, max };
  }, [query.data, gears.data]);

  return (
    <ChartCard
      id="gear-species"
      title={t("title-gear-species")}
      description={t("text-gear-species-description", { species: TOP_SPECIES, gears: TOP_GEARS })}
      info={compositionInfo(t)}
      download={(query.data?.rows ?? []).flatMap((s) =>
        s.groups.map((g) => ({ taxon: s.taxon, gear: g.group, recorded_catch_kg: g.value })),
      )}
    >
      <ChartGate
        query={query}
        isEmpty={!species.length || !columns.length}
        emptyDescription={t(
          query.data?.available === false
            ? "text-gear-species-not-published"
            : "text-no-data-available-for-filters",
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("text-species")}</TableHead>
              {columns.map((g) => (
                <TableHead key={g ?? "none"} className="text-center">
                  {gearLabel(g, t("text-unknown"))}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {species.map((s) => (
              <TableRow key={s.taxon ?? "none"}>
                <TableCell>
                  <div className="max-w-56 truncate font-medium">
                    {name(s.taxon) || t("text-unknown")}
                  </div>
                  {name(s.taxon) !== s.taxon && (
                    <div className="max-w-56 truncate text-xs text-muted-foreground italic">
                      {s.taxon}
                    </div>
                  )}
                </TableCell>
                {columns.map((g) => {
                  const share = shares.get(`${s.taxon}|${g}`) ?? 0;
                  return (
                    <TableCell key={g ?? "none"} className="text-center">
                      {share >= 1 ? (
                        <HeatCell
                          value={share}
                          min={0}
                          max={max}
                          label={formatPercent(share, lang)}
                        />
                      ) : (
                        ""
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartGate>
    </ChartCard>
  );
}
