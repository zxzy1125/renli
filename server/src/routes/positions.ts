// 职位路由
import { Router } from 'express';
import { nanoid } from 'nanoid';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import {
  listPositions,
  findPositionById,
  createPosition,
  updatePosition,
  updatePositionStatus,
  deletePosition,
} from '../repositories/positionRepo.js';
import { parseFileToText } from '../utils/fileParser.js';

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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB（Excel/带图 Word 可能较大）
  fileFilter: (_req, file, cb) => {
    const allowed = [
      '.txt', '.pdf', '.docx', '.doc',
      '.xlsx', '.xlsm', '.xls', '.csv',
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('暂不支持该格式，支持 .txt/.pdf/.docx/.xlsx/.xls/.csv/.jpg/.png 等'));
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
    ai_meta: b.ai_meta ?? null,
    source_filename: b.source_filename ?? null,
    source_ext: b.source_ext ?? null,
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
    ai_meta: b.ai_meta,
    source_filename: b.source_filename,
    source_ext: b.source_ext,
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

// POST /api/positions/upload（文件上传，支持 .txt / .pdf / .docx / .xlsx / .xls / .csv / .jpg / .png 等）
positionsRouter.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, '请上传文件');
  // 临时文件读完即删，避免 uploads 目录无限累积
  try {
    const parsed = await parseFileToText(req.file.path, req.file.originalname);
    res.json({
      data: {
        text: parsed.text,
        filename: parsed.meta.filename,
        ext: parsed.meta.ext,
        mime: parsed.meta.mime,
        charCount: parsed.meta.charCount,
        sheetCount: parsed.meta.sheetCount,
        imageCount: parsed.meta.imageCount,
        attachmentCount: parsed.meta.attachmentCount,
        // 返回图片资产给前端，AI 解析时一起回传
        images: parsed.images.map((img) => ({
          name: img.name,
          mime: img.mime,
          base64: img.base64,
          source: img.source,
        })),
        // 附件元信息（前端只展示，不参与 AI 调用）
        attachments: parsed.attachments.map((att) => ({
          name: att.name,
          ext: att.ext,
          mime: att.mime,
          size: att.size,
          source: att.source,
        })),
      },
    });
  } catch (err: any) {
    throw new ApiError(400, err?.message || '文件解析失败');
  } finally {
    // 无论成功失败都删掉临时文件
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
  }
}));
