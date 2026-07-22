// 登录页
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Loader2, Lock, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getErrorMsg } from '@/lib/api';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user, token } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 已登录直接跳走
  useEffect(() => {
    if (token && user) {
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [token, user, navigate, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(username.trim(), password.trim());
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMsg(err) || '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 dark:bg-forest-950 px-4">
      <div className="w-full max-w-md">
        {/* 深墨绿顶色条 */}
        <div className="h-2 bg-forest-700 rounded-t-xl" />
        <div className="card rounded-t-none p-8">
          {/* Logo 区 */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ochre-300 to-ochre-500 flex items-center justify-center font-serif text-2xl font-bold text-forest-900 mb-3">
              代
            </div>
            <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100">代招助手</h1>
            <p className="text-sm text-forest-500 dark:text-forest-400 mt-1">人力代招招聘辅助工具</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">用户名</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400" />
                <input
                  type="text"
                  className="input pl-9"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="label">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400" />
                <input
                  type="password"
                  className="input pl-9"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-risk-600 bg-risk-50 border border-risk-100 dark:text-risk-400 dark:bg-risk-900/20 dark:border-risk-800 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              登录
            </button>
          </form>

        </div>
        <div className="text-center text-xs text-forest-400 dark:text-forest-500 mt-4">
          © 2026 代招助手 · 仅供授权用户使用
        </div>
      </div>
    </div>
  );
}
