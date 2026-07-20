// 回访计划表单（Modal 形式）：创建/编辑一次性/周期性/自定义计划
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Check,
  X,
  Plus,
  Trash2,
  Calendar,
  Save,
  Loader2,
  Building2,
  Users,
} from 'lucide-react';
import dayjs from 'dayjs';
import { resumesApi, positionsApi, followupsApi, getErrorMsg } from '@/lib/api';
import type { FollowupPlan, FollowupPlanType, Position, Resume } from '@/types';
import Modal from '@/components/Modal';
import Loading from '@/components/Loading';
import { RiskBadge } from '@/components/RiskBadge';
import { PLAN_TYPE_OPTIONS } from './constants';

interface PlanFormProps {
  open: boolean;
  onClose: () => void;
  // 编辑模式时传入现有计划
  plan?: FollowupPlan | null;
  // 来自简历详情页时预选简历
  presetResumeId?: string;
  onSaved: (plan: FollowupPlan) => void;
}

interface FormState {
  resume_id: string;
  title: string;
  type: FollowupPlanType;
  remind_date: string; // 一次性
  interval_days: string; // 周期性
  max_times: string; // 周期性
  custom_dates: string[]; // 自定义
  purpose: string;
  position_ids: string[];
}

const EMPTY_FORM: FormState = {
  resume_id: '',
  title: '',
  type: 'once',
  remind_date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
  interval_days: '7',
  max_times: '5',
  custom_dates: [],
  purpose: '',
  position_ids: [],
};

export default function PlanForm({
  open,
  onClose,
  plan,
  presetResumeId,
  onSaved,
}: PlanFormProps) {
  const isEdit = !!plan;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 简历搜索
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [resKeyword, setResKeyword] = useState('');
  const [resLoading, setResLoading] = useState(false);
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [resumePickerOpen, setResumePickerOpen] = useState(false);

  // 职位搜索
  const [positions, setPositions] = useState<Position[]>([]);
  const [posKeyword, setPosKeyword] = useState('');
  const [posLoading, setPosLoading] = useState(false);
  const [posPickerOpen, setPosPickerOpen] = useState(false);
  const selectedPositions = useMemo(
    () => positions.filter((p) => form.position_ids.includes(p.id)),
    [positions, form.position_ids]
  );

  // 初始化：编辑模式加载 plan，新建模式预选简历
  useEffect(() => {
    if (!open) return;
    if (plan) {
      setForm({
        resume_id: plan.resume_id,
        title: plan.title || '',
        type: plan.type,
        remind_date: plan.remind_date || dayjs().add(1, 'day').format('YYYY-MM-DD'),
        interval_days: plan.interval_days?.toString() || '7',
        max_times: plan.max_times?.toString() || '5',
        custom_dates: plan.custom_dates || [],
        purpose: plan.purpose || '',
        position_ids: plan.position_ids || [],
      });
      // 拉取简历和职位详情
      if (plan.resume_id) {
        resumesApi.get(plan.resume_id).then(setSelectedResume).catch(() => {});
      }
      if (plan.position_ids && plan.position_ids.length > 0) {
        Promise.all(plan.position_ids.map((id) => positionsApi.get(id).catch(() => null)))
          .then((list) => {
            const valid = list.filter(Boolean) as Position[];
            setPositions(valid);
          })
          .catch(() => {});
      }
    } else {
      setForm({
        ...EMPTY_FORM,
        remind_date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
        resume_id: presetResumeId || '',
      });
      setSelectedResume(null);
      setPositions([]);
      if (presetResumeId) {
        resumesApi.get(presetResumeId).then(setSelectedResume).catch(() => {});
      }
    }
    setErrors({});
    setError('');
    setResKeyword('');
    setPosKeyword('');
    setResumePickerOpen(false);
    setPosPickerOpen(false);
  }, [open, plan, presetResumeId]);

  // 拉简历列表
  const fetchResumes = async () => {
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
  };

  // 拉职位列表
  const fetchPositions = async () => {
    setPosLoading(true);
    try {
      const res = await positionsApi.list({
        keyword: posKeyword || undefined,
        status: 'open',
        page: 1,
        pageSize: 30,
      });
      setPositions((prev) => {
        // 合并已选中的（可能不在当前列表）
        const existing = new Map(prev.map((p) => [p.id, p]));
        const merged = [...existing.values()];
        (res.data || []).forEach((p) => {
          if (!existing.has(p.id)) merged.push(p);
        });
        return merged;
      });
    } catch {
      // 忽略
    } finally {
      setPosLoading(false);
    }
  };

  useEffect(() => {
    if (resumePickerOpen) fetchResumes();
  }, [resumePickerOpen, resKeyword]);

  useEffect(() => {
    if (posPickerOpen) fetchPositions();
  }, [posPickerOpen, posKeyword]);

  const update = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  // 计算 next_remind_date
  const computeNextRemind = (): string => {
    if (form.type === 'once') return form.remind_date;
    if (form.type === 'recurring') {
      const days = parseInt(form.interval_days, 10);
      if (!days || days <= 0) return dayjs().add(7, 'day').format('YYYY-MM-DD');
      return dayjs().add(days, 'day').format('YYYY-MM-DD');
    }
    // custom：取第一个未过期的日期
    const today = dayjs().format('YYYY-MM-DD');
    const sorted = [...form.custom_dates].filter(Boolean).sort();
    return sorted.find((d) => d >= today) || sorted[0] || dayjs().add(1, 'day').format('YYYY-MM-DD');
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.resume_id) e.resume_id = '请选择关联简历';
    if (!form.title.trim()) e.title = '请填写计划标题';
    if (form.type === 'once' && !form.remind_date) e.remind_date = '请选择提醒日期';
    if (form.type === 'recurring') {
      const days = parseInt(form.interval_days, 10);
      if (!days || days <= 0) e.interval_days = '间隔天数需为正整数';
      const max = parseInt(form.max_times, 10);
      if (!max || max <= 0) e.max_times = '最大次数需为正整数';
    }
    if (form.type === 'custom') {
      if (!form.custom_dates.filter(Boolean).length) e.custom_dates = '请至少添加一个日期';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      const next_remind_date = computeNextRemind();
      const payload: Partial<FollowupPlan> = {
        resume_id: form.resume_id,
        title: form.title.trim(),
        type: form.type,
        purpose: form.purpose.trim() || null,
        position_ids: form.position_ids,
        next_remind_date,
      };
      if (form.type === 'once') {
        payload.remind_date = form.remind_date;
        payload.interval_days = null;
        payload.max_times = 1;
        payload.custom_dates = [];
      } else if (form.type === 'recurring') {
        payload.interval_days = parseInt(form.interval_days, 10);
        payload.max_times = parseInt(form.max_times, 10);
        payload.remind_date = null;
        payload.custom_dates = [];
      } else {
        payload.custom_dates = form.custom_dates.filter(Boolean).sort();
        payload.remind_date = null;
        payload.interval_days = null;
        payload.max_times = form.custom_dates.length;
      }

      let saved: FollowupPlan;
      if (isEdit && plan) {
        saved = await followupsApi.updatePlan(plan.id, payload);
      } else {
        saved = await followupsApi.createPlan(payload);
      }
      onSaved(saved);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const addCustomDate = () => {
    update('custom_dates', [...form.custom_dates, '']);
  };
  const removeCustomDate = (idx: number) => {
    update('custom_dates', form.custom_dates.filter((_, i) => i !== idx));
  };
  const setCustomDate = (idx: number, val: string) => {
    const next = [...form.custom_dates];
    next[idx] = val;
    update('custom_dates', next);
  };

  const togglePosition = (id: string) => {
    if (form.position_ids.includes(id)) {
      update(
        'position_ids',
        form.position_ids.filter((p) => p !== id)
      );
    } else {
      update('position_ids', [...form.position_ids, id]);
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? '编辑回访计划' : '新建回访计划'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-1 disabled:opacity-60"
            disabled={saving}
            onClick={handleSubmit}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? '保存中...' : '保存'}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* 关联简历 */}
        <Field label="关联简历" required error={errors.resume_id}>
          {selectedResume ? (
            <div className="flex items-center justify-between p-3 rounded-lg border border-forest-200 bg-cream-50">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Users className="w-4 h-4 text-forest-500 flex-shrink-0" />
                <span className="font-medium text-forest-800">{selectedResume.name}</span>
                {selectedResume.current_company && (
                  <span className="text-xs text-forest-500 truncate">
                    · {selectedResume.current_company}
                  </span>
                )}
                <RiskBadge risk={selectedResume.risk_warning} />
              </div>
              {!isEdit && (
                <button
                  type="button"
                  className="text-xs text-forest-500 hover:text-risk-600"
                  onClick={() => {
                    setSelectedResume(null);
                    update('resume_id', '');
                  }}
                >
                  更换
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="input text-left text-forest-400 hover:border-forest-400"
              onClick={() => setResumePickerOpen(true)}
              disabled={isEdit}
            >
              {isEdit ? '不可修改' : '点击选择简历...'}
            </button>
          )}
        </Field>

        {/* 计划标题 */}
        <Field label="计划标题" required error={errors.title}>
          <input
            type="text"
            className="input"
            placeholder="如：3 个月内持续跟进，目标邀面"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
          />
        </Field>

        {/* 计划类型 */}
        <Field label="计划类型" required>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PLAN_TYPE_OPTIONS.map((opt) => {
              const active = form.type === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => update('type', opt.value)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    active
                      ? 'border-forest-500 bg-forest-50 ring-1 ring-forest-400'
                      : 'border-forest-100 hover:border-forest-300 hover:bg-cream-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-forest-800">{opt.label}</span>
                    {active && <Check className="w-3.5 h-3.5 text-forest-600" />}
                  </div>
                  <p className="text-xs text-forest-500">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </Field>

        {/* 类型相关字段 */}
        {form.type === 'once' && (
          <Field label="提醒日期" required error={errors.remind_date}>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400 pointer-events-none" />
              <input
                type="date"
                className="input pl-9"
                value={form.remind_date}
                onChange={(e) => update('remind_date', e.target.value)}
              />
            </div>
            <p className="text-xs text-forest-400 mt-1">一次性计划：到日期回访一次后自动结束</p>
          </Field>
        )}

        {form.type === 'recurring' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="间隔天数" required error={errors.interval_days}>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  className="input pr-12"
                  value={form.interval_days}
                  onChange={(e) => update('interval_days', e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-forest-400">
                  天
                </span>
              </div>
            </Field>
            <Field label="最大次数" required error={errors.max_times}>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  className="input pr-12"
                  value={form.max_times}
                  onChange={(e) => update('max_times', e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-forest-400">
                  次
                </span>
              </div>
            </Field>
            <p className="col-span-2 text-xs text-forest-400 -mt-2">
              周期性计划：每次回访后自动顺延 N 天，达到最大次数后自动结束
            </p>
          </div>
        )}

        {form.type === 'custom' && (
          <Field label="自定义日期" required error={errors.custom_dates}>
            <div className="space-y-2">
              {form.custom_dates.map((d, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400 pointer-events-none" />
                    <input
                      type="date"
                      className="input pl-9"
                      value={d}
                      onChange={(e) => setCustomDate(idx, e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustomDate(idx)}
                    className="text-forest-400 hover:text-risk-600 p-1"
                    aria-label="删除日期"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addCustomDate}
                className="text-sm text-forest-600 hover:text-forest-800 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> 添加日期
              </button>
            </div>
            <p className="text-xs text-forest-400 mt-1">自定义计划：按指定日期依次回访，全部完成后结束</p>
          </Field>
        )}

        {/* 回访目的 */}
        <Field label="回访目的">
          <textarea
            className="input min-h-[80px]"
            placeholder="如：了解最近看机会的意愿 / 推介新职位 / 维护关系"
            value={form.purpose}
            onChange={(e) => update('purpose', e.target.value)}
          />
        </Field>

        {/* 关联职位（多选） */}
        <Field label="关联职位（可选）">
          {selectedPositions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedPositions.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-forest-50 text-forest-700 border border-forest-200"
                >
                  {p.title}
                  <button
                    type="button"
                    onClick={() => togglePosition(p.id)}
                    className="text-forest-400 hover:text-risk-600"
                    aria-label="移除"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            className="input text-left text-forest-400 hover:border-forest-400"
            onClick={() => setPosPickerOpen(true)}
          >
            点击选择职位...
          </button>
        </Field>
      </div>

      {/* 简历选择 Modal */}
      <Modal
        open={resumePickerOpen}
        title="选择简历"
        onClose={() => setResumePickerOpen(false)}
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchResumes();
          }}
          className="relative mb-3"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="搜索姓名/现公司/技能"
            value={resKeyword}
            onChange={(e) => setResKeyword(e.target.value)}
          />
        </form>
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {resLoading ? (
            <Loading />
          ) : resumes.length === 0 ? (
            <p className="text-sm text-forest-400 text-center py-8">暂无可选简历</p>
          ) : (
            resumes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedResume(r);
                  update('resume_id', r.id);
                  setResumePickerOpen(false);
                }}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  form.resume_id === r.id
                    ? 'border-forest-500 bg-forest-50 ring-1 ring-forest-400'
                    : 'border-forest-100 hover:border-forest-300 hover:bg-cream-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-forest-800">{r.name}</span>
                  {r.age && <span className="text-xs text-forest-400">{r.age}岁</span>}
                  <RiskBadge risk={r.risk_warning} />
                  {form.resume_id === r.id && (
                    <Check className="w-4 h-4 text-forest-600 ml-auto" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-forest-500">
                  <Building2 className="w-3 h-3" />
                  <span>{r.current_company || '现公司未知'}</span>
                  {r.current_title && <span>· {r.current_title}</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </Modal>

      {/* 职位选择 Modal */}
      <Modal
        open={posPickerOpen}
        title="选择职位（可多选）"
        onClose={() => setPosPickerOpen(false)}
        size="lg"
        footer={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setPosPickerOpen(false)}
          >
            完成（已选 {form.position_ids.length} 个）
          </button>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchPositions();
          }}
          className="relative mb-3"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="搜索职位标题/关键词"
            value={posKeyword}
            onChange={(e) => setPosKeyword(e.target.value)}
          />
        </form>
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {posLoading ? (
            <Loading />
          ) : positions.length === 0 ? (
            <p className="text-sm text-forest-400 text-center py-8">暂无可选职位</p>
          ) : (
            positions.map((p) => {
              const checked = form.position_ids.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePosition(p.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    checked
                      ? 'border-forest-500 bg-forest-50 ring-1 ring-forest-400'
                      : 'border-forest-100 hover:border-forest-300 hover:bg-cream-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-forest-800">{p.title}</span>
                    {checked && <Check className="w-4 h-4 text-forest-600" />}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-forest-500">
                    <Building2 className="w-3 h-3" />
                    {p.department || '—'}
                    {p.location && <span>· {p.location}</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Modal>
    </Modal>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-risk-600 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-risk-600 mt-1">{error}</p>}
    </div>
  );
}
