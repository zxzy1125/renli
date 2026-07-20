// 计划详情页：计划信息 + 求职者/职位卡片 + 回访历史时间轴
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Sparkles,
  Square,
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  GraduationCap,
  Building2,
  Briefcase,
  Clock,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react';
import dayjs from 'dayjs';
import {
  followupsApi,
  positionsApi,
  resumesApi,
  aiApi,
  getErrorMsg,
} from '@/lib/api';
import type {
  FollowupPlan,
  FollowupRecord,
  Position,
  PostFollowupAnalysis,
  Resume,
} from '@/types';
import Loading from '@/components/Loading';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { RiskBanner } from '@/components/RiskBadge';
import PlanForm from './PlanForm';
import FollowupModal from './FollowupModal';
import {
  CHANNEL_LABELS,
  FOLLOWUP_RESULT_LABELS,
  FOLLOWUP_RESULT_TONE_CLASS,
  PLAN_TYPE_LABELS,
  PLAN_STATUS_LABELS,
  PLAN_STATUS_TONE_CLASS,
  probabilityColorClass,
  priorityLabel,
  priorityToneClass,
  strengthToneClass,
} from './constants';

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<FollowupPlan | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [records, setRecords] = useState<FollowupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 弹窗
  const [editOpen, setEditOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [toDelete, setToDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stopping, setStopping] = useState(false);

  // AI 分析查看：record_id → analysis
  const [analysisCache, setAnalysisCache] = useState<Record<string, PostFollowupAnalysis>>({});
  const [analysisLoadingId, setAnalysisLoadingId] = useState<string | null>(null);
  const [analysisErrorId, setAnalysisErrorId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<FollowupRecord | null>(null);

  const fetchPlan = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const p = await followupsApi.getPlan(id);
      setPlan(p);
      if (p.resume_id) {
        try {
          setResume(await resumesApi.get(p.resume_id));
        } catch {
          setResume(p.resume || null);
        }
      }
      if (p.position_ids?.length) {
        const list = await Promise.all(
          p.position_ids.map((pid) => positionsApi.get(pid).catch(() => null))
        );
        setPositions(list.filter(Boolean) as Position[]);
      }
      const recs = await followupsApi.listRecords(p.id);
      setRecords(recs || []);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // 删除计划
  const handleDelete = async () => {
    if (!plan) return;
    setDeleting(true);
    try {
      await followupsApi.removePlan(plan.id);
      navigate('/followups');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setDeleting(false);
    }
  };

  // 停止计划
  const handleStop = async () => {
    if (!plan) return;
    setStopping(true);
    try {
      const updated = await followupsApi.updatePlan(plan.id, { status: 'stopped' });
      setPlan(updated);
      setStopping(false);
    } catch (err) {
      setError(getErrorMsg(err));
      setStopping(false);
    }
  };

  // 查看某条记录的 AI 分析（按需生成 + 缓存）
  const handleViewAnalysis = async (record: FollowupRecord) => {
    setViewingRecord(record);
    if (analysisCache[record.id]) return; // 已缓存
    setAnalysisLoadingId(record.id);
    setAnalysisErrorId(null);
    try {
      const r = await aiApi.postFollowup(record.id);
      setAnalysisCache((prev) => ({ ...prev, [record.id]: r }));
    } catch (err) {
      setAnalysisErrorId(record.id);
      setError(getErrorMsg(err));
    } finally {
      setAnalysisLoadingId(null);
    }
  };

  // 回访完成后刷新
  const handleRecorded = async () => {
    await fetchPlan();
  };

  if (loading) return <Loading className="py-20" />;
  if (error && !plan) {
    return (
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <div className="px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700 mb-4">
          {error}
        </div>
        <Link to="/followups" className="btn-ghost inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 返回跟进管理
        </Link>
      </div>
    );
  }
  if (!plan) {
    return (
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <p className="text-sm text-forest-500">回访计划不存在</p>
        <Link to="/followups" className="btn-ghost inline-flex items-center gap-1 mt-2">
          <ArrowLeft className="w-4 h-4" /> 返回跟进管理
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      {/* 顶部返回 */}
      <div className="flex items-center gap-2 mb-4">
        <Link to="/followups" className="btn-ghost inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 跟进管理
        </Link>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700">
          {error}
        </div>
      )}

      {/* 顶部信息卡 */}
      <div className="card p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-forest-800 flex items-center gap-3">
              {resume?.name || '—'}
              <span
                className={`badge text-sm px-2.5 py-1 ${PLAN_STATUS_TONE_CLASS[plan.status]}`}
              >
                {PLAN_STATUS_LABELS[plan.status]}
              </span>
            </h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-forest-500">
              <span className="font-medium text-forest-700">{plan.title}</span>
              <span className="text-forest-300">·</span>
              <span className="badge bg-cream-100 text-forest-700">
                {PLAN_TYPE_LABELS[plan.type]}
              </span>
              <span className="text-forest-300">·</span>
              <Calendar className="w-3.5 h-3.5" />
              <span>下次回访：{dayjs(plan.next_remind_date).format('YYYY-MM-DD')}</span>
              <span className="text-forest-300">·</span>
              <span>
                已回访 {plan.completed_times}
                {plan.max_times ? ` / ${plan.max_times}` : ''} 次
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {plan.status === 'active' && (
              <button
                type="button"
                onClick={() => setFollowupOpen(true)}
                className="btn-ai flex items-center gap-1"
              >
                <Sparkles className="w-4 h-4" />
                开始回访
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="btn-secondary flex items-center gap-1"
            >
              <Pencil className="w-4 h-4" />
              编辑
            </button>
            {plan.status === 'active' && (
              <button
                type="button"
                onClick={handleStop}
                disabled={stopping}
                className="btn-ghost text-risk-600 hover:bg-risk-50 flex items-center gap-1"
              >
                {stopping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                停止
              </button>
            )}
            <button
              type="button"
              onClick={() => setToDelete(true)}
              className="btn-ghost text-risk-600 hover:bg-risk-50 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          </div>
        </div>

        {/* 计划目的 */}
        {plan.purpose && (
          <div className="text-sm text-forest-700 bg-cream-50 rounded-lg p-3 border border-forest-100">
            <span className="text-forest-500 font-medium">回访目的：</span>
            {plan.purpose}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左：求职者卡片 + 关联职位 */}
        <div className="space-y-4">
          {resume && (
            <section className="card p-5">
              <h2 className="font-serif text-lg font-semibold text-forest-800 mb-3">求职者</h2>
              <RiskBanner risk={resume.risk_warning} className="mb-3" />
              <dl className="space-y-2 text-sm">
                <InfoRow icon={Building2} label="现公司" value={resume.current_company ?? undefined} />
                <InfoRow label="现职位" value={resume.current_title ?? undefined} />
                <InfoRow icon={GraduationCap} label="学历" value={resume.education ?? undefined} />
                <InfoRow icon={Phone} label="手机号" value={resume.phone_masked ?? undefined} mono />
                <InfoRow icon={Mail} label="邮箱" value={resume.email_masked ?? undefined} mono />
                <InfoRow icon={MessageCircle} label="微信号" value={resume.wechat_id ?? undefined} />
              </dl>
              <Link
                to={`/resumes/${resume.id}`}
                className="text-xs text-forest-600 hover:text-forest-800 mt-3 inline-flex items-center gap-1"
              >
                查看简历详情 →
              </Link>
            </section>
          )}

          {/* 关联职位 */}
          <section className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-forest-800 mb-3">
              关联职位 ({positions.length})
            </h2>
            {positions.length === 0 ? (
              <p className="text-sm text-forest-400">未关联职位</p>
            ) : (
              <ul className="space-y-2">
                {positions.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/positions/${p.id}`}
                      className="block p-2.5 rounded-lg border border-forest-100 hover:bg-cream-50 hover:border-forest-300 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 text-sm font-medium text-forest-800">
                        <Briefcase className="w-3.5 h-3.5 text-forest-500" />
                        {p.title}
                      </div>
                      <div className="text-xs text-forest-500 mt-0.5">
                        {p.department || '—'}
                        {p.location && <span> · {p.location}</span>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 计划配置 */}
          <section className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-forest-800 mb-3">计划配置</h2>
            <dl className="space-y-2 text-sm">
              <InfoRow label="计划类型" value={PLAN_TYPE_LABELS[plan.type]} />
              {plan.type === 'once' && plan.remind_date && (
                <InfoRow label="提醒日期" value={dayjs(plan.remind_date).format('YYYY-MM-DD')} />
              )}
              {plan.type === 'recurring' && (
                <>
                  <InfoRow label="间隔天数" value={`${plan.interval_days} 天`} />
                  <InfoRow label="最大次数" value={`${plan.max_times} 次`} />
                </>
              )}
              {plan.type === 'custom' && plan.custom_dates && (
                <InfoRow
                  label="自定义日期"
                  value={plan.custom_dates.map((d) => dayjs(d).format('YYYY-MM-DD')).join('、')}
                />
              )}
              <InfoRow
                label="创建时间"
                value={dayjs(plan.created_at).format('YYYY-MM-DD HH:mm')}
              />
            </dl>
          </section>
        </div>

        {/* 右：回访历史时间轴 */}
        <div className="lg:col-span-2">
          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold text-forest-800">
                回访历史 ({records.length})
              </h2>
              {plan.status === 'active' && (
                <button
                  type="button"
                  onClick={() => setFollowupOpen(true)}
                  className="btn-ai text-xs flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  开始回访
                </button>
              )}
            </div>

            {records.length === 0 ? (
              <div className="py-10 text-center text-sm text-forest-400">
                <Clock className="w-8 h-8 mx-auto mb-2 text-forest-300" />
                还没有回访记录，点击「开始回访」开始第一次跟进
              </div>
            ) : (
              <div className="relative">
                {/* 时间轴竖线 */}
                <div className="absolute left-3 top-2 bottom-2 w-px bg-forest-200" />
                <ul className="space-y-4">
                  {records.map((rec) => (
                    <TimelineItem
                      key={rec.id}
                      record={rec}
                      positions={positions}
                      onViewAnalysis={() => handleViewAnalysis(rec)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ===== Modals ===== */}

      {/* 编辑计划 */}
      <PlanForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        plan={plan}
        onSaved={async (updated) => {
          setEditOpen(false);
          setPlan(updated);
          await fetchPlan();
        }}
      />

      {/* 回访操作 */}
      <FollowupModal
        open={followupOpen}
        plan={plan}
        onClose={() => setFollowupOpen(false)}
        onRecorded={handleRecorded}
      />

      {/* 删除确认 */}
      <ConfirmDialog
        open={toDelete}
        title="删除回访计划"
        message={`确认删除计划「${plan.title}」吗？关联的回访记录将保留但不再属于任何计划，此操作不可撤销。`}
        confirmText={deleting ? '删除中...' : '确认删除'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(false)}
      />

      {/* AI 分析查看 Modal */}
      <Modal
        open={!!viewingRecord}
        title={
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-ochre-500" />
            <span>AI 分析报告 · {viewingRecord && dayjs(viewingRecord.followup_date).format('YYYY-MM-DD')}</span>
          </div>
        }
        onClose={() => setViewingRecord(null)}
        size="lg"
      >
        {viewingRecord && analysisLoadingId === viewingRecord.id && (
          <div className="py-10 text-center">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-ochre-500 animate-pulse" />
            <div className="flex items-center justify-center gap-2 text-forest-700 font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              AI 正在深度分析...
            </div>
            <p className="text-xs text-forest-400 mt-2">预计 5-15 秒</p>
          </div>
        )}

        {viewingRecord && analysisErrorId === viewingRecord.id && (
          <div className="py-8 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-risk-500" />
            <p className="text-sm text-risk-700">分析生成失败，请稍后重试</p>
          </div>
        )}

        {viewingRecord && analysisCache[viewingRecord.id] && (
          <AnalysisContent
            record={viewingRecord}
            analysis={analysisCache[viewingRecord.id]}
          />
        )}
      </Modal>
    </div>
  );
}

// 时间轴单项
function TimelineItem({
  record,
  positions,
  onViewAnalysis,
}: {
  record: FollowupRecord;
  positions: Position[];
  onViewAnalysis: () => void;
}) {
  const introduced = positions.filter((p) => record.introduced_positions?.includes(p.id));
  return (
    <li className="relative pl-10">
      {/* 时间轴节点 */}
      <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-ochre-400 border-2 border-white" />

      <div className="rounded-lg border border-forest-100 bg-white p-3">
        {/* 时间 + 渠道 + 结果 */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs text-forest-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {dayjs(record.followup_date).format('YYYY-MM-DD')}
          </span>
          {record.contact_channel && (
            <span className="badge bg-cream-100 text-forest-700">
              {CHANNEL_LABELS[record.contact_channel]}
            </span>
          )}
          {record.result && (
            <span className={`badge ${FOLLOWUP_RESULT_TONE_CLASS[record.result]}`}>
              {FOLLOWUP_RESULT_LABELS[record.result]}
            </span>
          )}
        </div>

        {/* 回访记录 */}
        {record.note && (
          <p className="text-sm text-forest-700 whitespace-pre-wrap leading-relaxed mb-2">
            {record.note}
          </p>
        )}

        {/* 介绍了哪些职位 */}
        {introduced.length > 0 && (
          <div className="mb-2">
            <div className="text-xs text-forest-500 mb-1">本次介绍了：</div>
            <div className="flex flex-wrap gap-1">
              {introduced.map((p) => (
                <span
                  key={p.id}
                  className="px-2 py-0.5 rounded text-xs bg-forest-50 text-forest-700 border border-forest-200"
                >
                  {p.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 下一步动作 */}
        {record.next_action && (
          <div className="text-xs text-forest-500 mb-2">
            <span className="text-forest-400">下一步：</span>
            {record.next_action}
          </div>
        )}

        {/* 操作 */}
        <div className="flex justify-end pt-1 border-t border-forest-100">
          <button
            type="button"
            onClick={onViewAnalysis}
            className="text-xs text-ochre-600 hover:text-ochre-700 flex items-center gap-1"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            查看 AI 分析
          </button>
        </div>
      </div>
    </li>
  );
}

// AI 分析内容展示（详情页子 Modal）
function AnalysisContent({
  record,
  analysis,
}: {
  record: FollowupRecord;
  analysis: PostFollowupAnalysis;
}) {
  return (
    <div className="space-y-3">
      {/* 原始记录 */}
      <div className="rounded-lg border border-forest-100 p-3">
        <div className="text-xs font-medium text-forest-600 mb-1">📋 员工回访记录（原始）</div>
        <p className="text-sm text-forest-700 whitespace-pre-wrap leading-relaxed">
          {record.note || '（无记录）'}
        </p>
      </div>

      {/* 顾虑解析 */}
      {analysis.concerns?.length > 0 && (
        <div className="rounded-lg border border-ochre-100 p-3 bg-ochre-50/30">
          <div className="text-xs font-medium text-ochre-700 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> 🔍 AI 顾虑解析
          </div>
          <div className="space-y-2">
            {analysis.concerns.map((c, i) => (
              <div key={i} className="text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-forest-800">
                    顾虑{i + 1}：{c.concern}
                  </span>
                  <span className={`badge ${strengthToneClass(c.strength)} flex-shrink-0`}>
                    {c.strength}
                  </span>
                </div>
                <p className="text-forest-700 mt-1 leading-relaxed">
                  <span className="text-forest-500">分析：</span>
                  {c.analysis}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 策略建议 */}
      {analysis.strategies?.length > 0 && (
        <div className="rounded-lg border border-ochre-100 p-3 bg-ochre-50/30">
          <div className="text-xs font-medium text-ochre-700 mb-2 flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5" /> 💡 跟进策略建议
          </div>
          <div className="space-y-2">
            {analysis.strategies.map((s, i) => (
              <div key={i} className="text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-forest-800">
                    策略{i + 1}：{s.strategy}
                  </span>
                  <span className={`badge ${priorityToneClass(s.priority)} flex-shrink-0`}>
                    {priorityLabel(s.priority)}
                  </span>
                </div>
                {s.actions?.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-forest-700">
                    {s.actions.map((a, j) => (
                      <li key={j} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-forest-500 mt-1 flex-shrink-0" />
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 转化概率更新 */}
      <div className="rounded-lg border border-forest-100 p-3">
        <div className="text-xs font-medium text-forest-600 mb-1 flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" /> 📊 转化可能性更新
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-lg text-forest-500">
            {analysis.conversionProbability + (analysis.probabilityChange || 0)}%
          </span>
          <span>→</span>
          <span
            className={`font-mono font-bold text-2xl ${probabilityColorClass(
              analysis.conversionProbability
            )}`}
          >
            {analysis.conversionProbability}%
          </span>
          {analysis.probabilityChange !== 0 && (
            <span
              className={`text-sm ${
                analysis.probabilityChange > 0 ? 'text-forest-600' : 'text-risk-600'
              }`}
            >
              {analysis.probabilityChange > 0 ? '↑' : '↓'}
              {Math.abs(analysis.probabilityChange)}
            </span>
          )}
        </div>
        {analysis.changeReason && (
          <p className="text-sm text-forest-600 mt-1">
            <span className="text-forest-500">原因：</span>
            {analysis.changeReason}
          </p>
        )}
      </div>

      {/* 下次回访建议 */}
      {analysis.nextFollowup && (
        <div className="rounded-lg border border-forest-100 p-3">
          <div className="text-xs font-medium text-forest-600 mb-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> 📅 下次回访建议
          </div>
          <div className="text-sm text-forest-700 space-y-1">
            <div>
              <span className="text-forest-500">时间：</span>
              {analysis.nextFollowup.suggestedDate
                ? dayjs(analysis.nextFollowup.suggestedDate).format('YYYY-MM-DD')
                : '—'}
            </div>
            <div>
              <span className="text-forest-500">重点：</span>
              {analysis.nextFollowup.focus || '—'}
            </div>
            {analysis.nextFollowup.preparation?.length > 0 && (
              <div>
                <span className="text-forest-500">准备物料：</span>
                {analysis.nextFollowup.preparation.join('、')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon?: typeof Phone;
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
