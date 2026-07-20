// 用户管理路由（管理员）
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  findUserById,
  findUserByUsername,
  updatePassword,
} from '../repositories/userRepo.js';
import type { UserRole } from '../types/index.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

// GET /api/users
usersRouter.get('/', requireAdmin, (_req, res) => {
  res.json({ data: listUsers() });
});

// POST /api/users
usersRouter.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { username, password, real_name, department, role } = req.body ?? {};
  if (!username || !password || !real_name) {
    throw new ApiError(400, '用户名、密码、姓名不能为空');
  }
  if (String(password).length < 6) {
    throw new ApiError(400, '密码至少 6 位');
  }
  const existing = findUserByUsername(String(username).trim());
  if (existing) {
    throw new ApiError(409, '用户名已存在');
  }
  const passwordHash = bcrypt.hashSync(String(password), 10);
  const user = createUser({
    id: nanoid(),
    username: String(username).trim(),
    password_hash: passwordHash,
    real_name: String(real_name).trim(),
    department: department ?? null,
    role: (role as UserRole) ?? 'consultant',
  });
  res.status(201).json({ data: user });
}));

// PUT /api/users/:id
usersRouter.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const existing = findUserById(id);
  if (!existing) throw new ApiError(404, '用户不存在');
  const { real_name, department, role, status } = req.body ?? {};
  const updated = updateUser(id, {
    real_name,
    department,
    role: role as UserRole | undefined,
    status,
  });
  res.json({ data: updated });
}));

// DELETE /api/users/:id
usersRouter.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  if (id === req.user!.id) {
    throw new ApiError(400, '不能删除自己');
  }
  const existing = findUserById(id);
  if (!existing) throw new ApiError(404, '用户不存在');
  deleteUser(id);
  res.json({ ok: true });
}));

// POST /api/users/:id/reset-password
usersRouter.post('/:id/reset-password', requireAdmin, asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const { newPassword } = req.body ?? {};
  if (!newPassword || String(newPassword).length < 6) {
    throw new ApiError(400, '新密码至少 6 位');
  }
  const existing = findUserById(id);
  if (!existing) throw new ApiError(404, '用户不存在');
  const newHash = bcrypt.hashSync(String(newPassword), 10);
  updatePassword(id, newHash);
  res.json({ ok: true });
}));
