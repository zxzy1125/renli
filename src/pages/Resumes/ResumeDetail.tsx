// 简历详情页：风险红标 + 基本信息 + 共同点 + 经历 + 跟进历史
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  GraduationCap,
  Building2,
  Briefcase,
  Users,
  Heart,
  Home,
  School,
  Clock,
  Plus,
} from 'lucide-react';
import dayjs from 'dayjs';
import { resumesApi, usersApi, followupsApi, getErrorMsg } from '@/lib/api';
import type { FollowupPlan, FollowupRecord, Resume, User } from '@/types';
import Loading from '@/components/Loading';
import MarkdownView from '@/components/MarkdownView';
import StatusBadge from '@/components/StatusBadge';
import { RiskBanner } from '@/components/RiskBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import PlanForm from '@/pages/Followups/PlanForm';
import {
  CHANNEL_LABELS,
  FOLLOWUP_RESULT_LABELS,
  FOLLOWUP_RESULT_TONE_CLASS,
  PLAN_TYPE_LABELS,
  PLAN_STATUS_LABELS,
  PLAN_STATUS_TONE_CLASS,
} from '@/pages/Followups/constants';
import { CANDIDATE_STATUS_OPTIONS, CONTACT_PREFERENCE_OPTIONS, getOptionLabel } from './constants';

export default function ResumeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [resume, setResume] = useState<Resume | null>(null);
  const [ownerName, setOwnerName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rawOpen, setRawOpen] = useState(false);
  const [remarkCopied, setRemarkCopied] = useState(false);

  const [toDelete, setToDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 跟进历史
  const [followupPlans, setFollowupPlans] = useState<FollowupPlan[]>([]);
  const [followupRecords, setFollowupRecords] = useState<
    Array<FollowupRecord & { plan?: FollowupPlan }>
  >([]);
  const [followupLoading, setFollowupLoading] = useState(false);
  const [planFormOpen, setPlanFormOpen] = useState(false);

  // 拉取跟进历史（合并多计划的记录，按时间倒序）
  const fetchFollowups = async (resumeId: string) => {
    setFollowupLoading(true);
    try {
      const plans = await followupsApi.listPlans({});
      const own = plans.filter((p) => p.resume_id === resumeId);
      setFollowupPlans(own);
      const allRecords = await Promise.all(
        own.map(async (p) => {
          const recs = await followupsApi.listRecords(p.id);
          return recs.map((r) => ({ ...r, plan: p }));
        })
      );
      const merged = allRecords
        .flat()
        .sort((a, b) =>
          dayjs(b.followup_date).valueOf() - dayjs(a.followup_date).valueOf()
        );
      setFollowupRecords(merged);
    } catch {
      setFollowupPlans([]);
      setFollowupRecords([]);
    } finally {
      setFollowupLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const r = await resumesApi.get(id);
        if (cancelled) return;
        setResume(r);
        // 拉所有用户用于显示 owner_name（管理员视角）
        try {
          const users = await usersApi.list().catch(() => [] as User[]);
          const u = users.find((u) => u.id === r.owner_id);
          if (!cancelled) setOwnerName(u?.real_name || '');
        } catch {
          // 拉不到用户列表（员工无权），忽略
        }
        // 拉取跟进历史
        fetchFollowups(r.id);
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

  const handleCopyRemark = async () => {
    if (!resume?.remark) return;
    try {
      await navigator.clipboard.writeText(resume.remark);
      setRemarkCopied(true);
      setTimeout(() => setRemarkCopied(false), 2000);
    } catch {
      // 兜底
    }
  };

  const handleDelete = async () => {
    if (!resume) return;
    setDeleting(true);
    try {
      await resumesApi.remove(resume.id);
      navigate('/resumes');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Loading className="py-20" />;
  if (error) {
    return (
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <div className="px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400 mb-4">
          {error}
        </div>
        <Link to="/resumes" className="btn-ghost inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 返回简历库
        </Link>
      </div>
    );
  }
  if (!resume) {
    return (
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <p className="text-sm text-forest-500 dark:text-forest-400">简历不存在</p>
        <Link to="/resumes" className="btn-ghost inline-flex items-center gap-1 mt-2">
          <ArrowLeft className="w-4 h-4" /> 返回简历库
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/resumes" className="btn-ghost inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 简历库
        </Link>
      </div>

      {/* 标题区 */}
      <div className="card p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100 flex items-center gap-3">
              {resume.name}
              {resume.age && <span className="text-base font-normal text-forest-500 dark:text-forest-400">{resume.age}岁</span>}
            </h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-forest-500 dark:text-forest-400">
              <StatusBadge status={resume.candidate_status} />
              {ownerName && <span>· 负责人：{ownerName}</span>}
              <span>· 录入于 {dayjs(resume.created_at).format('YYYY-MM-DD HH:mm')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/resumes/${resume.id}/edit`)}
              className="btn-secondary flex items-center gap-1"
            >
              <Pencil className="w-4 h-4" />
              编辑
            </button>
            <button
              type="button"
              onClick={() => setToDelete(true)}
              className="btn-danger flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          </div>
        </div>

        {/* 风险红条 */}
        <RiskBanner risk={resume.risk_warning} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左侧：基本信息 */}
        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-3">基本信息</h2>
            <dl className="space-y-2 text-sm">
              <InfoRow icon={Briefcase} label="现公司" value={resume.current_company ?? undefined} />
              <InfoRow label="现职位" value={resume.current_title ?? undefined} />
              <InfoRow icon={GraduationCap} label="学历" value={resume.education ?? undefined} />
              <InfoRow label="求职状态" value={getOptionLabel(CANDIDATE_STATUS_OPTIONS, resume.candidate_status)} />
              <InfoRow icon={Calendar} label="期望到岗" value={resume.expected_onboard_date ?? undefined} />
              <InfoRow icon={Home} label="意向城市" value={resume.expected_city ?? undefined} />
            </dl>
          </section>

          {/* 联系方式 */}
          <section className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-3">联系方式</h2>
            <dl className="space-y-2 text-sm">
              <InfoRow icon={Phone} label="手机号" value={resume.phone_masked ?? undefined} mono />
              <InfoRow icon={Mail} label="邮箱" value={resume.email_masked ?? undefined} mono />
              <InfoRow
                icon={MessageCircle}
                label="微信号"
                value={resume.wechat_id ?? undefined}
              />
              <InfoRow
                label="已加微信"
                value={resume.has_wechat === 1 || resume.has_wechat === true ? '是' : '否'}
              />
              <InfoRow
                label="联系偏好"
                value={getOptionLabel(CONTACT_PREFERENCE_OPTIONS, resume.contact_preference)}
              />
            </dl>
          </section>

          {/* 共同点 */}
          {hasCommonGrounds(resume.common_grounds) && (
            <section className="card p-5">
              <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-3">共同点</h2>
              <ul className="space-y-2 text-sm">
                {resume.common_grounds.alumni && (
                  <CommonItem icon={School} label="校友" value={resume.common_grounds.alumni} />
                )}
                {resume.common_grounds.hometown && (
                  <CommonItem icon={Home} label="老乡" value={resume.common_grounds.hometown} />
                )}
                {resume.common_grounds.previousCompany && (
                  <CommonItem icon={Building2} label="前公司" value={resume.common_grounds.previousCompany} />
                )}
                {resume.common_grounds.hobby && (
                  <CommonItem icon={Heart} label="爱好" value={resume.common_grounds.hobby} />
                )}
              </ul>
            </section>
          )}

          {/* 标签 */}
          {resume.tags && resume.tags.length > 0 && (
            <section className="card p-5">
              <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-3">标签</h2>
              <div className="flex flex-wrap gap-1.5">
                {resume.tags.map((t, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded text-xs bg-ochre-50 dark:bg-ochre-900/20 text-ochre-700 dark:text-ochre-400 border border-ochre-100 dark:border-ochre-800"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* 人选备注 */}
          {resume.remark && (
            <section className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100">人选备注</h2>
                <button
                  type="button"
                  onClick={handleCopyRemark}
                  className="text-xs text-forest-600 dark:text-cream-300 hover:text-forest-800 dark:hover:text-cream-100 flex items-center gap-1"
                >
                  {remarkCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> 已复制
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> 复制
                    </>
                  )}
                </button>
              </div>
              <div className="text-sm text-forest-700 dark:text-cream-200 bg-cream-50 dark:bg-forest-800/50 rounded p-3 whitespace-pre-wrap">
                {resume.remark}
              </div>
            </section>
          )}
        </div>

        {/* 右侧：经历、期望、原文 */}
        <div className="lg:col-span-2 space-y-4">
          <section className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-3">工作经历</h2>
            <MarkdownView content={resume.work_experience} />
          </section>
          <section className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-3">技能</h2>
            <MarkdownView content={resume.skills} />
          </section>
          <section className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-3">项目经历</h2>
            <MarkdownView content={resume.projects} />
          </section>
          <section className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-3">求职期望</h2>
            <MarkdownView content={resume.expectation} />
          </section>

          {/* 跟进历史 - 真实数据 */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100">
                跟进历史 ({followupRecords.length})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlanFormOpen(true)}
                  className="text-sm text-forest-600 dark:text-cream-300 hover:text-forest-800 dark:hover:text-cream-100 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> 新建回访计划
                </button>
                <Link to="/followups" className="text-sm text-forest-500 dark:text-forest-400 hover:text-forest-700 dark:hover:text-cream-200">
                  查看全部
                </Link>
              </div>
            </div>

            {/* 计划摘要 */}
            {followupPlans.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {followupPlans.map((p) => (
                  <Link
                    key={p.id}
                    to={`/followups/${p.id}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-cream-50 dark:bg-forest-800/50 text-forest-700 dark:text-cream-200 border border-forest-200 dark:border-forest-700 hover:border-forest-400"
                  >
                    <span className="font-medium">{p.title}</span>
                    <span className="text-forest-400 dark:text-forest-500">·</span>
                    <span>{PLAN_TYPE_LABELS[p.type]}</span>
                    <span className={`badge ${PLAN_STATUS_TONE_CLASS[p.status]}`}>
                      {PLAN_STATUS_LABELS[p.status]}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {followupLoading ? (
              <div className="py-6 text-center text-sm text-forest-400 dark:text-forest-500">
                <Clock className="w-5 h-5 mx-auto mb-2 animate-pulse text-forest-300 dark:text-forest-600" />
                加载中...
              </div>
            ) : followupRecords.length === 0 ? (
              <div className="py-8 text-center text-sm text-forest-400 dark:text-forest-500">
                <Clock className="w-6 h-6 mx-auto mb-2 text-forest-300 dark:text-forest-600" />
                暂无回访记录，点击「新建回访计划」开始跟进
              </div>
            ) : (
              <div className="relative">
                {/* 时间轴竖线 */}
                <div className="absolute left-3 top-2 bottom-2 w-px bg-forest-200 dark:bg-forest-700" />
                <ul className="space-y-3">
                  {followupRecords.map((rec) => (
                    <li key={rec.id} className="relative pl-10">
                      <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-ochre-400 border-2 border-white dark:border-forest-900" />
                      <div className="rounded-lg border border-forest-100 dark:border-forest-800 bg-white dark:bg-forest-900 p-3">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-xs text-forest-500 dark:text-forest-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {dayjs(rec.followup_date).format('YYYY-MM-DD')}
                          </span>
                          {rec.contact_channel && (
                            <span className="badge bg-cream-100 dark:bg-forest-800/50 text-forest-700 dark:text-cream-200">
                              {CHANNEL_LABELS[rec.contact_channel]}
                            </span>
                          )}
                          {rec.result && (
                            <span className={`badge ${FOLLOWUP_RESULT_TONE_CLASS[rec.result]}`}>
                              {FOLLOWUP_RESULT_LABELS[rec.result]}
                            </span>
                          )}
                          {rec.plan && (
                            <Link
                              to={`/followups/${rec.plan.id}`}
                              className="text-xs text-forest-500 dark:text-forest-400 hover:text-forest-700 dark:hover:text-cream-200"
                            >
                              · {rec.plan.title}
                            </Link>
                          )}
                        </div>
                        {rec.note && (
                          <p className="text-sm text-forest-700 dark:text-cream-200 whitespace-pre-wrap leading-relaxed line-clamp-3">
                            {rec.note}
                          </p>
                        )}
                        {rec.next_action && (
                          <div className="text-xs text-forest-500 dark:text-forest-400 mt-1">
                            <span className="text-forest-400 dark:text-forest-500">下一步：</span>
                            {rec.next_action}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* 折叠原文 */}
          {resume.raw_text && (
            <section className="card p-5">
              <button
                type="button"
                onClick={() => setRawOpen((v) => !v)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="font-serif text-base font-semibold text-forest-700 dark:text-cream-200">
                  原始文本（raw_text）
                </span>
                {rawOpen ? (
                  <ChevronDown className="w-4 h-4 text-forest-400 dark:text-forest-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-forest-400 dark:text-forest-500" />
                )}
              </button>
              {rawOpen && (
                <pre className="mt-3 p-3 bg-forest-900 text-cream-50 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {resume.raw_text}
                </pre>
              )}
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={toDelete}
        title="删除简历"
        message={`确认删除简历「${resume.name}」吗？此操作不可撤销。`}
        confirmText={deleting ? '删除中...' : '确认删除'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(false)}
      />

      {/* 新建回访计划 */}
      <PlanForm
        open={planFormOpen}
        onClose={() => setPlanFormOpen(false)}
        presetResumeId={resume.id}
        onSaved={async () => {
          setPlanFormOpen(false);
          await fetchFollowups(resume.id);
        }}
      />
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
      <dt className="text-forest-500 dark:text-forest-400 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-forest-400 dark:text-forest-500" />}
        {label}
      </dt>
      <dd className={`text-forest-800 dark:text-cream-100 ${mono ? 'font-mono' : ''}`}>
        {value || <span className="text-forest-300 dark:text-forest-600">—</span>}
      </dd>
    </div>
  );
}

function CommonItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Home;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-ochre-500 dark:text-ochre-400 mt-0.5 flex-shrink-0" />
      <div>
        <span className="text-forest-500 dark:text-forest-400 mr-1">{label}：</span>
        <span className="text-forest-800 dark:text-cream-100">{value}</span>
      </div>
    </li>
  );
}

function hasCommonGrounds(cg: Resume['common_grounds']): boolean {
  if (!cg) return false;
  return Boolean(cg.alumni || cg.hometown || cg.previousCompany || cg.hobby);
}

// 兼容 Users icon import（避免未使用告警）
void Users;
