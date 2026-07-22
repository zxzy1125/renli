// 报表路由（管理员）
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
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

// GET /api/reports/trends?months=6（月度趋势数据）
reportsRouter.get('/trends', asyncHandler(async (req, res) => {
  const months = Math.min(Number(req.query.months) || 6, 24);
  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m', created_at) as month,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'onboarded' THEN 1 ELSE 0 END) as onboarded,
      SUM(CASE WHEN status = 'offer_sent' THEN 1 ELSE 0 END) as offered,
      SUM(CASE WHEN status IN ('interview_invited','interview_passed') THEN 1 ELSE 0 END) as interviewing
    FROM matches
    WHERE created_at >= date('now', '-' || ? || ' months')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month ASC
  `).all(months);
  res.json({ data: rows });
}));

// GET /api/reports/export/:type?format=xlsx|pdf
reportsRouter.get('/export/:type', asyncHandler(async (req, res) => {
  const { type } = req.params;
  const format = String(req.query.format || 'xlsx');

  let data: any[] = [];
  let columns: { header: string; dataKey: string }[] = [];
  const titleMap: Record<string, string> = { positions: '职位列表', resumes: '简历列表', matches: '匹配列表' };

  if (type === 'positions') {
    data = db.prepare('SELECT title, department, location, status, salary_min, salary_max, experience, education, created_at FROM positions ORDER BY created_at DESC').all();
    columns = [
      { header: '职位', dataKey: 'title' }, { header: '部门', dataKey: 'department' },
      { header: '地点', dataKey: 'location' }, { header: '状态', dataKey: 'status' },
      { header: '薪资下限', dataKey: 'salary_min' }, { header: '薪资上限', dataKey: 'salary_max' },
      { header: '经验', dataKey: 'experience' }, { header: '学历', dataKey: 'education' },
      { header: '创建时间', dataKey: 'created_at' },
    ];
  } else if (type === 'resumes') {
    data = db.prepare('SELECT name, age, education, current_company, current_title, skills, created_at FROM resumes ORDER BY created_at DESC').all();
    columns = [
      { header: '姓名', dataKey: 'name' }, { header: '年龄', dataKey: 'age' },
      { header: '学历', dataKey: 'education' }, { header: '当前公司', dataKey: 'current_company' },
      { header: '当前职位', dataKey: 'current_title' }, { header: '技能', dataKey: 'skills' },
      { header: '创建时间', dataKey: 'created_at' },
    ];
  } else if (type === 'matches') {
    data = db.prepare(`
      SELECT p.title as position_title, r.name as candidate_name, m.status, m.score, m.created_at
      FROM matches m JOIN positions p ON m.position_id = p.id JOIN resumes r ON m.resume_id = r.id
      ORDER BY m.created_at DESC
    `).all();
    columns = [
      { header: '职位', dataKey: 'position_title' }, { header: '候选人', dataKey: 'candidate_name' },
      { header: '状态', dataKey: 'status' }, { header: '匹配分', dataKey: 'score' },
      { header: '创建时间', dataKey: 'created_at' },
    ];
  } else {
    return res.status(400).json({ error: 'type 必须为 positions|resumes|matches' });
  }

  if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data, { header: columns.map(c => c.dataKey) });
    columns.forEach((col, i) => {
      const cell = XLSX.utils.encode_cell({ r: 0, c: i });
      if (ws[cell]) ws[cell].v = col.header;
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(Buffer.from(buf));
  } else if (format === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' });
    doc.setFontSize(14);
    doc.text(titleMap[type] || type, 14, 20);
    autoTable(doc, {
      startY: 30, columns, body: data,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [34, 80, 54] },
    });
    const pdfBuf = doc.output('arraybuffer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.pdf"`);
    res.send(Buffer.from(pdfBuf));
  } else {
    res.status(400).json({ error: 'format 必须为 xlsx 或 pdf' });
  }
}));
