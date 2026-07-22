// 设置入口：左侧 Tab 导航
import { NavLink, Outlet } from 'react-router-dom';
import { User, Users, Sparkles, BookOpen, Package, RefreshCcw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const tabs = [
    { to: '/settings/profile', label: '个人设置', icon: User },
    ...(isAdmin
      ? [
          { to: '/settings/team', label: '团队管理', icon: Users },
          { to: '/settings/ai', label: 'AI 配置', icon: Sparkles },
          { to: '/settings/system', label: '系统更新', icon: RefreshCcw },
        ]
      : []),
    { to: '/settings/guidelines', label: '运营规范知识库', icon: BookOpen },
    { to: '/settings/version', label: '版本更新', icon: Package },
  ];

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100">设置</h1>
        <p className="text-sm text-forest-500 dark:text-forest-400 mt-1">账号、团队、AI、规范</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
        {/* 左侧 Tab */}
        <nav className="card p-2 h-fit">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors',
                    isActive
                      ? 'bg-forest-100 dark:bg-forest-700 text-forest-700 dark:text-cream-100 font-medium'
                      : 'text-forest-600 dark:text-forest-300 hover:bg-forest-50 dark:hover:bg-forest-800'
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </NavLink>
            );
          })}
        </nav>
        {/* 右侧内容 */}
        <div className="card p-5">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
