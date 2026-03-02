import { useState, useRef, useEffect } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(page: number, totalPages: number): (number | "ellipsis")[] {
  const pages: (number | "ellipsis")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 4) pages.push("ellipsis");
    const start = Math.max(2, page - 2);
    const end = Math.min(totalPages - 1, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 3) pages.push("ellipsis");
    pages.push(totalPages);
  }
  return pages;
}

function PageJumpInput({
  totalPages,
  onPageChange,
  onClose,
}: {
  totalPages: number;
  onPageChange: (page: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const num = parseInt(value, 10);
    if (num >= 1 && num <= totalPages) {
      onPageChange(num);
    }
    onClose();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={value}
      placeholder="Go"
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, "");
        setValue(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") onClose();
      }}
      onBlur={onClose}
      className="h-9 w-12 rounded-md border border-input bg-background text-center text-sm outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

export function PaginationBar({ page, totalPages, onPageChange }: PaginationBarProps) {
  const [jumpIndex, setJumpIndex] = useState<number | null>(null);

  if (totalPages <= 1) return null;

  return (
    <div className="mt-8">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
          {getPageNumbers(page, totalPages).map((p, i) =>
            p === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${i}`}>
                {jumpIndex === i ? (
                  <PageJumpInput
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                    onClose={() => setJumpIndex(null)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setJumpIndex(i)}
                    className="group flex h-9 cursor-pointer flex-col items-center justify-center gap-0 px-2 hover:text-foreground"
                    title={`1~${totalPages} 페이지로 이동`}
                  >
                    <span className="text-sm leading-none">···</span>
                    <span className="text-[10px] leading-tight text-muted-foreground group-hover:text-foreground">이동</span>
                  </button>
                )}
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  isActive={p === page}
                  onClick={() => onPageChange(p)}
                  className="cursor-pointer"
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
