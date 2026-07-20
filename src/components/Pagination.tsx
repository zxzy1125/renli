// 通用分页组件
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  className?: string;
}

export default function Pagination({
  page,
  pageSize,
  total,
  onChange,
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className={cn('flex items-center justify-between gap-2 py-3 text-sm', className)}>
      <div className="text-forest-500">
        共 <span className="font-mono text-forest-700">{total}</span> 条 · 第 {from}-{to} 条
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="p-1.5 rounded border border-forest-200 text-forest-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-forest-50"
          aria-label="上一页"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-3 py-1 text-forest-700">
          <span className="font-mono">{page}</span>
          <span className="mx-1 text-forest-400">/</span>
          <span className="font-mono">{totalPages}</span>
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="p-1.5 rounded border border-forest-200 text-forest-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-forest-50"
          aria-label="下一页"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
