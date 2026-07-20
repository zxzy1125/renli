// 回访操作弹窗（核心）：3 Tab = AI 作战卡片 / 录入回访 / AI 分析
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Target,
  MessageSquare,
  HelpCircle,
  TrendingUp,
  Lightbulb,
  Calendar,
  Save,
  ClipboardList,
  ChevronRight,
} from 'lucide-react';
import dayjs from 'dayjs';
import { aiApi, followupsApi, getErrorMsg } from '@/lib/api';
import type {
  FollowupPlan,
  FollowupRecord,
  FollowupResult,
  PitchChannel,
  Position,
  PostFollowupAnalysis,
  PreFollowupAnalysis,
} from '@/types';
import Modal from '@/components/Modal';
import { positionsApi } from '@/lib/api';
import {
  CHANNEL_LABELS,
  FOLLOWUP_RESULT_LABELS,
  FOLLOWUP_RESULT_TONE_CLASS,
  NEXT_ACTION_OPTIONS,
  PITCH_CHANNELS,
  probabilityColorClass,
  probabilityLevel,
  priorityLabel,
  priorityToneClass,
  strengthToneClass,
} from './constants';

interface FollowupModalProps {
  open: boolean;
  onClose: () => void;
  plan: FollowupPlan;
  // 完成回访后回调（让父组件刷新数据）
  onRecorded?: (record: FollowupRecord) => void;
}

type TabKey = 'card' | 'form' | 'analysis';

const RESULT_OPTIONS: { value: FollowupResult; label: string }[] = (
  Object.keys(FOLLOWUP_RESULT_LABELS) as FollowupResult[]
).map((v) => ({ value: v, label: FOLLOWUP_RESULT_LABELS[v] }));

const CHANNEL_OPTIONS: { value: PitchChannel; label: string }[] = (
  Object.keys(CHANNEL_LABELS) as PitchChannel[]
).map((v) => ({ value: v, label: CHANNEL_LABELS[v] }));

export default function FollowupModal({ open, onClose, plan, onRecorded }: FollowupModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('card');

  // Tab 1: AI 作战卡片
  const [preAnalysis, setPreAnalysis] = useState<PreFollowupAnalysis | null>(null);
  const [preLoading, setPreLoading] = useState(false);
  const [preError, setPreError] = useState('');

  // Tab 2: 录入回访
  const [form, setForm] = useState({
    contact_channel: 'wechat' as PitchChannel,
    result: 'reached' as FollowupResult,
    introduced_positions: [] as string[],
    note: '',
    next_action: 'continue',
    next_followup_date: dayjs().add(5, 'day').format('YYYY-MM-DD'),
  });
  const [positions, setPositions] = useState<Position[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [createdRecord, setCreatedRecord] = useState<FollowupRecord | null>(null);

  // Tab 3: AI 深度分析
  const [postAnalysis, setPostAnalysis] = useState<PostFollowupAnalysis | null>(null);
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState('');

  // 应对话术生成
  const [pitchModalOpen, setPitchModalOpen] = useState(false);
  const [pitchLoading, setPitchLoading] = useState(false);
  const [currentConcern, setCurrentConcern] = useState('');
  const [pitches, setPitches] = useState<{ wechat: string; phone: string; platform: string } | null>(
    null
  );

  // toast
  const [toast, setToast] = useState('');

  // 复制状态记录（哪个渠道已复制）
  const [copiedChannel, setCopiedChannel] = useState<PitchChannel | 'all' | null>(null);

  // 用于阻止组件卸载后 setState
  const mountedRef = useRef(true);

  // 拉取 AI 作战卡片
  const fetchPreAnalysis = useCallback(async () => {
    if (!plan?.id) return;
    setPreLoading(true);
    setPreError('');
    setPreAnalysis(null);
    try {
      const r = await aiApi.preFollowup(plan.id);
      if (!mountedRef.current) return;
      setPreAnalysis(r);
    } catch (err) {
      if (mountedRef.current) setPreError(getErrorMsg(err));
    } finally {
      if (mountedRef.current) setPreLoading(false);
    }
  }, [plan?.id]);

  // 弹窗打开时自动拉取作战卡片
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (open) {
      // 重置状态
      setActiveTab('card');
      setPreAnalysis(null);
      setPreError('');
      setCreatedRecord(null);
      setPostAnalysis(null);
      setPostError('');
      setForm({
        contact_channel: 'wechat' as PitchChannel,
        result: 'reached' as FollowupResult,
        introduced_positions: [],
        note: '',
        next_action: 'continue',
        next_followup_date: dayjs().add(5, 'day').format('YYYY-MM-DD'),
      });
      // 拉取关联职位
      if (plan.position_ids && plan.position_ids.length > 0) {
        Promise.all(plan.position_ids.map((id) => positionsApi.get(id).catch(() => null)))
          .then((list) => {
            if (!mountedRef.current) return;
            setPositions(list.filter(Boolean) as Position[]);
          })
          .catch(() => {});
      } else {
        setPositions([]);
      }
      fetchPreAnalysis();
    }
  }, [open, plan, fetchPreAnalysis]);

  // toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  // 复制文本
  const handleCopy = async (text: string, channel?: PitchChannel | 'all') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setToast('已复制');
      if (channel) {
        setCopiedChannel(channel);
        setTimeout(() => setCopiedChannel(null), 1500);
      }
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setToast('已复制');
    }
  };

  // 复制全部话术
  const buildAllPitchesText = () => {
    if (!pitches) return '';
    return PITCH_CHANNELS.map((ch) => `=== ${CHANNEL_LABELS[ch]} ===\n${pitches[ch]}`).join('\n\n');
  };

  const handleCopyAll = async () => {
    const text = buildAllPitchesText();
    if (!text) return;
    await handleCopy(text, 'all');
  };

  // Tab 2: 切换职位选中
  const togglePosition = (id: string) => {
    setForm((prev) => ({
      ...prev,
      introduced_positions: prev.introduced_positions.includes(id)
        ? prev.introduced_positions.filter((p) => p !== id)
        : [...prev.introduced_positions, id],
    }));
  };

  // Tab 2: 保存回访记录
  const handleSubmitRecord = async () => {
    if (!form.note.trim()) {
      setFormError('请填写回访记录（沟通内容）');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const record = await followupsApi.createRecord({
        plan_id: plan.id,
        resume_id: plan.resume_id,
        followup_date: dayjs().format('YYYY-MM-DD'),
        contact_channel: form.contact_channel,
        result: form.result,
        note: form.note.trim(),
        introduced_positions: form.introduced_positions,
        next_action: form.next_action,
      });
      if (!mountedRef.current) return;
      setCreatedRecord(record);
      onRecorded?.(record);
      setToast('回访记录已保存');
      // 自动切换到 Tab 3 并触发 AI 分析
      setActiveTab('analysis');
      fetchPostAnalysis(record.id);
    } catch (err) {
      if (mountedRef.current) setFormError(getErrorMsg(err));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  // Tab 3: 拉取 AI 深度分析
  const fetchPostAnalysis = useCallback(async (recordId: string) => {
    setPostLoading(true);
    setPostError('');
    setPostAnalysis(null);
    try {
      const r = await aiApi.postFollowup(recordId);
      if (!mountedRef.current) return;
      setPostAnalysis(r);
    } catch (err) {
      if (mountedRef.current) setPostError(getErrorMsg(err));
    } finally {
      if (mountedRef.current) setPostLoading(false);
    }
  }, []);

  // 重新生成深度分析
  const handleReAnalyze = () => {
    if (!createdRecord) return;
    fetchPostAnalysis(createdRecord.id);
  };

  // 一键生成应对话术
  const handleGeneratePitch = async (concern: string, strategy?: string) => {
    if (!createdRecord) return;
    setCurrentConcern(concern);
    setPitches(null);
    setPitchModalOpen(true);
    setPitchLoading(true);
    try {
      const r = await aiApi.concernPitch(createdRecord.id, concern, strategy);
      if (!mountedRef.current) return;
      setPitches(r);
    } catch (err) {
      if (mountedRef.current) {
        setPitchLoading(false);
        setToast(getErrorMsg(err));
      }
    } finally {
      if (mountedRef.current) setPitchLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-ochre-500" />
          <span>回访操作 · {plan.title}</span>
        </div>
      }
      onClose={onClose}
      size="xl"
      className="max-h-[92vh]"
    >
      {/* toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg bg-forest-800 text-cream-50 text-sm shadow-cardHover">
          {toast}
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex items-center gap-1 mb-4 border-b border-forest-100">
        <TabButton
          active={activeTab === 'card'}
          onClick={() => setActiveTab('card')}
          icon={<Sparkles className="w-3.5 h-3.5" />}
          label="AI 作战卡片"
        />
        <TabButton
          active={activeTab === 'form'}
          onClick={() => setActiveTab('form')}
          icon={<ClipboardList className="w-3.5 h-3.5" />}
          label="录入回访"
        />
        <TabButton
          active={activeTab === 'analysis'}
          onClick={() => setActiveTab('analysis')}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="AI 分析"
          disabled={!createdRecord}
          hint={!createdRecord ? '需先录入回访' : undefined}
        />
      </div>

      {/* Tab 1: AI 作战卡片 */}
      {activeTab === 'card' && (
        <div>
          <div className="mb-3 px-3 py-2 rounded-lg bg-ochre-50 border border-ochre-100 text-xs text-ochre-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            此卡片供参考，请结合实际情况灵活运用
          </div>

          {preLoading && (
            <AILoading text="AI 正在生成回访作战卡片..." subText="深度画像 + 顾虑预判 + 3 套开场话术，预计 5-15 秒" />
          )}

          {preError && !preLoading && (
            <div className="py-8 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-risk-500" />
              <p className="text-sm text-risk-700 mb-3">{preError}</p>
              <button type="button" className="btn-secondary" onClick={fetchPreAnalysis}>
                <RefreshCw className="w-4 h-4 mr-1 inline" /> 重新生成
              </button>
            </div>
          )}

          {preAnalysis && !preLoading && (
            <div className="space-y-3">
              {/* 求职者画像速览 */}
              <CardBlock title="求职者画像速览" icon={<Target className="w-4 h-4" />}>
                <p className="text-sm text-forest-700 leading-relaxed whitespace-pre-wrap">
                  {preAnalysis.profileSummary}
                </p>
              </CardBlock>

              {/* 本次回访目标 */}
              <CardBlock title="本次回访目标" icon={<Target className="w-4 h-4" />}>
                {preAnalysis.followupGoals?.length ? (
                  <ol className="list-decimal pl-5 text-sm text-forest-700 space-y-1">
                    {preAnalysis.followupGoals.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-forest-400">暂无</p>
                )}
              </CardBlock>

              {/* 预判的求职者顾虑 */}
              <CardBlock
                title="预判的求职者顾虑"
                icon={<AlertTriangle className="w-4 h-4" />}
                tone="ochre"
              >
                {preAnalysis.predictedConcerns?.length ? (
                  <ol className="list-decimal pl-5 text-sm text-forest-700 space-y-1">
                    {preAnalysis.predictedConcerns.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-forest-400">暂无</p>
                )}
              </CardBlock>

              {/* 推荐开场话术 */}
              <CardBlock
                title="推荐开场话术（3 选 1）"
                icon={<MessageSquare className="w-4 h-4" />}
                tone="ochre"
              >
                <div className="space-y-2">
                  {preAnalysis.openingScripts?.map((s, i) => {
                    const seq = ['①', '②', '③'][i] || `(${i + 1})`;
                    return (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-cream-50 border border-forest-100"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="text-xs font-medium text-ochre-700">
                            {seq} {s.type}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(s.content)}
                            className="text-xs text-forest-500 hover:text-forest-700 flex items-center gap-0.5 flex-shrink-0"
                          >
                            <Copy className="w-3 h-3" /> 复制
                          </button>
                        </div>
                        <p className="text-sm text-forest-800 whitespace-pre-wrap leading-relaxed">
                          {s.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardBlock>

              {/* 推荐提问 */}
              <CardBlock title="推荐提问" icon={<HelpCircle className="w-4 h-4" />}>
                {preAnalysis.recommendedQuestions?.length ? (
                  <ul className="space-y-1 text-sm text-forest-700">
                    {preAnalysis.recommendedQuestions.map((q, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-forest-400">•</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-forest-400">暂无</p>
                )}
              </CardBlock>

              {/* 转化可能性预判 */}
              <CardBlock title="转化可能性预判" icon={<TrendingUp className="w-4 h-4" />}>
                <div className="flex items-baseline gap-3 mb-2">
                  <span
                    className={`font-mono font-bold text-3xl ${probabilityColorClass(
                      preAnalysis.conversionProbability
                    )}`}
                  >
                    {preAnalysis.conversionProbability}%
                  </span>
                  <span className="text-sm text-forest-500">
                    （{probabilityLevel(preAnalysis.conversionProbability).label}）
                  </span>
                </div>
                {preAnalysis.strategy && (
                  <div className="mt-2 p-3 rounded-lg bg-forest-50 border border-forest-100">
                    <div className="text-xs text-forest-600 mb-1 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5" /> 建议策略
                    </div>
                    <p className="text-sm text-forest-700 leading-relaxed whitespace-pre-wrap">
                      {preAnalysis.strategy}
                    </p>
                  </div>
                )}
              </CardBlock>

              {/* 重新生成 */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={fetchPreAnalysis}
                  disabled={preLoading}
                  className="btn-ghost text-ochre-600 flex items-center gap-1 text-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> 重新生成
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: 录入回访 */}
      {activeTab === 'form' && (
        <div className="space-y-4">
          {formError && (
            <div className="px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="联系渠道">
              <select
                className="input"
                value={form.contact_channel}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, contact_channel: e.target.value as PitchChannel }))
                }
              >
                {CHANNEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="联系结果">
              <select
                className="input"
                value={form.result}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, result: e.target.value as FollowupResult }))
                }
              >
                {RESULT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* 本次介绍了哪些职位 */}
          <Field label="本次介绍了哪些职位（可选）">
            {positions.length === 0 ? (
              <p className="text-xs text-forest-400">该计划未关联职位，无需选择</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {positions.map((p) => {
                  const checked = form.introduced_positions.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePosition(p.id)}
                      className={`px-2.5 py-1 rounded text-xs border transition-all ${
                        checked
                          ? 'bg-forest-100 text-forest-700 border-forest-400'
                          : 'bg-white text-forest-600 border-forest-200 hover:border-forest-400'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3 inline mr-0.5" />}
                      {p.title}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          <Field label="回访记录" required>
            <textarea
              className="input min-h-[120px]"
              placeholder="请详细填写沟通内容：求职者反应、关心的点、双方讨论的关键信息..."
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            />
            <p className="text-xs text-forest-400 mt-1">
              建议越详细越好，AI 会基于此生成深度分析报告
            </p>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="下一步动作">
              <select
                className="input"
                value={form.next_action}
                onChange={(e) => setForm((prev) => ({ ...prev, next_action: e.target.value }))}
              >
                {NEXT_ACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="下次回访时间">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400 pointer-events-none" />
                <input
                  type="date"
                  className="input pl-9"
                  value={form.next_followup_date}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, next_followup_date: e.target.value }))
                  }
                />
              </div>
            </Field>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSubmitRecord}
              disabled={saving}
              className="btn-primary flex items-center gap-1 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? '保存中...' : '保存并生成 AI 分析'}
            </button>
          </div>

          {createdRecord && (
            <div className="mt-2 p-3 rounded-lg bg-forest-50 border border-forest-100 text-sm text-forest-700 flex items-center gap-2">
              <Check className="w-4 h-4 text-forest-600" />
              <span>已保存回访记录，AI 深度分析正在生成中...</span>
              <button
                type="button"
                onClick={() => setActiveTab('analysis')}
                className="ml-auto text-xs text-forest-600 hover:text-forest-800 flex items-center gap-0.5"
              >
                查看 <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: AI 分析 */}
      {activeTab === 'analysis' && (
        <div>
          {!createdRecord && (
            <div className="py-12 text-center">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 text-forest-300" />
              <p className="text-sm text-forest-500 mb-2">请先在「录入回访」Tab 填写并保存</p>
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className="btn-secondary text-sm"
              >
                去录入
              </button>
            </div>
          )}

          {createdRecord && postLoading && (
            <AILoading text="AI 正在深度分析..." subText="解析顾虑 + 跟进策略 + 转化概率更新，预计 5-15 秒" />
          )}

          {createdRecord && postError && !postLoading && (
            <div className="py-8 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-risk-500" />
              <p className="text-sm text-risk-700 mb-3">{postError}</p>
              <button type="button" className="btn-secondary" onClick={handleReAnalyze}>
                <RefreshCw className="w-4 h-4 mr-1 inline" /> 重新分析
              </button>
            </div>
          )}

          {createdRecord && postAnalysis && !postLoading && (
            <div className="space-y-3">
              {/* 员工回访记录原始 */}
              <CardBlock title="员工回访记录（原始）" icon={<ClipboardList className="w-4 h-4" />}>
                <p className="text-sm text-forest-700 leading-relaxed whitespace-pre-wrap bg-cream-50 p-3 rounded-lg border border-forest-100">
                  {createdRecord.note || '（无记录）'}
                </p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-forest-500">
                  <span>渠道：{CHANNEL_LABELS[createdRecord.contact_channel || 'wechat']}</span>
                  <span>·</span>
                  <span>
                    结果：
                    <span
                      className={`badge ml-1 ${
                        FOLLOWUP_RESULT_TONE_CLASS[createdRecord.result || 'other']
                      }`}
                    >
                      {FOLLOWUP_RESULT_LABELS[createdRecord.result || 'other']}
                    </span>
                  </span>
                  <span>·</span>
                  <span>{dayjs(createdRecord.followup_date).format('YYYY-MM-DD')}</span>
                </div>
              </CardBlock>

              {/* AI 顾虑解析 */}
              <CardBlock
                title="AI 顾虑解析"
                icon={<AlertTriangle className="w-4 h-4" />}
                tone="ochre"
              >
                {postAnalysis.concerns?.length ? (
                  <div className="space-y-3">
                    {postAnalysis.concerns.map((c, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-cream-50 border border-forest-100"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="text-sm font-medium text-forest-800">
                            顾虑{i + 1}：{c.concern}
                          </div>
                          <span className={`badge ${strengthToneClass(c.strength)} flex-shrink-0`}>
                            {c.strength}
                          </span>
                        </div>
                        <p className="text-sm text-forest-700 leading-relaxed mt-1">
                          <span className="text-forest-500">分析：</span>
                          {c.analysis}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-forest-400">暂未识别明显顾虑</p>
                )}
              </CardBlock>

              {/* 跟进策略建议 */}
              <CardBlock
                title="跟进策略建议"
                icon={<Lightbulb className="w-4 h-4" />}
                tone="ochre"
              >
                {postAnalysis.strategies?.length ? (
                  <div className="space-y-3">
                    {postAnalysis.strategies.map((s, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-cream-50 border border-forest-100"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="text-sm font-medium text-forest-800">
                            策略{i + 1}：{s.strategy}
                          </div>
                          <span className={`badge ${priorityToneClass(s.priority)} flex-shrink-0`}>
                            {priorityLabel(s.priority)}
                          </span>
                        </div>
                        {s.actions?.length > 0 && (
                          <ul className="space-y-1 text-sm text-forest-700">
                            {s.actions.map((a, j) => (
                              <li key={j} className="flex items-start gap-1.5">
                                <span className="text-forest-400">•</span>
                                <span>{a}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-forest-400">暂无策略建议</p>
                )}
              </CardBlock>

              {/* 转化可能性更新 */}
              <CardBlock title="转化可能性更新" icon={<TrendingUp className="w-4 h-4" />}>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-lg text-forest-500">
                    {postAnalysis.conversionProbability + (postAnalysis.probabilityChange || 0)}%
                  </span>
                  <ChevronRight className="w-4 h-4 text-forest-400" />
                  <span
                    className={`font-mono font-bold text-3xl ${probabilityColorClass(
                      postAnalysis.conversionProbability
                    )}`}
                  >
                    {postAnalysis.conversionProbability}%
                  </span>
                  {postAnalysis.probabilityChange !== 0 && (
                    <span
                      className={`text-sm ${
                        postAnalysis.probabilityChange > 0
                          ? 'text-forest-600'
                          : 'text-risk-600'
                      }`}
                    >
                      {postAnalysis.probabilityChange > 0 ? '↑' : '↓'}
                      {Math.abs(postAnalysis.probabilityChange)}
                    </span>
                  )}
                </div>
                {postAnalysis.changeReason && (
                  <p className="text-sm text-forest-600 mt-2 leading-relaxed">
                    <span className="text-forest-500">原因：</span>
                    {postAnalysis.changeReason}
                  </p>
                )}
              </CardBlock>

              {/* 下次回访建议 */}
              <CardBlock title="下次回访建议" icon={<Calendar className="w-4 h-4" />}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-forest-500 mb-0.5">建议时间</div>
                    <div className="text-sm font-medium text-forest-800">
                      {postAnalysis.nextFollowup?.suggestedDate
                        ? dayjs(postAnalysis.nextFollowup.suggestedDate).format('YYYY-MM-DD')
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-forest-500 mb-0.5">重点</div>
                    <div className="text-sm text-forest-700">
                      {postAnalysis.nextFollowup?.focus || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-forest-500 mb-0.5">准备物料</div>
                    <div className="text-sm text-forest-700">
                      {postAnalysis.nextFollowup?.preparation?.length
                        ? postAnalysis.nextFollowup.preparation.join('、')
                        : '—'}
                    </div>
                  </div>
                </div>
              </CardBlock>

              {/* 一键生成应对话术 */}
              {postAnalysis.concerns?.length > 0 && (
                <CardBlock
                  title="一键生成应对话术"
                  icon={<MessageSquare className="w-4 h-4" />}
                  tone="ochre"
                >
                  <p className="text-xs text-forest-500 mb-2">
                    针对每个顾虑生成 3 渠道（微信/电话/站内信）应对话术
                  </p>
                  <div className="space-y-2">
                    {postAnalysis.concerns.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleGeneratePitch(c.concern, c.analysis)}
                        className="w-full text-left p-3 rounded-lg border border-ochre-200 bg-ochre-50/50 hover:bg-ochre-50 transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-forest-800">
                            顾虑{i + 1}：{c.concern}
                          </div>
                          <div className="text-xs text-forest-500 mt-0.5">
                            生成针对此顾虑的 3 渠道话术
                          </div>
                        </div>
                        <Sparkles className="w-4 h-4 text-ochre-600 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </CardBlock>
              )}

              {/* 重新分析 */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleReAnalyze}
                  disabled={postLoading}
                  className="btn-ghost text-ochre-600 flex items-center gap-1 text-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> 重新分析
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 应对话术生成 Modal */}
      <Modal
        open={pitchModalOpen}
        title={
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-ochre-500" />
            <span>应对话术 · {currentConcern.slice(0, 30)}{currentConcern.length > 30 ? '...' : ''}</span>
          </div>
        }
        onClose={() => setPitchModalOpen(false)}
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setPitchModalOpen(false)}
            >
              关闭
            </button>
            <button
              type="button"
              className="btn-secondary flex items-center gap-1 disabled:opacity-50"
              disabled={!pitches}
              onClick={handleCopyAll}
            >
              {copiedChannel === 'all' ? (
                <Check className="w-4 h-4 text-forest-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              全部复制
            </button>
          </>
        }
      >
        {pitchLoading && <AILoading text="AI 正在生成应对话术..." subText="3 渠道话术，预计 5-15 秒" />}

        {!pitchLoading && pitches && (
          <div className="space-y-3">
            {PITCH_CHANNELS.map((ch) => (
              <div
                key={ch}
                className="p-3 rounded-lg bg-cream-50 border border-forest-100"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-xs font-medium text-ochre-700">
                    {CHANNEL_LABELS[ch]}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(pitches[ch], ch)}
                    className="text-xs text-forest-500 hover:text-forest-700 flex items-center gap-0.5"
                  >
                    {copiedChannel === ch ? (
                      <>
                        <Check className="w-3 h-3 text-forest-600" /> 已复制
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> 复制
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm text-forest-800 whitespace-pre-wrap leading-relaxed">
                  {pitches[ch]}
                </p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </Modal>
  );
}

// Tab 按钮
function TabButton({
  active,
  onClick,
  icon,
  label,
  disabled,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
        active
          ? 'border-ochre-500 text-forest-800'
          : 'border-transparent text-forest-500 hover:text-forest-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {icon}
      {label}
    </button>
  );
}

// AI 加载占位
function AILoading({ text, subText }: { text: string; subText?: string }) {
  return (
    <div className="py-10 text-center">
      <Sparkles className="w-10 h-10 mx-auto mb-3 text-ochre-500 animate-pulse" />
      <div className="flex items-center justify-center gap-2 text-forest-700 font-medium">
        <Loader2 className="w-4 h-4 animate-spin" />
        {text}
      </div>
      {subText && <p className="text-xs text-forest-400 mt-2">{subText}</p>}
    </div>
  );
}

// 卡片块（带图标标题）
function CardBlock({
  title,
  icon,
  children,
  tone = 'forest',
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: 'forest' | 'ochre';
}) {
  const titleColor = tone === 'ochre' ? 'text-ochre-700' : 'text-forest-700';
  const iconColor = tone === 'ochre' ? 'text-ochre-500' : 'text-forest-500';
  return (
    <div className="rounded-lg border border-forest-100 bg-white p-4">
      <div className={`flex items-center gap-1.5 font-medium text-sm mb-2 ${titleColor}`}>
        <span className={iconColor}>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-risk-600 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
