// 顶部栏：菜单按钮、当前用户、退出登录
import { Menu, LogOut, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

interface TopBarProps {
  onToggleSidebar: () => void;
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-forest-100">
      {/* 左侧菜单按钮 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-1.5 rounded hover:bg-forest-50 text-forest-600"
          aria-label="切换菜单"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="text-sm text-forest-600 font-medium hidden sm:block">
          人力代招 · 招聘辅助工具
        </div>
      </div>

      {/* 右侧用户信息 */}
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-forest-50 text-forest-700"
        >
          <div className="w-8 h-8 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-sm font-semibold">
            {user?.real_name?.slice(0, 1) || 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-sm font-medium leading-tight">{user?.real_name}</div>
            <div className="text-xs text-forest-500 leading-tight">
              {user?.role === 'admin' ? '管理员' : '招聘顾问'}
              {user?.department ? ` · ${user.department}` : ''}
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-forest-500" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-cardHover border border-forest-100 py-1 z-50">
            <div className="px-3 py-2 text-xs text-forest-500 border-b border-forest-50">
              {user?.username}
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-risk-600 hover:bg-risk-50"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
