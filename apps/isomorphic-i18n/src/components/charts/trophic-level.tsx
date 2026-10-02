import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@workspace/ui/components/chart";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_HEIGHT, ChartGate } from "@/components/charts/chart-state";
import { monthAxis, monthTooltipLabel } from "@/lib/dashboard/format";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

/** Mean trophic level of the recorded catch per month, weighted by each taxon's catch. */
export function TrophicLevel({ className }: { className?: string }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const query = api.summaries.speciesTraits.useQuery(scope.input, scope.options);
  const rows = (query.data?.months ?? []).filter((m) => m.trophic_level != null);
  const format = (v: number) =>
    v.toLocaleString(lang, { maximumFractionDigits: 2, minimumFractionDigits: 2 });

  return (
    <ChartCard
      id="trophic-level"
      className={className}
      title={t("title-trophic-level")}
      description={t("text-trophic-level-description")}
      info="info-trophic"
      download={rows.map((m) => ({
        month: m.month,
        trophic_level: m.trophic_level,
        catch_kg: m.catch_kg,
      }))}
    >
      <ChartGate
        query={query}
        isEmpty={rows.length < 2}
        emptyDescription={t(
          query.data?.traitsAvailable ? "text-too-few-months" : "text-traits-not-published",
        )}
      >
        <ChartContainer
          config={{ trophic_level: { label: t("text-trophic-level") } }}
          className={`aspect-auto w-full ${CHART_HEIGHT}`}
        >
          <LineChart accessibilityLayer data={rows} margin={{ right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis {...monthAxis(lang)} />
            {/* A fixed span of the levels catches have: an auto-fitted axis made a 0.2 change look like a collapse. */}
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              domain={[2, 4.5]}
              ticks={[2, 2.5, 3, 3.5, 4, 4.5]}
              tickFormatter={format}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={monthTooltipLabel(lang)}
                  formatter={(value) => format(Number(value))}
                />
              }
            />
            <Line dataKey="trophic_level" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartContainer>
      </ChartGate>
    </ChartCard>
  );
}
