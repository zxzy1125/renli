// AI 智能匹配页：自动扫描空闲人才，与开放职位进行 AI 匹配分析
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Eye,
  Users,
  Building2,
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { aiApi, positionsApi, getErrorMsg } from '@/lib/api';
import type { Position } from '@/types';
import type { SmartMatchEvent, SmartMatchResult } from '@/lib/api';
import Loading from '@/components/Loading';
import { scoreColorClass } from './constants';

const RESUME_STATUS_OPTIONS = [
  { value: 'looking', label: '求职中' },
  { value: 'unemployed', label: '未就业' },
  { value: 'passive', label: '被动看机会' },
];

export default function SmartMatch() {
  const navigate = useNavigate();

  // 统计数据
  const [stats, setStats] = useState<{
    open_positions: number;
    available_resumes: number;
    existing_matches: number;
    estimated_pairs: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // 配置
  const [statusFilter, setStatusFilter] = useState<string[]>(['looking', 'unemployed']);
  const [selectedPosIds, setSelectedPosIds] = useState<string[]>([]);
  const [positionMode, setPositionMode] = useState<'all' | 'select'>('all');
  const [positions, setPositions] = useState<Position[]>([]);
  const [posLoading, setPosLoading] = useState(false);

  // 执行状态
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<SmartMatchEvent | null>(null);
  const [result, setResult] = useState<SmartMatchResult | null>(null);
  const [error, setError] = useState('');

  // 加载统计
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await aiApi.smartMatchStats();
      setStats(res);
    } catch {
      // ignore
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // 加载职位列表（选择模式）
  const loadPositions = useCallback(async () => {
    setPosLoading(true);
    try {
      const res = await positionsApi.list({ status: 'open', page: 1, pageSize: 100 });
      setPositions(res.data || []);
    } catch {
      setPositions([]);
    } finally {
      setPosLoading(false);
    }
  }, []);

  useEffect(() => {
    if (positionMode === 'select') loadPositions();
  }, [positionMode, loadPositions]);

  // 切换简历状态
  const toggleStatus = (val: string) => {
    setStatusFilter((prev) =>
      prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]
    );
  };

  // 切换职位选择
  const togglePosition = (id: string) => {
    setSelectedPosIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  // 开始智能匹配
  const handleStart = async () => {
    if (statusFilter.length === 0) {
      setError('请至少选择一种简历范围');
      return;
    }
    setRunning(true);
    setResult(null);
    setProgress(null);
    setError('');

    const body: { position_ids?: string[]; status_filter?: string[] } = {
      status_filter: statusFilter,
    };
    if (positionMode === 'select' && selectedPosIds.length > 0) {
      body.position_ids = selectedPosIds;
    }

    try {
      await aiApi.smartMatch(body, (event) => {
        setProgress(event);
        if (event.type === 'complete' && event.result) {
          setResult(event.result);
        }
        if (event.type === 'error' && event.error) {
          setError(event.error);
        }
      });
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      {/* 顶部导航 */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => navigate('/matches')}
          className="btn-ghost inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> 返回匹配列表
        </button>
      </div>

      {/* 页面标题 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-6 h-6 text-ochre-500" />
          <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100">AI 智能匹配</h1>
        </div>
        <p className="text-sm text-forest-500 dark:text-forest-400">
          自动扫描简历库空闲人才，与开放职位进行 AI 匹配分析，把手里空闲人才全部利用起来
        </p>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 配置面板 */}
      {!result && (
        <div className="card p-5 mb-4">
          <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-ochre-500" />
            匹配配置
          </h2>

          {/* 统计概览 */}
          {statsLoading ? (
            <Loading text="加载统计数据..." />
          ) : stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <StatCard label="开放职位" value={stats.open_positions} icon={<Building2 className="w-4 h-4" />} />
              <StatCard label="空闲人才" value={stats.available_resumes} icon={<Users className="w-4 h-4" />} />
              <StatCard label="已有匹配" value={stats.existing_matches} icon={<CheckCircle2 className="w-4 h-4" />} />
              <StatCard label="预估匹配对" value={stats.estimated_pairs} icon={<Sparkles className="w-4 h-4" />} />
            </div>
          )}

          {/* 简历范围 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-forest-700 dark:text-cream-200 mb-2">简历范围</label>
            <div className="flex flex-wrap gap-3">
              {RESUME_STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                    statusFilter.includes(opt.value)
                      ? 'border-forest-500 bg-forest-50 text-forest-700 dark:bg-forest-800 dark:border-forest-500 dark:text-cream-100'
                      : 'border-forest-200 text-forest-500 hover:border-forest-300 dark:border-forest-700 dark:text-forest-400 dark:hover:border-forest-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={statusFilter.includes(opt.value)}
                    onChange={() => toggleStatus(opt.value)}
                    className="sr-only"
                  />
                  {statusFilter.includes(opt.value) && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* 职位范围 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-forest-700 dark:text-cream-200 mb-2">职位范围</label>
            <div className="flex gap-3 mb-3">
              <button
                type="button"
                onClick={() => setPositionMode('all')}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                  positionMode === 'all'
                    ? 'border-forest-500 bg-forest-50 text-forest-700 dark:bg-forest-800 dark:border-forest-500 dark:text-cream-100'
                    : 'border-forest-200 text-forest-500 hover:border-forest-300 dark:border-forest-700 dark:text-forest-400'
                }`}
              >
                全部开放职位
              </button>
              <button
                type="button"
                onClick={() => setPositionMode('select')}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                  positionMode === 'select'
                    ? 'border-forest-500 bg-forest-50 text-forest-700 dark:bg-forest-800 dark:border-forest-500 dark:text-cream-100'
                    : 'border-forest-200 text-forest-500 hover:border-forest-300 dark:border-forest-700 dark:text-forest-400'
                }`}
              >
                指定职位
              </button>
            </div>
            {positionMode === 'select' && (
              <div className="border border-forest-200 dark:border-forest-700 rounded-lg p-3 max-h-48 overflow-y-auto">
                {posLoading ? (
                  <Loading text="加载职位列表..." className="py-4" />
                ) : positions.length === 0 ? (
                  <p className="text-sm text-forest-400 dark:text-forest-500 text-center py-3">暂无开放职位</p>
                ) : (
                  positions.map((pos) => (
                    <label
                      key={pos.id}
                      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-cream-50 dark:hover:bg-forest-800 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPosIds.includes(pos.id)}
                        onChange={() => togglePosition(pos.id)}
                        className="w-4 h-4 rounded border-forest-300 text-forest-600 focus:ring-forest-500"
                      />
                      <span className="text-forest-700 dark:text-cream-200">{pos.title}</span>
                      {pos.location && (
                        <span className="text-forest-400 dark:text-forest-500 text-xs">· {pos.location}</span>
                      )}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 开始按钮 */}
          <button
            type="button"
            onClick={handleStart}
            disabled={running || statusFilter.length === 0 || (positionMode === 'select' && selectedPosIds.length === 0)}
            className="btn-ai flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                匹配中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                开始智能匹配
              </>
            )}
          </button>
        </div>
      )}

      {/* 进度面板 */}
      {running && progress && (
        <div className="card p-5 mb-4">
          <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-3 flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-ochre-500" />
            匹配进度
          </h2>
          {/* 进度条 */}
          {progress.total_pairs && progress.current && (
            <div className="mb-3">
              <div className="flex justify-between text-sm text-forest-600 dark:text-forest-400 mb-1">
                <span>已完成 {progress.current} / {progress.total_pairs}</span>
                <span>{Math.round((progress.current / progress.total_pairs) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-forest-100 dark:bg-forest-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-forest-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((progress.current / progress.total_pairs) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {/* 当前分析项 */}
          {progress.type === 'progress' && progress.position_title && (
            <p className="text-sm text-forest-500 dark:text-forest-400 mb-2">
              正在分析「{progress.position_title}」vs「{progress.resume_name}」的匹配度
            </p>
          )}
          {/* 统计 */}
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1 text-forest-600 dark:text-forest-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> 已创建: {progress.matched ?? 0}
            </span>
            <span className="flex items-center gap-1 text-ochre-600 dark:text-ochre-400">
              <AlertCircle className="w-3.5 h-3.5" /> 跳过: {progress.skipped ?? 0}
            </span>
            <span className="flex items-center gap-1 text-risk-600 dark:text-risk-400">
              <XCircle className="w-3.5 h-3.5" /> 失败: {progress.failed ?? 0}
            </span>
          </div>
        </div>
      )}

      {/* 结果面板 */}
      {result && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-forest-500" />
              匹配完成
            </h2>
            <button
              type="button"
              onClick={() => { setResult(null); setProgress(null); loadStats(); }}
              className="btn-secondary text-sm"
            >
              重新匹配
            </button>
          </div>

          {/* 汇总统计 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatCard label="总匹配对" value={result.total_pairs} icon={<Zap className="w-4 h-4" />} />
            <StatCard label="成功" value={result.matched} icon={<CheckCircle2 className="w-4 h-4 text-forest-500" />} />
            <StatCard label="跳过" value={result.skipped} icon={<AlertCircle className="w-4 h-4 text-ochre-500" />} />
            <StatCard label="失败" value={result.failed} icon={<XCircle className="w-4 h-4 text-risk-500" />} />
          </div>

          {/* 按职位分组的结果 */}
          {result.results.length === 0 ? (
            <p className="text-sm text-forest-400 dark:text-forest-500 text-center py-8">暂无匹配结果</p>
          ) : (
            <div className="space-y-4">
              {result.results.map((group) => (
                <div key={group.position_id} className="border border-forest-200 dark:border-forest-700 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-forest-50 dark:bg-forest-800/50 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-forest-600 dark:text-forest-400" />
                    <span className="font-medium text-forest-800 dark:text-cream-100">{group.position_title}</span>
                    <span className="text-xs text-forest-500 dark:text-forest-400 ml-auto">
                      {group.matches.length} 条匹配
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-forest-100 dark:border-forest-700 text-left text-forest-500 dark:text-forest-400">
                          <th className="px-4 py-2 font-medium">候选人</th>
                          <th className="px-4 py-2 font-medium w-20">分数</th>
                          <th className="px-4 py-2 font-medium">推荐建议</th>
                          <th className="px-4 py-2 font-medium w-20">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.matches.map((m) => (
                          <tr
                            key={m.resume_id}
                            className="border-b border-forest-50 dark:border-forest-800 last:border-0 hover:bg-cream-50 dark:hover:bg-forest-800/30"
                          >
                            <td className="px-4 py-2 text-forest-700 dark:text-cream-200">{m.resume_name}</td>
                            <td className="px-4 py-2">
                              <span className={`font-semibold ${m.score != null ? scoreColorClass(m.score) : 'text-forest-400'}`}>
                                {m.score ?? '-'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-forest-600 dark:text-forest-400 max-w-xs truncate">
                              {m.recommendation || '-'}
                            </td>
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                onClick={() => navigate(`/matches/${m.match_id}`)}
                                className="text-forest-600 hover:text-forest-800 dark:text-forest-400 dark:hover:text-cream-100 flex items-center gap-1 text-sm"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                查看
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 加载中（初始统计） */}
      {!result && !running && statsLoading && <Loading text="加载中..." />}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-cream-50 dark:bg-forest-800/50 border border-forest-100 dark:border-forest-700">
      <div className="flex items-center gap-1.5 text-forest-500 dark:text-forest-400 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-lg font-semibold text-forest-800 dark:text-cream-100">{value}</span>
    </div>
  );
}
