// 职位路由
import { Router } from 'express';
import { nanoid } from 'nanoid';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { isExcelFile, parseExcelFile } from '../utils/xlsxParser.js';
import {
  listPositions,
  findPositionById,
  createPosition,
  updatePosition,
  updatePositionStatus,
  deletePosition,
} from '../repositories/positionRepo.js';

export const positionsRouter = Router();

positionsRouter.use(requireAuth);

// 文件上传配置
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.resolve(process.cwd(), 'server/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.txt', '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('暂不支持该格式，请粘贴文本'));
    }
  },
});

// GET /api/positions（全员可见，支持搜索/筛选/分页）
positionsRouter.get('/', (req, res) => {
  const { keyword, status, client_id, page, pageSize } = req.query;
  const result = listPositions({
    keyword: keyword ? String(keyword) : undefined,
    status: status ? String(status) : undefined,
    client_id: client_id ? String(client_id) : undefined,
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20,
  });
  res.json({ data: result.data, total: result.total, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
});

// GET /api/positions/:id
positionsRouter.get('/:id', asyncHandler(async (req, res) => {
  const p = findPositionById(String(req.params.id));
  if (!p) throw new ApiError(404, '职位不存在');
  res.json({ data: p });
}));

// POST /api/positions（管理员，含 raw_text）
positionsRouter.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const b = req.body ?? {};
  if (!b.title) throw new ApiError(400, '职位标题不能为空');
  const p = createPosition({
    id: nanoid(),
    title: String(b.title).trim(),
    client_id: b.client_id ?? null,
    department: b.department ?? null,
    location: b.location ?? null,
    headcount: b.headcount ? Number(b.headcount) : null,
    salary_min: b.salary_min ?? null,
    salary_max: b.salary_max ?? null,
    experience: b.experience ?? null,
    education: b.education ?? null,
    job_type: b.job_type ?? null,
    work_mode: b.work_mode ?? null,
    priority: b.priority ?? null,
    status: b.status ?? 'open',
    jd: b.jd ?? null,
    requirements: b.requirements ?? null,
    bonus: b.bonus ?? null,
    keywords: Array.isArray(b.keywords) ? b.keywords : [],
    raw_text: b.raw_text ?? null,
    created_by: req.user!.id,
  });
  res.status(201).json({ data: p });
}));

// PUT /api/positions/:id（管理员）
positionsRouter.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = findPositionById(String(req.params.id));
  if (!existing) throw new ApiError(404, '职位不存在');
  const b = req.body ?? {};
  const updated = updatePosition(String(req.params.id), {
    title: b.title,
    client_id: b.client_id,
    department: b.department,
    location: b.location,
    headcount: b.headcount !== undefined ? (b.headcount === null ? null : Number(b.headcount)) : undefined,
    salary_min: b.salary_min,
    salary_max: b.salary_max,
    experience: b.experience,
    education: b.education,
    job_type: b.job_type,
    work_mode: b.work_mode,
    priority: b.priority,
    status: b.status,
    jd: b.jd,
    requirements: b.requirements,
    bonus: b.bonus,
    keywords: Array.isArray(b.keywords) ? b.keywords : undefined,
    raw_text: b.raw_text,
  });
  res.json({ data: updated });
}));

// PATCH /api/positions/:id/status（管理员）
positionsRouter.patch('/:id/status', requireAdmin, asyncHandler(async (req, res) => {
  const existing = findPositionById(String(req.params.id));
  if (!existing) throw new ApiError(404, '职位不存在');
  const { status } = req.body ?? {};
  if (!status) throw new ApiError(400, 'status 不能为空');
  const updated = updatePositionStatus(String(req.params.id), String(status));
  res.json({ data: updated });
}));

// DELETE /api/positions/:id（管理员）
positionsRouter.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = findPositionById(String(req.params.id));
  if (!existing) throw new ApiError(404, '职位不存在');
  deletePosition(String(req.params.id));
  res.json({ ok: true });
}));

// POST /api/positions/upload（文件上传）
positionsRouter.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, '请上传文件');
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (ext === '.txt') {
    const text = fs.readFileSync(req.file.path, 'utf-8');
    res.json({ data: { text, filename: req.file.originalname } });
  } else if (isExcelFile(req.file.originalname)) {
    const text = parseExcelFile(req.file.path);
    res.json({ data: { text, filename: req.file.originalname } });
  } else {
    res.status(400).json({ error: '暂不支持该格式，请粘贴文本或上传 .txt/.xlsx/.csv' });
  }
}));
