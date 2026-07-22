// 对话辅助会话列表页：搜索 + 状态筛选 + 表格列表 + 新建会话
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Eye,
  Trash2,
  MessageSquare,
  Check,
  Loader2,
} from 'lucide-react';
import dayjs from 'dayjs';
import {
  chatApi,
  positionsApi,
  resumesApi,
  getErrorMsg,
} from '@/lib/api';
import type { ChatSession, Position, Resume } from '@/types';
import Loading from '@/components/Loading';
import Empty from '@/components/Empty';
import Pagination from '@/components/Pagination';
import ConfirmDialog from '@/components/ConfirmDialog';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';

const PAGE_SIZE = 12;

// 会话状态文案
const SESSION_STATUS_TEXT: Record<string, string> = {
  active: '进行中',
  closed: '已关闭',
};

export default function ChatList() {
  const navigate = useNavigate();

  const [list, setList] = useState<ChatSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 删除确认
  const [toDelete, setToDelete] = useState<ChatSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 新建会话弹窗
  const [createOpen, setCreateOpen] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await chatApi.listSessions({
        keyword: keyword || undefined,
        status: (statusFilter as 'active' | 'closed') || undefined,
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
      await chatApi.removeSession(toDelete.id);
      setToDelete(null);
      await fetchList();
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setDeleting(false);
    }
  };

  // 新建会话成功后跳转
  const handleCreated = (session: ChatSession) => {
    setCreateOpen(false);
    navigate(`/chat/${session.id}`);
  };

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100">对话辅助</h1>
          <p className="text-sm text-forest-500 dark:text-forest-400 mt-1">
            BOSS 实时对话场景：粘贴求职者回复 → AI 资深 HR 视角分析 → 3 套回复策略选优发送
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="btn-ai flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          新建会话
        </button>
      </div>

      {/* 搜索栏 */}
      <form onSubmit={handleSearch} className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400 dark:text-forest-500" />
          <input
            type="text"
            className="input pl-9"
            placeholder="搜索求职者名 / 职位名"
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
          <option value="active">进行中</option>
          <option value="closed">已关闭</option>
        </select>
        <button type="submit" className="btn-primary">
          搜索
        </button>
      </form>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400">
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
            暂无对话会话，{''}
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="text-forest-600 dark:text-cream-300 underline"
            >
              立即新建会话
            </button>
          </p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream-100 dark:bg-forest-800 text-forest-600 dark:text-cream-300 text-left">
                  <th className="px-4 py-3 font-medium">求职者 / 标题</th>
                  <th className="px-4 py-3 font-medium">咨询职位</th>
                  <th className="px-4 py-3 font-medium">绑定简历</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">最后消息</th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <SessionRow key={s.id} session={s} onDelete={() => setToDelete(s)} />
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
        title="删除对话会话"
        message={`确认删除该对话会话吗？所有对话消息将一并删除，此操作不可撤销。`}
        confirmText={deleting ? '删除中...' : '确认删除'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />

      {/* 新建会话弹窗 */}
      <CreateSessionModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
    </div>
  );
}

// 表格行
function SessionRow({ session, onDelete }: { session: ChatSession; onDelete: () => void }) {
  const title = session.title || session.candidate_name || '未命名会话';
  const positionTitle = session.position?.title || '—';
  const positionSalary =
    session.position?.salary_min && session.position?.salary_max
      ? `${session.position.salary_min}-${session.position.salary_max}`
      : null;
  const resumeName = session.resume?.name;

  return (
    <tr className="border-t border-forest-50 dark:border-forest-800 hover:bg-cream-50/50 dark:hover:bg-forest-800/50">
      {/* 求职者 / 标题 */}
      <td className="px-4 py-3">
        <Link
          to={`/chat/${session.id}`}
          className="font-medium text-forest-800 dark:text-cream-100 hover:text-forest-600 flex items-center gap-1.5"
        >
          <MessageSquare className="w-3.5 h-3.5 text-forest-400 dark:text-forest-500" />
          {title}
        </Link>
        {session.candidate_name && session.title && session.candidate_name !== session.title && (
          <div className="text-xs text-forest-400 dark:text-forest-500 mt-0.5">求职者：{session.candidate_name}</div>
        )}
      </td>
      {/* 职位 */}
      <td className="px-4 py-3">
        <div className="text-forest-700 dark:text-cream-200">{positionTitle}</div>
        {positionSalary && (
          <div className="text-xs text-forest-400 dark:text-forest-500 mt-0.5">薪资 {positionSalary}</div>
        )}
      </td>
      {/* 简历 */}
      <td className="px-4 py-3">
        {resumeName ? (
          <span className="text-forest-700 dark:text-cream-200">{resumeName}</span>
        ) : (
          <span className="text-xs text-forest-400 dark:text-forest-500">未绑定</span>
        )}
      </td>
      {/* 状态 */}
      <td className="px-4 py-3">
        <StatusBadge
          status={session.status}
          text={SESSION_STATUS_TEXT[session.status] || session.status}
        />
      </td>
      {/* 最后消息时间 */}
      <td className="px-4 py-3 text-forest-500 dark:text-forest-400 text-xs">
        {session.last_message_at
          ? dayjs(session.last_message_at).format('MM-DD HH:mm')
          : dayjs(session.created_at).format('MM-DD HH:mm')}
      </td>
      {/* 操作 */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Link
            to={`/chat/${session.id}`}
            className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            进入
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

// 新建会话弹窗
function CreateSessionModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (session: ChatSession) => void;
}) {
  const [positionId, setPositionId] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 职位列表
  const [positions, setPositions] = useState<Position[]>([]);
  const [posKeyword, setPosKeyword] = useState('');
  const [posLoading, setPosLoading] = useState(false);

  // 简历列表
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [resKeyword, setResKeyword] = useState('');
  const [resLoading, setResLoading] = useState(false);

  // 拉取职位（仅招聘中）
  const fetchPositions = useCallback(async () => {
    setPosLoading(true);
    try {
      const res = await positionsApi.list({
        keyword: posKeyword || undefined,
        status: 'open',
        page: 1,
        pageSize: 30,
      });
      setPositions(res.data || []);
    } catch {
      setPositions([]);
    } finally {
      setPosLoading(false);
    }
  }, [posKeyword]);

  // 拉取简历
  const fetchResumes = useCallback(async () => {
    setResLoading(true);
    try {
      const res = await resumesApi.list({
        keyword: resKeyword || undefined,
        page: 1,
        pageSize: 30,
      });
      setResumes(res.data || []);
    } catch {
      setResumes([]);
    } finally {
      setResLoading(false);
    }
  }, [resKeyword]);

  useEffect(() => {
    if (open) {
      fetchPositions();
      fetchResumes();
      // 重置表单
      setPositionId('');
      setResumeId('');
      setCandidateName('');
      setError('');
    }
  }, [open, fetchPositions, fetchResumes]);

  const handleSubmit = async () => {
    if (!positionId) {
      setError('请选择咨询的职位');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const session = await chatApi.createSession({
        position_id: positionId,
        resume_id: resumeId || undefined,
        candidate_name: candidateName || undefined,
      });
      onCreated(session);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="新建对话会话"
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button
            type="button"
            className="btn-ai flex items-center gap-1"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {submitting ? '创建中...' : '创建并进入'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400">
            {error}
          </div>
        )}

        {/* 求职者名 */}
        <div>
          <label className="block text-sm font-medium text-forest-700 dark:text-cream-200 mb-1">
            求职者名 <span className="text-forest-400 dark:text-forest-500 text-xs">（可选，未绑定简历时建议填写）</span>
          </label>
          <input
            type="text"
            className="input"
            placeholder="如：张先生 / BOSS昵称"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
          />
        </div>

        {/* 选择职位（必填） */}
        <div>
          <label className="block text-sm font-medium text-forest-700 dark:text-cream-200 mb-1">
            咨询职位 <span className="text-risk-500">*</span>
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchPositions();
            }}
            className="relative mb-2"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400 dark:text-forest-500" />
            <input
              type="text"
              className="input pl-9"
              placeholder="搜索职位名"
              value={posKeyword}
              onChange={(e) => setPosKeyword(e.target.value)}
            />
          </form>
          <div className="border border-forest-100 dark:border-forest-700 rounded-lg max-h-48 overflow-y-auto bg-cream-50/30 dark:bg-forest-800/30">
            {posLoading ? (
              <div className="p-3 text-sm text-forest-400 dark:text-forest-500 text-center">
                <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                加载中...
              </div>
            ) : positions.length === 0 ? (
              <div className="p-3 text-sm text-forest-400 dark:text-forest-500 text-center">暂无可选职位</div>
            ) : (
              positions.map((p) => {
                const selected = positionId === p.id;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setPositionId(p.id)}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-forest-50 dark:border-forest-800 last:border-b-0 transition-colors ${
                      selected
                        ? 'bg-forest-100 text-forest-800 dark:bg-forest-700 dark:text-cream-100'
                        : 'hover:bg-cream-100 text-forest-700 dark:hover:bg-forest-700 dark:text-cream-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{p.title}</span>
                      {selected && <Check className="w-3.5 h-3.5 text-forest-600 dark:text-cream-300" />}
                    </div>
                    <div className="text-xs text-forest-400 dark:text-forest-500 mt-0.5">
                      {p.location || '地点不限'}
                      {p.salary_min && p.salary_max ? ` · ${p.salary_min}-${p.salary_max}` : ''}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 选择简历（可选） */}
        <div>
          <label className="block text-sm font-medium text-forest-700 dark:text-cream-200 mb-1">
            绑定简历 <span className="text-forest-400 dark:text-forest-500 text-xs">（可选，绑定后 AI 分析更精准）</span>
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchResumes();
            }}
            className="relative mb-2"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400 dark:text-forest-500" />
            <input
              type="text"
              className="input pl-9"
              placeholder="搜索求职者姓名"
              value={resKeyword}
              onChange={(e) => setResKeyword(e.target.value)}
            />
          </form>
          <div className="border border-forest-100 dark:border-forest-700 rounded-lg max-h-48 overflow-y-auto bg-cream-50/30 dark:bg-forest-800/30">
            {/* 不绑定简历选项 */}
            <button
              type="button"
              onClick={() => setResumeId('')}
              className={`w-full text-left px-3 py-2 text-sm border-b border-forest-50 dark:border-forest-800 transition-colors ${
                resumeId === ''
                  ? 'bg-forest-100 text-forest-800 dark:bg-forest-700 dark:text-cream-100'
                  : 'hover:bg-cream-100 text-forest-700 dark:hover:bg-forest-700 dark:text-cream-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-forest-500 dark:text-forest-400">不绑定简历</span>
                {resumeId === '' && <Check className="w-3.5 h-3.5 text-forest-600 dark:text-cream-300" />}
              </div>
            </button>
            {resLoading ? (
              <div className="p-3 text-sm text-forest-400 dark:text-forest-500 text-center">
                <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                加载中...
              </div>
            ) : resumes.length === 0 ? (
              <div className="p-3 text-sm text-forest-400 dark:text-forest-500 text-center">暂无可选简历</div>
            ) : (
              resumes.map((r) => {
                const selected = resumeId === r.id;
                return (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => setResumeId(r.id)}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-forest-50 dark:border-forest-800 last:border-b-0 transition-colors ${
                      selected
                        ? 'bg-forest-100 text-forest-800 dark:bg-forest-700 dark:text-cream-100'
                        : 'hover:bg-cream-100 text-forest-700 dark:hover:bg-forest-700 dark:text-cream-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{r.name}</span>
                      {selected && <Check className="w-3.5 h-3.5 text-forest-600 dark:text-cream-300" />}
                    </div>
                    <div className="text-xs text-forest-400 dark:text-forest-500 mt-0.5">
                      {r.current_company || '未知公司'}
                      {r.current_title ? ` · ${r.current_title}` : ''}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 提示 */}
        <div className="px-3 py-2 rounded-lg bg-cream-50 dark:bg-forest-800/50 border border-forest-100 dark:border-forest-800 text-xs text-forest-500 dark:text-forest-400">
          创建会话后即可在详情页粘贴求职者回复，AI 会以资深 HR 视角分析意图、风险、情绪，并生成 3 套不同策略的回复供你选优发送。
        </div>
      </div>
    </Modal>
  );
}
