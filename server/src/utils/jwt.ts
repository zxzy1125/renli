// JWT 工具
import jwt from 'jsonwebtoken';
import type { SafeUser } from '../types/index.js';

// 硬编码密钥（生产环境会换成环境变量）
export const JWT_SECRET = 'trae-recruit-secret-key-2026';
// 24 小时过期
export const JWT_EXPIRES_IN = '24h';

// 生成 token
export function signToken(user: SafeUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// 验证 token
export function verifyToken(token: string): { id: string; username: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; role: string };
    return decoded;
  } catch {
    return null;
  }
}
