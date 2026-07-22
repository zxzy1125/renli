// 匹配列表页：搜索 + 状态筛选 + 表格列表 + 批量选择 + 分页
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Search,
  Plus,
  Eye,
  Trash2,
  CheckSquare,
  Square,
  MinusSquare,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import dayjs from 'dayjs';
import { matchesApi, reportsApi } from '@/lib/api';
import type { Match, MatchStatus } from '@/types';
import Loading from '@/components/Loading';
import Empty from '@/components/Empty';
import Pagination from '@/components/Pagination';
import ConfirmDialog from '@/components/ConfirmDialog';
import { RiskBadge } from '@/components/RiskBadge';
import { useListPage, useDeleteHandler } from '@/hooks/useListPage';
import {
  MATCH_STATUS_LABELS,
  scoreColorClass,
} from './constants';

const PAGE_SIZE = 12;

const STATUS_OPTIONS: { value: MatchStatus; label: string }[] = (
  Object.keys(MATCH_STATUS_LABELS) as MatchStatus[]
).map((k) => ({ value: k, label: MATCH_STATUS_LABELS[k] }));

export default function MatchList() {
  const navigate = useNavigate();

  const {
    list, total, page, setPage, pageSize,
    keyword, setKeyword, statusFilter, setStatusFilter,
    loading, error, fetchList, handleSearch,
    selectedIds, toggleSelect, selectAll, clearSelection,
  } = useListPage<Match>({
    fetchApi: matchesApi.list,
    defaultPageSize: PAGE_SIZE,
  });

  const { toDelete, setToDelete, deleting, handleDelete } = useDeleteHandler<Match>(
    matchesApi.remove,
    fetchList
  );

  // 导出下拉
  const [showExport, setShowExport] = useState(false);
  const handleExport = async (format: 'xlsx' | 'pdf') => {
    setShowExport(false);
    try {
      const blob = await reportsApi.export('matches', format);
      const url = URL.createObjectURL(blob as any);
      const a = document.createElement('a');
      a.href = url;
      a.download = `匹配记录.${format === 'xlsx' ? 'xlsx' : 'pdf'}`;
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
      await Promise.allSettled([...selectedIds].map((id) => matchesApi.remove(id)));
      clearSelection();
      await fetchList();
    } finally {
      setBatchDeleting(false);
    }
  };

  const allSelected = list.length > 0 && selectedIds.size === list.length;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100">匹配管理</h1>
          <p className="text-sm text-forest-500 mt-1 dark:text-forest-400">
            选职位 + 选简历 → AI 生成匹配报告与 18 条话术
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
            onClick={() => navigate('/matches/smart')}
            className="btn-secondary flex items-center gap-1 text-sm"
          >
            <Sparkles className="w-4 h-4" />
            AI 智能匹配
          </button>
          <button
            type="button"
            onClick={() => navigate('/matches/new')}
            className="btn-ai flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            新建匹配
          </button>
        </div>
      </div>

      {/* 搜索栏 */}
      <form onSubmit={handleSearch} className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="搜索求职者姓名 / 职位名"
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
          {STATUS_OPTIONS.map((o) => (
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
        <div className="card p-12">
          <Empty />
          <p className="text-center text-sm text-forest-500 dark:text-forest-400 mt-2">
            暂无匹配记录，{''}
            <Link to="/matches/new" className="text-forest-600 dark:text-forest-300 underline">
              立即新建匹配
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream-100 text-forest-600 text-left dark:bg-forest-800 dark:text-cream-300">
                  <th className="px-4 py-3 font-medium w-10">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="flex items-center"
                      aria-label={allSelected ? '取消全选' : '全选'}
                    >
                      {allSelected
                        ? <CheckSquare className="w-4 h-4 text-forest-600 dark:text-forest-400" />
                        : selectedIds.size > 0
                          ? <MinusSquare className="w-4 h-4 text-forest-500 dark:text-forest-400" />
                          : <Square className="w-4 h-4 text-forest-300 dark:text-forest-600" />
                      }
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium">求职者</th>
                  <th className="px-4 py-3 font-medium">职位</th>
                  <th className="px-4 py-3 font-medium">匹配度</th>
                  <th className="px-4 py-3 font-medium">转化概率</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">创建时间</th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    onDelete={() => setToDelete(m)}
                    selected={selectedIds.has(m.id)}
                    onToggleSelect={() => toggleSelect(m.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
        </>
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!toDelete}
        title="删除匹配记录"
        message={`确认删除该匹配记录吗？关联的话术也将一并删除，此操作不可撤销。`}
        confirmText={deleting ? '删除中...' : '确认删除'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function MatchRow({ match, onDelete, selected, onToggleSelect }: {
  match: Match;
  onDelete: () => void;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const resumeName = match.resume?.name || '—';
  const positionTitle = match.position?.title || '—';
  const isRisky = match.resume?.risk_warning?.isRisky;

  const toneClass =
    match.status === 'lost'
      ? 'bg-risk-100 text-risk-700 dark:bg-risk-900/30 dark:text-risk-400'
      : match.status === 'interview_invited'
      ? 'bg-ochre-100 text-ochre-700 dark:bg-ochre-900/30 dark:text-ochre-400'
      : 'bg-forest-100 text-forest-700 dark:bg-forest-800 dark:text-forest-300';

  return (
    <tr className={`border-t border-forest-50 hover:bg-cream-50/50 dark:border-forest-800 dark:hover:bg-forest-800/50 ${selected ? 'bg-forest-50/60 dark:bg-forest-800/30' : ''}`}>
      {/* Checkbox */}
      <td className="px-4 py-3">
        <button type="button" onClick={onToggleSelect} aria-label={selected ? '取消选择' : '选择'}>
          {selected
            ? <CheckSquare className="w-4 h-4 text-forest-600 dark:text-forest-400" />
            : <Square className="w-4 h-4 text-forest-300 dark:text-forest-600" />
          }
        </button>
      </td>
      {/* 求职者 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            to={`/matches/${match.id}`}
            className="font-medium text-forest-800 hover:text-forest-600 dark:text-cream-100 dark:hover:text-cream-200"
          >
            {resumeName}
          </Link>
          {isRisky && <RiskBadge risk={match.resume?.risk_warning} />}
        </div>
        {match.resume?.current_company && (
          <div className="text-xs text-forest-400 mt-0.5">{match.resume.current_company}</div>
        )}
      </td>
      {/* 职位 */}
      <td className="px-4 py-3">
        <div className="text-forest-700 dark:text-cream-200">{positionTitle}</div>
        {match.position?.location && (
          <div className="text-xs text-forest-400 mt-0.5">{match.position.location}</div>
        )}
      </td>
      {/* 匹配度 */}
      <td className="px-4 py-3">
        <div className={`font-mono font-semibold text-lg ${scoreColorClass(match.score)}`}>
          {match.score}
        </div>
        <div className="text-xs text-forest-400">/ 100</div>
      </td>
      {/* 转化概率 */}
      <td className="px-4 py-3">
        <span className="font-mono text-forest-700 dark:text-cream-200">{match.conversion_probability}%</span>
      </td>
      {/* 状态 */}
      <td className="px-4 py-3">
        <span className={`badge ${toneClass}`}>{MATCH_STATUS_LABELS[match.status]}</span>
      </td>
      {/* 创建时间 */}
      <td className="px-4 py-3 text-forest-500 text-xs">
        {dayjs(match.created_at).format('YYYY-MM-DD HH:mm')}
      </td>
      {/* 操作 */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Link
            to={`/matches/${match.id}`}
            className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            查看
          </Link>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs px-2 py-1 rounded text-risk-600 hover:bg-risk-50 dark:hover:bg-risk-900/20 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            删除
          </button>
        </div>
      </td>
    </tr>
  );
}
