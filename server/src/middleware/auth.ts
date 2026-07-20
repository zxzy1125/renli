// 鉴权中间件：JWT 验证 + RBAC 权限
import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { findUserById } from '../repositories/userRepo.js';
import type { SafeUser, UserRole } from '../types/index.js';

// 要求登录
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证 token' });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'token 无效或已过期' });
    return;
  }
  const user = findUserById(payload.id);
  if (!user) {
    res.status(401).json({ error: '用户不存在' });
    return;
  }
  if (user.status !== 'active') {
    res.status(403).json({ error: '账号已被禁用' });
    return;
  }
  // 挂载安全用户视图（不含密码）
  const { password_hash, ...safeUser } = user;
  req.user = safeUser as SafeUser;
  next();
}

// 要求管理员
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: '未认证' });
    return;
  }
  if (req.user.role !== 'admin' as UserRole) {
    res.status(403).json({ error: '权限不足，需要管理员权限' });
    return;
  }
  next();
}

// 是否管理员
export function isAdmin(user?: SafeUser): boolean {
  return user?.role === 'admin';
}
