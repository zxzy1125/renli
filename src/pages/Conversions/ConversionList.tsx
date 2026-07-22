// 转化跟踪页：状态漏斗 + 状态分布卡片 + 匹配记录表格 + 管理员报表
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Search,
  Eye,
  Filter,
  Users,
  Building2,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  LabelList,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import dayjs from 'dayjs';
import { matchesApi, reportsApi, getErrorMsg } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { Match, MatchStatus } from '@/types';
import Loading from '@/components/Loading';
import Empty from '@/components/Empty';
import Pagination from '@/components/Pagination';
import { RiskBadge } from '@/components/RiskBadge';
import { MATCH_STATUS_LABELS, scoreColorClass } from '@/pages/Matches/constants';

const PAGE_SIZE = 10;

// 6 个状态阶段顺序（漏斗展示）
const STATUS_PIPELINE: MatchStatus[] = [
  'consulting',
  'interview_invited',
  'interview_passed',
  'offer_sent',
  'onboarded',
  'lost',
];

// 漏斗条配色（forest → ochre → risk 渐变）
const STATUS_BAR_COLORS: Record<MatchStatus, string> = {
  consulting: '#2e6350',
  interview_invited: '#3f7c63',
  interview_passed: '#5a9978',
  offer_sent: '#e69238',
  onboarded: '#2e6350',
  lost: '#c8553d',
};

// 状态分布卡片色调
const CARD_TONES: Record<MatchStatus, string> = {
  consulting: 'bg-forest-50 border-forest-200 dark:bg-forest-800 dark:border-forest-700',
  interview_invited: 'bg-ochre-50 border-ochre-200',
  interview_passed: 'bg-forest-50 border-forest-200 dark:bg-forest-800 dark:border-forest-700',
  offer_sent: 'bg-cream-100 border-cream-300 dark:bg-forest-800',
  onboarded: 'bg-forest-100 border-forest-300 dark:bg-forest-800 dark:border-forest-700',
  lost: 'bg-risk-50 border-risk-200 dark:bg-risk-900/20 dark:border-risk-800',
};

const CARD_TEXT_TONES: Record<MatchStatus, string> = {
  consulting: 'text-forest-700 dark:text-cream-200',
  interview_invited: 'text-ochre-700',
  interview_passed: 'text-forest-700 dark:text-cream-200',
  offer_sent: 'text-ochre-700',
  onboarded: 'text-forest-800 dark:text-cream-100',
  lost: 'text-risk-700 dark:text-risk-400',
};

// 状态下拉选项
const STATUS_OPTIONS: { value: '' | MatchStatus; label: string }[] = [
  { value: '', label: '全部状态' },
  ...STATUS_PIPELINE.map((s) => ({ value: s, label: MATCH_STATUS_LABELS[s] })),
];

export default function ConversionList() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();

  // 全量匹配（漏斗 + 卡片用）
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // 列表分页
  const [list, setList] = useState<Match[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | MatchStatus>('');
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState('');

  // toast 提示
  const [toast, setToast] = useState('');

  // 拉取全量匹配（用于漏斗 + 状态卡片）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingStats(true);
      try {
        const res = await matchesApi.list({ pageSize: 9999 });
        if (!cancelled) setAllMatches(res.data || []);
      } catch (err) {
        if (!cancelled) setError(getErrorMsg(err));
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 按状态分组统计
  const statusCounts = useMemo(() => {
    const map: Record<MatchStatus, number> = {
      consulting: 0,
      interview_invited: 0,
      interview_passed: 0,
      offer_sent: 0,
      onboarded: 0,
      lost: 0,
    };
    allMatches.forEach((m) => {
      map[m.status] = (map[m.status] || 0) + 1;
    });
    return map;
  }, [allMatches]);

  // 漏斗数据：每个阶段数量 + 占咨询中比例
  const funnelData = useMemo(() => {
    const baseCount = statusCounts.consulting || 0;
    return STATUS_PIPELINE.map((status) => {
      const count = statusCounts[status] || 0;
      const rate = baseCount > 0 ? Math.round((count / baseCount) * 100) : 0;
      return {
        status,
        label: MATCH_STATUS_LABELS[status],
        count,
        rate,
      };
    });
  }, [statusCounts]);

  const totalCount = allMatches.length;

  // toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // 拉取表格分页列表
  const fetchList = useCallback(async () => {
    setLoadingList(true);
    setError('');
    try {
      const res = await matchesApi.list({
        keyword: keyword || undefined,
        status: statusFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setList(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setLoadingList(false);
    }
  }, [keyword, statusFilter, page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchList();
  };

  const handleStatusChange = (value: '' | MatchStatus) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      {/* toast 提示 */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-forest-800 text-cream-50 text-sm shadow-cardHover">
          {toast}
        </div>
      )}

      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-ochre-500" />
            转化跟踪
          </h1>
          <p className="text-sm text-forest-500 dark:text-cream-300 mt-1">
            {isAdmin ? '团队全链路状态漏斗，一眼看出每阶段转化情况' : '你的匹配状态总览，关注每一步推进'}
          </p>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400">
          {error}
        </div>
      )}

      {/* ===== Section 1：转化漏斗 ===== */}
      <section className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100">转化漏斗</h2>
          <span className="text-xs text-forest-400 dark:text-forest-500">
            共 {totalCount} 条匹配 · 占咨询中比例
          </span>
        </div>
        {loadingStats ? (
          <Loading />
        ) : totalCount === 0 ? (
          <div className="py-8">
            <Empty />
            <p className="text-center text-sm text-forest-500 dark:text-cream-300 mt-2">暂无匹配数据</p>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 5, right: 60, bottom: 5, left: 20 }}
              >
                <CartesianGrid horizontal={false} stroke="#e8efe9" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={80}
                  tick={{ fill: '#1f4035', fontSize: 13 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(46, 99, 80, 0.08)' }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #dcebe4',
                    fontSize: 12,
                  }}
                  formatter={(value: number, _name: string, props: { payload?: { rate: number; label: string } }) => {
                    const rate = props?.payload?.rate ?? 0;
                    return [`${value} 人 · 转化率 ${rate}%`, props?.payload?.label ?? ''];
                  }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={26} isAnimationActive={false}>
                  {funnelData.map((d) => (
                    <Cell key={d.status} fill={STATUS_BAR_COLORS[d.status]} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="right"
                    fill="#1f4035"
                    stroke="none"
                    fontSize={13}
                    formatter={(value: number) => `${value} 人`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ===== Section 2：状态分布卡片 ===== */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-5 h-5 text-forest-500" />
          <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100">状态分布</h2>
        </div>
        {loadingStats ? (
          <Loading />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {STATUS_PIPELINE.map((status) => {
              const count = statusCounts[status] || 0;
              const ratio = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
              return (
                <Link
                  key={status}
                  to={`/matches?status=${status}`}
                  className={`card p-4 border ${CARD_TONES[status]} hover:shadow-cardHover transition-shadow`}
                >
                  <div className={`text-xs ${CARD_TEXT_TONES[status]} mb-2`}>
                    {MATCH_STATUS_LABELS[status]}
                  </div>
                  <div className="font-mono text-2xl font-bold text-forest-800 dark:text-cream-100">{count}</div>
                  <div className="text-xs text-forest-400 dark:text-forest-500 mt-1">占比 {ratio}%</div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== Section 3：匹配记录表格 ===== */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-forest-500" />
          <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100">匹配记录</h2>
        </div>

        {/* 筛选栏 */}
        <form onSubmit={handleSearch} className="card p-4 mb-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400 dark:text-forest-500" />
            <input
              type="text"
              className="input pl-9"
              placeholder="搜索求职者姓名 / 职位名"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <select
            className="input w-40"
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value as '' | MatchStatus)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary">
            搜索
          </button>
        </form>

        {/* 表格 */}
        {loadingList ? (
          <Loading />
        ) : list.length === 0 ? (
          <div className="card p-12">
            <Empty />
            <p className="text-center text-sm text-forest-500 dark:text-cream-300 mt-2">
              暂无匹配记录，{''}
              <Link to="/matches/new" className="text-forest-600 dark:text-cream-300 underline">
                立即新建匹配
              </Link>
            </p>
          </div>
        ) : (
          <>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-cream-100 dark:bg-forest-800 text-forest-600 dark:text-cream-300 text-left">
                      <th className="px-4 py-3 font-medium">求职者</th>
                      <th className="px-4 py-3 font-medium">职位</th>
                      <th className="px-4 py-3 font-medium">匹配度</th>
                      <th className="px-4 py-3 font-medium">转化概率</th>
                      <th className="px-4 py-3 font-medium">当前状态</th>
                      <th className="px-4 py-3 font-medium">创建时间</th>
                      <th className="px-4 py-3 font-medium">最后更新</th>
                      <th className="px-4 py-3 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((m) => (
                      <ConversionRow
                        key={m.id}
                        match={m}
                        onView={() => navigate(`/matches/${m.id}`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
          </>
        )}
      </section>

      {/* ===== Section 4：管理员报表 ===== */}
      {isAdmin && <AdminReports onToast={setToast} />}
    </div>
  );
}

// ===== 匹配记录行 =====
function ConversionRow({ match, onView }: { match: Match; onView: () => void }) {
  const resumeName = match.resume?.name || '—';
  const positionTitle = match.position?.title || '—';
  const isRisky = match.resume?.risk_warning?.isRisky;

  const toneClass =
    match.status === 'lost'
      ? 'bg-risk-100 text-risk-700 dark:bg-risk-900/20 dark:text-risk-400'
      : match.status === 'interview_invited'
      ? 'bg-ochre-100 text-ochre-700'
      : 'bg-forest-100 text-forest-700 dark:bg-forest-800 dark:text-cream-200';

  return (
    <tr
      className="border-t border-forest-50 dark:border-forest-800 hover:bg-cream-50/50 dark:hover:bg-forest-800/50 cursor-pointer"
      onClick={onView}
    >
      {/* 求职者 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-forest-800 dark:text-cream-100">{resumeName}</span>
          {isRisky && <RiskBadge risk={match.resume?.risk_warning} />}
        </div>
        {match.resume?.current_company && (
          <div className="text-xs text-forest-400 dark:text-forest-500 mt-0.5">{match.resume.current_company}</div>
        )}
      </td>
      {/* 职位 */}
      <td className="px-4 py-3">
        <div className="text-forest-700 dark:text-cream-200">{positionTitle}</div>
        {match.position?.location && (
          <div className="text-xs text-forest-400 dark:text-forest-500 mt-0.5">{match.position.location}</div>
        )}
      </td>
      {/* 匹配度 */}
      <td className="px-4 py-3">
        <div className={`font-mono font-semibold text-lg ${scoreColorClass(match.score)}`}>
          {match.score}
        </div>
        <div className="text-xs text-forest-400 dark:text-forest-500">/ 100</div>
      </td>
      {/* 转化概率 */}
      <td className="px-4 py-3">
        <span className="font-mono text-forest-700 dark:text-cream-200">{match.conversion_probability}%</span>
      </td>
      {/* 状态 */}
      <td className="px-4 py-3">
        <span className={`badge ${toneClass}`}>{MATCH_STATUS_LABELS[match.status]}</span>
      </td>
      {/* 创建时间 */}
      <td className="px-4 py-3 text-forest-500 dark:text-cream-300 text-xs">
        {dayjs(match.created_at).format('YYYY-MM-DD HH:mm')}
      </td>
      {/* 最后更新 */}
      <td className="px-4 py-3 text-forest-500 dark:text-cream-300 text-xs">
        {dayjs(match.updated_at).format('YYYY-MM-DD HH:mm')}
      </td>
      {/* 操作 */}
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onView}
          className="btn-ghost text-xs px-2 py-1 inline-flex items-center gap-1"
        >
          <Eye className="w-3.5 h-3.5" />
          查看
        </button>
      </td>
    </tr>
  );
}

// ===== 管理员报表区 =====
type AdminTab = 'employee' | 'client';

function AdminReports({ onToast }: { onToast: (msg: string) => void }) {
  const [tab, setTab] = useState<AdminTab>('employee');
  const [empRows, setEmpRows] = useState<Record<string, unknown>[]>([]);
  const [clientRows, setClientRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [emp, cli] = await Promise.all([
          reportsApi.employeePerformance(),
          reportsApi.clientSummary(),
        ]);
        if (!cancelled) {
          // 兜底：确保一定是数组（API 返回 null/对象时降级为空数组，避免 .map 报错）
          setEmpRows(Array.isArray(emp) ? (emp as Record<string, unknown>[]) : []);
          setClientRows(Array.isArray(cli) ? (cli as Record<string, unknown>[]) : []);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = getErrorMsg(err);
          setError(msg);
          onToast(`报表加载失败：${msg}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onToast]);

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-ochre-500" />
        <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100">团队报表</h2>
        <span className="text-xs px-2 py-0.5 rounded bg-forest-100 dark:bg-forest-800 text-forest-700 dark:text-cream-200">管理员</span>
      </div>

      <div className="card">
        {/* Tab 切换 */}
        <div className="flex items-center border-b border-forest-100 dark:border-forest-800">
          <TabButton
            active={tab === 'employee'}
            onClick={() => setTab('employee')}
            icon={Users}
            label="员工绩效"
          />
          <TabButton
            active={tab === 'client'}
            onClick={() => setTab('client')}
            icon={Building2}
            label="客户公司汇总"
          />
        </div>

        {loading ? (
          <Loading />
        ) : error ? (
          <div className="px-4 py-8 text-center text-sm text-risk-600 dark:text-risk-400">{error}</div>
        ) : tab === 'employee' ? (
          <EmployeeTable rows={empRows} />
        ) : (
          <ClientTable rows={clientRows} />
        )}
      </div>
    </section>
  );
}

// Tab 按钮
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px inline-flex items-center gap-1.5 ${
        active
          ? 'border-forest-500 text-forest-800 dark:text-cream-100'
          : 'border-transparent text-forest-500 dark:text-cream-300 hover:text-forest-700 dark:hover:text-cream-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// 员工绩效表格
function EmployeeTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-8">
        <Empty />
        <p className="text-center text-sm text-forest-500 dark:text-cream-300 mt-2">暂无员工绩效数据</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-cream-50 dark:bg-forest-800 text-forest-600 dark:text-cream-300 text-left border-b border-forest-100 dark:border-forest-800">
            <th className="px-4 py-2.5 font-medium">员工名</th>
            <th className="px-4 py-2.5 font-medium">部门</th>
            <th className="px-4 py-2.5 font-medium text-right">简历数</th>
            <th className="px-4 py-2.5 font-medium text-right">咨询数</th>
            <th className="px-4 py-2.5 font-medium text-right">Offer 数</th>
            <th className="px-4 py-2.5 font-medium text-right">入职数</th>
            <th className="px-4 py-2.5 font-medium text-right">转化率</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-forest-100 dark:divide-forest-800">
          {rows.map((row, i) => {
            const matchCount = Number(row.match_count || 0);
            const onboardedCount = Number(row.onboarded_count || 0);
            const rate = matchCount > 0 ? Math.round((onboardedCount / matchCount) * 100) : 0;
            return (
              <tr key={(row.employee_id as string) || i} className="hover:bg-cream-50/50 dark:hover:bg-forest-800/50">
                <td className="px-4 py-3 font-medium text-forest-800 dark:text-cream-100">
                  {String(row.real_name || '—')}
                </td>
                <td className="px-4 py-3 text-forest-600 dark:text-cream-300">
                  {String(row.department || '—')}
                </td>
                <td className="px-4 py-3 text-right font-mono text-forest-700 dark:text-cream-200">
                  {Number(row.resume_count || 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-forest-700 dark:text-cream-200">
                  {matchCount}
                </td>
                <td className="px-4 py-3 text-right font-mono text-ochre-700">
                  {Number(row.offered_count || 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-forest-700 dark:text-cream-200 font-semibold">
                  {onboardedCount}
                </td>
                <td className="px-4 py-3 text-right font-mono text-forest-700 dark:text-cream-200">{rate}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// 客户公司汇总表格
function ClientTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-8">
        <Empty />
        <p className="text-center text-sm text-forest-500 dark:text-cream-300 mt-2">暂无客户公司汇总数据</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-cream-50 dark:bg-forest-800 text-forest-600 dark:text-cream-300 text-left border-b border-forest-100 dark:border-forest-800">
            <th className="px-4 py-2.5 font-medium">客户名</th>
            <th className="px-4 py-2.5 font-medium">行业</th>
            <th className="px-4 py-2.5 font-medium text-right">职位数</th>
            <th className="px-4 py-2.5 font-medium text-right">咨询数</th>
            <th className="px-4 py-2.5 font-medium text-right">入职数</th>
            <th className="px-4 py-2.5 font-medium text-right">转化率</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-forest-100 dark:divide-forest-800">
          {rows.map((row, i) => {
            const matchCount = Number(row.match_count || 0);
            const onboardedCount = Number(row.onboarded_count || 0);
            const rate = matchCount > 0 ? Math.round((onboardedCount / matchCount) * 100) : 0;
            return (
              <tr key={(row.client_id as string) || i} className="hover:bg-cream-50/50 dark:hover:bg-forest-800/50">
                <td className="px-4 py-3 font-medium text-forest-800 dark:text-cream-100">
                  {String(row.client_name || '—')}
                </td>
                <td className="px-4 py-3 text-forest-600 dark:text-cream-300">
                  {String(row.industry || '—')}
                </td>
                <td className="px-4 py-3 text-right font-mono text-forest-700 dark:text-cream-200">
                  {Number(row.position_count || 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-forest-700 dark:text-cream-200">
                  {matchCount}
                </td>
                <td className="px-4 py-3 text-right font-mono text-forest-700 dark:text-cream-200 font-semibold">
                  {onboardedCount}
                </td>
                <td className="px-4 py-3 text-right font-mono text-forest-700 dark:text-cream-200">{rate}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
