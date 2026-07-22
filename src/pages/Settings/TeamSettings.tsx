// 团队管理（管理员）：员工 CRUD + 重置密码 + 禁用/启用
import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  UserPlus,
} from 'lucide-react';
import dayjs from 'dayjs';
import { usersApi, getErrorMsg } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';
import Loading from '@/components/Loading';
import Empty from '@/components/Empty';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';

interface UserFormState {
  username: string;
  password: string;
  passwordConfirm: string;
  real_name: string;
  department: string;
  role: 'admin' | 'consultant';
  status: 'active' | 'disabled';
}

const EMPTY_FORM: UserFormState = {
  username: '',
  password: '',
  passwordConfirm: '',
  real_name: '',
  department: '',
  role: 'consultant',
  status: 'active',
};

export default function TeamSettings() {
  const me = useAuthStore((s) => s.user);
  const [list, setList] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 重置密码
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await usersApi.list();
      setList(data);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({
      username: u.username,
      password: '',
      passwordConfirm: '',
      real_name: u.real_name,
      department: u.department ?? '',
      role: u.role,
      status: u.status,
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.username.trim() || !form.real_name.trim()) {
      setFormError('用户名和姓名不能为空');
      return;
    }
    if (!editing && form.password.length < 6) {
      setFormError('新用户密码至少 6 位');
      return;
    }
    if (!editing && form.password !== form.passwordConfirm) {
      setFormError('两次输入的密码不一致');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await usersApi.update(editing.id, {
          real_name: form.real_name.trim(),
          department: form.department || null,
          role: form.role,
          status: form.status,
        });
      } else {
        await usersApi.create({
          username: form.username.trim(),
          password: form.password.trim(),
          real_name: form.real_name.trim(),
          department: form.department || undefined,
          role: form.role,
        });
      }
      setFormOpen(false);
      await fetchList();
    } catch (err) {
      setFormError(getErrorMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await usersApi.remove(toDelete.id);
      setToDelete(null);
      await fetchList();
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleReset = async () => {
    if (!resetUser) return;
    if (resetPwd.length < 6) {
      setFormError('新密码至少 6 位');
      return;
    }
    setResetting(true);
    setFormError('');
    try {
      await usersApi.resetPassword(resetUser.id, resetPwd);
      setResetUser(null);
      setResetPwd('');
    } catch (err) {
      setFormError(getErrorMsg(err));
    } finally {
      setResetting(false);
    }
  };

  const toggleStatus = async (u: User) => {
    const nextStatus = u.status === 'active' ? 'disabled' : 'active';
    try {
      await usersApi.update(u.id, { status: nextStatus });
      await fetchList();
    } catch (err) {
      setError(getErrorMsg(err));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100">团队管理</h2>
          <p className="text-sm text-forest-500 dark:text-forest-400 mt-1">添加、编辑、禁用、删除员工账号</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="btn-primary flex items-center gap-1"
        >
          <UserPlus className="w-4 h-4" />
          新建员工
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400">
          {error}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 dark:bg-forest-800 text-forest-700 dark:text-cream-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium">用户名</th>
                <th className="text-left px-3 py-2 font-medium">姓名</th>
                <th className="text-left px-3 py-2 font-medium">部门</th>
                <th className="text-left px-3 py-2 font-medium">角色</th>
                <th className="text-left px-3 py-2 font-medium">状态</th>
                <th className="text-left px-3 py-2 font-medium">创建时间</th>
                <th className="text-right px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="border-t border-forest-50 dark:border-forest-800 hover:bg-cream-50 dark:hover:bg-forest-800/50">
                  <td className="px-3 py-2 font-mono text-forest-700 dark:text-cream-200">{u.username}</td>
                  <td className="px-3 py-2 text-forest-800 dark:text-cream-100">{u.real_name}</td>
                  <td className="px-3 py-2 text-forest-600 dark:text-cream-300">{u.department || '—'}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={u.role} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-3 py-2 text-forest-500 dark:text-forest-400 text-xs">
                    {dayjs(u.created_at).format('YYYY-MM-DD')}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="btn-ghost text-xs px-2 py-1 inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" />
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStatus(u)}
                      className="btn-ghost text-xs px-2 py-1 ml-1"
                      disabled={u.id === me?.id}
                      title={u.id === me?.id ? '不能禁用自己' : ''}
                    >
                      {u.status === 'active' ? '禁用' : '启用'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetUser(u)}
                      className="btn-ghost text-xs px-2 py-1 inline-flex items-center gap-1 ml-1"
                    >
                      <KeyRound className="w-3 h-3" />
                      重置密码
                    </button>
                    <button
                      type="button"
                      onClick={() => setToDelete(u)}
                      className="text-xs px-2 py-1 rounded text-risk-600 dark:text-risk-400 hover:bg-risk-50 dark:hover:bg-risk-900/20 inline-flex items-center gap-1 ml-1 disabled:opacity-50"
                      disabled={u.id === me?.id}
                      title={u.id === me?.id ? '不能删除自己' : ''}
                    >
                      <Trash2 className="w-3 h-3" />
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      <Modal
        open={formOpen}
        title={editing ? `编辑员工「${editing.username}」` : '新建员工'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="btn-ghost"
            >
              取消
            </button>
            <button
              type="submit"
              form="user-form"
              disabled={saving}
              className="btn-primary disabled:opacity-60"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSave} className="space-y-3">
          {formError && (
            <div className="px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">用户名 *</label>
              <input
                type="text"
                className="input"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                disabled={!!editing}
              />
              {editing && (
                <p className="text-xs text-forest-400 dark:text-forest-500 mt-1">用户名不可修改</p>
              )}
            </div>
            <div>
              <label className="label">
                密码 {!editing && <span className="text-risk-600">*</span>}
              </label>
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editing ? '留空表示不修改' : '至少 6 位'}
                autoComplete="new-password"
              />
            </div>
          </div>
          {!editing && (
            <div>
              <label className="label">确认密码 <span className="text-risk-600">*</span></label>
              <input
                type="password"
                className="input"
                value={form.passwordConfirm}
                onChange={(e) => setForm((f) => ({ ...f, passwordConfirm: e.target.value }))}
                placeholder="请再次输入密码"
                autoComplete="new-password"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">姓名 *</label>
              <input
                type="text"
                className="input"
                value={form.real_name}
                onChange={(e) => setForm((f) => ({ ...f, real_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">部门</label>
              <input
                type="text"
                className="input"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">角色</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    role: e.target.value as 'admin' | 'consultant',
                  }))
                }
              >
                <option value="consultant">招聘顾问</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            {editing && (
              <div>
                <label className="label">状态</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as 'active' | 'disabled',
                    }))
                  }
                >
                  <option value="active">正常</option>
                  <option value="disabled">已禁用</option>
                </select>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* 重置密码弹窗 */}
      <Modal
        open={!!resetUser}
        title={`重置「${resetUser?.real_name}」的密码`}
        onClose={() => {
          setResetUser(null);
          setResetPwd('');
          setFormError('');
        }}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setResetUser(null);
                setResetPwd('');
                setFormError('');
              }}
              className="btn-ghost"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="btn-primary disabled:opacity-60"
            >
              {resetting ? '重置中...' : '确认重置'}
            </button>
          </>
        }
      >
        {formError && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400">
            {formError}
          </div>
        )}
        <label className="label">新密码（至少 6 位）</label>
        <input
          type="password"
          className="input"
          value={resetPwd}
          onChange={(e) => setResetPwd(e.target.value)}
          placeholder="请输入新密码"
          autoFocus
        />
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="删除员工"
        message={`确认删除员工「${toDelete?.real_name}（${toDelete?.username}）」吗？此操作不可撤销，该员工的所有数据将保留但无法再登录。`}
        confirmText={deleting ? '删除中...' : '确认删除'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
