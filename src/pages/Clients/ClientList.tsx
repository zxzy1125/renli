// 客户公司列表 + CRUD（管理员可操作）
import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Building2, Phone, User as UserIcon } from 'lucide-react';
import dayjs from 'dayjs';
import { clientsApi, positionsApi, getErrorMsg } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { Client, Position } from '@/types';
import Loading from '@/components/Loading';
import Empty from '@/components/Empty';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';

interface ClientFormState {
  name: string;
  contact_name: string;
  contact_phone: string;
  industry: string;
  notes: string;
}

const EMPTY_FORM: ClientFormState = {
  name: '',
  contact_name: '',
  contact_phone: '',
  industry: '',
  notes: '',
};

export default function ClientList() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [list, setList] = useState<Client[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');

  const [editing, setEditing] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [clients, posResp] = await Promise.all([
        clientsApi.list(),
        positionsApi.list({ page: 1, pageSize: 1000 }),
      ]);
      setList(clients);
      setPositions(posResp.data || []);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 关联职位数统计
  const positionCount = (clientId: string) =>
    positions.filter((p) => p.client_id === clientId).length;

  // 搜索过滤
  const filtered = list.filter((c) => {
    if (!keyword) return true;
    const k = keyword.toLowerCase();
    return (
      c.name.toLowerCase().includes(k) ||
      (c.industry ?? '').toLowerCase().includes(k) ||
      (c.contact_name ?? '').toLowerCase().includes(k)
    );
  });

  const handleOpenNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
  };

  const handleOpenEdit = (c: Client) => {
    setEditing(c);
    setForm({
      name: c.name,
      contact_name: c.contact_name ?? '',
      contact_phone: c.contact_phone ?? '',
      industry: c.industry ?? '',
      notes: c.notes ?? '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('客户公司名称不能为空');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        industry: form.industry || null,
        notes: form.notes || null,
      };
      if (editing) {
        await clientsApi.update(editing.id, payload);
      } else {
        await clientsApi.create(payload);
      }
      setFormOpen(false);
      await fetchAll();
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
      await clientsApi.remove(toDelete.id);
      setToDelete(null);
      await fetchAll();
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest-800">客户公司</h1>
          <p className="text-sm text-forest-500 mt-1">团队共享 · 全员可见</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={handleOpenNew}
            className="btn-primary flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            新建客户
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="card p-4 mb-4 flex items-center gap-3"
      >
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="搜索公司名/行业/联系人"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </form>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700">
          {error}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <div className="card p-12">
          <Empty />
          {isAdmin && (
            <p className="text-center text-sm text-forest-500 mt-2">
              <button type="button" onClick={handleOpenNew} className="text-forest-600 underline">
                立即新建客户公司
              </button>
            </p>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 text-forest-700">
              <tr>
                <th className="text-left px-4 py-2 font-medium">公司名称</th>
                <th className="text-left px-4 py-2 font-medium">行业</th>
                <th className="text-left px-4 py-2 font-medium">联系人</th>
                <th className="text-left px-4 py-2 font-medium">电话</th>
                <th className="text-right px-4 py-2 font-medium">关联职位</th>
                <th className="text-left px-4 py-2 font-medium">创建时间</th>
                {isAdmin && <th className="text-right px-4 py-2 font-medium">操作</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-forest-50 hover:bg-cream-50">
                  <td className="px-4 py-2 text-forest-800 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-forest-400" />
                      {c.name}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-forest-600">{c.industry || '—'}</td>
                  <td className="px-4 py-2 text-forest-600">
                    {c.contact_name ? (
                      <span className="inline-flex items-center gap-1">
                        <UserIcon className="w-3 h-3 text-forest-400" />
                        {c.contact_name}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2 text-forest-600 font-mono">
                    {c.contact_phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3 text-forest-400" />
                        {c.contact_phone}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-forest-700">
                    {positionCount(c.id)}
                  </td>
                  <td className="px-4 py-2 text-forest-500 text-xs">
                    {dayjs(c.created_at).format('YYYY-MM-DD')}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(c)}
                        className="btn-ghost text-xs px-2 py-1 inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => setToDelete(c)}
                        className="text-xs px-2 py-1 rounded text-risk-600 hover:bg-risk-50 inline-flex items-center gap-1 ml-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        删除
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      <Modal
        open={formOpen}
        title={editing ? '编辑客户公司' : '新建客户公司'}
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
              form="client-form"
              disabled={saving}
              className="btn-primary disabled:opacity-60"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </>
        }
      >
        <form id="client-form" onSubmit={handleSave} className="space-y-3">
          {formError && (
            <div className="px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700">
              {formError}
            </div>
          )}
          <div>
            <label className="label">
              公司名称 <span className="text-risk-600">*</span>
            </label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">联系人</label>
              <input
                type="text"
                className="input"
                value={form.contact_name}
                onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">联系电话</label>
              <input
                type="text"
                className="input"
                value={form.contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">行业</label>
            <input
              type="text"
              className="input"
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              placeholder="如：互联网 / 制造业"
            />
          </div>
          <div>
            <label className="label">备注</label>
            <textarea
              className="input min-h-[80px]"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="删除客户公司"
        message={`确认删除客户公司「${toDelete?.name}」吗？关联的职位不会被删除，但会失去客户关联。此操作不可撤销。`}
        confirmText={deleting ? '删除中...' : '确认删除'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
