// 通知路由
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../repositories/notificationRepo.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

// GET /api/notifications?page=1&pageSize=20&unread=1
notificationsRouter.get('/', asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const unreadOnly = req.query.unread === '1';
  const result = listNotifications(req.user!.id, { page, pageSize, unreadOnly });
  res.json(result);
}));

// GET /api/notifications/unread-count
notificationsRouter.get('/unread-count', asyncHandler(async (req, res) => {
  const count = getUnreadCount(req.user!.id);
  res.json({ count });
}));

// PATCH /api/notifications/:id/read
notificationsRouter.patch('/:id/read', asyncHandler(async (req, res) => {
  const ok = markAsRead(String(req.params.id), req.user!.id);
  if (!ok) throw new ApiError(404, '通知不存在');
  res.json({ ok: true });
}));

// POST /api/notifications/mark-all-read
notificationsRouter.post('/mark-all-read', asyncHandler(async (req, res) => {
  markAllAsRead(req.user!.id);
  res.json({ ok: true });
}));
