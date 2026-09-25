import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export type Series = { key: string; label?: string; color: string };

/** Clickable legend: each pressed item is a visible series. */
export function SeriesLegend({
  series,
  hidden,
  onHiddenChange,
}: {
  series: Series[];
  hidden: string[];
  onHiddenChange: (hidden: string[]) => void;
}) {
  const keys = series.map((s) => s.key);

  return (
    <ToggleGroup
      multiple
      variant="outline"
      size="sm"
      spacing={1}
      value={keys.filter((k) => !hidden.includes(k))}
      onValueChange={(visible) => onHiddenChange(keys.filter((k) => !visible.includes(k)))}
      className="w-full flex-wrap justify-center"
    >
      {series.map((s) => (
        <ToggleGroupItem key={s.key} value={s.key}>
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
          {s.label ?? s.key}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
