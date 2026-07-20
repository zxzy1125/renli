// 鉴权 store：用户、token、登录、退出、获取当前用户
import { create } from 'zustand';
import { authApi, getErrorMsg } from '@/lib/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  initialized: boolean; // 是否已尝试初始化（避免未登录也反复跳转）
  login: (username: string, password: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  logout: () => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: false,
  initialized: false,

  login: async (username, password) => {
    set({ loading: true });
    try {
      const resp = await authApi.login(username, password);
      localStorage.setItem('token', resp.token);
      set({ user: resp.user, token: resp.token, initialized: true });
    } finally {
      set({ loading: false });
    }
  },

  fetchMe: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ user: null, token: null, initialized: true });
      return;
    }
    try {
      const user = await authApi.meGet();
      set({ user, token, initialized: true });
    } catch (err) {
      // token 失效
      localStorage.removeItem('token');
      set({ user: null, token: null, initialized: true });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, initialized: true });
    // 跳到登录页
    window.location.href = '/login';
  },

  isAdmin: () => get().user?.role === 'admin',
}));

// 便捷 hooks
export const useCurrentUser = () => useAuthStore((s) => s.user);
export const useIsAdmin = () => useAuthStore((s) => s.user?.role === 'admin');

export { getErrorMsg };
