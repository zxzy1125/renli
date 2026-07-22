// 职位库列表
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Eye, Pencil, Trash2, MapPin, Users, Wallet, Building2, Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { positionsApi, clientsApi, reportsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { Client, Position } from '@/types';
import Loading from '@/components/Loading';
import Empty from '@/components/Empty';
import Pagination from '@/components/Pagination';
import StatusBadge from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useListPage, useDeleteHandler } from '@/hooks/useListPage';
import { POSITION_STATUS_OPTIONS, JOB_TYPE_OPTIONS, getOptionLabel } from './constants';

const PAGE_SIZE = 12;

export default function PositionList() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const {
    list, total, page, setPage, pageSize,
    keyword, setKeyword, statusFilter, setStatusFilter,
    loading, error, setError, fetchList, handleSearch,
  } = useListPage<Position>({
    fetchApi: positionsApi.list,
    defaultPageSize: PAGE_SIZE,
  });

  const [clients, setClients] = useState<Client[]>([]);
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  useEffect(() => {
    clientsApi.list().then(setClients).catch(() => {});
  }, []);

  const { toDelete, setToDelete, deleting, handleDelete } = useDeleteHandler<Position>(
    positionsApi.remove,
    fetchList
  );

  // 导出下拉
  const [showExport, setShowExport] = useState(false);
  const handleExport = async (format: 'xlsx' | 'pdf') => {
    setShowExport(false);
    try {
      const blob = await reportsApi.export('positions', format);
      const url = URL.createObjectURL(blob as any);
      const a = document.createElement('a');
      a.href = url;
      a.download = `职位库.${format === 'xlsx' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('导出失败，请重试');
    }
  };

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100">职位库</h1>
          <p className="text-sm text-forest-500 mt-1 dark:text-forest-400">团队共享 · 全员可见</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 导出下拉 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExport((v) => !v)}
              className="btn-secondary flex items-center gap-1 text-sm"
            >
              <Download className="w-4 h-4" />
              导出
              <ChevronDown className="w-3 h-3" />
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-forest-100 py-1 z-20 dark:bg-forest-800 dark:border-forest-700">
                <button
                  onClick={() => handleExport('xlsx')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-forest-700 hover:bg-forest-50 dark:text-cream-200 dark:hover:bg-forest-700"
                >
                  <FileSpreadsheet className="w-4 h-4 text-forest-500" />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-forest-700 hover:bg-forest-50 dark:text-cream-200 dark:hover:bg-forest-700"
                >
                  <FileText className="w-4 h-4 text-risk-500" />
                  PDF (.pdf)
                </button>
              </div>
            )}
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/positions/new')}
              className="btn-primary flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              新建职位
            </button>
          )}
        </div>
      </div>

      {/* 搜索栏 */}
      <form onSubmit={handleSearch} className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="搜索职位标题/职责/关键词"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <select
          className="input w-40"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">全部状态</option>
          {POSITION_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary">
          搜索
        </button>
      </form>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700 dark:bg-risk-900/20 dark:border-risk-800 dark:text-risk-400">
          {error}
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((p) => (
              <PositionCard
                key={p.id}
                position={p}
                clientName={p.client_id ? clientMap.get(p.client_id) : undefined}
                isAdmin={isAdmin}
                onDelete={() => setToDelete(p)}
              />
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={setPage}
          />
        </>
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!toDelete}
        title="删除职位"
        message={`确认删除职位「${toDelete?.title}」吗？此操作不可撤销。`}
        confirmText={deleting ? '删除中...' : '确认删除'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

// 职位卡片
interface PositionCardProps {
  position: Position;
  clientName?: string;
  isAdmin: boolean;
  onDelete: () => void;
}
function PositionCard({ position, clientName, isAdmin, onDelete }: PositionCardProps) {
  const salary = [position.salary_min, position.salary_max]
    .filter(Boolean)
    .join(' - ');
  return (
    <div className="card p-4 hover:shadow-cardHover transition-shadow flex flex-col dark:hover:shadow-none">
      {/* 标题行 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          to={`/positions/${position.id}`}
          className="font-serif text-base font-semibold text-forest-800 hover:text-forest-600 dark:text-cream-100 dark:hover:text-cream-200 line-clamp-2 flex-1"
        >
          {position.title}
        </Link>
        <StatusBadge status={position.status} />
      </div>

      {/* 客户公司 */}
      {clientName && (
        <div className="flex items-center gap-1 text-sm text-forest-600 dark:text-cream-300 mb-2">
          <Building2 className="w-3.5 h-3.5 text-forest-400 dark:text-forest-500" />
          <span>{clientName}</span>
          {position.department ? <span className="text-forest-400 dark:text-forest-500">· {position.department}</span> : null}
        </div>
      )}

      {/* 信息 */}
      <div className="grid grid-cols-2 gap-2 text-xs text-forest-600 dark:text-cream-300 mb-3">
        {position.location && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-forest-400 dark:text-forest-500" />
            <span>{position.location}</span>
          </div>
        )}
        {position.headcount ? (
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 text-forest-400 dark:text-forest-500" />
            <span>{position.headcount} 人</span>
          </div>
        ) : null}
        {salary && (
          <div className="flex items-center gap-1">
            <Wallet className="w-3 h-3 text-forest-400 dark:text-forest-500" />
            <span className="font-mono">{salary}</span>
          </div>
        )}
        {position.job_type && (
          <div className="text-forest-500 dark:text-forest-400">
            类型：{getOptionLabel(JOB_TYPE_OPTIONS, position.job_type)}
          </div>
        )}
      </div>

      {/* 关键词 */}
      {position.keywords && position.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {position.keywords.slice(0, 4).map((k, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 rounded text-xs bg-ochre-50 text-ochre-700 border border-ochre-100 dark:bg-ochre-900/20 dark:text-ochre-400 dark:border-ochre-800"
            >
              {k}
            </span>
          ))}
          {position.keywords.length > 4 && (
            <span className="text-xs text-forest-400">+{position.keywords.length - 4}</span>
          )}
        </div>
      )}

      {/* 操作 */}
      <div className="mt-auto flex items-center justify-end gap-1 pt-2 border-t border-forest-50 dark:border-forest-800">
        <Link
          to={`/positions/${position.id}`}
          className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
        >
          <Eye className="w-3.5 h-3.5" />
          查看
        </Link>
        {isAdmin && (
          <>
            <Link
              to={`/positions/${position.id}/edit`}
              className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
            >
              <Pencil className="w-3.5 h-3.5" />
              编辑
            </Link>
            <button
              type="button"
              onClick={onDelete}
              className="text-xs px-2 py-1 rounded text-risk-600 hover:bg-risk-50 dark:hover:bg-risk-900/20 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              删除
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-12">
      <Empty />
      <p className="text-center text-sm text-forest-500 dark:text-forest-400 mt-2">
        暂无职位，{''}
        <Link to="/positions/new" className="text-forest-600 dark:text-forest-300 underline">
          立即新建
        </Link>
      </p>
    </div>
  );
}
