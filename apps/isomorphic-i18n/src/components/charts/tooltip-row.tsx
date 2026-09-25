import { cn } from "@workspace/ui/lib/utils";

/**
 * One row for `ChartTooltipContent`'s `formatter`, matching its default
 * indicator / label / value layout but with dashboard number formatting.
 */
export function TooltipRow({
  color,
  label,
  value,
  className,
}: {
  color?: string;
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      {color && (
        <div className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
      )}
      <div className="flex flex-1 items-center justify-between gap-4 leading-none">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium tabular-nums">{value}</span>
      </div>
    </div>
  );
}
