// 个人设置：修改密码
import { useState } from 'react';
import { Lock, Save } from 'lucide-react';
import { authApi, getErrorMsg } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function ProfileSettings() {
  const user = useAuthStore((s) => s.user);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!oldPwd || !newPwd || !confirmPwd) {
      setError('请填写完整');
      return;
    }
    if (newPwd.length < 6) {
      setError('新密码至少 6 位');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('两次输入的新密码不一致');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(oldPwd, newPwd);
      setSuccess('密码修改成功，下次登录请使用新密码');
      setOldPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="font-serif text-lg font-semibold text-forest-800 mb-1">个人设置</h2>
      <p className="text-sm text-forest-500 mb-4">修改登录密码</p>

      {/* 账号信息 */}
      <div className="mb-6 p-4 rounded-lg bg-cream-50 border border-cream-200">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-forest-500 text-xs">用户名</div>
            <div className="text-forest-800 font-mono">{user?.username}</div>
          </div>
          <div>
            <div className="text-forest-500 text-xs">姓名</div>
            <div className="text-forest-800">{user?.real_name}</div>
          </div>
          <div>
            <div className="text-forest-500 text-xs">角色</div>
            <div className="text-forest-800">{user?.role === 'admin' ? '管理员' : '招聘顾问'}</div>
          </div>
          <div>
            <div className="text-forest-500 text-xs">部门</div>
            <div className="text-forest-800">{user?.department || '—'}</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-forest-50 border border-forest-100 text-sm text-forest-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
        <div>
          <label className="label">
            <Lock className="w-3.5 h-3.5 inline mr-1" />
            旧密码
          </label>
          <input
            type="password"
            className="input"
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="label">新密码（至少 6 位）</label>
          <input
            type="password"
            className="input"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="label">确认新密码</label>
          <input
            type="password"
            className="input"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="btn-primary flex items-center gap-1 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? '保存中...' : '修改密码'}
        </button>
      </form>
    </div>
  );
}
