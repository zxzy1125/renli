// 职位表单的常量定义
export const JOB_TYPE_OPTIONS = [
  { value: 'fulltime', label: '全职' },
  { value: 'parttime', label: '兼职' },
  { value: 'intern', label: '实习' },
  { value: 'outsourcing', label: '外包' },
] as const;

export const WORK_MODE_OPTIONS = [
  { value: 'onsite', label: '坐班' },
  { value: 'remote', label: '远程' },
  { value: 'hybrid', label: '混合' },
] as const;

export const PRIORITY_OPTIONS = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
] as const;

export const POSITION_STATUS_OPTIONS = [
  { value: 'open', label: '招聘中' },
  { value: 'paused', label: '暂停' },
  { value: 'closed', label: '已关闭' },
] as const;

// 获取选项 label
export function getOptionLabel(
  options: readonly { value: string; label: string }[],
  value?: string | null
): string {
  if (!value) return '—';
  const o = options.find((o) => o.value === value);
  return o?.label ?? value;
}
