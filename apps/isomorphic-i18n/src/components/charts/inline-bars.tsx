import { cn } from "@workspace/ui/lib/utils";
import type { MaturityPosition } from "@repo/domain/sizes";
import { useT } from "@/i18n/use-lang";
import { Legend } from "@/components/charts/legend";
import { MATURITY_FILL } from "@/lib/dashboard/species";

/** The key to MATURITY_FILL; RangeBar needs only the first two. */
export function MaturityLegend({
  positions = ["below", "spanning"],
}: {
  positions?: MaturityPosition[];
}) {
  const { t } = useT();
  return (
    <Legend
      items={positions.map((p) => ({
        label: t(`text-${p}-maturity-short`),
        color: MATURITY_FILL[p],
      }))}
    />
  );
}

/** A value and a bar for its size against the column's largest, for ranked tables. */
export function BarCell({
  value,
  max,
  label,
  faded,
}: {
  value: number | null;
  max: number;
  label: string;
  faded?: boolean;
}) {
  if (value == null) return <span className="text-muted-foreground">–</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-right tabular-nums">{label}</span>
      <span className="h-2.5 min-w-px flex-1">
        <span
          className={cn("block h-full rounded-r-sm bg-chart-1", faded && "opacity-40")}
          style={{ width: `${max > 0 ? (100 * value) / max : 0}%` }}
        />
      </span>
    </span>
  );
}

/**
 * The share of catch below maturity (0–1), known between two bounds because a
 * length class can straddle the maturity length: the least as a solid bar, up
 * to the most in the colour of that straddling class. Shown with MaturityLegend.
 */
export function RangeBar({ least, most }: { least: number; most: number }) {
  return (
    <span className="relative block h-2.5 w-full rounded-sm bg-muted">
      <span
        className="absolute inset-y-0 left-0 rounded-sm"
        style={{ width: `${100 * least}%`, backgroundColor: MATURITY_FILL.below }}
      />
      <span
        className="absolute inset-y-0 rounded-r-sm"
        style={{
          left: `${100 * least}%`,
          width: `${100 * (most - least)}%`,
          backgroundColor: MATURITY_FILL.spanning,
        }}
      />
    </span>
  );
}
