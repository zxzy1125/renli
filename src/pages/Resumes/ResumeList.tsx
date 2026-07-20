// 简历库列表
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { resumesApi, getErrorMsg } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { Resume } from '@/types';
import Loading from '@/components/Loading';
import Empty from '@/components/Empty';
import Pagination from '@/components/Pagination';
import StatusBadge from '@/components/StatusBadge';
import { RiskBadge } from '@/components/RiskBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { CANDIDATE_STATUS_OPTIONS, getOptionLabel } from './constants';

const PAGE_SIZE = 12;

export default function ResumeList() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [list, setList] = useState<Resume[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [toDelete, setToDelete] = useState<Resume | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await resumesApi.list({
        keyword: keyword || undefined,
        candidate_status: statusFilter || undefined,
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
      await resumesApi.remove(toDelete.id);
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest-800">简历库</h1>
          <p className="text-sm text-forest-500 mt-1">
            {isAdmin ? '全部员工的简历' : '我的简历'}
          </p>
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

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700">
          {error}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <div className="card p-12">
          <Empty />
          <p className="text-center text-sm text-forest-500 mt-2">
            暂无简历，{''}
            <Link to="/resumes/new" className="text-forest-600 underline">
              立即录入
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((r) => (
              <ResumeCard key={r.id} resume={r} onDelete={() => setToDelete(r)} />
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
}
function ResumeCard({ resume, onDelete }: ResumeCardProps) {
  return (
    <div className="card p-4 hover:shadow-cardHover transition-shadow flex flex-col">
      {/* 标题行 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          to={`/resumes/${resume.id}`}
          className="font-serif text-base font-semibold text-forest-800 hover:text-forest-600 flex items-center gap-2"
        >
          <span>{resume.name}</span>
          {resume.age && <span className="text-sm font-normal text-forest-500">{resume.age}岁</span>}
        </Link>
        <div className="flex items-center gap-1">
          <RiskBadge risk={resume.risk_warning} />
          <StatusBadge status={resume.candidate_status} />
        </div>
      </div>

      {/* 现公司 / 现职位 */}
      <div className="flex items-center gap-1 text-sm text-forest-600 mb-2">
        <Building2 className="w-3.5 h-3.5 text-forest-400" />
        <span>{resume.current_company || '现公司未知'}</span>
        {resume.current_title && (
          <span className="text-forest-400">· {resume.current_title}</span>
        )}
      </div>

      {/* 标签 */}
      {resume.tags && resume.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {resume.tags.slice(0, 4).map((t, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 rounded text-xs bg-ochre-50 text-ochre-700 border border-ochre-100"
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
        <div className="flex items-center gap-1 text-xs text-forest-600 mb-2">
          <Wallet className="w-3 h-3 text-forest-400" />
          <span>
            {resume.expected_city ? `${resume.expected_city} · ` : ''}
            {resume.expectation || '期望方向未填'}
          </span>
        </div>
      )}

      {/* 已加微信标识 */}
      {(resume.has_wechat === 1 || resume.has_wechat === true) && (
        <div className="inline-flex items-center gap-1 text-xs text-forest-600 mb-2">
          <MessageCircle className="w-3 h-3 text-forest-500" />
          <span>已加微信{resume.wechat_id ? `（${resume.wechat_id}）` : ''}</span>
        </div>
      )}

      {/* 操作 */}
      <div className="mt-auto flex items-center justify-end gap-1 pt-2 border-t border-forest-50">
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
          className="text-xs px-2 py-1 rounded text-risk-600 hover:bg-risk-50 flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          删除
        </button>
      </div>
    </div>
  );
}

// 暴露给外部按需使用
export { getOptionLabel };
