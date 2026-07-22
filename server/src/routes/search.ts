// 全局搜索路由：跨职位/简历/客户搜索
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { asyncHandler } from '../middleware/error.js';

export const searchRouter = Router();
searchRouter.use(requireAuth);

// GET /api/search?q=xxx&limit=10
searchRouter.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const limit = Math.min(Number(req.query.limit) || 10, 50);

  if (!q) return res.json({ data: { positions: [], resumes: [], clients: [] } });

  const like = `%${q}%`;
  const isAdmin = req.user!.role === 'admin';

  const positions = db.prepare(
    `SELECT id, title, location, status, department FROM positions WHERE title LIKE ? OR location LIKE ? OR department LIKE ? ORDER BY created_at DESC LIMIT ?`
  ).all(like, like, like, limit);

  const resumeWhere = isAdmin
    ? 'WHERE name LIKE ? OR current_company LIKE ? OR current_title LIKE ? OR skills LIKE ?'
    : 'WHERE owner_id = ? AND (name LIKE ? OR current_company LIKE ? OR current_title LIKE ? OR skills LIKE ?)';
  const resumeParams = isAdmin
    ? [like, like, like, like, limit]
    : [req.user!.id, like, like, like, like, limit];

  const resumes = db.prepare(
    `SELECT id, name, current_company, current_title, education FROM resumes ${resumeWhere} ORDER BY created_at DESC LIMIT ?`
  ).all(...resumeParams);

  const clients = db.prepare(
    `SELECT id, name, industry, contact_name FROM clients WHERE name LIKE ? OR industry LIKE ? OR contact_name LIKE ? ORDER BY created_at DESC LIMIT ?`
  ).all(like, like, like, limit);

  res.json({ data: { positions, resumes, clients } });
}));
