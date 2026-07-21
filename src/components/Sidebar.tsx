// 左侧导航栏：根据角色显示不同菜单
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Building2,
  FileText,
  GitCompareArrows,
  CalendarClock,
  TrendingUp,
  AlertTriangle,
  MessageCircle,
  Settings,
  Bot,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  role: 'admin' | 'consultant' | undefined;
  open: boolean;
  onClose: () => void;
}

interface MenuItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  placeholder?: boolean;
}

// 管理员菜单
const adminMenus: MenuItem[] = [
  { to: '/dashboard', label: '总览工作台', icon: LayoutDashboard },
  { to: '/positions', label: '职位库', icon: Briefcase },
  { to: '/clients', label: '客户公司', icon: Building2 },
  { to: '/resumes', label: '简历库', icon: FileText },
  { to: '/matches', label: '匹配管理', icon: GitCompareArrows },
  { to: '/chat', label: '对话辅助', icon: MessageCircle },
  { to: '/followups', label: '跟进管理', icon: CalendarClock },
  { to: '/conversions', label: '转化跟踪', icon: TrendingUp },
  { to: '/boss-auto', label: 'Boss自动化', icon: Bot },
  { to: '/conflicts', label: '撞单管理', icon: AlertTriangle },
  { to: '/settings', label: '设置', icon: Settings },
];

// 员工菜单
const consultantMenus: MenuItem[] = [
  { to: '/dashboard', label: '总览工作台', icon: LayoutDashboard },
  { to: '/positions', label: '职位库', icon: Briefcase },
  { to: '/resumes', label: '简历库', icon: FileText },
  { to: '/matches', label: '匹配管理', icon: GitCompareArrows },
  { to: '/chat', label: '对话辅助', icon: MessageCircle },
  { to: '/followups', label: '跟进管理', icon: CalendarClock },
  { to: '/conversions', label: '转化跟踪', icon: TrendingUp },
  { to: '/boss-auto', label: 'Boss自动化', icon: Bot },
  { to: '/settings', label: '设置', icon: Settings },
];

export default function Sidebar({ role, open, onClose }: SidebarProps) {
  const menus = role === 'admin' ? adminMenus : consultantMenus;

  return (
    <>
      {/* 移动端遮罩 */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-forest-950/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-[220px] bg-forest-800 text-cream-50 flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo 区 */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-forest-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ochre-300 to-ochre-500 flex items-center justify-center font-serif font-bold text-forest-900">
              代
            </div>
            <div className="font-serif text-base font-semibold tracking-wide">代招助手</div>
          </div>
          <button
            type="button"
            className="lg:hidden text-cream-50/70 hover:text-cream-50"
            onClick={onClose}
            aria-label="关闭菜单"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 菜单 */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1">
            {menus.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-5 py-2.5 text-sm transition-colors',
                        isActive
                          ? 'bg-forest-700 text-cream-50 border-l-2 border-ochre-300'
                          : 'text-cream-50/80 hover:bg-forest-700/50 hover:text-cream-50'
                      )
                    }
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.placeholder && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-forest-600 text-cream-50/70">
                        待上线
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 底部版本信息 */}
        <div className="px-5 py-3 text-xs text-cream-50/40 border-t border-forest-700">
          v0.1.0 · 公测版
        </div>
      </aside>
    </>
  );
}
