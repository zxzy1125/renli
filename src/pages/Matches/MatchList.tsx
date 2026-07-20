// 匹配列表页：搜索 + 状态筛选 + 表格列表 + 分页
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Eye, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import { matchesApi, getErrorMsg } from '@/lib/api';
import type { Match, MatchStatus } from '@/types';
import Loading from '@/components/Loading';
import Empty from '@/components/Empty';
import Pagination from '@/components/Pagination';
import ConfirmDialog from '@/components/ConfirmDialog';
import { RiskBadge } from '@/components/RiskBadge';
import {
  MATCH_STATUS_LABELS,
  scoreColorClass,
} from './constants';

const PAGE_SIZE = 12;

// 状态筛选选项
const STATUS_OPTIONS: { value: MatchStatus; label: string }[] = (
  Object.keys(MATCH_STATUS_LABELS) as MatchStatus[]
).map((k) => ({ value: k, label: MATCH_STATUS_LABELS[k] }));

export default function MatchList() {
  const navigate = useNavigate();

  const [list, setList] = useState<Match[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 删除确认
  const [toDelete, setToDelete] = useState<Match | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await matchesApi.list({
        keyword: keyword || undefined,
        status: statusFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setList(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, [keyword, statusFilter, page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchList();
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await matchesApi.remove(toDelete.id);
      setToDelete(null);
      await fetchList();
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest-800">匹配管理</h1>
          <p className="text-sm text-forest-500 mt-1">
            选职位 + 选简历 → AI 生成匹配报告与 18 条话术
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/matches/new')}
          className="btn-ai flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          新建匹配
        </button>
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

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700">
          {error}
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <div className="card p-12">
          <Empty />
          <p className="text-center text-sm text-forest-500 mt-2">
            暂无匹配记录，{''}
            <Link to="/matches/new" className="text-forest-600 underline">
              立即新建匹配
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream-100 text-forest-600 text-left">
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
                  <MatchRow key={m.id} match={m} onDelete={() => setToDelete(m)} />
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

// 表格行
function MatchRow({ match, onDelete }: { match: Match; onDelete: () => void }) {
  const resumeName = match.resume?.name || '—';
  const positionTitle = match.position?.title || '—';
  const isRisky = match.resume?.risk_warning?.isRisky;

  // 状态徽章色调
  const toneClass =
    match.status === 'lost'
      ? 'bg-risk-100 text-risk-700'
      : match.status === 'interview_invited'
      ? 'bg-ochre-100 text-ochre-700'
      : 'bg-forest-100 text-forest-700';

  return (
    <tr className="border-t border-forest-50 hover:bg-cream-50/50">
      {/* 求职者 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            to={`/matches/${match.id}`}
            className="font-medium text-forest-800 hover:text-forest-600"
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
        <div className="text-forest-700">{positionTitle}</div>
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
        <span className="font-mono text-forest-700">{match.conversion_probability}%</span>
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
            className="text-xs px-2 py-1 rounded text-risk-600 hover:bg-risk-50 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            删除
          </button>
        </div>
      </td>
    </tr>
  );
}
