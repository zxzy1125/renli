// 全局浮动通知组件：BOSS 文案后台生成完成时弹窗提醒
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, CheckCircle2, XCircle, X, ChevronRight } from 'lucide-react';
import { useBossPostingStore, type BossPostingTask } from '@/store/bossPostingStore';

export default function NotificationToast() {
  const tasks = useBossPostingStore((s) => s.tasks);
  const markNotified = useBossPostingStore((s) => s.markNotified);
  const setPendingView = useBossPostingStore((s) => s.setPendingView);
  const navigate = useNavigate();

  // 找到刚完成（未通知）的任务
  const unread = tasks.filter(
    (t) => !t.notified && (t.status === 'completed' || t.status === 'error')
  );

  // 只显示最新的未读通知（避免弹窗过多）
  const latest = unread[0] || null;

  // 5 秒后自动消失
  const [visible, setVisible] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    if (latest && latest.id !== currentId) {
      setCurrentId(latest.id);
      setVisible(true);
      // 8 秒后自动标记已读并隐藏
      const timer = setTimeout(() => {
        markNotified(latest.id);
        setVisible(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [latest?.id, currentId, markNotified]);

  if (!latest || !visible) return null;

  const isCompleted = latest.status === 'completed';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div
        className={`card shadow-lg border-l-4 p-4 max-w-sm ${
          isCompleted
            ? 'border-l-forest-500 bg-white dark:bg-forest-900'
            : 'border-l-risk-500 bg-risk-50'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${isCompleted ? 'text-forest-500 dark:text-forest-400' : 'text-risk-500'}`}>
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-forest-800 dark:text-cream-100">
              {isCompleted ? '文案生成完成' : '文案生成失败'}
            </p>
            <p className="text-xs text-forest-500 dark:text-forest-400 mt-0.5 truncate">
              {latest.positionTitle}
            </p>
            {isCompleted && (
              <button
                type="button"
                onClick={() => {
                  markNotified(latest.id);
                  setPendingView(latest.id);
                  setVisible(false);
                  navigate(`/positions/${latest.positionId}`);
                }}
                className="mt-2 text-xs text-ochre-700 hover:text-ochre-900 flex items-center gap-0.5"
              >
                查看结果 <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              markNotified(latest.id);
              setVisible(false);
            }}
            className="text-forest-400 dark:text-forest-500 hover:text-forest-600 dark:hover:text-cream-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// 通知铃铛图标（导航栏用），显示未读数量
export function NotificationBell() {
  const tasks = useBossPostingStore((s) => s.tasks);
  const viewResult = useBossPostingStore((s) => s.viewResult);
  const removeTask = useBossPostingStore((s) => s.removeTask);
  const setPendingView = useBossPostingStore((s) => s.setPendingView);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  const completed = tasks.filter((t) => t.status === 'completed' || t.status === 'error');
  const unreadCount = completed.filter((t) => !t.notified).length;

  // 只保留最近 20 条记录
  const recent = [...completed].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-forest-50 dark:hover:bg-forest-800/50 text-forest-600 dark:text-cream-300"
        title="生成通知"
      >
        <Sparkles className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-risk-500 text-white text-[10px] flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 card shadow-xl z-50 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-forest-100 dark:border-forest-800">
              <h3 className="text-sm font-semibold text-forest-800 dark:text-cream-100">生成记录</h3>
            </div>
            {recent.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-forest-400 dark:text-forest-500">
                暂无生成记录
              </div>
            ) : (
              recent.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onView={viewResult}
                  onRemove={removeTask}
                  onNavigate={(taskId, positionId) => {
                    viewResult(taskId);
                    setPendingView(taskId);
                    setOpen(false);
                    navigate(`/positions/${positionId}`);
                  }}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TaskItem({
  task,
  onView,
  onRemove,
  onNavigate,
}: {
  task: BossPostingTask;
  onView: (id: string) => void;
  onRemove: (id: string) => void;
  onNavigate: (taskId: string, positionId: string) => void;
}) {
  const isCompleted = task.status === 'completed';
  const timeAgo = formatTimeAgo(task.createdAt);

  return (
    <div
      className={`px-4 py-3 border-b border-forest-50 dark:border-forest-800 hover:bg-forest-50 dark:hover:bg-forest-800/50 transition-colors ${
        !task.notified ? 'bg-ochre-50/40' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-forest-500 dark:text-forest-400 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-risk-500 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-forest-800 dark:text-cream-100 truncate">
              {task.positionTitle}
            </p>
            <p className="text-[11px] text-forest-400 dark:text-forest-500">{timeAgo}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isCompleted && (
            <button
              type="button"
              onClick={() => onNavigate(task.id, task.positionId)}
              className="text-[11px] text-ochre-700 hover:text-ochre-900 px-2 py-0.5 rounded bg-ochre-50 border border-ochre-100"
            >
              查看
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(task.id)}
            className="text-[11px] text-forest-400 dark:text-forest-500 hover:text-risk-600 dark:hover:text-risk-400 px-1"
            title="删除"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      {!isCompleted && task.error && (
        <p className="text-[11px] text-risk-600 mt-1 ml-6 truncate">{task.error}</p>
      )}
    </div>
  );
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return `${Math.floor(diff / 86400_000)} 天前`;
}
