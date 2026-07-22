// 跟进管理首页：今日待回访 + 逾期未回访 + 全部回访计划
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  AlertTriangle,
  Plus,
  Sparkles,
  Calendar,
  SkipForward,
  Square,
  Eye,
  Pencil,
  Phone,
  MessageCircle,
  Building2,
  Briefcase,
  Loader2,
} from 'lucide-react';
import dayjs from 'dayjs';
import { followupsApi, getErrorMsg } from '@/lib/api';
import type { FollowupPlan, FollowupPlanStatus } from '@/types';
import Loading from '@/components/Loading';
import { RiskBadge } from '@/components/RiskBadge';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import PlanForm from './PlanForm';
import FollowupModal from './FollowupModal';
import {
  PLAN_TYPE_LABELS,
  PLAN_STATUS_LABELS,
  PLAN_STATUS_TONE_CLASS,
} from './constants';

const PLAN_STATUS_TABS: { value: FollowupPlanStatus; label: string }[] = [
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'stopped', label: '已停止' },
];

export default function FollowupHome() {
  const navigate = useNavigate();

  const [todayPlans, setTodayPlans] = useState<FollowupPlan[]>([]);
  const [overduePlans, setOverduePlans] = useState<FollowupPlan[]>([]);
  const [allPlans, setAllPlans] = useState<FollowupPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStatus, setActiveStatus] = useState<FollowupPlanStatus>('active');

  // 弹窗
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<FollowupPlan | null>(null);
  const [followupPlan, setFollowupPlan] = useState<FollowupPlan | null>(null);

  // 改期
  const [reschedulePlan, setReschedulePlan] = useState<FollowupPlan | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // 跳过 / 停止
  const [skipPlan, setSkipPlan] = useState<FollowupPlan | null>(null);
  const [stoppingPlan, setStoppingPlan] = useState<FollowupPlan | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [today, overdue, all] = await Promise.all([
        followupsApi.today(),
        followupsApi.overdue(),
        followupsApi.listPlans({}),
      ]);
      setTodayPlans(today || []);
      setOverduePlans(overdue || []);
      setAllPlans(all || []);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 改期保存
  const handleReschedule = async () => {
    if (!reschedulePlan || !rescheduleDate) return;
    setRescheduling(true);
    try {
      await followupsApi.updatePlan(reschedulePlan.id, { next_remind_date: rescheduleDate });
      setReschedulePlan(null);
      await fetchAll();
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setRescheduling(false);
    }
  };

  // 跳过：推到下个周期；一次性计划则标记 completed
  const handleSkip = async () => {
    if (!skipPlan) return;
    try {
      if (skipPlan.type === 'once') {
        await followupsApi.updatePlan(skipPlan.id, { status: 'completed' });
      } else if (skipPlan.type === 'recurring' && skipPlan.interval_days) {
        const next = dayjs().add(skipPlan.interval_days, 'day').format('YYYY-MM-DD');
        await followupsApi.updatePlan(skipPlan.id, { next_remind_date: next });
      } else if (skipPlan.type === 'custom' && skipPlan.custom_dates?.length) {
        const today = dayjs().format('YYYY-MM-DD');
        const next = [...skipPlan.custom_dates].sort().find((d) => d > today);
        if (next) {
          await followupsApi.updatePlan(skipPlan.id, { next_remind_date: next });
        } else {
          await followupsApi.updatePlan(skipPlan.id, { status: 'completed' });
        }
      } else {
        // 兜底：推 7 天
        await followupsApi.updatePlan(skipPlan.id, {
          next_remind_date: dayjs().add(7, 'day').format('YYYY-MM-DD'),
        });
      }
      setSkipPlan(null);
      await fetchAll();
    } catch (err) {
      setError(getErrorMsg(err));
    }
  };

  // 停止计划
  const handleStop = async () => {
    if (!stoppingPlan) return;
    try {
      await followupsApi.updatePlan(stoppingPlan.id, { status: 'stopped' });
      setStoppingPlan(null);
      await fetchAll();
    } catch (err) {
      setError(getErrorMsg(err));
    }
  };

  // 打开改期 Modal
  const openReschedule = (plan: FollowupPlan) => {
    setReschedulePlan(plan);
    setRescheduleDate(
      dayjs(plan.next_remind_date).add(1, 'day').format('YYYY-MM-DD')
    );
  };

  // 打开编辑
  const openEdit = (plan: FollowupPlan) => {
    setEditingPlan(plan);
    setPlanFormOpen(true);
  };

  // 打开新建
  const openCreate = () => {
    setEditingPlan(null);
    setPlanFormOpen(true);
  };

  // 计划保存后刷新
  const handlePlanSaved = async () => {
    setPlanFormOpen(false);
    setEditingPlan(null);
    await fetchAll();
  };

  // 回访完成后刷新
  const handleRecorded = async () => {
    await fetchAll();
  };

  // 过滤当前 Tab 的计划
  const filteredPlans = allPlans.filter((p) => p.status === activeStatus);

  if (loading) return <Loading className="py-20" />;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      {/* 顶部标题 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100 flex items-center gap-2">
            <Clock className="w-6 h-6 text-ochre-500" />
            跟进管理
          </h1>
          <p className="text-sm text-forest-500 dark:text-cream-300 mt-1">
            按回访计划持续触达求职者，AI 自动生成作战卡片与深度分析报告
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-1">
          <Plus className="w-4 h-4" />
          新建回访计划
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400">
          {error}
        </div>
      )}

      {/* Section 1: 今日待回访 */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-ochre-500" />
          <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100">
            今日待回访 ({todayPlans.length})
          </h2>
        </div>

        {todayPlans.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-sm text-forest-500 dark:text-cream-300">今天没有待回访的求职者</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {todayPlans.map((plan) => (
              <TodayCard
                key={plan.id}
                plan={plan}
                onStart={() => setFollowupPlan(plan)}
                onReschedule={() => openReschedule(plan)}
                onSkip={() => setSkipPlan(plan)}
                onView={() => navigate(`/followups/${plan.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 2: 逾期未回访（仅有数据时显示） */}
      {overduePlans.length > 0 && (
        <section className="mb-6">
          <div className="rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-200 dark:border-risk-800 px-4 py-3 mb-3">
            <div className="flex items-center gap-2 text-risk-700 dark:text-risk-400 font-medium">
              <AlertTriangle className="w-5 h-5" />
              <span>⚠️ 逾期未回访 ({overduePlans.length})</span>
            </div>
          </div>
          <div className="card divide-y divide-forest-100 dark:divide-forest-800">
            {overduePlans.map((plan) => (
              <OverdueRow
                key={plan.id}
                plan={plan}
                onStart={() => setFollowupPlan(plan)}
                onReschedule={() => openReschedule(plan)}
                onStop={() => setStoppingPlan(plan)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section 3: 全部回访计划 */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="w-5 h-5 text-forest-600" />
          <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100">全部回访计划</h2>
        </div>

        <div className="card">
          {/* Tab 切换 */}
          <div className="flex items-center border-b border-forest-100 dark:border-forest-800">
            {PLAN_STATUS_TABS.map((tab) => {
              const count = allPlans.filter((p) => p.status === tab.value).length;
              const active = activeStatus === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveStatus(tab.value)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    active
                      ? 'border-forest-500 text-forest-800 dark:text-cream-100'
                      : 'border-transparent text-forest-500 dark:text-cream-300 hover:text-forest-700 dark:hover:text-cream-100'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1 text-xs text-forest-400 dark:text-forest-500">({count})</span>
                </button>
              );
            })}
          </div>

          {/* 表格 */}
          {filteredPlans.length === 0 ? (
            <div className="py-10 text-center text-sm text-forest-400 dark:text-forest-500">
              {activeStatus === 'active'
                ? '暂无进行中的回访计划，点击右上角「新建回访计划」开始'
                : `暂无${PLAN_STATUS_LABELS[activeStatus]}的计划`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-forest-500 dark:text-cream-300 border-b border-forest-100 dark:border-forest-800 bg-cream-50 dark:bg-forest-800">
                    <th className="px-4 py-2.5 font-medium">求职者</th>
                    <th className="px-4 py-2.5 font-medium">类型</th>
                    <th className="px-4 py-2.5 font-medium">下次回访</th>
                    <th className="px-4 py-2.5 font-medium">已回访 X/Y</th>
                    <th className="px-4 py-2.5 font-medium">状态</th>
                    <th className="px-4 py-2.5 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-100 dark:divide-forest-800">
                  {filteredPlans.map((plan) => {
                    const maxTimes = plan.max_times ?? '—';
                    return (
                      <tr key={plan.id} className="hover:bg-cream-50/50 dark:hover:bg-forest-800/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-forest-800 dark:text-cream-100">
                              {plan.resume?.name || '—'}
                            </span>
                            <RiskBadge risk={plan.resume?.risk_warning} />
                          </div>
                          <div className="text-xs text-forest-400 dark:text-forest-500 mt-0.5 truncate max-w-[180px]">
                            {plan.title}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-forest-600 dark:text-cream-300">
                          {PLAN_TYPE_LABELS[plan.type]}
                        </td>
                        <td className="px-4 py-3 text-forest-600 dark:text-cream-300">
                          {plan.next_remind_date
                            ? dayjs(plan.next_remind_date).format('YYYY-MM-DD')
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-forest-600 dark:text-cream-300">
                          {plan.completed_times} / {maxTimes}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`badge ${PLAN_STATUS_TONE_CLASS[plan.status]}`}
                          >
                            {PLAN_STATUS_LABELS[plan.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/followups/${plan.id}`)}
                              className="btn-ghost text-xs flex items-center gap-0.5"
                              title="查看"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {plan.status === 'active' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setFollowupPlan(plan)}
                                  className="btn-ai text-xs flex items-center gap-0.5 px-2.5 py-1"
                                  title="立即回访"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  回访
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEdit(plan)}
                                  className="btn-ghost text-xs flex items-center gap-0.5"
                                  title="编辑"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStoppingPlan(plan)}
                                  className="btn-ghost text-xs text-risk-600 dark:text-risk-400 hover:bg-risk-50 dark:hover:bg-risk-900/20 flex items-center gap-0.5"
                                  title="停止计划"
                                >
                                  <Square className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ===== Modals ===== */}

      {/* 新建/编辑计划 */}
      <PlanForm
        open={planFormOpen}
        onClose={() => {
          setPlanFormOpen(false);
          setEditingPlan(null);
        }}
        plan={editingPlan}
        onSaved={handlePlanSaved}
      />

      {/* 回访操作 Modal */}
      {followupPlan && (
        <FollowupModal
          open={!!followupPlan}
          plan={followupPlan}
          onClose={() => setFollowupPlan(null)}
          onRecorded={handleRecorded}
        />
      )}

      {/* 改期 Modal */}
      <Modal
        open={!!reschedulePlan}
        title="改期下次回访"
        onClose={() => setReschedulePlan(null)}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setReschedulePlan(null)}
              disabled={rescheduling}
            >
              取消
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-1 disabled:opacity-60"
              disabled={rescheduling || !rescheduleDate}
              onClick={handleReschedule}
            >
              {rescheduling && <Loader2 className="w-4 h-4 animate-spin" />}
              {rescheduling ? '保存中...' : '确认改期'}
            </button>
          </>
        }
      >
        <p className="text-sm text-forest-600 dark:text-cream-300 mb-3">
          当前计划「{reschedulePlan?.title}」的下一次回访日期是：
          <span className="font-medium text-forest-800 dark:text-cream-100">
            {reschedulePlan && dayjs(reschedulePlan.next_remind_date).format('YYYY-MM-DD')}
          </span>
        </p>
        <label className="label">新的下次回访日期</label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400 dark:text-forest-500 pointer-events-none" />
          <input
            type="date"
            className="input pl-9"
            value={rescheduleDate}
            min={dayjs().format('YYYY-MM-DD')}
            onChange={(e) => setRescheduleDate(e.target.value)}
          />
        </div>
      </Modal>

      {/* 跳过确认 */}
      <ConfirmDialog
        open={!!skipPlan}
        title="跳过本次回访"
        message={
          skipPlan
            ? skipPlan.type === 'once'
              ? `一次性计划「${skipPlan.title}」跳过后将标记为已完成，确认跳过？`
              : `跳过后下次回访日期将自动顺延，确认跳过「${skipPlan.title}」本次回访？`
            : ''
        }
        confirmText="确认跳过"
        danger
        onConfirm={handleSkip}
        onCancel={() => setSkipPlan(null)}
      />

      {/* 停止计划确认 */}
      <ConfirmDialog
        open={!!stoppingPlan}
        title="停止回访计划"
        message={
          stoppingPlan
            ? `确认停止计划「${stoppingPlan.title}」吗？停止后将不再生成回访提醒，可在列表中重新激活。`
            : ''
        }
        confirmText="确认停止"
        danger
        onConfirm={handleStop}
        onCancel={() => setStoppingPlan(null)}
      />
    </div>
  );
}

// ===== 今日待回访卡片 =====
function TodayCard({
  plan,
  onStart,
  onReschedule,
  onSkip,
  onView,
}: {
  plan: FollowupPlan;
  onStart: () => void;
  onReschedule: () => void;
  onSkip: () => void;
  onView: () => void;
}) {
  const resume = plan.resume;
  const contactInfo = resume?.wechat_id || resume?.phone_masked || '—';
  return (
    <div className="card p-4 flex flex-col">
      {/* 顶部：姓名 + 风险 */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          type="button"
          onClick={onView}
          className="font-medium text-forest-800 dark:text-cream-100 hover:text-forest-600 dark:hover:text-cream-200 truncate"
        >
          {resume?.name || '—'}
        </button>
        <RiskBadge risk={resume?.risk_warning} />
      </div>

      {/* 联系方式 */}
      <div className="flex items-center gap-1.5 text-xs text-forest-500 dark:text-cream-300 mb-2">
        {resume?.wechat_id ? (
          <MessageCircle className="w-3 h-3" />
        ) : (
          <Phone className="w-3 h-3" />
        )}
        <span className="font-mono truncate">{contactInfo}</span>
      </div>

      {/* 职位信息 */}
      {resume?.current_company && (
        <div className="flex items-center gap-1.5 text-xs text-forest-500 dark:text-cream-300 mb-2">
          <Building2 className="w-3 h-3" />
          <span className="truncate">{resume.current_company}</span>
          {resume.current_title && <span>· {resume.current_title}</span>}
        </div>
      )}

      {/* 已回访天数/次数 + 目的 */}
      <div className="text-xs text-forest-400 dark:text-forest-500 mb-2">
        <span>已回访 {plan.completed_times} 次</span>
        {plan.max_times && <span> / 上限 {plan.max_times}</span>}
      </div>
      {plan.purpose && (
        <div className="text-xs text-forest-600 dark:text-cream-300 bg-cream-50 dark:bg-forest-800/50 rounded p-2 mb-3 line-clamp-2">
          🎯 {plan.purpose}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2 border-t border-forest-100 dark:border-forest-800">
        <button
          type="button"
          onClick={onStart}
          className="btn-ai text-xs flex items-center gap-1 px-2.5 py-1.5 flex-1 justify-center"
        >
          <Sparkles className="w-3.5 h-3.5" />
          开始回访
        </button>
        <button
          type="button"
          onClick={onReschedule}
          className="btn-secondary text-xs flex items-center gap-1 px-2 py-1.5"
        >
          <Calendar className="w-3.5 h-3.5" />
          改期
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="btn-ghost text-xs flex items-center gap-1 px-2 py-1.5"
        >
          <SkipForward className="w-3.5 h-3.5" />
          跳过
        </button>
      </div>
    </div>
  );
}

// ===== 逾期未回访行 =====
function OverdueRow({
  plan,
  onStart,
  onReschedule,
  onStop,
}: {
  plan: FollowupPlan;
  onStart: () => void;
  onReschedule: () => void;
  onStop: () => void;
}) {
  const overdueDays = dayjs().diff(dayjs(plan.next_remind_date), 'day');
  return (
    <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-forest-800 dark:text-cream-100">{plan.resume?.name || '—'}</span>
          <RiskBadge risk={plan.resume?.risk_warning} />
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-risk-100 dark:bg-risk-900/20 text-risk-700 dark:text-risk-400">
          逾期 {overdueDays} 天
        </span>
        <span className="text-xs text-forest-500 dark:text-cream-300 truncate">
          应回访：{dayjs(plan.next_remind_date).format('YYYY-MM-DD')}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onStart}
          className="btn-ai text-xs flex items-center gap-1 px-2.5 py-1"
        >
          <Sparkles className="w-3 h-3" />
          立即回访
        </button>
        <button
          type="button"
          onClick={onReschedule}
          className="btn-secondary text-xs flex items-center gap-1 px-2 py-1"
        >
          <Calendar className="w-3 h-3" />
          改期
        </button>
        <button
          type="button"
          onClick={onStop}
          className="btn-ghost text-xs text-risk-600 dark:text-risk-400 hover:bg-risk-50 dark:hover:bg-risk-900/20 flex items-center gap-1 px-2 py-1"
        >
          <Square className="w-3 h-3" />
          停止
        </button>
      </div>
    </div>
  );
}
