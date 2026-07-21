// 通用列表页面 Hook：封装搜索/筛选/分页/加载/错误状态
import { useState, useCallback, useEffect } from 'react';
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

export function useListPage<T>({
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

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchApi({
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
  }, [keyword, statusFilter, page, fetchApi, defaultPageSize, extraParams]);

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
