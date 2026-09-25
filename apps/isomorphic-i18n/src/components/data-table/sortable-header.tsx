import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

type SortableColumn = {
  getIsSorted: () => false | "asc" | "desc";
  toggleSorting: (desc?: boolean) => void;
};

/** Header cell that toggles ascending/descending sort, per the shadcn Data Table guide. */
export function SortableHeader({ column, children }: { column: SortableColumn; children: React.ReactNode }) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "desc" ? ArrowDownIcon : sorted === "asc" ? ArrowUpIcon : ChevronsUpDownIcon;

  return (
    <Button variant="ghost" size="sm" className="-ml-2" onClick={() => column.toggleSorting(sorted === "asc")}>
      {children}
      <Icon data-icon="inline-end" />
    </Button>
  );
}
