// 撞单管理（管理员）：待处理 / 已处理 Tab
import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle,
  Phone,
  Mail,
  User as UserIcon,
  Building2,
  ArrowRight,
} from 'lucide-react';
import dayjs from 'dayjs';
import { conflictsApi, resumesApi, usersApi, getErrorMsg } from '@/lib/api';
import type { ConflictRecord, ConflictStatus, Resume, User } from '@/types';
import Loading from '@/components/Loading';
import Empty from '@/components/Empty';
import StatusBadge from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';

type TabKey = 'pending' | 'resolved';

interface ConflictDetail extends ConflictRecord {
  resumeA?: Resume;
  resumeB?: Resume;
  employeeA?: User;
  employeeB?: User;
}

export default function ConflictList() {
  const [tab, setTab] = useState<TabKey>('pending');
  const [list, setList] = useState<ConflictDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 处理确认弹窗
  const [toResolve, setToResolve] = useState<{
    conflict: ConflictDetail;
    action: ConflictStatus;
  } | null>(null);
  const [note, setNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const status = tab === 'pending' ? 'pending' : undefined;
      // 已处理 tab：拉所有非 pending 的
      let records: ConflictRecord[] = [];
      if (tab === 'pending') {
        const res = await conflictsApi.list('pending');
        records = res.data || [];
      } else {
        // 已处理：先拉全部，再前端过滤
        const res = await conflictsApi.list();
        records = (res.data || []).filter((c) => c.status !== 'pending');
      }

      // 拉用户列表和简历
      const [users, resumes] = await Promise.all([
        usersApi.list().catch(() => [] as User[]),
        Promise.all(records.map((r) => resumesApi.get(r.resume_id_a).catch(() => null))).then(
          (rsA) =>
            Promise.all(
              records.map((r, i) =>
                rsA[i]
                  ? resumesApi.get(r.resume_id_b).catch(() => null)
                  : Promise.resolve(null)
              )
            ).then((rsB) => ({ rsA, rsB }))
        ),
      ]);

      const userMap = new Map(users.map((u) => [u.id, u]));
      const details: ConflictDetail[] = records.map((r, i) => ({
        ...r,
        resumeA: (resumes.rsA[i] as Resume) || undefined,
        resumeB: (resumes.rsB[i] as Resume) || undefined,
        employeeA: userMap.get(r.employee_id_a),
        employeeB: userMap.get(r.employee_id_b),
      }));
      setList(details);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const openResolve = (conflict: ConflictDetail, action: ConflictStatus) => {
    setToResolve({ conflict, action });
    setNote('');
  };

  const handleResolve = async () => {
    if (!toResolve) return;
    setResolving(true);
    try {
      await conflictsApi.resolve(toResolve.conflict.id, toResolve.action, note || undefined);
      setToResolve(null);
      setNote('');
      await fetchList();
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100">撞单管理</h1>
        <p className="text-sm text-forest-500 dark:text-forest-400 mt-1">
          系统自动检测同手机号/邮箱/姓名+公司的简历冲突，请管理员分配归属
        </p>
      </div>

      {/* Tab */}
      <div className="border-b border-forest-100 dark:border-forest-800 mb-4 flex gap-2">
        <TabBtn active={tab === 'pending'} onClick={() => setTab('pending')}>
          待处理
        </TabBtn>
        <TabBtn active={tab === 'resolved'} onClick={() => setTab('resolved')}>
          已处理
        </TabBtn>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400">
          {error}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <div className="card p-12">
          <Empty />
          <p className="text-center text-sm text-forest-500 dark:text-forest-400 mt-2">
            {tab === 'pending' ? '暂无待处理撞单' : '暂无已处理记录'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <ConflictCard
              key={c.id}
              conflict={c}
              onResolve={openResolve}
              showActions={tab === 'pending'}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toResolve}
        title={actionTitle(toResolve?.action)}
        message={
          toResolve
            ? `确认对求职者「${toResolve.conflict.candidate_name}」的撞单执行：${actionLabel(toResolve.action)}？`
            : ''
        }
        confirmText={resolving ? '处理中...' : '确认'}
        danger={toResolve?.action === 'false_alarm'}
        requireNote
        noteLabel="处理备注（可选）"
        notePlaceholder="例如：经核实为同一员工重复录入"
        onConfirm={async (noteVal) => {
          setNote(noteVal || '');
          await handleResolve();
        }}
        onCancel={() => setToResolve(null)}
      />
    </div>
  );
}

function TabBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm border-b-2 -mb-px ${
        active
          ? 'border-forest-600 dark:border-forest-400 text-forest-700 dark:text-cream-200 font-medium'
          : 'border-transparent text-forest-500 dark:text-forest-400 hover:text-forest-700'
      }`}
    >
      {children}
    </button>
  );
}

function ConflictCard({
  conflict,
  onResolve,
  showActions,
}: {
  conflict: ConflictDetail;
  onResolve: (c: ConflictDetail, action: ConflictStatus) => void;
  showActions: boolean;
}) {
  const matchFieldText =
    conflict.match_field === 'phone'
      ? '手机号相同'
      : conflict.match_field === 'email'
      ? '邮箱相同'
      : '姓名+公司相同';

  return (
    <div className="card p-5">
      {/* 顶部：求职者 + 字段 */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-ochre-500" />
            <span className="font-serif text-base font-semibold text-forest-800 dark:text-cream-100">
              {conflict.candidate_name}
            </span>
            <span className="text-xs text-forest-500 dark:text-forest-400">
              · {matchFieldText}
              {conflict.match_field === 'name_company' && '（弱匹配）'}
            </span>
          </div>
          <div className="text-xs text-forest-400 dark:text-forest-500">
            创建时间：{dayjs(conflict.created_at).format('YYYY-MM-DD HH:mm')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={conflict.status} />
          {conflict.resolved_at && (
            <span className="text-xs text-forest-400 dark:text-forest-500">
              处理于 {dayjs(conflict.resolved_at).format('YYYY-MM-DD HH:mm')}
            </span>
          )}
        </div>
      </div>

      {/* 员工 A vs 员工 B */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
        <ResumeSide
          side="A"
          label="已存在简历"
          user={conflict.employeeA}
          resume={conflict.resumeA}
        />
        <div className="flex items-center justify-center text-ochre-500">
          <ArrowRight className="w-5 h-5" />
        </div>
        <ResumeSide
          side="B"
          label="新录入简历"
          user={conflict.employeeB}
          resume={conflict.resumeB}
        />
      </div>

      {/* 备注 */}
      {conflict.note && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-cream-50 dark:bg-forest-800 text-sm text-forest-600 dark:text-cream-300">
          <span className="text-forest-400 dark:text-forest-500">备注：</span>
          {conflict.note}
        </div>
      )}

      {/* 操作按钮 */}
      {showActions && (
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-forest-50 dark:border-forest-800">
          <span className="text-sm text-forest-500 dark:text-forest-400 mr-2">处理方式：</span>
          <button
            type="button"
            onClick={() => onResolve(conflict, 'assigned_a')}
            className="btn-secondary text-xs"
          >
            归属 A
          </button>
          <button
            type="button"
            onClick={() => onResolve(conflict, 'assigned_b')}
            className="btn-secondary text-xs"
          >
            归属 B
          </button>
          <button
            type="button"
            onClick={() => onResolve(conflict, 'shared')}
            className="btn-secondary text-xs"
          >
            共享独立
          </button>
          <button
            type="button"
            onClick={() => onResolve(conflict, 'false_alarm')}
            className="text-xs px-3 py-1.5 rounded text-risk-600 hover:bg-risk-50 dark:hover:bg-risk-900/20 border border-risk-100 dark:border-risk-800"
          >
            标记误报
          </button>
        </div>
      )}
    </div>
  );
}

function ResumeSide({
  side,
  label,
  user,
  resume,
}: {
  side: 'A' | 'B';
  label: string;
  user?: User;
  resume?: Resume;
}) {
  const sideTone = side === 'A' ? 'forest' : 'ochre';
  const sideColor = side === 'A' ? 'bg-forest-50 dark:bg-forest-800 text-forest-700 dark:text-cream-200' : 'bg-ochre-50 dark:bg-ochre-900/20 text-ochre-700 dark:text-ochre-400';
  return (
    <div className="border border-forest-100 dark:border-forest-800 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${sideColor}`}>
          {label}（员工 {side}）
        </span>
        <span className="text-xs text-forest-500 dark:text-forest-400">
          {user?.real_name || '未知员工'}
          {user?.department ? ` · ${user.department}` : ''}
        </span>
      </div>
      {resume ? (
        <div className="text-xs text-forest-700 dark:text-cream-200 space-y-1">
          <div className="flex items-center gap-1">
            <UserIcon className="w-3 h-3 text-forest-400 dark:text-forest-500" />
            {resume.name} · {resume.age || '?'}岁 · {resume.education || '学历未知'}
          </div>
          {resume.current_company && (
            <div className="flex items-center gap-1">
              <Building2 className="w-3 h-3 text-forest-400 dark:text-forest-500" />
              {resume.current_company} · {resume.current_title || '职位未知'}
            </div>
          )}
          {resume.phone_masked && (
            <div className="flex items-center gap-1 text-forest-500 dark:text-forest-400">
              <Phone className="w-3 h-3" />
              <span className="font-mono">{resume.phone_masked}</span>
            </div>
          )}
          {resume.email_masked && (
            <div className="flex items-center gap-1 text-forest-500 dark:text-forest-400">
              <Mail className="w-3 h-3" />
              <span className="font-mono">{resume.email_masked}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-forest-400 dark:text-forest-500 italic">简历信息加载失败</div>
      )}
      <span className={`mt-1 text-[10px] text-forest-400 ${sideTone === 'ochre' ? 'text-ochre-500' : ''}`}>
        {/* 占位 */}
      </span>
    </div>
  );
}

function actionLabel(action?: ConflictStatus): string {
  if (!action) return '';
  const map: Record<ConflictStatus, string> = {
    pending: '待处理',
    assigned_a: '归属 A（已存在简历的员工）',
    assigned_b: '归属 B（新录入简历的员工）',
    shared: '共享独立（双方各自跟进）',
    false_alarm: '标记误报',
  };
  return map[action] || action;
}

function actionTitle(action?: ConflictStatus): string {
  if (!action) return '撞单处理';
  const map: Record<ConflictStatus, string> = {
    pending: '撞单处理',
    assigned_a: '归属 A',
    assigned_b: '归属 B',
    shared: '共享独立',
    false_alarm: '标记误报',
  };
  return map[action] || '撞单处理';
}
