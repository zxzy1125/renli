// 状态徽章组件：统一颜色规则
import { cn } from '@/lib/utils';

// 颜色规则映射
// open/active/looking/accepted → 绿色（forest）
// paused/passive/pending → 黄色（ochre）
// closed/not_now/discarded → 灰色
// high/风险 → 红色（risk）
type Tone = 'green' | 'yellow' | 'gray' | 'red' | 'blue';

interface StatusBadgeProps {
  status?: string | null;
  text?: string;
  tone?: Tone;
  className?: string;
}

// 根据状态值映射 tone
export function toneForStatus(status?: string | null): Tone {
  if (!status) return 'gray';
  const s = status.toLowerCase();
  // 红色：高风险
  if (s === 'high' || s === 'risky') return 'red';
  // 绿色：开放/活跃/寻找中/已接受
  if (['open', 'active', 'looking', 'accepted', 'onboarded', 'completed'].includes(s)) return 'green';
  // 黄色：暂停/被动/待处理
  if (['paused', 'passive', 'pending', 'interviewing', 'offered', 'medium'].includes(s)) return 'yellow';
  // 灰色：关闭/不合适/已流失
  if (['closed', 'not_now', 'discarded', 'lost', 'low'].includes(s)) return 'gray';
  // 默认灰色
  return 'gray';
}

// 状态文案映射
const STATUS_TEXT: Record<string, string> = {
  // 职位状态
  open: '招聘中',
  paused: '暂停',
  closed: '已关闭',
  // 用户状态
  active: '正常',
  disabled: '已禁用',
  // 求职者状态
  looking: '在职看机会',
  unemployed: '离职找工作',
  passive: '被动看机会',
  not_now: '暂不考虑',
  // 撞单状态
  pending: '待处理',
  assigned_a: '归属 A',
  assigned_b: '归属 B',
  shared: '共享独立',
  false_alarm: '误报',
  // 优先级
  high: '高',
  medium: '中',
  low: '低',
  // 工作模式
  onsite: '坐班',
  remote: '远程',
  hybrid: '混合',
  // 职位类型
  full_time: '全职',
  part_time: '兼职',
  intern: '实习',
  outsourcing: '外包',
  // 联系偏好
  wechat: '微信',
  phone: '电话',
  platform: '站内信',
  // 角色
  admin: '管理员',
  consultant: '招聘顾问',
};

const toneClasses: Record<Tone, string> = {
  green: 'bg-forest-100 text-forest-700 dark:bg-forest-800 dark:text-forest-300',
  yellow: 'bg-ochre-100 text-ochre-700 dark:bg-ochre-900/30 dark:text-ochre-400',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  red: 'bg-risk-100 text-risk-700 dark:bg-risk-900/30 dark:text-risk-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export function statusLabel(status?: string | null): string {
  if (!status) return '—';
  return STATUS_TEXT[status.toLowerCase()] || status;
}

export default function StatusBadge({
  status,
  text,
  tone,
  className,
}: StatusBadgeProps) {
  const finalTone = tone || toneForStatus(status);
  const finalText = text || statusLabel(status);
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        toneClasses[finalTone],
        className
      )}
    >
      {finalText}
    </span>
  );
}
