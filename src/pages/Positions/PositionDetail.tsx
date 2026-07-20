// 职位详情页：基本信息 + JD/要求/加分项 + 折叠原文 + 生成 BOSS 文案按钮
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Sparkles,
  GitCompareArrows,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Building2,
  Users,
  Wallet,
  MapPin,
  Briefcase,
  Calendar,
} from 'lucide-react';
import dayjs from 'dayjs';
import { positionsApi, clientsApi, aiApi, getErrorMsg } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  useBossPostingStore,
  extractPostings,
  type BossPosting,
  type BossPostingTask,
} from '@/store/bossPostingStore';
import type { Client, Position } from '@/types';
import Loading from '@/components/Loading';
import MarkdownView from '@/components/MarkdownView';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import {
  JOB_TYPE_OPTIONS,
  WORK_MODE_OPTIONS,
  PRIORITY_OPTIONS,
  getOptionLabel,
} from './constants';

export default function PositionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [position, setPosition] = useState<Position | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rawOpen, setRawOpen] = useState(false);

  // BOSS 文案弹窗
  const [bossOpen, setBossOpen] = useState(false);
  const [bossTask, setBossTask] = useState<BossPostingTask | null>(null);

  const startGeneration = useBossPostingStore((s) => s.startGeneration);
  const tasks = useBossPostingStore((s) => s.tasks);
  const pendingViewTaskId = useBossPostingStore((s) => s.pendingViewTaskId);
  const setPendingView = useBossPostingStore((s) => s.setPendingView);
  const replacePosting = useBossPostingStore((s) => s.replacePosting);
  const setStyleRegenerating = useBossPostingStore((s) => s.setStyleRegenerating);

  // 从通知跳来时，自动打开弹窗
  useEffect(() => {
    if (pendingViewTaskId) {
      const task = tasks.find((t) => t.id === pendingViewTaskId);
      if (task && task.positionId === id) {
        setBossTask(task);
        setBossOpen(true);
        setPendingView(null);
      }
    }
  }, [pendingViewTaskId, tasks, id, setPendingView]);

  // 同步后台任务状态到弹窗
  useEffect(() => {
    if (bossTask) {
      const latest = tasks.find((t) => t.id === bossTask.id);
      if (latest && latest !== bossTask) {
        setBossTask(latest);
      }
    }
  }, [tasks, bossTask]);

  const handleGenerateBoss = () => {
    if (!position) return;
    startGeneration(
      position.id,
      position.title,
      client?.industry,
      position.location ?? undefined
    );
    // 不再自动弹窗，生成完成后右下角弹窗通知
  };

  // 该职位是否有正在生成中的任务
  const generatingTask = tasks.find(
    (t) => t.positionId === id && t.status === 'generating'
  );

  // 该职位最近一次已完成的生成结果
  const latestCompleted = tasks
    .filter((t) => t.positionId === id && t.status === 'completed')
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const p = await positionsApi.get(id);
        if (cancelled) return;
        setPosition(p);
        if (p.client_id) {
          try {
            const clients = await clientsApi.list();
            if (!cancelled) {
              setClient(clients.find((c) => c.id === p.client_id) || null);
            }
          } catch {
            // 忽略客户公司加载错误
          }
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMsg(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <Loading className="py-20" />;
  if (error) {
    return (
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <div className="px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700 mb-4">
          {error}
        </div>
        <Link to="/positions" className="btn-ghost inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 返回职位库
        </Link>
      </div>
    );
  }
  if (!position) {
    return (
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <p className="text-sm text-forest-500">职位不存在</p>
        <Link to="/positions" className="btn-ghost inline-flex items-center gap-1 mt-2">
          <ArrowLeft className="w-4 h-4" /> 返回职位库
        </Link>
      </div>
    );
  }

  const salary = [position.salary_min, position.salary_max].filter(Boolean).join(' - ');

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      {/* 顶部操作 */}
      <div className="flex items-center gap-2 mb-4">
        <Link to="/positions" className="btn-ghost inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 职位库
        </Link>
      </div>

      {/* 标题区 */}
      <div className="card p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h1 className="font-serif text-2xl font-bold text-forest-800">{position.title}</h1>
            {client && (
              <div className="flex items-center gap-1 text-sm text-forest-500 mt-1">
                <Building2 className="w-3.5 h-3.5" />
                <span>{client.name}</span>
                {position.department && <span>· {position.department}</span>}
              </div>
            )}
          </div>
          <StatusBadge status={position.status} />
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate(`/positions/${position.id}/edit`)}
              className="btn-secondary flex items-center gap-1"
            >
              <Pencil className="w-4 h-4" />
              编辑
            </button>
          )}
          <button
            type="button"
            onClick={handleGenerateBoss}
            disabled={!!generatingTask}
            className={`btn-ai flex items-center gap-1 ${generatingTask ? 'opacity-70 cursor-wait' : ''}`}
          >
            <Sparkles className={`w-4 h-4 ${generatingTask ? 'animate-pulse' : ''}`} />
            {generatingTask ? '生成中...' : '生成 BOSS 发布文案'}
          </button>
          {generatingTask && (
            <button
              type="button"
              onClick={() => {
                setBossTask(generatingTask);
                setBossOpen(true);
              }}
              className="btn-ghost flex items-center gap-1 text-forest-600"
            >
              <Sparkles className="w-4 h-4 animate-pulse text-ochre-500" />
              查看生成进度
            </button>
          )}
          {latestCompleted && (
            <button
              type="button"
              onClick={() => {
                setBossTask(latestCompleted);
                setBossOpen(true);
              }}
              className="btn-ghost flex items-center gap-1 text-ochre-700"
            >
              查看上次生成结果
            </button>
          )}
          <button
            type="button"
            disabled
            className="btn-ghost flex items-center gap-1 opacity-60 cursor-not-allowed"
            title="匹配管理功能即将上线"
          >
            <GitCompareArrows className="w-4 h-4" />
            发起匹配
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左侧基本信息 */}
        <div className="card p-5">
          <h2 className="font-serif text-lg font-semibold text-forest-800 mb-3">基本信息</h2>
          <dl className="space-y-2 text-sm">
            <InfoRow icon={Building2} label="客户公司" value={client?.name} />
            <InfoRow label="部门" value={position.department ?? undefined} />
            <InfoRow icon={MapPin} label="地点" value={position.location ?? undefined} />
            <InfoRow icon={Users} label="招聘人数" value={position.headcount ? `${position.headcount} 人` : undefined} />
            <InfoRow icon={Wallet} label="薪资范围" value={salary || undefined} mono />
            <InfoRow icon={Briefcase} label="经验要求" value={position.experience ?? undefined} />
            <InfoRow label="学历要求" value={position.education ?? undefined} />
            <InfoRow
              label="职位类型"
              value={getOptionLabel(JOB_TYPE_OPTIONS, position.job_type)}
            />
            <InfoRow
              label="工作模式"
              value={getOptionLabel(WORK_MODE_OPTIONS, position.work_mode)}
            />
            <InfoRow
              label="优先级"
              value={getOptionLabel(PRIORITY_OPTIONS, position.priority)}
            />
            <InfoRow
              icon={Calendar}
              label="创建时间"
              value={dayjs(position.created_at).format('YYYY-MM-DD HH:mm')}
            />
          </dl>
        </div>

        {/* 右侧 JD / 要求 / 加分项 */}
        <div className="lg:col-span-2 space-y-4">
          <section className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-forest-800 mb-3">岗位职责</h2>
            <MarkdownView content={position.jd} />
          </section>
          <section className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-forest-800 mb-3">任职要求</h2>
            <MarkdownView content={position.requirements} />
          </section>
          {position.bonus && (
            <section className="card p-5">
              <h2 className="font-serif text-lg font-semibold text-forest-800 mb-3">加分项</h2>
              <MarkdownView content={position.bonus} />
            </section>
          )}

          {/* 折叠原文 */}
          {position.raw_text && (
            <section className="card p-5">
              <button
                type="button"
                onClick={() => setRawOpen((v) => !v)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="font-serif text-base font-semibold text-forest-700">
                  原始文本（raw_text）
                </span>
                {rawOpen ? (
                  <ChevronDown className="w-4 h-4 text-forest-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-forest-400" />
                )}
              </button>
              {rawOpen && (
                <pre className="mt-3 p-3 bg-forest-900 text-cream-50 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {position.raw_text}
                </pre>
              )}
            </section>
          )}
        </div>
      </div>

      {/* BOSS 文案弹窗 */}
      <Modal
        open={bossOpen}
        title="BOSS 发布文案（3 套）"
        onClose={() => setBossOpen(false)}
        size="lg"
      >
        {bossTask?.status === 'generating' ? (
          <div className="py-8 text-center text-sm text-forest-500">
            <Sparkles className="w-6 h-6 mx-auto mb-2 animate-pulse text-ochre-500" />
            AI 正在后台生成 3 套文案（诱惑型/神秘型/专业型）...
            <p className="text-xs text-forest-400 mt-2">您可以安全离开此页面，完成后会收到通知</p>
          </div>
        ) : bossTask?.status === 'error' ? (
          <div className="px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700">
            {bossTask.error}
          </div>
        ) : bossTask?.status === 'completed' ? (
          <div className="space-y-3">
            {bossTask.postings.map((p, i) => {
              const isRegen = (bossTask.regeneratingStyles ?? []).includes(p.style);
              return (
                <BossPostingCard
                  key={`${p.style}-${i}`}
                  posting={p}
                  regenerating={isRegen}
                  onRegenerate={async () => {
                    if (!bossTask || !position) return;
                    const style = p.style;
                    setStyleRegenerating(bossTask.id, style, true);
                    try {
                      const res = await aiApi.generateBossPosting(
                        position.id,
                        client?.industry,
                        position.location ?? undefined,
                        style
                      );
                      const data = (res as { data?: unknown }).data ?? res;
                      const extracted = extractPostings(data, position.title);
                      if (extracted.length > 0) {
                        replacePosting(bossTask.id, style, extracted[0]);
                      }
                    } catch {
                      // ignore
                    } finally {
                      setStyleRegenerating(bossTask.id, style, false);
                    }
                  }}
                />
              );
            })}
            {bossTask.postings.length === 0 && (
              <p className="text-sm text-forest-400 text-center py-4">暂无内容</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-forest-400 text-center py-4">暂无内容</p>
        )}
      </Modal>
    </div>
  );
}

// 信息行
function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon?: typeof MapPin;
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-forest-500 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-forest-400" />}
        {label}
      </dt>
      <dd className={`text-forest-800 ${mono ? 'font-mono' : ''}`}>
        {value || <span className="text-forest-300">—</span>}
      </dd>
    </div>
  );
}

// BOSS 文案卡片
function BossPostingCard({
  posting,
  onRegenerate,
  regenerating,
}: {
  posting: BossPosting;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const styleMap: Record<string, string> = {
    tempting: '诱惑型',
    mystery: '神秘型',
    professional: '专业型',
    诱惑型: '诱惑型',
    神秘型: '神秘型',
    专业型: '专业型',
  };
  const label = styleMap[posting.style] || posting.style || '文案';

  const fullText = `${posting.title}\n\n${posting.content}`;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 兜底
      const ta = document.createElement('textarea');
      ta.value = fullText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border border-forest-100 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-cream-100">
        <span className="text-xs font-medium text-ochre-700 px-2 py-0.5 rounded bg-ochre-50 border border-ochre-100">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              className={`text-xs text-forest-600 hover:text-forest-800 flex items-center gap-1 ${regenerating ? 'opacity-60 cursor-wait' : ''}`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${regenerating ? 'animate-pulse text-ochre-500' : ''}`} />
              {regenerating ? '重新生成中...' : '重新生成'}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs text-forest-600 hover:text-forest-800 flex items-center gap-1"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-forest-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '已复制' : '一键复制'}
          </button>
        </div>
      </div>
      <div className="p-3">
        <div className="font-serif text-base font-semibold text-forest-800 mb-2">
          {posting.title}
        </div>
        <div className="markdown-body">
          <MarkdownView content={posting.content} />
        </div>
      </div>
    </div>
  );
}
