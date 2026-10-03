import { cn } from "@workspace/ui/lib/utils";
import type { Method } from "@repo/domain/metrics";
import { METHOD_TINT } from "@/lib/dashboard/metrics";

/**
 * A value on the portal's one-hue ramp (the `--tint-*` tokens, or for an
 * estimate the ramp of its `method`), for heat tables: five steps from `min`
 * to `max`, text in the foreground colour on every one. Missing values
 * (`null`) show "-".
 */
export function HeatCell({
  value,
  min,
  max,
  label,
  title,
  dense,
  method = "tracker",
}: {
  value: number | null;
  min: number;
  max: number;
  label: string;
  title?: string;
  /** Smaller, for tables with many columns (24 months). */
  dense?: boolean;
  method?: Method;
}) {
  if (value === null) return <span className="text-muted-foreground">-</span>;
  const step = max === min ? 5 : 1 + Math.min(4, Math.floor((5 * (value - min)) / (max - min)));
  return (
    <span
      title={title}
      className={cn(
        "inline-block rounded-md text-center tabular-nums",
        dense ? "min-w-8 px-1 py-0.5 text-xs print:min-w-0" : "min-w-12 px-2 py-1",
      )}
      style={{ backgroundColor: `var(--${METHOD_TINT[method]}-${step})` }}
    >
      {label}
    </span>
  );
}

/** Min/max for colour scaling (0..1 when there are no values). */
export function valueRange(values: number[]) {
  return values.length
    ? { min: Math.min(...values), max: Math.max(...values) }
    : { min: 0, max: 1 };
}

/** Column sort that treats missing values as 0. */
export const sortNullsAsZero = (
  a: { getValue: (id: string) => unknown },
  b: { getValue: (id: string) => unknown },
  id: string,
) => (Number(a.getValue(id)) || 0) - (Number(b.getValue(id)) || 0);
