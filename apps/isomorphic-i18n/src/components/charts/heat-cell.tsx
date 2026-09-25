import { getPaletteColor, getTextColor } from "@/lib/dashboard/palettes";

/** YlGnBu-coloured value pill for the heatmap tables; missing values (`null`) show "-". */
export function HeatCell({
  value,
  min,
  max,
  label,
  title,
}: {
  value: number | null;
  min: number;
  max: number;
  label: string;
  title?: string;
}) {
  if (value === null) return <span className="text-muted-foreground">-</span>;
  const bg = getPaletteColor(value, min, max);
  return (
    <span
      title={title}
      className="inline-block min-w-12 rounded-md px-2 py-1 text-center font-medium tabular-nums"
      style={{ backgroundColor: bg, color: getTextColor(bg) }}
    >
      {label}
    </span>
  );
}

/** Min/max for colour scaling (0..1 when there are no values). */
export function valueRange(values: number[]) {
  return values.length ? { min: Math.min(...values), max: Math.max(...values) } : { min: 0, max: 1 };
}

/** Column sort that treats missing values as 0. */
export const sortNullsAsZero = (
  a: { getValue: (id: string) => unknown },
  b: { getValue: (id: string) => unknown },
  id: string
) => (Number(a.getValue(id)) || 0) - (Number(b.getValue(id)) || 0);
