// 手机号脱敏 / 哈希 / 邮箱脱敏
import crypto from 'node:crypto';

// 手机号脱敏：138****5678
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  // 仅对纯数字手机号做脱敏；非标准格式直接返回原值
  const trimmed = phone.trim();
  if (/^1\d{10}$/.test(trimmed)) {
    return trimmed.slice(0, 3) + '****' + trimmed.slice(7);
  }
  // 兜底：保留首尾各 3 位
  if (trimmed.length <= 6) return trimmed;
  return trimmed.slice(0, 3) + '****' + trimmed.slice(-3);
}

// 手机号哈希：SHA256
export function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(phone.trim()).digest('hex');
}

// 邮箱脱敏：z***@example.com
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [name, domain] = email.split('@');
  if (name.length <= 1) return '*@' + domain;
  return name[0] + '***@' + domain;
}
