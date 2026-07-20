// 跟进回访相关常量定义
import type {
  FollowupPlanType,
  FollowupPlanStatus,
  FollowupResult,
  PitchChannel,
} from '@/types';

// 计划类型中文标签
export const PLAN_TYPE_LABELS: Record<FollowupPlanType, string> = {
  once: '一次性',
  recurring: '周期性',
  custom: '自定义',
};

// 计划状态中文标签
export const PLAN_STATUS_LABELS: Record<FollowupPlanStatus, string> = {
  active: '进行中',
  completed: '已完成',
  stopped: '已停止',
};

// 计划状态对应的色调
export const PLAN_STATUS_TONES: Record<FollowupPlanStatus, 'green' | 'gray' | 'red'> = {
  active: 'green',
  completed: 'gray',
  stopped: 'red',
};

// 计划状态徽章色调对应的 class
export const PLAN_STATUS_TONE_CLASS: Record<FollowupPlanStatus, string> = {
  active: 'bg-forest-100 text-forest-700',
  completed: 'bg-gray-100 text-gray-500',
  stopped: 'bg-risk-100 text-risk-700',
};

// 回访结果中文标签
export const FOLLOWUP_RESULT_LABELS: Record<FollowupResult, string> = {
  reached: '已联系上',
  no_response: '未接听/未回复',
  rejected: '已拒绝',
  interview_invited: '已邀面试',
  other: '其他',
};

// 回访结果对应的色调（forest/ochre/risk）
export const FOLLOWUP_RESULT_COLORS: Record<FollowupResult, 'forest' | 'ochre' | 'risk'> = {
  reached: 'forest',
  interview_invited: 'forest',
  no_response: 'ochre',
  rejected: 'risk',
  other: 'forest',
};

// 回访结果徽章色调 class
export const FOLLOWUP_RESULT_TONE_CLASS: Record<FollowupResult, string> = {
  reached: 'bg-forest-100 text-forest-700',
  interview_invited: 'bg-forest-100 text-forest-700',
  no_response: 'bg-ochre-100 text-ochre-700',
  rejected: 'bg-risk-100 text-risk-700',
  other: 'bg-forest-100 text-forest-700',
};

// 联系渠道中文标签
export const CHANNEL_LABELS: Record<PitchChannel, string> = {
  wechat: '微信',
  phone: '电话',
  platform: '站内信',
};

// 渠道顺序（用于一键复制话术时的展示）
export const PITCH_CHANNELS: PitchChannel[] = ['wechat', 'phone', 'platform'];

// 下一步动作选项
export const NEXT_ACTION_OPTIONS = [
  { value: 'continue', label: '继续跟进' },
  { value: 'interview', label: '直接邀面试' },
  { value: 'pause', label: '暂停跟进' },
] as const;

// 计划类型选项
export const PLAN_TYPE_OPTIONS = [
  { value: 'once' as const, label: '一次性', desc: '设置一个具体提醒日期，完成即结束' },
  { value: 'recurring' as const, label: '周期性', desc: '按固定间隔（天）自动循环，最多 N 次' },
  { value: 'custom' as const, label: '自定义', desc: '手动设置多个具体回访日期' },
];

// 转化概率等级（用于颜色与文字描述）
export function probabilityLevel(p: number): { label: string; tone: 'forest' | 'ochre' | 'risk' } {
  if (p >= 70) return { label: '高', tone: 'forest' };
  if (p >= 40) return { label: '中等', tone: 'ochre' };
  return { label: '低', tone: 'risk' };
}

// 转化概率对应文字颜色类
export function probabilityColorClass(p: number): string {
  if (p >= 70) return 'text-forest-600';
  if (p >= 40) return 'text-ochre-600';
  return 'text-risk-600';
}

// 根据优先级返回中文标签
export function priorityLabel(priority: string): string {
  const map: Record<string, string> = {
    high: '高优先级',
    medium: '中优先级',
    low: '低优先级',
  };
  return map[priority] || priority;
}

// 根据优先级返回色调 class
export function priorityToneClass(priority: string): string {
  const map: Record<string, string> = {
    high: 'bg-risk-100 text-risk-700',
    medium: 'bg-ochre-100 text-ochre-700',
    low: 'bg-forest-100 text-forest-700',
  };
  return map[priority] || 'bg-gray-100 text-gray-500';
}

// 顾虑强度（强/中/弱）对应色调
export function strengthToneClass(strength: string): string {
  const s = (strength || '').toLowerCase();
  if (s.includes('强') || s.includes('high')) return 'bg-risk-100 text-risk-700';
  if (s.includes('中') || s.includes('medium')) return 'bg-ochre-100 text-ochre-700';
  if (s.includes('弱') || s.includes('low')) return 'bg-forest-100 text-forest-700';
  return 'bg-gray-100 text-gray-500';
}
