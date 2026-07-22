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
  FileText,
  AlertTriangle,
  CheckCircle2,
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

interface AiMeta {
  clientCompany?: string;
  salaryUnit?: string;
  highlights?: string[];
  confidence?: number;
  uncertainFields?: string[];
  rawTextSummary?: string;
  keywords?: string[];
  salaryDetails?: Record<string, string>;
  trainingPeriod?: Record<string, string>;
  probation?: Record<string, string>;
  performanceMetrics?: Record<string, string>;
  benefits?: Record<string, string>;
  workLifeBalance?: Record<string, string>;
  teamInfo?: Record<string, string>;
  growthPath?: Record<string, string>;
  positionContext?: Record<string, string>;
  interviewProcess?: Record<string, string>;
  companyInsights?: Record<string, string>;
  jobSeekerVerdict?: string;
  [k: string]: unknown;
}

// 上传文件后保留的图片资产（用于多模态 AI 解析）
interface UploadImage {
  name: string;
  mime: string;
  base64: string;
  source: string;
}

// 上传文件后保留的附件元信息（仅展示用）
interface UploadAttachment {
  name: string;
  ext: string;
  mime: string;
  size: number;
  source: string;
}

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
  ai_meta: AiMeta | null;
  source_filename: string;
  source_ext: string;
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
  ai_meta: null,
  source_filename: '',
  source_ext: '',
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

  // 上传后保留的图片资产和附件元信息（用于多模态 AI 调用 + UI 展示）
  const [uploadImages, setUploadImages] = useState<UploadImage[]>([]);
  const [uploadAttachments, setUploadAttachments] = useState<UploadAttachment[]>([]);
  const [uploadMeta, setUploadMeta] = useState<{
    sheetCount: number;
    imageCount: number;
    attachmentCount: number;
  } | null>(null);

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
          ai_meta: (p.ai_meta as AiMeta | null) ?? null,
          source_filename: p.source_filename || '',
          source_ext: p.source_ext || '',
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
      // 一起更新 raw_text 和源文件元信息（供后端存档/详情页展示）
      setForm((f) => ({
        ...f,
        raw_text: res.text,
        source_filename: res.filename,
        source_ext: res.ext,
        // 切换文件后旧的 AI 解析结果作废
        ai_meta: null,
      }));
      // 保留图片资产 + 附件元信息，AI 解析时一并回传
      setUploadImages(res.images ?? []);
      setUploadAttachments(res.attachments ?? []);
      setUploadMeta({
        sheetCount: res.sheetCount ?? 0,
        imageCount: res.imageCount ?? 0,
        attachmentCount: res.attachmentCount ?? 0,
      });
      const bits: string[] = [`${res.ext}，${res.charCount} 字符`];
      if (res.sheetCount > 0) bits.push(`${res.sheetCount} 个工作表`);
      if (res.imageCount > 0) bits.push(`${res.imageCount} 张图片`);
      if (res.attachmentCount > 0) bits.push(`${res.attachmentCount} 个嵌入附件`);
      setParseMsg(
        `已上传文件「${res.filename}」（${bits.join('，')}），可点击 AI 解析自动填表${
          res.imageCount > 0 ? '（图片将一并交给 AI 多模态识别）' : ''
        }`
      );
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setUploading(false);
    }
  };

  const handleParse = async () => {
    if (!form.raw_text.trim() && uploadImages.length === 0) {
      setError('请先粘贴或上传职位原文');
      return;
    }
    setParsing(true);
    setParseMsg('');
    setError('');
    try {
      // 把上传时拿到的图片资产一起传给 AI（多模态）
      const imgs = uploadImages.length > 0
        ? uploadImages.map((i) => ({ name: i.name, mime: i.mime, base64: i.base64 }))
        : undefined;
      const res = await aiApi.parsePosition(form.raw_text, imgs);
      const data = (res as { data?: Record<string, unknown> }).data ?? (res as Record<string, unknown>);
      // 完整消费所有 AI 字段：填充表单空字段 + 保存 AI 完整结果到 ai_meta
      setForm((f) => mergeParseResult(f, data, clients));
      const extra = uploadImages.length > 0 ? `（含 ${uploadImages.length} 张图片多模态识别）` : '';
      setParseMsg(`AI 解析完成${extra}，已自动填充表单空字段，请核对后保存`);
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
        ai_meta: form.ai_meta || null,
        source_filename: form.source_filename || null,
        source_ext: form.source_ext || null,
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
        <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100">
          {isEdit ? '编辑职位' : '新建职位'}
        </h1>
        <p className="text-sm text-forest-500 dark:text-forest-400 mt-1">
          {isEdit ? '修改职位信息后保存' : '粘贴/上传客户原文，AI 一键解析后入库'}
        </p>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 左栏：基本信息 */}
        <div className="card p-5">
          <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-4">基本信息</h2>
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
            <div className="flex items-center gap-2 mb-3 border-b border-forest-100 dark:border-forest-800 pb-2">
              <button
                type="button"
                onClick={() => setInputMode('paste')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${
                  inputMode === 'paste'
                    ? 'bg-forest-100 text-forest-700'
                    : 'text-forest-500 dark:text-forest-400 hover:bg-forest-50 dark:hover:bg-forest-800/30'
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
                    : 'text-forest-500 dark:text-forest-400 hover:bg-forest-50 dark:hover:bg-forest-800/30'
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
                  accept=".txt,.pdf,.doc,.docx,.xlsx,.xlsm,.xls,.csv,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    // 清空 input value 让同一文件可重复选择
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-forest-200 dark:border-forest-700 rounded-lg py-8 text-center text-forest-500 dark:text-forest-400 hover:bg-forest-50 dark:hover:bg-forest-800/30 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-forest-400 dark:text-forest-500" />
                      <div className="text-sm text-forest-500 dark:text-forest-400">文件上传中，请稍候…</div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 mx-auto mb-2" />
                      <div className="text-sm">点击上传文件</div>
                      <div className="text-xs text-forest-400 dark:text-forest-500 mt-1">
                        支持 .txt / .pdf / .docx / .xlsx / .xls / .csv / .jpg / .png 等
                      </div>
                      <div className="text-xs text-forest-400 dark:text-forest-500 mt-0.5">
                        自动提取文本 + Excel 多工作表 + Word/Excel 嵌入附件 + 图片多模态识别
                      </div>
                    </>
                  )}
                </button>
                {form.source_filename && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-forest-600 dark:text-cream-300 bg-forest-50 dark:bg-forest-800/30 px-2 py-1.5 rounded">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="truncate">原文件：{form.source_filename}</span>
                    <span className="text-forest-400 dark:text-forest-500">（{form.source_ext}）</span>
                  </div>
                )}

                {/* 上传解析后展示：工作表/图片/附件统计 */}
                {uploadMeta && (uploadMeta.sheetCount > 0 || uploadMeta.imageCount > 0 || uploadMeta.attachmentCount > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    {uploadMeta.sheetCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-ochre-50 dark:bg-ochre-900/20 text-ochre-700 dark:text-ochre-400 border border-ochre-100 dark:border-ochre-800">
                        {uploadMeta.sheetCount} 个工作表
                      </span>
                    )}
                    {uploadMeta.imageCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {uploadMeta.imageCount} 张图片（将交给 AI 多模态识别）
                      </span>
                    )}
                    {uploadMeta.attachmentCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-cream-100 dark:bg-forest-800/50 text-forest-700 dark:text-cream-200 border border-forest-100 dark:border-forest-800">
                        {uploadMeta.attachmentCount} 个嵌入附件
                      </span>
                    )}
                  </div>
                )}

                {/* 上传的图片缩略图预览 */}
                {uploadImages.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {uploadImages.map((img, i) => (
                      <div
                        key={`${img.name}-${i}`}
                        className="relative border border-forest-100 dark:border-forest-800 rounded overflow-hidden bg-cream-50 dark:bg-forest-800/50"
                        title={`${img.name}（${img.source}）`}
                      >
                        <img
                          src={`data:${img.mime};base64,${img.base64}`}
                          alt={img.name}
                          className="w-full h-20 object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-forest-900/70 text-cream-50 text-[10px] px-1 py-0.5 truncate">
                          {img.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 嵌入附件清单 */}
                {uploadAttachments.length > 0 && (
                  <div className="mt-2 text-xs">
                    <div className="text-forest-500 dark:text-forest-400 mb-1">嵌入附件清单：</div>
                    <ul className="space-y-0.5">
                      {uploadAttachments.map((att, i) => (
                        <li
                          key={`${att.name}-${i}`}
                          className="flex items-center gap-1.5 text-forest-600 dark:text-cream-300"
                        >
                          <FileText className="w-3 h-3 text-forest-400 dark:text-forest-500" />
                          <span className="truncate">{att.name}</span>
                          <span className="text-forest-400 dark:text-forest-500">
                            （{att.ext}，{(att.size / 1024).toFixed(1)} KB，来源 {att.source}）
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleParse}
                disabled={parsing || (!form.raw_text.trim() && uploadImages.length === 0)}
                className="btn-ai flex items-center gap-1 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {parsing ? 'AI 解析中...' : 'AI 解析'}
              </button>
              {parseMsg && (
                <span className="text-xs text-forest-500 dark:text-forest-400">{parseMsg}</span>
              )}
            </div>

            {/* AI 解析结果摘要 */}
            {form.ai_meta && (
              <AiMetaPanel meta={form.ai_meta} />
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-3">详细内容</h2>
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
        {required && <span className="text-risk-600 dark:text-risk-400 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-risk-600 dark:text-risk-400 mt-1">{error}</p>}
    </div>
  );
}

// AI 解析结果合并：只填空字段（用户已填的不覆盖），同时把 AI 完整结果存到 ai_meta，
// 并尝试用 clientCompany 反向匹配 client_id（若用户未关联客户公司且能在客户列表找到对应名称）
function mergeParseResult(
  form: FormState,
  data: Record<string, unknown>,
  clients: Client[] = []
): FormState {
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

  // 反向匹配客户公司：若 form.client_id 为空且 AI 给出了 clientCompany，
  // 尝试在客户列表里按名称匹配（包含/等于都算）
  const clientCompany = pickString(data.clientCompany ?? data.client_company);
  if (!next.client_id && clientCompany) {
    const matched = clients.find(
      (c) => c.name === clientCompany || c.name.includes(clientCompany) || clientCompany.includes(c.name)
    );
    if (matched) next.client_id = matched.id;
  }

  // 保存 AI 完整结果到 ai_meta（详情页卡片化展示用）
  next.ai_meta = {
    clientCompany,
    salaryUnit: pickString(data.salaryUnit ?? data.salary_unit),
    highlights: pickStringArray(data.highlights),
    confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
    uncertainFields: pickStringArray(data.uncertainFields ?? data.uncertain_fields),
    rawTextSummary: pickString(data.rawTextSummary ?? data.raw_text_summary),
    keywords: pickStringArray(data.keywords),
    // 增强字段：全部保存，PositionDetail 卡片展示用
    salaryDetails: (data.salaryDetails ?? data.salary_details) as Record<string, string> | undefined,
    trainingPeriod: (data.trainingPeriod ?? data.training_period) as Record<string, string> | undefined,
    probation: data.probation as Record<string, string> | undefined,
    performanceMetrics: (data.performanceMetrics ?? data.performance_metrics) as Record<string, string> | undefined,
    benefits: data.benefits as Record<string, string> | undefined,
    workLifeBalance: (data.workLifeBalance ?? data.work_life_balance) as Record<string, string> | undefined,
    teamInfo: (data.teamInfo ?? data.team_info) as Record<string, string> | undefined,
    growthPath: (data.growthPath ?? data.growth_path) as Record<string, string> | undefined,
    positionContext: (data.positionContext ?? data.position_context) as Record<string, string> | undefined,
    interviewProcess: (data.interviewProcess ?? data.interview_process) as Record<string, string> | undefined,
    companyInsights: (data.companyInsights ?? data.company_insights) as Record<string, string> | undefined,
    jobSeekerVerdict: pickString(data.jobSeekerVerdict ?? data.job_seeker_verdict) || undefined,
  };
  return next;
}

function pickString(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function pickStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

// AI 解析结果摘要面板：显示 confidence、uncertainFields、highlights、rawTextSummary
function AiMetaPanel({ meta }: { meta: AiMeta }) {
  const confidence = typeof meta.confidence === 'number' ? meta.confidence : null;
  const uncertain = meta.uncertainFields ?? [];
  const highlights = meta.highlights ?? [];
  const summary = meta.rawTextSummary ?? '';
  const clientCompany = meta.clientCompany ?? '';
  const salaryUnit = meta.salaryUnit ?? '';

  // 置信度颜色：>=0.85 绿色 / 0.7-0.85 黄色 / <0.7 红色
  const confLevel =
    confidence === null ? 'unknown' :
    confidence >= 0.85 ? 'high' :
    confidence >= 0.7 ? 'medium' : 'low';
  const confColor =
    confLevel === 'high' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
    confLevel === 'medium' ? 'text-amber-600 bg-amber-50 border-amber-100' :
    confLevel === 'low' ? 'text-risk-600 bg-risk-50 border-risk-100' :
    'text-forest-500 dark:text-forest-400 bg-forest-50 dark:bg-forest-800/30 border-forest-100 dark:border-forest-800';

  return (
    <div className="mt-3 border border-forest-100 dark:border-forest-800 rounded-lg p-3 bg-cream-50 dark:bg-forest-800/50 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-forest-700 dark:text-cream-200">AI 解析结果</span>
        {confidence !== null && (
          <span className={`text-xs px-2 py-0.5 rounded border ${confColor}`}>
            置信度 {(confidence * 100).toFixed(0)}%
          </span>
        )}
        {clientCompany && (
          <span className="text-xs text-forest-500 dark:text-forest-400">
            客户公司：<span className="text-forest-700 dark:text-cream-200">{clientCompany}</span>
          </span>
        )}
        {salaryUnit && (
          <span className="text-xs text-forest-500 dark:text-forest-400">
            薪资单位：<span className="text-forest-700 dark:text-cream-200">{salaryUnit}</span>
          </span>
        )}
      </div>

      {summary && (
        <div className="text-xs text-forest-600 dark:text-cream-300 bg-white dark:bg-forest-900 rounded p-2 border border-forest-100 dark:border-forest-800">
          <span className="font-medium text-forest-700 dark:text-cream-200">原文摘要：</span>
          {summary}
        </div>
      )}

      {highlights.length > 0 && (
        <div className="text-xs">
          <div className="font-medium text-forest-700 dark:text-cream-200 mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            职位亮点
          </div>
          <ul className="list-disc list-inside text-forest-600 dark:text-cream-300 space-y-0.5">
            {highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {uncertain.length > 0 && (
        <div className="text-xs">
          <div className="font-medium text-amber-700 mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            不确定字段（需人工核对）
          </div>
          <ul className="list-disc list-inside text-amber-700 space-y-0.5">
            {uncertain.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
