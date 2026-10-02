import { cn } from "@workspace/ui/lib/utils";

export type LegendItem = {
  label: React.ReactNode;
  /** A CSS colour, usually a token: `var(--concern-2)`. */
  color: string;
  /** A filled square (bars, areas), a line (series), or a hollow point. */
  shape?: "box" | "line" | "hollow";
};

/**
 * The key to marks drawn outside Recharts (bars in table cells, the length
 * chart, the district panels), set like ChartLegendContent: swatch, then label.
 */
export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {items.map(({ label, color, shape = "box" }, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              "shrink-0",
              shape === "box" && "size-2.5 rounded-[2px]",
              shape === "line" && "h-0.5 w-3.5 rounded-full",
              shape === "hollow" && "size-2 rounded-full border-[1.5px] bg-background",
            )}
            style={shape === "hollow" ? { borderColor: color } : { backgroundColor: color }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}
