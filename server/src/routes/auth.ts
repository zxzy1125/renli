// 认证路由
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { findUserByUsername, findUserById, updatePassword } from '../repositories/userRepo.js';
import { signToken } from '../utils/jwt.js';
import type { LoginResponse, SafeUser } from '../types/index.js';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    throw new ApiError(400, '用户名和密码不能为空');
  }
  const user = findUserByUsername(String(username).trim());
  if (!user) {
    throw new ApiError(401, '用户名或密码错误');
  }
  if (user.status !== 'active') {
    throw new ApiError(403, '账号已被禁用');
  }
  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) {
    throw new ApiError(401, '用户名或密码错误');
  }
  const { password_hash, ...safeUser } = user;
  const token = signToken(safeUser as SafeUser);
  const resp: LoginResponse = { token, user: safeUser as SafeUser };
  res.json(resp);
}));

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password
authRouter.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body ?? {};
  if (!oldPassword || !newPassword) {
    throw new ApiError(400, '旧密码和新密码不能为空');
  }
  if (String(newPassword).length < 6) {
    throw new ApiError(400, '新密码至少 6 位');
  }
  const user = findUserById(req.user!.id);
  if (!user) throw new ApiError(404, '用户不存在');
  const ok = bcrypt.compareSync(String(oldPassword), user.password_hash);
  if (!ok) throw new ApiError(400, '旧密码错误');
  const newHash = bcrypt.hashSync(String(newPassword), 10);
  updatePassword(user.id, newHash);
  res.json({ ok: true });
}));
