// 职位详情页：基本信息 + JD/要求/加分项 + AI 解析结果（增强卡片布局）+ 折叠原文 + 生成 BOSS 文案按钮
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
  FileText,
  AlertTriangle,
  CheckCircle2,
  Sparkle,
  Clock,
  GraduationCap,
  TrendingUp,
  Heart,
  Target,
  Shield,
  Coffee,
  User,
  Zap,
  HelpCircle,
  Lightbulb,
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
  POSITION_STATUS_OPTIONS,
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
        <div className="px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400 mb-4">
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
        <p className="text-sm text-forest-500 dark:text-forest-400">职位不存在</p>
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
            <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100">{position.title}</h1>
            {client && (
              <div className="flex items-center gap-1 text-sm text-forest-500 dark:text-forest-400 mt-1">
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
              className="btn-ghost flex items-center gap-1 text-forest-600 dark:text-cream-300"
            >
              <Sparkles className="w-4 h-4 animate-pulse text-ochre-500 dark:text-ochre-400" />
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
              className="btn-ghost flex items-center gap-1 text-ochre-700 dark:text-ochre-400"
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
          <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-3">基本信息</h2>
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
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-3">岗位职责</h2>
            <MarkdownView content={position.jd} />
          </section>
          <section className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-3">任职要求</h2>
            <MarkdownView content={position.requirements} />
          </section>
          {position.bonus && (
            <section className="card p-5">
              <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-3">加分项</h2>
              <MarkdownView content={position.bonus} />
            </section>
          )}

          {/* AI 解析结果（结构化表格） */}
          <AiResultTable position={position} client={client} />

          {/* 折叠原文 */}
          {position.raw_text && (
            <section className="card p-5">
              <button
                type="button"
                onClick={() => setRawOpen((v) => !v)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="font-serif text-base font-semibold text-forest-700 dark:text-cream-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-forest-400 dark:text-forest-500" />
                  原始文本
                  {position.source_filename && (
                    <span className="text-xs text-forest-500 dark:text-forest-400 font-normal">
                      （来源：{position.source_filename}
                      {position.source_ext ? ` · ${position.source_ext}` : ''}）
                    </span>
                  )}
                </span>
                {rawOpen ? (
                  <ChevronDown className="w-4 h-4 text-forest-400 dark:text-forest-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-forest-400 dark:text-forest-500" />
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
          <div className="py-8 text-center text-sm text-forest-500 dark:text-forest-400">
            <Sparkles className="w-6 h-6 mx-auto mb-2 animate-pulse text-ochre-500 dark:text-ochre-400" />
            AI 正在后台生成 3 套文案（诱惑型/神秘型/专业型）...
            <p className="text-xs text-forest-400 dark:text-forest-500 mt-2">您可以安全离开此页面，完成后会收到通知</p>
          </div>
        ) : bossTask?.status === 'error' ? (
          <div className="px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400">
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
              <p className="text-sm text-forest-400 dark:text-forest-500 text-center py-4">暂无内容</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-forest-400 dark:text-forest-500 text-center py-4">暂无内容</p>
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
      <dt className="text-forest-500 dark:text-cream-300 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-forest-400 dark:text-forest-500" />}
        {label}
      </dt>
      <dd className={`text-forest-800 dark:text-cream-100 ${mono ? 'font-mono' : ''}`}>
        {value || <span className="text-forest-300 dark:text-forest-600">—</span>}
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
    <div className="border border-forest-100 dark:border-forest-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-cream-100 dark:bg-forest-800/50">
        <span className="text-xs font-medium text-ochre-700 dark:text-ochre-400 px-2 py-0.5 rounded bg-ochre-50 dark:bg-ochre-900/20 border border-ochre-100 dark:border-ochre-800">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              className={`text-xs text-forest-600 dark:text-cream-300 hover:text-forest-800 dark:hover:text-cream-100 flex items-center gap-1 ${regenerating ? 'opacity-60 cursor-wait' : ''}`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${regenerating ? 'animate-pulse text-ochre-500' : ''}`} />
              {regenerating ? '重新生成中...' : '重新生成'}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs text-forest-600 dark:text-cream-300 hover:text-forest-800 dark:hover:text-cream-100 flex items-center gap-1"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-forest-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '已复制' : '一键复制'}
          </button>
        </div>
      </div>
      <div className="p-3">
        <div className="font-serif text-base font-semibold text-forest-800 dark:text-cream-100 mb-2">
          {posting.title}
        </div>
        <div className="markdown-body">
          <MarkdownView content={posting.content} />
        </div>
      </div>
    </div>
  );
}

// AI 解析结果：增强卡片布局，展示求职者关心的所有字段
interface AiMetaShape {
  clientCompany?: string;
  salaryUnit?: string;
  highlights?: string[];
  confidence?: number;
  uncertainFields?: string[];
  rawTextSummary?: string;
  keywords?: string[];
  salaryDetails?: {
    baseSalary?: string; commission?: string; performanceBonus?: string;
    annualBonus?: string; totalRange?: string; otherCompensation?: string;
  };
  trainingPeriod?: { duration?: string; salary?: string; content?: string };
  probation?: { duration?: string; salary?: string; conditions?: string; postSalary?: string };
  performanceMetrics?: { kpi?: string; evaluationCycle?: string; consequences?: string };
  benefits?: {
    socialInsurance?: string; paidLeave?: string; allowances?: string;
    insurance?: string; meals?: string; activities?: string; other?: string;
  };
  workLifeBalance?: { overtime?: string; schedule?: string; weekdays?: string; flexibility?: string };
  teamInfo?: { size?: string; reportTo?: string; subordinates?: string; structure?: string };
  growthPath?: { promotion?: string; training?: string; learning?: string };
  positionContext?: { hiringReason?: string; urgency?: string; note?: string };
  interviewProcess?: { rounds?: string; format?: string; duration?: string };
  companyInsights?: { scale?: string; industry?: string; fundingStage?: string; highlights?: string };
  jobSeekerVerdict?: string;
  [k: string]: unknown;
}

// 辅助：判断对象是否有任何非空字段
function hasAnyValue(obj: Record<string, unknown> | undefined | null): boolean {
  if (!obj || typeof obj !== 'object') return false;
  return Object.values(obj).some((v) => v != null && v !== '');
}

// 辅助：渲染 key-value 列表卡片
function DetailCard({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof Wallet;
  items: Array<{ label: string; value: string | undefined | null }>;
}) {
  const visible = items.filter((i) => i.value != null && i.value !== '');
  if (visible.length === 0) return null;
  return (
    <div className="card p-4">
      <h3 className="font-serif text-sm font-semibold text-forest-700 dark:text-cream-200 mb-3 flex items-center gap-2">
        <Icon className="w-4 h-4 text-ochre-500 dark:text-ochre-400" />
        {title}
      </h3>
      <dl className="space-y-2">
        {visible.map((item) => (
          <div key={item.label} className="flex flex-col sm:flex-row sm:items-start gap-1">
            <dt className="text-xs text-forest-500 dark:text-forest-400 sm:w-24 shrink-0 pt-0.5">{item.label}</dt>
            <dd className="text-sm text-forest-800 dark:text-cream-100 leading-relaxed">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AiResultTable({
  position,
  client,
}: {
  position: Position;
  client?: Client | null;
}) {
  const aiMeta = (position.ai_meta as AiMetaShape | null) ?? null;
  const hasSourceFile = !!(position.source_filename || position.source_ext);
  if (!aiMeta && !hasSourceFile) return null;

  const confidence = typeof aiMeta?.confidence === 'number' ? aiMeta.confidence : null;
  const confidencePct = confidence !== null ? `${Math.round(confidence * 100)}%` : '—';
  const confidenceColor =
    confidence === null ? 'text-forest-500'
      : confidence >= 0.85 ? 'text-emerald-600'
      : confidence >= 0.6 ? 'text-ochre-600'
      : 'text-risk-600';

  const highlights = Array.isArray(aiMeta?.highlights) ? (aiMeta!.highlights as string[]).filter(Boolean) : [];
  const uncertainFields = Array.isArray(aiMeta?.uncertainFields) ? (aiMeta!.uncertainFields as string[]).filter(Boolean) : [];
  const keywords = Array.isArray(aiMeta?.keywords) ? (aiMeta!.keywords as string[]).filter(Boolean) : (Array.isArray(position.keywords) ? position.keywords : []);

  // 基础信息行（原有逻辑，精简保留）
  const basicRows: Array<{ label: string; value: React.ReactNode; mono?: boolean }> = [];
  if (aiMeta?.clientCompany) basicRows.push({ label: '客户公司（AI 识别）', value: aiMeta.clientCompany });
  if (client?.name) basicRows.push({ label: '关联客户公司', value: client.name });
  if (aiMeta?.salaryUnit) basicRows.push({ label: '薪资单位', value: aiMeta.salaryUnit, mono: true });
  if (position.salary_min || position.salary_max) {
    basicRows.push({ label: '薪资范围', value: [position.salary_min, position.salary_max].filter(Boolean).join(' - '), mono: true });
  }
  if (position.source_filename) {
    basicRows.push({
      label: '源文件',
      value: (
        <span className="inline-flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-forest-400" />
          {position.source_filename}
          {position.source_ext && <span className="text-xs text-forest-400">（{position.source_ext}）</span>}
        </span>
      ),
    });
  }

  // 工作生活平衡标签文本
  const overtimeLabel: Record<string, string> = {
    rare: '基本不加班', occasional: '偶尔加班', frequent: '经常加班', heavy: '高强度/996',
  };
  const hiringLabel: Record<string, string> = {
    new: '新增 HC', replacement: '替补', expansion: '扩编', unknown: '未说明',
  };

  const salaryDetails = aiMeta?.salaryDetails;
  const trainingPeriod = aiMeta?.trainingPeriod;
  const probation = aiMeta?.probation;
  const perfMetrics = aiMeta?.performanceMetrics;
  const benefits = aiMeta?.benefits;
  const wlb = aiMeta?.workLifeBalance;
  const teamInfo = aiMeta?.teamInfo;
  const growth = aiMeta?.growthPath;
  const ctx = aiMeta?.positionContext;
  const interview = aiMeta?.interviewProcess;
  const companyInsights = aiMeta?.companyInsights;

  return (
    <section className="card p-5">
      {/* 标题 + 置信度 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 flex items-center gap-2">
          <Sparkle className="w-4 h-4 text-ochre-500 dark:text-ochre-400" />
          AI 智能解析
        </h2>
        {confidence !== null && (
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            confidence >= 0.85 ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
              : confidence >= 0.6 ? 'bg-ochre-50 dark:bg-ochre-900/20 border-ochre-100 dark:border-ochre-800 text-ochre-700 dark:text-ochre-400'
              : 'bg-risk-50 dark:bg-risk-900/20 border-risk-100 dark:border-risk-800 text-risk-700 dark:text-risk-400'
          }`}>
            置信度 {confidencePct}
          </span>
        )}
      </div>

      {/* 基础信息表格 */}
      {basicRows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-forest-100 dark:border-forest-800 mb-4">
          <table className="w-full text-sm">
            <tbody>
              {basicRows.map((r, i) => (
                <tr key={r.label} className={i % 2 === 0 ? 'bg-cream-50 dark:bg-forest-800/50' : 'bg-white dark:bg-forest-900'}>
                  <th scope="row" className="text-left font-medium text-forest-600 dark:text-cream-300 px-3 py-2 align-top w-1/3 whitespace-nowrap">{r.label}</th>
                  <td className={`px-3 py-2 text-forest-800 dark:text-cream-100 ${r.mono ? 'font-mono' : ''}`}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 求职者评价（醒目展示） */}
      {aiMeta?.jobSeekerVerdict && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-gradient-to-r from-ochre-50 to-cream-50 dark:from-ochre-900/20 dark:to-forest-800/50 border border-ochre-100 dark:border-ochre-800">
          <div className="text-xs font-semibold text-ochre-700 dark:text-ochre-400 mb-1 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" />
            求职者视角评价
          </div>
          <p className="text-sm text-forest-700 dark:text-cream-200 leading-relaxed">{aiMeta.jobSeekerVerdict}</p>
        </div>
      )}

      {/* 增强字段卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* 💰 薪资详情 */}
        <DetailCard
          title="薪资详情"
          icon={Wallet}
          items={[
            { label: '底薪', value: salaryDetails?.baseSalary },
            { label: '提成', value: salaryDetails?.commission },
            { label: '绩效奖金', value: salaryDetails?.performanceBonus },
            { label: '年终奖', value: salaryDetails?.annualBonus },
            { label: '综合收入', value: salaryDetails?.totalRange },
            { label: '其他收入', value: salaryDetails?.otherCompensation },
          ]}
        />

        {/* 📈 业绩指标 */}
        <DetailCard
          title="业绩指标"
          icon={Target}
          items={[
            { label: 'KPI/考核', value: perfMetrics?.kpi },
            { label: '考核周期', value: perfMetrics?.evaluationCycle },
            { label: '未达标影响', value: perfMetrics?.consequences },
          ]}
        />

        {/* 🎓 培训期 */}
        <DetailCard
          title="培训期"
          icon={GraduationCap}
          items={[
            { label: '培训时长', value: trainingPeriod?.duration },
            { label: '培训薪资', value: trainingPeriod?.salary },
            { label: '培训内容', value: trainingPeriod?.content },
          ]}
        />

        {/* ✅ 试用期与转正 */}
        <DetailCard
          title="试用期与转正"
          icon={CheckCircle2}
          items={[
            { label: '试用时长', value: probation?.duration },
            { label: '试用薪资', value: probation?.salary },
            { label: '转正条件', value: probation?.conditions },
            { label: '转正后待遇', value: probation?.postSalary },
          ]}
        />

        {/* 🏖️ 公司福利 */}
        <DetailCard
          title="公司福利"
          icon={Heart}
          items={[
            { label: '五险一金', value: benefits?.socialInsurance },
            { label: '带薪假期', value: benefits?.paidLeave },
            { label: '各类补贴', value: benefits?.allowances },
            { label: '保险', value: benefits?.insurance },
            { label: '餐饮住宿', value: benefits?.meals },
            { label: '团建/体检', value: benefits?.activities },
            { label: '其他福利', value: benefits?.other },
          ]}
        />

        {/* ⏰ 工作生活平衡 */}
        <DetailCard
          title="作息与加班"
          icon={Coffee}
          items={[
            { label: '加班强度', value: wlb?.overtime ? (overtimeLabel[wlb.overtime] || wlb.overtime) : undefined },
            { label: '上下班时间', value: wlb?.schedule },
            { label: '休息安排', value: wlb?.weekdays },
            { label: '弹性工作', value: wlb?.flexibility },
          ]}
        />

        {/* 👥 团队信息 */}
        <DetailCard
          title="团队信息"
          icon={Users}
          items={[
            { label: '团队规模', value: teamInfo?.size },
            { label: '汇报对象', value: teamInfo?.reportTo },
            { label: '下属人数', value: teamInfo?.subordinates },
            { label: '团队架构', value: teamInfo?.structure },
          ]}
        />

        {/* 📈 晋升成长 */}
        <DetailCard
          title="晋升与成长"
          icon={TrendingUp}
          items={[
            { label: '晋升通道', value: growth?.promotion },
            { label: '培训机会', value: growth?.training },
            { label: '学习资源', value: growth?.learning },
          ]}
        />

        {/* 🔍 岗位背景 */}
        <DetailCard
          title="岗位背景"
          icon={HelpCircle}
          items={[
            { label: '招聘原因', value: ctx?.hiringReason ? (hiringLabel[ctx.hiringReason] || ctx.hiringReason) : undefined },
            { label: '紧急程度', value: ctx?.urgency },
            { label: '补充说明', value: ctx?.note },
          ]}
        />

        {/* 🎤 面试流程 */}
        <DetailCard
          title="面试流程"
          icon={Zap}
          items={[
            { label: '面试轮数', value: interview?.rounds },
            { label: '面试形式', value: interview?.format },
            { label: '面试周期', value: interview?.duration },
          ]}
        />

        {/* 🏢 公司信息 */}
        <DetailCard
          title="公司信息"
          icon={Building2}
          items={[
            { label: '公司规模', value: companyInsights?.scale },
            { label: '所属行业', value: companyInsights?.industry },
            { label: '融资阶段', value: companyInsights?.fundingStage },
            { label: '公司亮点', value: companyInsights?.highlights },
          ]}
        />
      </div>

      {/* 关键词标签 */}
      {keywords.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-forest-600 dark:text-cream-300 mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-forest-400" />
            关键词标签
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((k, i) => (
              <span
                key={`${k}-${i}`}
                className="text-xs px-2 py-0.5 rounded-full bg-forest-50 dark:bg-forest-800/60 text-forest-700 dark:text-cream-200 border border-forest-200 dark:border-forest-700"
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 职位亮点 */}
      {highlights.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-forest-600 dark:text-cream-300 mb-2 flex items-center gap-1.5">
            <Sparkle className="w-3.5 h-3.5 text-ochre-500 dark:text-ochre-400" />
            职位亮点
          </h3>
          <ul className="space-y-1">
            {highlights.map((h, i) => (
              <li key={i} className="text-sm text-forest-700 dark:text-cream-200 flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-ochre-500 shrink-0" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 不确定字段警告 */}
      {uncertainFields.length > 0 && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800">
          <div className="text-xs font-semibold text-risk-700 dark:text-risk-400 flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            以下字段 AI 不确定，请人工核对
          </div>
          <div className="flex flex-wrap gap-1">
            {uncertainFields.map((f, i) => (
              <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-white dark:bg-forest-900 text-risk-700 dark:text-risk-400 border border-risk-100 dark:border-risk-800">{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* 原文摘要 */}
      {aiMeta?.rawTextSummary && (
        <div>
          <h3 className="text-xs font-semibold text-forest-600 dark:text-cream-300 mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-forest-400 dark:text-forest-500" />
            AI 原文摘要
          </h3>
          <p className="text-sm text-forest-600 dark:text-cream-300 leading-relaxed bg-cream-50 dark:bg-forest-800/50 border border-forest-100 dark:border-forest-800 rounded-lg px-3 py-2">
            {aiMeta.rawTextSummary}
          </p>
        </div>
      )}
    </section>
  );
}
