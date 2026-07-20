// 简历录入/编辑表单（含 AI 解析 + 撞单提示）
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Upload,
  ClipboardPaste,
  Save,
  X,
  AlertTriangle,
} from 'lucide-react';
import { resumesApi, aiApi, getErrorMsg } from '@/lib/api';
import type { CommonGrounds, Resume, RiskWarning } from '@/types';
import Loading from '@/components/Loading';
import TagInput from '@/components/TagInput';
import Modal from '@/components/Modal';
import { CANDIDATE_STATUS_OPTIONS, CONTACT_PREFERENCE_OPTIONS } from './constants';

type InputMode = 'paste' | 'upload';

interface FormState {
  name: string;
  age: string;
  education: string;
  current_company: string;
  current_title: string;
  candidate_status: string;
  expected_onboard_date: string;
  expected_city: string;
  phone: string;
  email: string;
  wechat_id: string;
  has_wechat: boolean;
  contact_preference: string;
  work_experience: string;
  skills: string;
  projects: string;
  expectation: string;
  tags: string[];
  remark: string;
  raw_text: string;
  common_grounds: CommonGrounds;
  risk_warning: RiskWarning;
}

const EMPTY_FORM: FormState = {
  name: '',
  age: '',
  education: '',
  current_company: '',
  current_title: '',
  candidate_status: 'passive',
  expected_onboard_date: '',
  expected_city: '',
  phone: '',
  email: '',
  wechat_id: '',
  has_wechat: false,
  contact_preference: 'wechat',
  work_experience: '',
  skills: '',
  projects: '',
  expectation: '',
  tags: [],
  remark: '',
  raw_text: '',
  common_grounds: {},
  risk_warning: { isRisky: false, reasons: [] },
};

export default function ResumeForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [inputMode, setInputMode] = useState<InputMode>('paste');
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // 撞单提示
  const [conflictTip, setConflictTip] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await resumesApi.get(id);
        if (cancelled) return;
        setForm({
          name: r.name || '',
          age: r.age || '',
          education: r.education || '',
          current_company: r.current_company || '',
          current_title: r.current_title || '',
          candidate_status: r.candidate_status || 'passive',
          expected_onboard_date: r.expected_onboard_date || '',
          expected_city: r.expected_city || '',
          phone: '', // 编辑时不显示明文手机号
          email: '', // 同上
          wechat_id: r.wechat_id || '',
          has_wechat: r.has_wechat === 1 || r.has_wechat === true,
          contact_preference: r.contact_preference || 'wechat',
          work_experience: r.work_experience || '',
          skills: r.skills || '',
          projects: r.projects || '',
          expectation: r.expectation || '',
          tags: r.tags || [],
          remark: r.remark || '',
          raw_text: r.raw_text || '',
          common_grounds: r.common_grounds || {},
          risk_warning: r.risk_warning || { isRisky: false, reasons: [] },
        });
      } catch (err) {
        setError(getErrorMsg(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[key];
        return next;
      });
    }
  };

  const handleUpload = async (file: File) => {
    setError('');
    try {
      const res = await resumesApi.upload(file);
      update('raw_text', res.text);
      setParseMsg(`已上传文件「${res.filename}」，可点击 AI 解析自动填表`);
    } catch (err) {
      setError(getErrorMsg(err));
    }
  };

  const handleParse = async () => {
    if (!form.raw_text.trim()) {
      setError('请先粘贴或上传简历原文');
      return;
    }
    setParsing(true);
    setParseMsg('');
    setError('');
    try {
      const res = await aiApi.parseResume(form.raw_text);
      const data = (res as { data?: Record<string, unknown> }).data ?? (res as Record<string, unknown>);
      setForm((f) => mergeParseResult(f, data));
      setParseMsg('AI 解析完成，已自动填充表单空字段，请核对后保存');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setParsing(false);
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = '姓名不能为空';
    if (form.phone && !/^\d{11}$/.test(form.phone)) {
      // 不强制 11 位（兼容座机），但长度太短提示
      if (form.phone.length < 6) e.phone = '手机号格式不正确';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = '邮箱格式不正确';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      const payload: Partial<Resume> & { phone?: string; email?: string } = {
        name: form.name.trim(),
        age: form.age || null,
        education: form.education || null,
        current_company: form.current_company || null,
        current_title: form.current_title || null,
        candidate_status: form.candidate_status,
        expected_onboard_date: form.expected_onboard_date || null,
        expected_city: form.expected_city || null,
        phone: form.phone || undefined,
        email: form.email || undefined,
        wechat_id: form.wechat_id || null,
        has_wechat: form.has_wechat ? 1 : 0,
        contact_preference: form.contact_preference,
        work_experience: form.work_experience || null,
        skills: form.skills || null,
        projects: form.projects || null,
        expectation: form.expectation || null,
        tags: form.tags,
        remark: form.remark || null,
        raw_text: form.raw_text || null,
        common_grounds: form.common_grounds,
        risk_warning: form.risk_warning,
      };
      if (isEdit && id) {
        await resumesApi.update(id, payload);
        navigate(`/resumes/${id}`);
      } else {
        const created = await resumesApi.create(payload);
        // 检查撞单计数
        if (created.conflictCount > 0) {
          setConflictTip(
            `已保存，但检测到 ${created.conflictCount} 条潜在撞单，已通知管理员`
          );
          // 不直接跳转，等用户看到提示后再跳转
          setTimeout(() => {
            navigate(`/resumes/${created.data.id}`);
          }, 2500);
        } else {
          navigate(`/resumes/${created.data.id}`);
        }
      }
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading className="py-20" />;

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="btn-ghost inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> 返回
        </button>
      </div>

      <div className="mb-4">
        <h1 className="font-serif text-2xl font-bold text-forest-800">
          {isEdit ? '编辑简历' : '新建简历'}
        </h1>
        <p className="text-sm text-forest-500 mt-1">
          粘贴/上传简历原文，AI 一键解析并自动识别风险/共同点
        </p>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 左栏：基本信息 */}
        <div className="card p-5">
          <h2 className="font-serif text-lg font-semibold text-forest-800 mb-4">基本信息</h2>
          <div className="space-y-3">
            <Field label="姓名" required error={errors.name}>
              <input
                type="text"
                className="input"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="如：张三"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="年龄">
                <input
                  type="text"
                  className="input"
                  value={form.age}
                  onChange={(e) => update('age', e.target.value)}
                  placeholder="如：28"
                />
              </Field>
              <Field label="学历">
                <input
                  type="text"
                  className="input"
                  value={form.education}
                  onChange={(e) => update('education', e.target.value)}
                  placeholder="如：本科"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="现公司">
                <input
                  type="text"
                  className="input"
                  value={form.current_company}
                  onChange={(e) => update('current_company', e.target.value)}
                />
              </Field>
              <Field label="现职位">
                <input
                  type="text"
                  className="input"
                  value={form.current_title}
                  onChange={(e) => update('current_title', e.target.value)}
                />
              </Field>
            </div>
            <Field label="求职状态">
              <select
                className="input"
                value={form.candidate_status}
                onChange={(e) => update('candidate_status', e.target.value)}
              >
                {CANDIDATE_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="期望到岗时间">
              <input
                type="text"
                className="input"
                value={form.expected_onboard_date}
                onChange={(e) => update('expected_onboard_date', e.target.value)}
                placeholder="如：1 周内 / 2026-08"
              />
            </Field>
            <Field label="意向城市">
              <input
                type="text"
                className="input"
                value={form.expected_city}
                onChange={(e) => update('expected_city', e.target.value)}
                placeholder="如：上海"
              />
            </Field>

            <hr className="border-forest-100 my-1" />
            <h3 className="text-sm font-semibold text-forest-700">联系方式</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="手机号" error={errors.phone}>
                <input
                  type="text"
                  className="input"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder={isEdit ? '留空表示不修改' : '如：138****1234'}
                />
              </Field>
              <Field label="邮箱" error={errors.email}>
                <input
                  type="text"
                  className="input"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder={isEdit ? '留空表示不修改' : '如：zhangsan@xxx.com'}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="微信号">
                <input
                  type="text"
                  className="input"
                  value={form.wechat_id}
                  onChange={(e) => update('wechat_id', e.target.value)}
                />
              </Field>
              <Field label="联系偏好">
                <select
                  className="input"
                  value={form.contact_preference}
                  onChange={(e) => update('contact_preference', e.target.value)}
                >
                  {CONTACT_PREFERENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-forest-700">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-forest-600"
                checked={form.has_wechat}
                onChange={(e) => update('has_wechat', e.target.checked)}
              />
              已加微信
            </label>

            <hr className="border-forest-100 my-1" />
            <Field label="人选备注">
              <textarea
                className="input min-h-[80px]"
                value={form.remark}
                onChange={(e) => update('remark', e.target.value)}
                placeholder="如：2026-07-20 张三 28岁 本科 资深前端"
              />
            </Field>
          </div>
        </div>

        {/* 右栏：录入方式 + AI 解析 + 经历 */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3 border-b border-forest-100 pb-2">
              <button
                type="button"
                onClick={() => setInputMode('paste')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${
                  inputMode === 'paste'
                    ? 'bg-forest-100 text-forest-700'
                    : 'text-forest-500 hover:bg-forest-50'
                }`}
              >
                <ClipboardPaste className="w-4 h-4" />
                粘贴文本
              </button>
              <button
                type="button"
                onClick={() => setInputMode('upload')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${
                  inputMode === 'upload'
                    ? 'bg-forest-100 text-forest-700'
                    : 'text-forest-500 hover:bg-forest-50'
                }`}
              >
                <Upload className="w-4 h-4" />
                上传文件
              </button>
            </div>

            {inputMode === 'paste' ? (
              <Field label="简历原文（raw_text）">
                <textarea
                  className="input min-h-[180px] font-mono text-xs"
                  value={form.raw_text}
                  onChange={(e) => update('raw_text', e.target.value)}
                  placeholder="粘贴求职者简历原文"
                />
              </Field>
            ) : (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.pdf,.doc,.docx,.xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-forest-200 rounded-lg py-8 text-center text-forest-500 hover:bg-forest-50"
                >
                  <Upload className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-sm">点击上传文件（.txt / .xlsx / .csv）</div>
                  <div className="text-xs text-forest-400 mt-1">支持 .txt、.xlsx、.xls、.csv 自动提取文本</div>
                </button>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleParse}
                disabled={parsing || !form.raw_text.trim()}
                className="btn-ai flex items-center gap-1 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {parsing ? 'AI 解析中...' : 'AI 解析'}
              </button>
              {parseMsg && (
                <span className="text-xs text-forest-500">{parseMsg}</span>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-forest-800 mb-3">详细经历</h2>
            <div className="space-y-3">
              <Field label="工作经历（支持 Markdown）">
                <textarea
                  className="input min-h-[120px] font-mono text-xs"
                  value={form.work_experience}
                  onChange={(e) => update('work_experience', e.target.value)}
                />
              </Field>
              <Field label="技能（支持 Markdown）">
                <textarea
                  className="input min-h-[80px] font-mono text-xs"
                  value={form.skills}
                  onChange={(e) => update('skills', e.target.value)}
                />
              </Field>
              <Field label="项目经历（支持 Markdown）">
                <textarea
                  className="input min-h-[120px] font-mono text-xs"
                  value={form.projects}
                  onChange={(e) => update('projects', e.target.value)}
                />
              </Field>
              <Field label="求职期望">
                <textarea
                  className="input min-h-[80px] font-mono text-xs"
                  value={form.expectation}
                  onChange={(e) => update('expectation', e.target.value)}
                  placeholder="如：期望薪资 25-35k · 方向 资深前端"
                />
              </Field>
              <Field label="标签">
                <TagInput
                  value={form.tags}
                  onChange={(v) => update('tags', v)}
                  placeholder="如：高潜 / 资深 / Java"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="lg:col-span-2 flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-ghost flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-1 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>

      {/* 撞单提示弹窗 */}
      <Modal
        open={!!conflictTip}
        title="撞单提醒"
        onClose={() => setConflictTip(null)}
        size="sm"
        footer={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setConflictTip(null)}
          >
            我知道了
          </button>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-ochre-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-forest-700">{conflictTip}</p>
        </div>
      </Modal>
    </div>
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

// AI 解析结果合并：只填空字段，但 common_grounds / risk_warning / tags 总是覆盖（AI 推断更准）
function mergeParseResult(form: FormState, data: Record<string, unknown>): FormState {
  const next = { ...form };
  const setIfEmpty = (key: keyof FormState, value: unknown) => {
    if (value === undefined || value === null) return;
    const s = typeof value === 'string' ? value.trim() : value;
    if (!s || s === '') return;
    if (key === 'tags') {
      if (Array.isArray(value) && value.length > 0 && next.tags.length === 0) {
        next.tags = value.map(String);
      }
      return;
    }
    if (typeof next[key] === 'string') {
      const cur = next[key] as string;
      if (!cur.trim()) (next[key] as string) = String(value);
    }
    if (key === 'has_wechat') {
      next.has_wechat = Boolean(value);
    }
  };
  // 基础字段：仅填空
  setIfEmpty('name', data.name);
  setIfEmpty('age', data.age);
  setIfEmpty('education', data.education);
  setIfEmpty('current_company', data.current_company ?? data.currentCompany);
  setIfEmpty('current_title', data.current_title ?? data.currentTitle);
  setIfEmpty('expected_city', data.expected_city ?? data.expectedCity);
  setIfEmpty('expected_onboard_date', data.expected_onboard_date ?? data.expectedOnboardDate);
  setIfEmpty('candidate_status', data.candidate_status ?? data.candidateStatus);
  setIfEmpty('phone', data.phone);
  setIfEmpty('email', data.email);
  setIfEmpty('wechat_id', data.wechat_id ?? data.wechatId);
  setIfEmpty('work_experience', data.work_experience ?? data.workExperience);
  setIfEmpty('skills', data.skills);
  setIfEmpty('projects', data.projects);
  setIfEmpty('expectation', data.expectation);
  setIfEmpty('remark', data.remark);
  setIfEmpty('tags', data.tags);

  // 共同点：AI 推断更准，直接覆盖空值
  const cgRaw = (data.common_grounds ?? data.commonGrounds) as CommonGrounds | undefined;
  if (cgRaw && typeof cgRaw === 'object') {
    next.common_grounds = {
      ...next.common_grounds,
      ...Object.fromEntries(
        Object.entries(cgRaw).filter(([, v]) => v !== undefined && v !== null && v !== '')
      ),
    };
  }

  // 风险警告：AI 推断更准，直接覆盖
  const rw = (data.risk_warning ?? data.riskWarning) as RiskWarning | undefined;
  if (rw && typeof rw === 'object') {
    next.risk_warning = {
      isRisky: Boolean(rw.isRisky),
      reasons: Array.isArray(rw.reasons) ? rw.reasons.map(String) : [],
    };
  }
  return next;
}
