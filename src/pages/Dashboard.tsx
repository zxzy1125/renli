// 总览页：4 个统计卡片 + 转化漏斗图 + 业绩柱状图 + 趋势折线图（管理员）+ 快捷入口 + 今日待回访 + 最近匹配
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  FileText,
  CalendarClock,
  TrendingUp,
  Plus,
  GitCompareArrows,
  ArrowRight,
  Sparkles,
  Clock,
  BarChart3,
  LineChart as LineChartIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import dayjs from 'dayjs';
import {
  positionsApi,
  resumesApi,
  reportsApi,
  matchesApi,
  followupsApi,
  getErrorMsg,
} from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import Loading from '@/components/Loading';
import Empty from '@/components/Empty';
import { RiskBadge } from '@/components/RiskBadge';
import type { FunnelStage, Match, FollowupPlan } from '@/types';
import { MATCH_STATUS_LABELS, scoreColorClass } from '@/pages/Matches/constants';

interface Stats {
  positionCount: number;
  resumeCount: number;
  todayFollowup: number;
  monthOnboard: number;
}

// 漏斗配色
const FUNNEL_COLORS = ['#2e6350', '#3f7c63', '#e69238', '#ecb164', '#d9761b'];

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    positionCount: 0,
    resumeCount: 0,
    todayFollowup: 0,
    monthOnboard: 0,
  });
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [todayPlans, setTodayPlans] = useState<FollowupPlan[]>([]);
  const [error, setError] = useState('');
  const [trends, setTrends] = useState<{ month: string; matches: number; conversions: number }[]>([]);
  const [employeePerformance, setEmployeePerformance] = useState<{ name: string; matches: number; onboard: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [
          posRes,
          resRes,
          todayRes,
          recentRes,
          onboardRes,
        ] = await Promise.allSettled([
          positionsApi.list({ page: 1, pageSize: 1 }),
          resumesApi.list({ page: 1, pageSize: 1 }),
          followupsApi.today(),
          matchesApi.list({ page: 1, pageSize: 5 }),
          matchesApi.list({ status: 'onboarded', page: 1, pageSize: 9999 }),
        ]);

        const next: Stats = {
          positionCount: 0,
          resumeCount: 0,
          todayFollowup: 0,
          monthOnboard: 0,
        };
        if (posRes.status === 'fulfilled') next.positionCount = posRes.value.total;
        if (resRes.status === 'fulfilled') next.resumeCount = resRes.value.total;
        if (todayRes.status === 'fulfilled') {
          const plans = todayRes.value || [];
          setTodayPlans(plans);
          next.todayFollowup = plans.length;
        }
        if (recentRes.status === 'fulfilled') {
          setRecentMatches(recentRes.value.data || []);
        }
        if (onboardRes.status === 'fulfilled') {
          const startOfMonth = dayjs().startOf('month');
          const monthCount = (onboardRes.value.data || []).filter((m) =>
            dayjs(m.updated_at).isAfter(startOfMonth) || dayjs(m.updated_at).isSame(startOfMonth)
          ).length;
          next.monthOnboard = monthCount;
        }

        // 管理员才拉漏斗、趋势、业绩
        if (isAdmin) {
          const [funnelRes, trendsRes, perfRes] = await Promise.allSettled([
            reportsApi.funnel(),
            reportsApi.trends(6),
            reportsApi.employeePerformance(),
          ]);
          if (!cancelled) {
            if (funnelRes.status === 'fulfilled') {
              setFunnel(Array.isArray(funnelRes.value) ? funnelRes.value as FunnelStage[] : []);
            }
            if (trendsRes.status === 'fulfilled') {
              setTrends(Array.isArray(trendsRes.value) ? trendsRes.value as { month: string; matches: number; conversions: number }[] : []);
            }
            if (perfRes.status === 'fulfilled') {
              setEmployeePerformance(Array.isArray(perfRes.value) ? perfRes.value as { name: string; matches: number; onboard: number }[] : []);
            }
          }
        }

        if (!cancelled) setStats(next);
      } catch (e) {
        if (!cancelled) setError(getErrorMsg(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (loading) return <Loading className="py-20" />;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-7xl mx-auto">
      {/* 标题 */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100">
          你好，{user?.real_name} 👋
        </h1>
        <p className="text-sm text-forest-500 mt-1 dark:text-forest-400">
          今天也要把每一个求职者稳稳推进到入职。
        </p>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700 dark:bg-risk-900/20 dark:border-risk-800 dark:text-risk-400">
          {error}
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Briefcase}
          label="在招职位数"
          value={stats.positionCount}
          tone="forest"
          link="/positions"
        />
        <StatCard
          icon={FileText}
          label="简历数"
          value={stats.resumeCount}
          tone="ochre"
          link="/resumes"
        />
        <StatCard
          icon={CalendarClock}
          label="今日待回访"
          value={stats.todayFollowup}
          tone="cream"
          link="/followups"
        />
        <StatCard
          icon={TrendingUp}
          label="本月入职数"
          value={stats.monthOnboard}
          tone="forest"
          link="/conversions"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 转化漏斗 */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100">转化漏斗</h2>
            <span className="text-xs text-forest-400">简历入库 → 入职</span>
          </div>
          {isAdmin ? (
            funnel.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <FunnelChart>
                    <Tooltip
                      formatter={(value: number, _name: string, props: { payload?: FunnelStage }) =>
                        [`${value} 人`, props?.payload?.stage ?? '']
                      }
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #dcebe4',
                        fontSize: 12,
                        background: 'var(--tooltip-bg, #fff)',
                      }}
                    />
                    <Funnel
                      data={funnel.map((s, i) => ({
                        name: s.stage,
                        value: s.count,
                        fill: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                      }))}
                      dataKey="value"
                      isAnimationActive={false}
                    >
                      <LabelList position="right" fill="#1f4035" stroke="none" dataKey="name" />
                      <LabelList position="center" fill="#fff" stroke="none" dataKey="value" />
                      {funnel.map((_, i) => (
                        <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                      ))}
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-sm text-forest-400">
                暂无漏斗数据
              </div>
            )
          ) : (
            <div className="h-72 flex items-center justify-center">
              <div className="text-center text-sm text-forest-500 dark:text-forest-400">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-forest-300 dark:text-forest-600" />
                团队报表仅管理员可见
              </div>
            </div>
          )}
        </div>

        {/* 快捷入口 */}
        <div className="card p-5">
          <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-4">快捷入口</h2>
          <div className="space-y-3">
            <QuickAction
              icon={Plus}
              title="新建职位"
              desc="录入新职位（管理员）"
              to="/positions/new"
              disabled={!isAdmin}
              disabledHint="仅管理员"
            />
            <QuickAction
              icon={FileText}
              title="新建简历"
              desc="录入一份求职者简历"
              to="/resumes/new"
            />
            <QuickAction
              icon={GitCompareArrows}
              title="新建匹配"
              desc="选职位+简历生成话术"
              to="/matches/new"
            />
          </div>
        </div>
      </div>

      {/* 员工业绩 + 趋势图（管理员） */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 员工业绩柱状图 */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-forest-600 dark:text-forest-400" />
                员工业绩
              </h2>
            </div>
            {employeePerformance.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={employeePerformance} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #dcebe4',
                        fontSize: 12,
                      }}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="matches"
                      name="匹配数"
                      fill="#2e6350"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="onboard"
                      name="入职数"
                      fill="#e69238"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-forest-400">
                暂无业绩数据
              </div>
            )}
          </div>

          {/* 匹配/转化趋势折线图 */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 flex items-center gap-2">
                <LineChartIcon className="w-5 h-5 text-ochre-500" />
                月度趋势
              </h2>
            </div>
            {trends.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #dcebe4',
                        fontSize: 12,
                      }}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="matches"
                      name="匹配数"
                      stroke="#2e6350"
                      strokeWidth={2}
                      dot={{ fill: '#2e6350', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="conversions"
                      name="转化数"
                      stroke="#e69238"
                      strokeWidth={2}
                      dot={{ fill: '#e69238', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-forest-400">
                暂无趋势数据
              </div>
            )}
          </div>
        </div>
      )}

      {/* 今日待回访 + 最近匹配 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 今日待回访 */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-ochre-500" />
              今日待回访 ({todayPlans.length})
            </h2>
            <Link
              to="/followups"
              className="text-sm text-forest-500 hover:text-forest-700 dark:text-forest-400 dark:hover:text-cream-200 inline-flex items-center gap-1"
            >
              查看全部 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {todayPlans.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-sm text-forest-500 dark:text-forest-400">今天没有待回访的求职者</p>
            </div>
          ) : (
            <ul className="divide-y divide-forest-100 dark:divide-forest-800">
              {todayPlans.slice(0, 3).map((plan) => (
                <li key={plan.id}>
                  <Link
                    to={`/followups/${plan.id}`}
                    className="flex items-center gap-3 py-3 hover:bg-cream-50/50 dark:hover:bg-forest-800/50 -mx-2 px-2 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-forest-800 dark:text-cream-100 truncate">
                          {plan.resume?.name || '—'}
                        </span>
                        <RiskBadge risk={plan.resume?.risk_warning} />
                      </div>
                      <div className="text-xs text-forest-400 mt-0.5 truncate">
                        {plan.resume?.current_company
                          ? `${plan.resume.current_company} · `
                          : ''}
                        {plan.title}
                      </div>
                    </div>
                    <span
                      className="btn-ai text-xs flex items-center gap-1 px-2 py-1 flex-shrink-0 pointer-events-none"
                    >
                      <Sparkles className="w-3 h-3" />
                      开始回访
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 最近匹配 */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 flex items-center gap-2">
              <GitCompareArrows className="w-5 h-5 text-forest-600 dark:text-forest-400" />
              最近匹配
            </h2>
            <Link
              to="/matches"
              className="text-sm text-forest-500 hover:text-forest-700 dark:text-forest-400 dark:hover:text-cream-200 inline-flex items-center gap-1"
            >
              查看全部 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentMatches.length === 0 ? (
            <div className="py-8 text-center">
              <Empty />
              <p className="text-sm text-forest-500 dark:text-forest-400 mt-2">
                <Link to="/matches/new" className="text-forest-600 dark:text-forest-300 underline">
                  立即新建匹配
                </Link>
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-forest-100 dark:divide-forest-800">
              {recentMatches.map((m) => {
                const toneClass =
                  m.status === 'lost'
                    ? 'bg-risk-100 text-risk-700 dark:bg-risk-900/30 dark:text-risk-400'
                    : m.status === 'interview_invited'
                    ? 'bg-ochre-100 text-ochre-700 dark:bg-ochre-900/30 dark:text-ochre-400'
                    : 'bg-forest-100 text-forest-700 dark:bg-forest-800 dark:text-forest-300';
                return (
                  <li key={m.id}>
                    <Link
                      to={`/matches/${m.id}`}
                      className="flex items-center gap-3 py-3 hover:bg-cream-50/50 dark:hover:bg-forest-800/50 -mx-2 px-2 rounded"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-forest-800 dark:text-cream-100 truncate">
                            {m.resume?.name || '—'}
                          </span>
                          <RiskBadge risk={m.resume?.risk_warning} />
                        </div>
                        <div className="text-xs text-forest-400 mt-0.5 truncate">
                          {m.position?.title || '—'}
                          {m.resume?.current_company ? ` · ${m.resume.current_company}` : ''}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className={`font-mono font-semibold ${scoreColorClass(m.score)}`}>
                          {m.score}
                          <span className="text-xs text-forest-400">/100</span>
                        </div>
                        <span className={`badge ${toneClass}`}>
                          {MATCH_STATUS_LABELS[m.status]}
                        </span>
                        <span className="text-xs text-forest-400">
                          {dayjs(m.created_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// 统计卡片
interface StatCardProps {
  icon: typeof Briefcase;
  label: string;
  value: number;
  tone: 'forest' | 'ochre' | 'cream';
  link?: string;
}
function StatCard({ icon: Icon, label, value, tone, link }: StatCardProps) {
  const toneClasses = {
    forest: 'bg-forest-50 text-forest-700 dark:bg-forest-800 dark:text-forest-300',
    ochre: 'bg-ochre-50 text-ochre-700 dark:bg-ochre-900/30 dark:text-ochre-400',
    cream: 'bg-cream-100 text-ochre-700 dark:bg-forest-800 dark:text-ochre-400',
  }[tone];
  const content = (
    <div className="card p-4 hover:shadow-cardHover transition-shadow h-full">
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm text-forest-500 dark:text-forest-400">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${toneClasses}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="font-mono text-3xl font-bold text-forest-800 dark:text-cream-100">{value}</div>
    </div>
  );
  if (link) return <Link to={link}>{content}</Link>;
  return content;
}

// 快捷入口
interface QuickActionProps {
  icon: typeof Plus;
  title: string;
  desc: string;
  to: string;
  disabled?: boolean;
  disabledHint?: string;
}
function QuickAction({ icon: Icon, title, desc, to, disabled, disabledHint }: QuickActionProps) {
  if (disabled) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-forest-200 bg-cream-50 cursor-not-allowed opacity-70 dark:border-forest-700 dark:bg-forest-800/50">
        <div className="w-9 h-9 rounded-lg bg-cream-100 text-forest-400 flex items-center justify-center dark:bg-forest-800 dark:text-forest-500">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-forest-600 dark:text-cream-200">{title}</div>
          <div className="text-xs text-forest-400">{desc}</div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-cream-200 text-forest-500 dark:bg-forest-700 dark:text-forest-400">
          {disabledHint || '暂不可用'}
        </span>
      </div>
    );
  }
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-forest-100 hover:border-forest-300 hover:bg-forest-50 transition-colors dark:border-forest-700 dark:hover:border-forest-600 dark:hover:bg-forest-800"
    >
      <div className="w-9 h-9 rounded-lg bg-forest-100 text-forest-700 flex items-center justify-center dark:bg-forest-800 dark:text-forest-300">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-forest-700 dark:text-cream-100">{title}</div>
        <div className="text-xs text-forest-500 dark:text-forest-400">{desc}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-forest-400" />
    </Link>
  );
}
