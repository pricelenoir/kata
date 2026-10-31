import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TablePagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <span className="text-sm tabular-nums text-muted-foreground">
        {totalCount === 0 ? "No results" : `${rangeStart}–${rangeEnd} of ${totalCount}`}
      </span>
      <div className="flex items-center gap-2">
        <span className="hidden text-sm tabular-nums text-muted-foreground sm:inline">
          Page {page} of {totalPages}
        </span>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeftIcon />
        </Button>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Next page" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
