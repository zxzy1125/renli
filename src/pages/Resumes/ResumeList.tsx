// 简历库列表
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  MessageCircle,
  GitCompareArrows,
  Wallet,
  Building2,
  CheckSquare,
  Square,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { resumesApi, reportsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { Resume } from '@/types';
import Loading from '@/components/Loading';
import Empty from '@/components/Empty';
import Pagination from '@/components/Pagination';
import StatusBadge from '@/components/StatusBadge';
import { RiskBadge } from '@/components/RiskBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useListPage, useDeleteHandler } from '@/hooks/useListPage';
import { CANDIDATE_STATUS_OPTIONS, getOptionLabel } from './constants';

const PAGE_SIZE = 12;

export default function ResumeList() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const {
    list, total, page, setPage, pageSize,
    keyword, setKeyword, statusFilter, setStatusFilter,
    loading, error, fetchList, handleSearch,
    selectedIds, toggleSelect, selectAll, clearSelection,
  } = useListPage<Resume>({
    fetchApi: (params) => {
      const { status, ...rest } = params;
      return resumesApi.list({
        ...rest,
        candidate_status: status,
      });
    },
    defaultPageSize: PAGE_SIZE,
  });

  const { toDelete, setToDelete, deleting, handleDelete } = useDeleteHandler<Resume>(
    resumesApi.remove,
    fetchList
  );

  // 导出下拉
  const [showExport, setShowExport] = useState(false);
  const handleExport = async (format: 'xlsx' | 'pdf') => {
    setShowExport(false);
    try {
      const blob = await reportsApi.export('resumes', format);
      const url = URL.createObjectURL(blob as any);
      const a = document.createElement('a');
      a.href = url;
      a.download = `简历库.${format === 'xlsx' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  // 批量删除
  const [batchDeleting, setBatchDeleting] = useState(false);
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setBatchDeleting(true);
    try {
      await Promise.allSettled([...selectedIds].map((id) => resumesApi.remove(id)));
      clearSelection();
      await fetchList();
    } finally {
      setBatchDeleting(false);
    }
  };

  const allSelected = list.length > 0 && selectedIds.size === list.length;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100">简历库</h1>
          <p className="text-sm text-forest-500 mt-1 dark:text-forest-400">
            {isAdmin ? '全部员工的简历' : '我的简历'}
          </p>
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
          <button
            type="button"
            onClick={() => navigate('/resumes/new')}
            className="btn-primary flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            新建简历
          </button>
        </div>
      </div>

      <form onSubmit={handleSearch} className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="搜索姓名/现公司/现职位/技能/标签"
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
          {CANDIDATE_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary">
          搜索
        </button>
      </form>

      {/* 批量操作工具栏 */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-forest-50 border border-forest-200 dark:bg-forest-800/50 dark:border-forest-700">
          <button
            type="button"
            onClick={selectAll}
            className="text-sm text-forest-600 hover:text-forest-800 dark:text-forest-300 dark:hover:text-cream-100 flex items-center gap-1"
          >
            {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {allSelected ? '取消全选' : '全选当页'}
          </button>
          <span className="text-sm text-forest-500 dark:text-forest-400">
            已选 {selectedIds.size} 项
          </span>
          <button
            type="button"
            onClick={handleBatchDelete}
            disabled={batchDeleting}
            className="btn-danger text-xs px-3 py-1.5 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {batchDeleting ? '删除中...' : '批量删除'}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-sm text-forest-500 hover:text-forest-700 dark:text-forest-400 dark:hover:text-cream-200 ml-auto"
          >
            取消选择
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700 dark:bg-risk-900/20 dark:border-risk-800 dark:text-risk-400">
          {error}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <div className="card p-12">
          <Empty />
          <p className="text-center text-sm text-forest-500 dark:text-forest-400 mt-2">
            暂无简历，{''}
            <Link to="/resumes/new" className="text-forest-600 dark:text-forest-300 underline">
              立即录入
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((r) => (
              <ResumeCard
                key={r.id}
                resume={r}
                onDelete={() => setToDelete(r)}
                selected={selectedIds.has(r.id)}
                onToggleSelect={() => toggleSelect(r.id)}
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

      <ConfirmDialog
        open={!!toDelete}
        title="删除简历"
        message={`确认删除简历「${toDelete?.name}」吗？此操作不可撤销。`}
        confirmText={deleting ? '删除中...' : '确认删除'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

interface ResumeCardProps {
  resume: Resume;
  onDelete: () => void;
  selected: boolean;
  onToggleSelect: () => void;
}
function ResumeCard({ resume, onDelete, selected, onToggleSelect }: ResumeCardProps) {
  return (
    <div className={`card p-4 hover:shadow-cardHover transition-shadow flex flex-col ${selected ? 'ring-2 ring-forest-400 dark:ring-forest-500' : ''}`}>
      {/* 标题行 + 选择框 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onToggleSelect}
            className="flex-shrink-0 mt-0.5"
            aria-label={selected ? '取消选择' : '选择'}
          >
            {selected
              ? <CheckSquare className="w-4.5 h-4.5 text-forest-600 dark:text-forest-400" />
              : <Square className="w-4.5 h-4.5 text-forest-300 dark:text-forest-600" />
            }
          </button>
          <Link
            to={`/resumes/${resume.id}`}
            className="font-serif text-base font-semibold text-forest-800 hover:text-forest-600 dark:text-cream-100 dark:hover:text-cream-200 flex items-center gap-2"
          >
            <span>{resume.name}</span>
            {resume.age && <span className="text-sm font-normal text-forest-500 dark:text-forest-400">{resume.age}岁</span>}
          </Link>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <RiskBadge risk={resume.risk_warning} />
          <StatusBadge status={resume.candidate_status} />
        </div>
      </div>

      {/* 现公司 / 现职位 */}
      <div className="flex items-center gap-1 text-sm text-forest-600 dark:text-cream-300 mb-2">
        <Building2 className="w-3.5 h-3.5 text-forest-400 dark:text-forest-500" />
        <span>{resume.current_company || '现公司未知'}</span>
        {resume.current_title && (
          <span className="text-forest-400 dark:text-forest-500">· {resume.current_title}</span>
        )}
      </div>

      {/* 标签 */}
      {resume.tags && resume.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {resume.tags.slice(0, 4).map((t, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 rounded text-xs bg-ochre-50 text-ochre-700 border border-ochre-100 dark:bg-ochre-900/20 dark:text-ochre-400 dark:border-ochre-800"
            >
              {t}
            </span>
          ))}
          {resume.tags.length > 4 && (
            <span className="text-xs text-forest-400">+{resume.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* 期望 */}
      {(resume.expectation || resume.expected_city) && (
        <div className="flex items-center gap-1 text-xs text-forest-600 dark:text-cream-300 mb-2">
          <Wallet className="w-3 h-3 text-forest-400 dark:text-forest-500" />
          <span>
            {resume.expected_city ? `${resume.expected_city} · ` : ''}
            {resume.expectation || '期望方向未填'}
          </span>
        </div>
      )}

      {/* 已加微信标识 */}
      {(resume.has_wechat === 1 || resume.has_wechat === true) && (
        <div className="inline-flex items-center gap-1 text-xs text-forest-600 dark:text-cream-300 mb-2">
          <MessageCircle className="w-3 h-3 text-forest-500" />
          <span>已加微信{resume.wechat_id ? `（${resume.wechat_id}）` : ''}</span>
        </div>
      )}

      {/* 操作 */}
      <div className="mt-auto flex items-center justify-end gap-1 pt-2 border-t border-forest-50 dark:border-forest-800">
        <Link
          to={`/resumes/${resume.id}`}
          className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
        >
          <Eye className="w-3.5 h-3.5" />
          查看
        </Link>
        <Link
          to={`/resumes/${resume.id}/edit`}
          className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
        >
          <Pencil className="w-3.5 h-3.5" />
          编辑
        </Link>
        <button
          type="button"
          disabled
          className="text-xs px-2 py-1 rounded text-forest-400 opacity-60 cursor-not-allowed flex items-center gap-1"
          title="匹配管理功能即将上线"
        >
          <GitCompareArrows className="w-3.5 h-3.5" />
          匹配
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs px-2 py-1 rounded text-risk-600 hover:bg-risk-50 dark:hover:bg-risk-900/20 flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          删除
        </button>
      </div>
    </div>
  );
}

export { getOptionLabel };
