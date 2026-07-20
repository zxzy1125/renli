// 报表路由（管理员）
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { db } from '../db/index.js';

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requireAdmin);

// GET /api/reports/funnel（转化漏斗）
reportsRouter.get('/funnel', (_req, res) => {
  const totalResumes = (db.prepare('SELECT COUNT(*) as cnt FROM resumes').get() as { cnt: number }).cnt;
  const totalMatches = (db.prepare('SELECT COUNT(*) as cnt FROM matches').get() as { cnt: number }).cnt;
  const interviewing = (db.prepare("SELECT COUNT(*) as cnt FROM matches WHERE status = 'interviewing'").get() as { cnt: number }).cnt;
  const offered = (db.prepare("SELECT COUNT(*) as cnt FROM matches WHERE status = 'offered'").get() as { cnt: number }).cnt;
  const onboarded = (db.prepare("SELECT COUNT(*) as cnt FROM matches WHERE status = 'onboarded'").get() as { cnt: number }).cnt;
  res.json({
    data: [
      { stage: '简历入库', count: totalResumes },
      { stage: '匹配创建', count: totalMatches },
      { stage: '面试中', count: interviewing },
      { stage: 'Offer', count: offered },
      { stage: '入职', count: onboarded },
    ],
  });
});

// GET /api/reports/employee-performance（员工绩效）
reportsRouter.get('/employee-performance', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      u.id as employee_id,
      u.real_name,
      u.department,
      (SELECT COUNT(*) FROM resumes r WHERE r.owner_id = u.id) as resume_count,
      (SELECT COUNT(*) FROM matches m WHERE m.owner_id = u.id) as match_count,
      (SELECT COUNT(*) FROM matches m WHERE m.owner_id = u.id AND m.status = 'onboarded') as onboarded_count,
      (SELECT COUNT(*) FROM matches m WHERE m.owner_id = u.id AND m.status = 'offered') as offered_count,
      (SELECT COUNT(*) FROM followup_records fr WHERE fr.employee_id = u.id) as followup_count
    FROM users u
    WHERE u.role = 'consultant'
    ORDER BY onboarded_count DESC, match_count DESC
  `).all();
  res.json({ data: rows });
});

// GET /api/reports/client-summary（客户公司汇总）
reportsRouter.get('/client-summary', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      c.id as client_id,
      c.name as client_name,
      c.industry,
      (SELECT COUNT(*) FROM positions p WHERE p.client_id = c.id) as position_count,
      (SELECT COUNT(*) FROM matches m
        JOIN positions p ON m.position_id = p.id
        WHERE p.client_id = c.id) as match_count,
      (SELECT COUNT(*) FROM matches m
        JOIN positions p ON m.position_id = p.id
        WHERE p.client_id = c.id AND m.status = 'onboarded') as onboarded_count
    FROM clients c
    ORDER BY position_count DESC, match_count DESC
  `).all();
  res.json({ data: rows });
});
