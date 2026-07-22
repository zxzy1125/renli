// 通用列表页面 Hook：封装搜索/筛选/分页/加载/错误状态 + 批量选择
import { useState, useCallback, useEffect, useRef } from 'react';
import { getErrorMsg } from '@/lib/api';

export interface UseListPageOptions<T> {
  fetchApi: (params: {
    keyword?: string;
    status?: string;
    page: number;
    pageSize: number;
    [key: string]: any;
  }) => Promise<{ data: T[]; total: number }>;
  defaultPageSize?: number;
  defaultKeyword?: string;
  defaultStatus?: string;
  extraParams?: Record<string, any>;
  autoFetch?: boolean;
}

export function useListPage<T extends { id: string }>({
  fetchApi,
  defaultPageSize = 12,
  defaultKeyword = '',
  defaultStatus = '',
  extraParams = {},
  autoFetch = true,
}: UseListPageOptions<T>) {
  const [list, setList] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState(defaultKeyword);
  const [statusFilter, setStatusFilter] = useState(defaultStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 批量选择状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 用 ref 存储 fetchApi，避免内联函数导致 useCallback 依赖变化引发无限循环
  const fetchApiRef = useRef(fetchApi);
  fetchApiRef.current = fetchApi;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === list.length && list.length > 0) return new Set();
      return new Set(list.map((item) => item.id));
    });
  }, [list]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchApiRef.current({
        keyword: keyword || undefined,
        status: statusFilter || undefined,
        page,
        pageSize: defaultPageSize,
        ...extraParams,
      });
      setList(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, [keyword, statusFilter, page, defaultPageSize, extraParams]);

  useEffect(() => {
    if (autoFetch) {
      fetchList();
    }
  }, [fetchList, autoFetch]);

  const handleSearch = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      setPage(1);
    },
    []
  );

  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  return {
    // 数据
    list,
    total,
    // 分页
    page,
    setPage,
    pageSize: defaultPageSize,
    // 搜索筛选
    keyword,
    setKeyword,
    statusFilter,
    setStatusFilter: handleStatusChange,
    // 状态
    loading,
    error,
    setError,
    // 操作
    fetchList,
    handleSearch,
    // 批量选择
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
  };
}

// 通用的删除处理 Hook
export function useDeleteHandler<T extends { id: string }>(
  removeApi: (id: string) => Promise<any>,
  fetchList: () => Promise<void>
) {
  const [toDelete, setToDelete] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await removeApi(toDelete.id);
      setToDelete(null);
      await fetchList();
    } catch (err) {
      throw err;
    } finally {
      setDeleting(false);
    }
  }, [toDelete, removeApi, fetchList]);

  return {
    toDelete,
    setToDelete,
    deleting,
    handleDelete,
  };
}
