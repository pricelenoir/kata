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
    <div className="flex items-center justify-between pt-1">
      <span className="font-mono text-xs text-muted-foreground">
        {totalCount === 0
          ? "0 results"
          : `${rangeStart}–${rangeEnd} of ${totalCount}`}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          &larr; Prev
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          Page {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next &rarr;
        </Button>
      </div>
    </div>
  );
}
