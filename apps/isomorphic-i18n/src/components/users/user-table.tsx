"use client";

import { useMemo, useState } from "react";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";
import type { RouterOutputs } from "@api/index";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { statusLabel } from "@/components/users/user-options";

export type UserRow = RouterOutputs["user"]["all"][number];

const features = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
});

const columnHelper = createColumnHelper<typeof features, UserRow>();

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  control: "secondary",
  iia: "secondary",
  cia: "secondary",
  wbcia: "outline",
  aia: "outline",
};

const PAGE_SIZES = [10, 20, 30, 50].map((n) => ({ label: String(n), value: n }));

export function UserTable({
  users,
  onEdit,
  onDelete,
}: {
  users: UserRow[];
  onEdit: (user: UserRow) => void;
  onDelete: (user: UserRow) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("name", {
          header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
          sortFn: "text",
        }),
        columnHelper.accessor("email", {
          header: ({ column }) => <SortableHeader column={column}>Email</SortableHeader>,
          sortFn: "text",
        }),
        columnHelper.accessor((row) => row.userBmu?.BMU ?? "", {
          id: "userBmu",
          header: ({ column }) => <SortableHeader column={column}>User BMU</SortableHeader>,
          sortFn: "text",
          cell: ({ getValue }) => (getValue() ? <Badge variant="secondary">{getValue()}</Badge> : null),
        }),
        columnHelper.display({
          id: "role",
          header: "Role",
          cell: ({ row }) => (
            <div className="flex flex-wrap gap-1">
              {row.original.groups.map((group) => (
                <Badge key={group._id} variant={ROLE_VARIANTS[group.name.toLowerCase()] ?? "outline"}>
                  {group.name}
                </Badge>
              ))}
            </div>
          ),
        }),
        columnHelper.accessor("status", {
          header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
          sortFn: "text",
          cell: ({ getValue }) => (
            <Badge variant={getValue() === "active" ? "secondary" : "destructive"}>
              {statusLabel(getValue())}
            </Badge>
          ),
        }),
        columnHelper.accessor((row) => (row.created_at ? new Date(row.created_at).getTime() : 0), {
          id: "created_at",
          header: ({ column }) => <SortableHeader column={column}>Created At</SortableHeader>,
          cell: ({ getValue }) => (getValue() ? new Date(getValue()).toLocaleDateString() : ""),
        }),
        columnHelper.display({
          id: "actions",
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) => (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete user"
              onClick={(e) => {
                e.stopPropagation(); // don't open the edit dialog
                onDelete(row.original);
              }}
            >
              <Trash2Icon />
            </Button>
          ),
        }),
      ]),
    [onDelete]
  );

  const table = useTable({
    features,
    data: users,
    columns,
    initialState: { pagination: { pageIndex: 0, pageSize: 20 } },
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onEdit(row.original)}
                  className={cn("cursor-pointer", row.original.status === "inactive" && "opacity-50")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No users.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Rows per page</span>
          <Select
            items={PAGE_SIZES}
            value={table.state.pagination.pageSize}
            onValueChange={(value) => value && table.setPageSize(value)}
          >
            <SelectTrigger size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectGroup>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm font-medium">
          Page {table.state.pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            aria-label="Go to first page"
          >
            <ChevronsLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Go to previous page"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Go to next page"
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            aria-label="Go to last page"
          >
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
