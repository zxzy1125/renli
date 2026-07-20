// 路由守卫：未登录跳 /login，权限不足跳 /403
import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { FullScreenLoading } from './Loading';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin }: ProtectedRouteProps) {
  const { user, token, initialized, loading } = useAuthStore();
  const location = useLocation();

  // 还没初始化过：尝试拉一次 me
  useEffect(() => {
    if (token && !user && !initialized) {
      useAuthStore.getState().fetchMe().catch(() => {
        // 错误已在 store 内处理
      });
    }
  }, [token, user, initialized]);

  // 正在拉用户信息
  if (loading && token && !user) {
    return <FullScreenLoading />;
  }

  // 没有 token：跳登录
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // token 在但用户还没拉到：再等一会
  if (!user) {
    return <FullScreenLoading />;
  }

  // 权限不足
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
