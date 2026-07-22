// 主布局：左侧导航 + 顶部栏 + 内容区
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import NotificationToast from './NotificationToast';
import { useAuthStore } from '@/store/authStore';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex min-h-screen bg-cream-50 dark:bg-forest-950 dark:text-cream-50">
      <Sidebar
        role={user?.role}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 lg:pl-0">
        <TopBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      <NotificationToast />
    </div>
  );
}
