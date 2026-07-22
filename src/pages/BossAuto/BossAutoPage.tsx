// Boss 自动化控制台
// 功能：Chrome 连接管理 + 打招呼任务控制 + 实时统计 + 操作日志
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  PlayCircle,
  StopCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Activity,
  MessageSquare,
  Eye,
  Bot,
  LogOut,
  Link2,
  AlertCircle,
} from 'lucide-react';
import { bossAutoApi, getErrorMsg, type BossAutoStatus, type BossTaskStatus, type BossTodayStat } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';

export default function BossAutoPage() {
  const [status, setStatus] = useState<BossAutoStatus | null>(null);
  const [taskStatus, setTaskStatus] = useState<BossTaskStatus | null>(null);
  const [stat, setStat] = useState<BossTodayStat | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // 任务配置
  const [city, setCity] = useState('101010100');  // 默认北京
  const [maxCount, setMaxCount] = useState(50);
  const [template, setTemplate] = useState('');
  const [browseRatio, setBrowseRatio] = useState(0.2);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 拉取状态
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, t, st, lg] = await Promise.all([
        bossAutoApi.getStatus(),
        bossAutoApi.getTaskStatus(),
        bossAutoApi.getTodayStat(),
        bossAutoApi.getLogs({ limit: 20 }),
      ]);
      setStatus(s);
      setTaskStatus(t);
      setStat(st);
      setLogs(lg);
    } catch (err: any) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // 每 3 秒轮询任务状态（任务运行时）
    pollTimerRef.current = setInterval(async () => {
      try {
        const t = await bossAutoApi.getTaskStatus();
        setTaskStatus(t);
        if (t.isRunning) {
          // 运行中顺便刷新统计
          const st = await bossAutoApi.getTodayStat();
          setStat(st);
        }
      } catch {}
    }, 3000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [refresh]);

  // 连接 Chrome
  const handleConnect = async () => {
    setActionLoading(true);
    setError('');
    try {
      const r = await bossAutoApi.connect();
      setToast(r.message);
      setTimeout(() => setToast(''), 3000);
      await refresh();
    } catch (err: any) {
      setError(getErrorMsg(err));
    } finally {
      setActionLoading(false);
    }
  };

  // 断开
  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      await bossAutoApi.disconnect();
      await refresh();
    } catch (err: any) {
      setError(getErrorMsg(err));
    } finally {
      setActionLoading(false);
    }
  };

  // 启动打招呼
  const handleStart = async () => {
    setActionLoading(true);
    setError('');
    try {
      const r = await bossAutoApi.startSayHello({
        city,
        template: template || undefined,
        maxCount,
        browseRatio,
      });
      setToast(r.message);
      setTimeout(() => setToast(''), 3000);
    } catch (err: any) {
      setError(getErrorMsg(err));
    } finally {
      setActionLoading(false);
    }
  };

  // 停止打招呼
  const handleStop = async () => {
    setActionLoading(true);
    try {
      await bossAutoApi.stopSayHello();
      setToast('已发送停止信号');
      setTimeout(() => setToast(''), 3000);
    } catch (err: any) {
      setError(getErrorMsg(err));
    } finally {
      setActionLoading(false);
    }
  };

  const isConnected = status?.connected ?? false;
  const isAgentOnline = status?.agentOnline ?? false;
  const isRunning = taskStatus?.isRunning ?? false;

  return (
    <div className="p-6 space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold dark:text-cream-100">Boss 自动化</h1>
          <p className="text-sm text-forest-600 dark:text-cream-300 mt-1">
            自动打招呼 / 复聊 / 智能沟通 · 防封号策略已启用
          </p>
        </div>
        <Button variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* Agent + Chrome 连接状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-5 h-5 text-green-600" />
            ) : isAgentOnline ? (
              <Wifi className="w-5 h-5 text-amber-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            连接状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              {/* Agent 在线状态 */}
              <div className="flex items-center gap-2">
                <Badge variant={isAgentOnline ? 'success' : 'danger'}>
                  {isAgentOnline ? 'Agent 在线' : 'Agent 离线'}
                </Badge>
                {status?.agentUser && (
                  <span className="text-xs text-forest-500 dark:text-forest-400">
                    账号：{status.agentUser.name}
                  </span>
                )}
              </div>
              {/* Chrome 连接状态 */}
              <div className="flex items-center gap-2">
                <Badge variant={isConnected ? 'success' : 'warning'}>
                  Chrome {isConnected ? '已连接' : '未连接'}
                </Badge>
                {status?.bossUser && (
                  <span className="text-sm text-forest-700 dark:text-cream-200">
                    Boss 用户：<strong>{status.bossUser.name}</strong>（UID: {status.bossUser.uid}）
                  </span>
                )}
              </div>
              <p className="text-xs text-forest-500 dark:text-forest-400">{status?.message}</p>
            </div>
            <div className="flex gap-2">
              {!isConnected ? (
                <Button onClick={handleConnect} disabled={actionLoading || !isAgentOnline}>
                  <Link2 className="w-4 h-4" />
                  连接 Chrome
                </Button>
              ) : (
                <Button variant="danger" onClick={handleDisconnect} disabled={actionLoading}>
                  <LogOut className="w-4 h-4" />
                  断开
                </Button>
              )}
            </div>
          </div>
          {!isAgentOnline && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-400">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              本地 Agent 未连接。请在本地电脑：
              <ol className="list-decimal ml-5 mt-1 space-y-0.5">
                <li>双击 <code className="px-1 bg-red-100 dark:bg-red-900/40 rounded">chrome-debug.bat</code> 启动 Chrome 并登录 Boss 直聘</li>
                <li>双击 <code className="px-1 bg-red-100 dark:bg-red-900/40 rounded">agent/start.bat</code> 启动本地 Agent</li>
              </ol>
            </div>
          )}
          {isAgentOnline && !isConnected && (
            <div className="mt-3 p-3 bg-ochre-50 dark:bg-ochre-900/20 border border-ochre-200 dark:border-ochre-800 rounded text-xs text-forest-700 dark:text-cream-200">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Agent 已在线，但 Chrome 未连接。请确保已运行 chrome-debug.bat 启动 Chrome 并登录 Boss，然后点"连接 Chrome"
            </div>
          )}
        </CardContent>
      </Card>

      {/* 今日统计 */}
      {stat && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={MessageSquare} label="打招呼" value={stat.sayHello} color="text-blue-600" />
          <StatCard icon={RefreshCw} label="复聊" value={stat.followUp} color="text-amber-600" />
          <StatCard icon={Activity} label="回复" value={stat.reply} color="text-green-600" />
          <StatCard icon={Eye} label="浏览" value={stat.browse} color="text-purple-600" />
          <StatCard icon={Bot} label="AI 对话" value={stat.aiChat} color="text-pink-600" />
        </div>
      )}

      {/* 打招呼任务 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              自动打招呼
            </span>
            {isRunning && (
              <Badge variant="warning">
                运行中 · 已成功 {taskStatus?.result?.success || 0}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-forest-600 dark:text-cream-300 mb-1 block">城市 Code</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="如 101010100（北京）"
                disabled={isRunning}
              />
              <p className="text-[10px] text-forest-400 dark:text-forest-500 mt-1">
                <a
                  href="https://www.zhipin.com/web/chat/recommend"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  查看城市代码
                </a>
              </p>
            </div>
            <div>
              <label className="text-xs text-forest-600 dark:text-cream-300 mb-1 block">本次上限</label>
              <Input
                type="number"
                value={maxCount}
                onChange={(e) => setMaxCount(Number(e.target.value))}
                min={1}
                max={50}
                disabled={isRunning}
              />
            </div>
            <div>
              <label className="text-xs text-forest-600 dark:text-cream-300 mb-1 block">浏览概率</label>
              <Input
                type="number"
                value={browseRatio}
                onChange={(e) => setBrowseRatio(Number(e.target.value))}
                min={0}
                max={1}
                step={0.1}
                disabled={isRunning}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-forest-600 dark:text-cream-300 mb-1 block">
              自定义打招呼话术（留空用 Boss 默认）
            </label>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="你好，看到你的简历感觉很匹配我们的岗位，方便聊聊吗？"
              rows={3}
              disabled={isRunning}
            />
          </div>

          <div className="flex gap-2">
            {!isRunning ? (
              <Button
                onClick={handleStart}
                disabled={actionLoading || !isConnected || !isAgentOnline}
              >
                <PlayCircle className="w-4 h-4" />
                启动打招呼
              </Button>
            ) : (
              <Button variant="danger" onClick={handleStop} disabled={actionLoading}>
                <StopCircle className="w-4 h-4" />
                停止
              </Button>
            )}
          </div>

          {/* 任务进度 */}
          {taskStatus?.result && (
            <div className="mt-3 p-3 bg-forest-50 dark:bg-forest-800/50 rounded border border-forest-200 dark:border-forest-700 text-sm">
              <div className="flex flex-wrap gap-4">
                <span>总操作：<strong>{taskStatus.result.total}</strong></span>
                <span className="text-green-700">成功：{taskStatus.result.success}</span>
                <span className="text-red-700">失败：{taskStatus.result.failed}</span>
                <span className="text-purple-700">浏览：{taskStatus.result.browsed}</span>
              </div>
              {taskStatus.result.stopReason && (
                <p className="text-xs text-amber-700 mt-2">
                  停止原因：{taskStatus.result.stopReason}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 操作日志 */}
      <Card>
        <CardHeader>
          <CardTitle>最近操作日志</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <Empty description="暂无日志" />
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2 px-3 bg-forest-50 dark:bg-forest-800/50 rounded text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="default">{log.action}</Badge>
                    <span className="text-forest-700 dark:text-cream-200">{log.target || '-'}</span>
                  </div>
                  <span className="text-xs text-forest-400 dark:text-forest-500">{log.created_at}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Toast 提示 */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-forest-800 text-cream-50 rounded shadow-lg">
          {toast}
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-red-600 text-white rounded shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}

// 统计卡片组件
function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-forest-900 border border-forest-200 dark:border-forest-700 rounded-lg p-3 flex items-center gap-3">
      <Icon className={`w-6 h-6 ${color}`} />
      <div>
        <div className="text-xs text-forest-500 dark:text-forest-400">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}
