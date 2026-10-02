import { TriangleAlertIcon } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";

/** Warning sign for figures that rest on too little data; the words beside it carry the meaning. */
export function WarningIcon({ className, label }: { className?: string; label?: string }) {
  return (
    <TriangleAlertIcon
      className={cn("size-3.5 shrink-0 text-warning", className)}
      aria-label={label}
      aria-hidden={!label}
    />
  );
}
