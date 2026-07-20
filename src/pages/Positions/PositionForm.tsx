// 职位录入/编辑表单（管理员，含 AI 解析、上传文件）
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Upload,
  ClipboardPaste,
  Save,
  X,
  Loader2,
} from 'lucide-react';
import { positionsApi, clientsApi, aiApi, getErrorMsg } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { Client, Position } from '@/types';
import Loading from '@/components/Loading';
import TagInput from '@/components/TagInput';
import {
  JOB_TYPE_OPTIONS,
  WORK_MODE_OPTIONS,
  PRIORITY_OPTIONS,
  POSITION_STATUS_OPTIONS,
} from './constants';

type InputMode = 'paste' | 'upload';

interface FormState {
  title: string;
  client_id: string;
  department: string;
  location: string;
  headcount: string;
  salary_min: string;
  salary_max: string;
  experience: string;
  education: string;
  job_type: string;
  work_mode: string;
  priority: string;
  status: string;
  jd: string;
  requirements: string;
  bonus: string;
  keywords: string[];
  raw_text: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  client_id: '',
  department: '',
  location: '',
  headcount: '',
  salary_min: '',
  salary_max: '',
  experience: '',
  education: '',
  job_type: 'full_time',
  work_mode: 'onsite',
  priority: 'medium',
  status: 'open',
  jd: '',
  requirements: '',
  bonus: '',
  keywords: [],
  raw_text: '',
};

export default function PositionForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isEdit = !!id;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 录入方式
  const [inputMode, setInputMode] = useState<InputMode>('paste');
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 权限校验：仅管理员
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/403', { replace: true });
    }
  }, [user, navigate]);

  // 加载客户公司
  useEffect(() => {
    clientsApi.list().then(setClients).catch(() => {});
  }, []);

  // 加载编辑数据
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = await positionsApi.get(id);
        if (cancelled) return;
        setForm({
          title: p.title || '',
          client_id: p.client_id || '',
          department: p.department || '',
          location: p.location || '',
          headcount: p.headcount ? String(p.headcount) : '',
          salary_min: p.salary_min || '',
          salary_max: p.salary_max || '',
          experience: p.experience || '',
          education: p.education || '',
          job_type: p.job_type || 'full_time',
          work_mode: p.work_mode || 'onsite',
          priority: p.priority || 'medium',
          status: p.status || 'open',
          jd: p.jd || '',
          requirements: p.requirements || '',
          bonus: p.bonus || '',
          keywords: p.keywords || [],
          raw_text: p.raw_text || '',
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
    setUploading(true);
    try {
      const res = await positionsApi.upload(file);
      update('raw_text', res.text);
      setParseMsg(`已上传文件「${res.filename}」，可点击 AI 解析自动填表`);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setUploading(false);
    }
  };

  const handleParse = async () => {
    if (!form.raw_text.trim()) {
      setError('请先粘贴或上传职位原文');
      return;
    }
    setParsing(true);
    setParseMsg('');
    setError('');
    try {
      const res = await aiApi.parsePosition(form.raw_text);
      const data = (res as { data?: Record<string, unknown> }).data ?? (res as Record<string, unknown>);
      // 仅填充空字段
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
    if (!form.title.trim()) e.title = '职位标题不能为空';
    if (!form.status) e.status = '请选择状态';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      const payload: Partial<Position> = {
        title: form.title.trim(),
        client_id: form.client_id || null,
        department: form.department || null,
        location: form.location || null,
        headcount: form.headcount ? Number(form.headcount) : null,
        salary_min: form.salary_min || null,
        salary_max: form.salary_max || null,
        experience: form.experience || null,
        education: form.education || null,
        job_type: form.job_type,
        work_mode: form.work_mode,
        priority: form.priority,
        status: form.status,
        jd: form.jd || null,
        requirements: form.requirements || null,
        bonus: form.bonus || null,
        keywords: form.keywords,
        raw_text: form.raw_text || null,
      };
      if (isEdit && id) {
        await positionsApi.update(id, payload);
        navigate(`/positions/${id}`);
      } else {
        const created = await positionsApi.create(payload);
        navigate(`/positions/${created.id}`);
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
          {isEdit ? '编辑职位' : '新建职位'}
        </h1>
        <p className="text-sm text-forest-500 mt-1">
          {isEdit ? '修改职位信息后保存' : '粘贴/上传客户原文，AI 一键解析后入库'}
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
            <Field label="职位标题" required error={errors.title}>
              <input
                type="text"
                className="input"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="如：高级前端工程师"
              />
            </Field>
            <Field label="客户公司">
              <select
                className="input"
                value={form.client_id}
                onChange={(e) => update('client_id', e.target.value)}
              >
                <option value="">— 不关联 —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="部门">
                <input
                  type="text"
                  className="input"
                  value={form.department}
                  onChange={(e) => update('department', e.target.value)}
                />
              </Field>
              <Field label="地点">
                <input
                  type="text"
                  className="input"
                  value={form.location}
                  onChange={(e) => update('location', e.target.value)}
                  placeholder="如：上海"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="招聘人数">
                <input
                  type="number"
                  className="input"
                  value={form.headcount}
                  onChange={(e) => update('headcount', e.target.value)}
                  min={0}
                />
              </Field>
              <Field label="经验要求">
                <input
                  type="text"
                  className="input"
                  value={form.experience}
                  onChange={(e) => update('experience', e.target.value)}
                  placeholder="如：3-5 年"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="薪资下限">
                <input
                  type="text"
                  className="input"
                  value={form.salary_min}
                  onChange={(e) => update('salary_min', e.target.value)}
                  placeholder="如：15k"
                />
              </Field>
              <Field label="薪资上限">
                <input
                  type="text"
                  className="input"
                  value={form.salary_max}
                  onChange={(e) => update('salary_max', e.target.value)}
                  placeholder="如：25k"
                />
              </Field>
            </div>
            <Field label="学历要求">
              <input
                type="text"
                className="input"
                value={form.education}
                onChange={(e) => update('education', e.target.value)}
                placeholder="如：本科及以上"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="职位类型">
                <select
                  className="input"
                  value={form.job_type}
                  onChange={(e) => update('job_type', e.target.value)}
                >
                  {JOB_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="工作模式">
                <select
                  className="input"
                  value={form.work_mode}
                  onChange={(e) => update('work_mode', e.target.value)}
                >
                  {WORK_MODE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="优先级">
                <select
                  className="input"
                  value={form.priority}
                  onChange={(e) => update('priority', e.target.value)}
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="状态" required error={errors.status}>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => update('status', e.target.value)}
                >
                  {POSITION_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </div>

        {/* 右栏：录入方式 + 文本/JD/要求/关键词 */}
        <div className="space-y-4">
          <div className="card p-5">
            {/* 录入方式 Tab */}
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
              <Field label="职位原文（raw_text）">
                <textarea
                  className="input min-h-[180px] font-mono text-xs"
                  value={form.raw_text}
                  onChange={(e) => update('raw_text', e.target.value)}
                  placeholder="粘贴客户发来的职位描述原文（可包含表格、零散字段等）"
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
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-forest-200 rounded-lg py-8 text-center text-forest-500 hover:bg-forest-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-forest-400" />
                      <div className="text-sm text-forest-500">文件上传中，请稍候…</div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 mx-auto mb-2" />
                      <div className="text-sm">点击上传文件（.txt / .xlsx / .csv）</div>
                      <div className="text-xs text-forest-400 mt-1">支持 .txt、.xlsx、.xls、.csv 自动提取文本</div>
                    </>
                  )}
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
            <h2 className="font-serif text-lg font-semibold text-forest-800 mb-3">详细内容</h2>
            <div className="space-y-3">
              <Field label="岗位职责（支持 Markdown）">
                <textarea
                  className="input min-h-[120px] font-mono text-xs"
                  value={form.jd}
                  onChange={(e) => update('jd', e.target.value)}
                  placeholder={'1. 负责...\n2. 主导...'}
                />
              </Field>
              <Field label="任职要求（支持 Markdown）">
                <textarea
                  className="input min-h-[120px] font-mono text-xs"
                  value={form.requirements}
                  onChange={(e) => update('requirements', e.target.value)}
                  placeholder={'1. 3 年以上...\n2. 熟悉...'}
                />
              </Field>
              <Field label="加分项（支持 Markdown）">
                <textarea
                  className="input min-h-[80px] font-mono text-xs"
                  value={form.bonus}
                  onChange={(e) => update('bonus', e.target.value)}
                />
              </Field>
              <Field label="关键词标签">
                <TagInput
                  value={form.keywords}
                  onChange={(v) => update('keywords', v)}
                  placeholder="如：React / 高并发 / SaaS"
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
    </div>
  );
}

// 字段包装
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

// AI 解析结果合并：只填空字段
function mergeParseResult(form: FormState, data: Record<string, unknown>): FormState {
  const next = { ...form };
  const setIfEmpty = (key: keyof FormState, value: unknown) => {
    if (value === undefined || value === null) return;
    const s = String(value).trim();
    if (!s) return;
    if (key === 'keywords') {
      if (Array.isArray(value) && value.length > 0 && next.keywords.length === 0) {
        next.keywords = value.map(String);
      }
      return;
    }
    if (key === 'headcount') {
      if (!next.headcount) next.headcount = String(value);
      return;
    }
    const cur = next[key] as string;
    if (typeof cur === 'string' && !cur.trim()) {
      (next[key] as string) = s;
    }
  };
  // 兼容 snake_case 和 camelCase
  setIfEmpty('title', data.title);
  setIfEmpty('department', data.department);
  setIfEmpty('location', data.location);
  setIfEmpty('headcount', data.headcount ?? data.headCount);
  setIfEmpty('salary_min', data.salary_min ?? data.salaryMin);
  setIfEmpty('salary_max', data.salary_max ?? data.salaryMax);
  setIfEmpty('experience', data.experience);
  setIfEmpty('education', data.education);
  setIfEmpty('job_type', data.job_type ?? data.jobType);
  setIfEmpty('work_mode', data.work_mode ?? data.workMode);
  setIfEmpty('priority', data.priority);
  setIfEmpty('jd', data.jd ?? data.responsibilities ?? data.description);
  setIfEmpty('requirements', data.requirements);
  setIfEmpty('bonus', data.bonus);
  setIfEmpty('keywords', data.keywords);
  return next;
}
