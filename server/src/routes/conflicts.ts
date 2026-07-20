// 撞单管理路由（管理员）
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import {
  listConflicts,
  findConflictById,
  resolveConflict,
} from '../repositories/conflictRepo.js';
import type { ConflictStatus } from '../types/index.js';

export const conflictsRouter = Router();

conflictsRouter.use(requireAuth, requireAdmin);

// GET /api/conflicts?status=pending
conflictsRouter.get('/', (req, res) => {
  const { status } = req.query;
  const data = listConflicts({ status: status ? String(status) : undefined });
  res.json({ data });
});

// GET /api/conflicts/:id
conflictsRouter.get('/:id', asyncHandler(async (req, res) => {
  const c = findConflictById(String(req.params.id));
  if (!c) throw new ApiError(404, '撞单记录不存在');
  res.json({ data: c });
}));

// POST /api/conflicts/:id/resolve
conflictsRouter.post('/:id/resolve', asyncHandler(async (req, res) => {
  const existing = findConflictById(String(req.params.id));
  if (!existing) throw new ApiError(404, '撞单记录不存在');
  const { status, note } = req.body ?? {};
  const validStatuses: ConflictStatus[] = ['assigned_a', 'assigned_b', 'shared', 'false_alarm'];
  if (!status || !validStatuses.includes(status)) {
    throw new ApiError(400, 'status 必须是 assigned_a / assigned_b / shared / false_alarm 之一');
  }
  const updated = resolveConflict(String(req.params.id), status as ConflictStatus, req.user!.id, note);
  res.json({ data: updated });
}));
