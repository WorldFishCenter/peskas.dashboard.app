import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { CHOSEN } from "@/components/filters/toggle-states";

/**
 * One choice among a few, each keyed by the colour it is drawn in: a method's
 * line (`MethodToggle`), a species figure's bars and cells.
 */
export function SwatchToggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; color: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      aria-label={label}
      value={[value]}
      onValueChange={(next) => {
        const picked = next[0] as T | undefined;
        if (picked && picked !== value) onChange(picked);
      }}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className={CHOSEN}>
          {/* Ringed in the background colour, so it shows on the chosen item's accent too. */}
          <span
            aria-hidden
            className="h-1 w-3.5 rounded-full ring-1 ring-background"
            style={{ backgroundColor: o.color }}
          />
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
