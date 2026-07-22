// 顶部栏：全局搜索、暗色模式、通知、用户菜单
import { Menu, LogOut, ChevronDown, Search, X, Sun, Moon, Bell } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useTheme } from '@/hooks/useTheme';
import { searchApi } from '@/lib/api';
import type { Position, Resume, Client } from '@/types';

interface TopBarProps {
  onToggleSidebar: () => void;
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { unreadCount, fetchUnreadCount, startPolling } = useNotificationStore();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 全局搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    positions: Position[];
    resumes: Resume[];
    clients: Client[];
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const searchRef = useRef<HTMLDivElement>(null);

  // 启动通知轮询
  useEffect(() => {
    fetchUnreadCount();
    startPolling();
  }, [fetchUnreadCount, startPolling]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 搜索输入防抖
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) {
      setSearchResults(null);
      setShowSearchDropdown(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchApi.search(value.trim());
        setSearchResults(res);
        setShowSearchDropdown(true);
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const goToItem = (type: string, id: string) => {
    setShowSearchDropdown(false);
    setSearchQuery('');
    if (type === 'position') navigate(`/positions/${id}`);
    else if (type === 'resume') navigate(`/resumes/${id}`);
    else if (type === 'client') navigate(`/clients/${id}`);
  };

  const totalResults = searchResults
    ? searchResults.positions.length + searchResults.resumes.length + searchResults.clients.length
    : 0;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-forest-100 dark:bg-forest-900 dark:border-forest-800">
      {/* 左侧菜单按钮 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-1.5 rounded hover:bg-forest-50 dark:hover:bg-forest-800 text-forest-600 dark:text-forest-300"
          aria-label="切换菜单"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="text-sm text-forest-600 font-medium hidden sm:block dark:text-forest-300">
          人力代招 · 招聘辅助工具
        </div>
      </div>

      {/* 中间全局搜索框 */}
      <div ref={searchRef} className="relative flex-1 max-w-md mx-4 hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => searchResults && setShowSearchDropdown(true)}
            placeholder="搜索职位、简历、客户..."
            className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-forest-200 bg-forest-50/50 text-sm
                       focus:outline-none focus:ring-2 focus:ring-forest-400 focus:border-transparent
                       dark:bg-forest-800 dark:border-forest-700 dark:text-cream-100 dark:placeholder-forest-500"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults(null); setShowSearchDropdown(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-forest-400 hover:text-forest-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 搜索结果下拉 */}
        {showSearchDropdown && searchResults && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-forest-100 max-h-80 overflow-y-auto z-50 dark:bg-forest-800 dark:border-forest-700">
            {totalResults === 0 ? (
              <div className="px-4 py-3 text-sm text-forest-400">
                {searching ? '搜索中...' : '无匹配结果'}
              </div>
            ) : (
              <>
                {searchResults.positions.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-forest-400 bg-forest-50 dark:bg-forest-700/50">职位</div>
                    {searchResults.positions.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => goToItem('position', p.id)}
                        className="w-full text-left px-3 py-2 hover:bg-forest-50 dark:hover:bg-forest-700 transition text-sm"
                      >
                        <span className="font-medium text-forest-800 dark:text-cream-100">{p.title}</span>
                        {p.location && <span className="ml-2 text-forest-400 text-xs">{p.location}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.resumes.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-forest-400 bg-forest-50 dark:bg-forest-700/50">简历</div>
                    {searchResults.resumes.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => goToItem('resume', r.id)}
                        className="w-full text-left px-3 py-2 hover:bg-forest-50 dark:hover:bg-forest-700 transition text-sm"
                      >
                        <span className="font-medium text-forest-800 dark:text-cream-100">{r.name}</span>
                        <span className="ml-2 text-forest-400 text-xs">{r.current_company}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.clients.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-forest-400 bg-forest-50 dark:bg-forest-700/50">客户</div>
                    {searchResults.clients.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => goToItem('client', c.id)}
                        className="w-full text-left px-3 py-2 hover:bg-forest-50 dark:hover:bg-forest-700 transition text-sm"
                      >
                        <span className="font-medium text-forest-800 dark:text-cream-100">{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 右侧：暗色模式 + 通知 + 用户信息 */}
      <div className="flex items-center gap-1">
        {/* 暗色模式切换 */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded hover:bg-forest-50 dark:hover:bg-forest-800 transition"
          title={isDark ? '切换亮色' : '切换暗色'}
        >
          {isDark
            ? <Sun className="w-5 h-5 text-ochre-500" />
            : <Moon className="w-5 h-5 text-forest-600" />
          }
        </button>

        {/* 通知铃铛 */}
        <button
          type="button"
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded hover:bg-forest-50 dark:hover:bg-forest-800 transition"
          title="消息通知"
        >
          <Bell className="w-5 h-5 text-forest-600 dark:text-forest-300" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-risk-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* 用户菜单 */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-forest-50 dark:hover:bg-forest-800 text-forest-700 dark:text-cream-200"
          >
            <div className="w-8 h-8 rounded-full bg-forest-100 dark:bg-forest-700 text-forest-700 dark:text-cream-200 flex items-center justify-center text-sm font-semibold">
              {user?.real_name?.slice(0, 1) || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium leading-tight">{user?.real_name}</div>
              <div className="text-xs text-forest-500 dark:text-forest-400 leading-tight">
                {user?.role === 'admin' ? '管理员' : '招聘顾问'}
                {user?.department ? ` · ${user.department}` : ''}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-forest-500" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-cardHover border border-forest-100 py-1 z-50 dark:bg-forest-800 dark:border-forest-700">
              <div className="px-3 py-2 text-xs text-forest-500 dark:text-forest-400 border-b border-forest-50 dark:border-forest-700">
                {user?.username}
              </div>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-risk-600 hover:bg-risk-50 dark:hover:bg-risk-900/20"
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
