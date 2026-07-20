// 简历表单的常量定义
export const CANDIDATE_STATUS_OPTIONS = [
  { value: 'looking', label: '在职看机会' },
  { value: 'unemployed', label: '离职找工作' },
  { value: 'passive', label: '被动看机会' },
  { value: 'not_now', label: '暂不考虑' },
] as const;

export const CONTACT_PREFERENCE_OPTIONS = [
  { value: 'wechat', label: '微信' },
  { value: 'phone', label: '电话' },
  { value: 'platform', label: '站内信' },
] as const;

export function getOptionLabel(
  options: readonly { value: string; label: string }[],
  value?: string | null
): string {
  if (!value) return '—';
  const o = options.find((o) => o.value === value);
  return o?.label ?? value;
}
