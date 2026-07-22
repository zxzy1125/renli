// 系统更新（管理员）：检查远程更新、一键部署
import { useEffect, useState, useRef, useCallback } from 'react';
import { Server, RefreshCcw, Check, X, Loader2, Minus, GitBranch, AlertCircle } from 'lucide-react';
import { systemApi, getErrorMsg } from '@/lib/api';
import Loading from '@/components/Loading';
import type { UpdateStatus, GitStatus } from '@/lib/api';

const STEPS = [
  { key: 'pull', label: '拉取代码' },
  { key: 'install', label: '安装依赖' },
  { key: 'build', label: '构建前端' },
  { key: 'copy', label: '复制文件' },
  { key: 'restart', label: '重启服务' },
] as const;

function StepIcon({ status }: { status?: string }) {
  if (!status || status === 'pending') return <Minus className="w-4 h-4 text-forest-300" />;
  if (status === 'running') return <Loader2 className="w-4 h-4 text-ochre-500 animate-spin" />;
  if (status === 'success') return <Check className="w-4 h-4 text-forest-600" />;
  if (status === 'skipped') return <Minus className="w-4 h-4 text-forest-400" />;
  if (status === 'error') return <X className="w-4 h-4 text-risk-600" />;
  return null;
}

export default function SystemUpdatePage() {
  const [git, setGit] = useState<GitStatus | null>(null);
  const [status, setStatus] = useState<UpdateStatus>({ status: 'idle' });
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState('');
  const [refreshIn, setRefreshIn] = useState(-1);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchGit = useCallback(async () => {
    try {
      const data = await systemApi.getGitStatus();
      setGit(data);
    } catch {
      // 服务器未部署时静默
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await systemApi.getUpdateStatus();
      setStatus(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  // 初始加载
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([fetchGit(), fetchStatus()]);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchGit, fetchStatus]);

  // 启动自动刷新倒计时（硬刷新，清除缓存）
  const startAutoRefresh = useCallback((seconds: number) => {
    setRefreshIn(seconds);
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(() => {
      setRefreshIn((prev) => {
        if (prev <= 1) {
          if (refreshTimerRef.current) { clearInterval(refreshTimerRef.current); refreshTimerRef.current = null; }
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // 轮询逻辑：重启步骤进行中时继续轮询，连续失败 3 次则自动刷新
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    let failCount = 0;
    pollingRef.current = setInterval(async () => {
      const data = await fetchStatus();
      if (!data) {
        // API 失败（pm2 重启期间服务不可用）
        if (status.step === 'restart') {
          failCount++;
          if (failCount >= 3) {
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
            startAutoRefresh(3);
          }
        }
        return;
      }
      failCount = 0;
      if (data.status !== 'running') {
        const restartDone = data.steps?.restart?.status === 'success' || data.steps?.restart?.status === 'error';
        if (data.status === 'completed' && !restartDone) {
          // 重启进行中，继续轮询
          return;
        }
        // 更新结束，停止轮询
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        fetchGit();
        // 成功完成 → 5 秒后自动刷新页面
        if (data.status === 'completed' && data.steps?.restart?.status === 'success') {
          startAutoRefresh(5);
        }
      }
    }, 2000);
  }, [fetchStatus, fetchGit, status.step, startAutoRefresh]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, []);

  // 如果页面加载时正在更新，恢复轮询
  useEffect(() => {
    if (status.status === 'running' && !pollingRef.current) {
      startPolling();
    }
  }, [status.status, startPolling]);

  const handleUpdate = async () => {
    setTriggering(true);
    setError('');
    try {
      await systemApi.triggerUpdate();
      // 写初始轮询状态
      setStatus({ status: 'running', step: 'pull', steps: {} });
      startPolling();
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setTriggering(false);
    }
  };

  if (loading) return <Loading />;

  const isRunning = status.status === 'running';
  const isCompleted = status.status === 'completed';
  const isError = status.status === 'error';
  const restartRunning = isCompleted && status.steps?.restart?.status !== 'success';
  const autoRefreshing = refreshIn >= 0;

  return (
    <div>
      <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-1 flex items-center gap-2">
        <Server className="w-5 h-5" />
        系统更新
      </h2>
      <p className="text-sm text-forest-500 dark:text-forest-400 mb-4">
        检查 GitHub 远程仓库更新，一键部署最新代码到服务器
      </p>

      {error && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Git 状态卡片 */}
      <div className="p-4 rounded-lg bg-cream-50 dark:bg-forest-800 border border-cream-200 dark:border-forest-700 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <GitBranch className="w-4 h-4 text-forest-600" />
          <span className="text-sm font-medium text-forest-800 dark:text-cream-100">仓库状态</span>
        </div>
        {git ? (
          <div className="space-y-2">
            <div className="text-sm text-forest-600 dark:text-forest-300">
              当前分支：<span className="font-mono">{git.currentBranch}</span>
            </div>
            {git.behind > 0 ? (
              <>
                <div className="text-sm text-ochre-600 dark:text-ochre-400">
                  落后远程 <span className="font-semibold">{git.behind}</span> 个提交
                </div>
                <div className="mt-1 p-2 rounded bg-forest-50 dark:bg-forest-900 border border-forest-100 dark:border-forest-700 max-h-32 overflow-y-auto">
                  {git.commits.map((c, i) => (
                    <div key={i} className="text-xs font-mono text-forest-600 dark:text-forest-300 py-0.5">{c}</div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-forest-600 dark:text-forest-400">
                <Check className="w-3.5 h-3.5 inline mr-1" />
                已是最新版本
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-forest-500 dark:text-forest-400">
            无法获取仓库信息（可能不在服务器环境）
          </div>
        )}
      </div>

      {/* 更新按钮 */}
      <div className="mb-4">
        <button
          onClick={handleUpdate}
          disabled={triggering || isRunning || restartRunning || autoRefreshing || (!git || git.behind === 0)}
          className="btn-primary flex items-center gap-1.5 disabled:opacity-60"
        >
          <RefreshCcw className={`w-4 h-4 ${isRunning || restartRunning ? 'animate-spin' : ''}`} />
          {triggering ? '触发中...' : isRunning || restartRunning ? '更新中...' : isCompleted ? '更新完成' : '开始更新'}
        </button>
        {git && git.behind === 0 && !isRunning && !isCompleted && (
          <p className="text-xs text-forest-400 dark:text-forest-500 mt-1.5">
            当前已是最新，无需更新
          </p>
        )}
      </div>

      {/* 进度展示 */}
      {(isRunning || isCompleted || isError) && (
        <div className="p-4 rounded-lg bg-cream-50 dark:bg-forest-800 border border-cream-200 dark:border-forest-700">
          <div className="text-sm font-medium text-forest-800 dark:text-cream-100 mb-3">
            更新进度
          </div>
          <div className="space-y-2">
            {STEPS.map((s) => {
              const stepData = status.steps?.[s.key];
              return (
                <div key={s.key} className="flex items-center gap-2">
                  <StepIcon status={stepData?.status} />
                  <span className={`text-sm ${
                    stepData?.status === 'error'
                      ? 'text-risk-600 dark:text-risk-400'
                      : 'text-forest-700 dark:text-forest-300'
                  }`}>
                    {s.label}
                  </span>
                  {stepData?.status === 'running' && (
                    <Loader2 className="w-3 h-3 text-ochre-500 animate-spin" />
                  )}
                  {stepData?.status === 'skipped' && (
                    <span className="text-xs text-forest-400 dark:text-forest-500">（跳过）</span>
                  )}
                  {stepData?.message && stepData.status === 'error' && (
                    <span className="text-xs text-risk-500 dark:text-risk-400 truncate max-w-xs">
                      {stepData.message}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {(isCompleted || autoRefreshing) && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-forest-50 dark:bg-forest-800/50 border border-forest-100 dark:border-forest-800 text-sm text-forest-700 dark:text-cream-200">
              <Check className="w-4 h-4 inline mr-1" />
              {autoRefreshing
                ? <>更新完成！页面将在 <span className="font-semibold">{refreshIn}</span> 秒后自动刷新...</>
                : restartRunning
                  ? '正在重启服务，完成后页面将自动刷新...'
                  : '更新完成！页面将自动刷新...'
              }
            </div>
          )}

          {isError && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400">
              <X className="w-4 h-4 inline mr-1" />
              更新过程中出现错误，请检查上方错误信息。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
