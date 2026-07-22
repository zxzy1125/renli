// 消息通知列表页
import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Filter } from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import { cn } from '@/lib/utils';

const typeLabels: Record<string, { label: string; color: string }> = {
  conflict: { label: '撞单', color: 'bg-risk-100 text-risk-700 dark:bg-risk-900/30 dark:text-risk-400' },
  followup: { label: '回访', color: 'bg-ochre-100 text-ochre-700 dark:bg-ochre-900/30 dark:text-ochre-400' },
  match: { label: '匹配', color: 'bg-forest-100 text-forest-700 dark:bg-forest-800 dark:text-forest-300' },
  system: { label: '系统', color: 'bg-cream-200 text-forest-600 dark:bg-forest-700 dark:text-cream-300' },
};

export default function NotificationList() {
  const { notifications, loading, fetchNotifications, markRead, markAllRead, unreadCount } = useNotificationStore();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchNotifications(page);
  }, [page, fetchNotifications]);

  const filtered = filter === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-forest-600 dark:text-forest-400" />
          <h1 className="text-lg font-serif font-semibold text-forest-800 dark:text-cream-100">消息通知</h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-risk-500 text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-forest-600 hover:text-forest-800 hover:bg-forest-50 rounded-lg transition dark:text-forest-400 dark:hover:text-cream-100 dark:hover:bg-forest-800"
          >
            <CheckCheck className="w-4 h-4" />
            全部已读
          </button>
        )}
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-forest-400" />
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1 text-sm rounded-full transition',
              filter === f
                ? 'bg-forest-600 text-white dark:bg-forest-500'
                : 'bg-forest-50 text-forest-600 hover:bg-forest-100 dark:bg-forest-800 dark:text-forest-300 dark:hover:bg-forest-700'
            )}
          >
            {f === 'all' ? '全部' : '未读'}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-forest-400">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-forest-400 mr-2" />
          加载中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-forest-400">
          <Bell className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">{filter === 'unread' ? '没有未读消息' : '暂无通知'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const typeInfo = typeLabels[n.type] || typeLabels.system;
            return (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-lg border transition cursor-pointer',
                  n.is_read
                    ? 'bg-white border-forest-100 dark:bg-forest-900/50 dark:border-forest-800'
                    : 'bg-forest-50/50 border-forest-200 dark:bg-forest-800/50 dark:border-forest-700'
                )}
                onClick={() => {
                  if (!n.is_read) markRead(n.id);
                  if (n.link) window.location.hash = n.link;
                }}
              >
                {/* 未读标记 */}
                <div className="mt-1.5 flex-shrink-0">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      n.is_read ? 'bg-transparent' : 'bg-forest-500 dark:bg-forest-400'
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-[11px] px-1.5 py-0.5 rounded font-medium', typeInfo.color)}>
                      {typeInfo.label}
                    </span>
                    <span className="text-xs text-forest-400">{formatTime(n.created_at)}</span>
                  </div>
                  <p
                    className={cn(
                      'text-sm leading-relaxed',
                      n.is_read
                        ? 'text-forest-500 dark:text-forest-400'
                        : 'text-forest-800 font-medium dark:text-cream-100'
                    )}
                  >
                    {n.title}
                  </p>
                  {n.content && (
                    <p className="text-xs text-forest-400 mt-1 line-clamp-2">{n.content}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 分页 */}
      {notifications.length >= 20 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm rounded border border-forest-200 text-forest-600 hover:bg-forest-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-forest-700 dark:text-forest-300 dark:hover:bg-forest-800"
          >
            上一页
          </button>
          <span className="text-sm text-forest-500 dark:text-forest-400">第 {page} 页</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm rounded border border-forest-200 text-forest-600 hover:bg-forest-50 dark:border-forest-700 dark:text-forest-300 dark:hover:bg-forest-800"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
