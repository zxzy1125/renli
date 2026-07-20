// 简历路由
import { Router } from 'express';
import { nanoid } from 'nanoid';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, isAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import {
  listResumes,
  findResumeById,
  createResume,
  updateResume,
  deleteResume,
} from '../repositories/resumeRepo.js';
import { maskPhone, hashPhone, maskEmail } from '../utils/crypto.js';
import { isExcelFile, parseExcelFile } from '../utils/xlsxParser.js';
import { detectAndCreateConflicts } from '../services/conflictService.js';

export const resumesRouter = Router();

resumesRouter.use(requireAuth);

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
  limits: { fileSize: 50 * 1024 * 1024 },
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

// 去除返回给前端的简历中的敏感字段（email_original）
function sanitizeResume(r: any) {
  if (!r) return r;
  const { email_original, ...rest } = r;
  return rest;
}

// GET /api/resumes（员工仅看自己的，管理员看所有人的）
resumesRouter.get('/', (req, res) => {
  const { keyword, candidate_status, page, pageSize } = req.query;
  const ownerFilter = isAdmin(req.user) ? undefined : req.user!.id;
  const result = listResumes({
    keyword: keyword ? String(keyword) : undefined,
    candidate_status: candidate_status ? String(candidate_status) : undefined,
    owner_id: ownerFilter,
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20,
  });
  res.json({
    data: result.data.map(sanitizeResume),
    total: result.total,
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20,
  });
});

// GET /api/resumes/:id（owner 或 admin 可见）
resumesRouter.get('/:id', asyncHandler(async (req, res) => {
  const r = findResumeById(String(req.params.id));
  if (!r) throw new ApiError(404, '简历不存在');
  if (!isAdmin(req.user) && r.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权查看此简历');
  }
  res.json({ data: sanitizeResume(r) });
}));

// POST /api/resumes（员工录入自己的，自动设置 owner_id，含手机号脱敏+哈希，触发撞单检测）
resumesRouter.post('/', asyncHandler(async (req, res) => {
  const b = req.body ?? {};
  if (!b.name) throw new ApiError(400, '姓名不能为空');

  // 手机号脱敏 + 哈希
  let phoneMasked: string | null = null;
  let phoneHash: string | null = null;
  if (b.phone) {
    phoneMasked = maskPhone(String(b.phone));
    phoneHash = hashPhone(String(b.phone));
  }
  // 邮箱脱敏
  let emailMasked: string | null = null;
  let emailOriginal: string | null = null;
  if (b.email) {
    emailOriginal = String(b.email).trim();
    emailMasked = maskEmail(emailOriginal);
  }

  const resume = createResume({
    id: nanoid(),
    name: String(b.name).trim(),
    age: b.age ?? null,
    education: b.education ?? null,
    current_company: b.current_company ?? null,
    current_title: b.current_title ?? null,
    work_experience: b.work_experience ?? null,
    skills: b.skills ?? null,
    projects: b.projects ?? null,
    expectation: b.expectation ?? null,
    expected_city: b.expected_city ?? null,
    raw_text: b.raw_text ?? null,
    source: b.source ?? null,
    phone_masked: phoneMasked,
    phone_hash: phoneHash,
    email_masked: emailMasked,
    email_original: emailOriginal,
    has_wechat: b.has_wechat ? 1 : 0,
    wechat_id: b.wechat_id ?? null,
    contact_preference: b.contact_preference ?? 'wechat',
    candidate_status: b.candidate_status ?? 'passive',
    expected_onboard_date: b.expected_onboard_date ?? null,
    tags: Array.isArray(b.tags) ? b.tags : [],
    common_grounds: b.common_grounds ?? {},
    risk_warning: b.risk_warning ?? { isRisky: false, reasons: [] },
    remark: b.remark ?? null,
    owner_id: req.user!.id,
  });

  // 触发撞单检测（不阻塞）
  const conflictCount = detectAndCreateConflicts({
    resumeId: resume.id,
    candidateName: resume.name,
    phoneHash: resume.phone_hash ?? null,
    email: emailOriginal,
    currentCompany: resume.current_company ?? null,
    ownerId: resume.owner_id,
  });

  res.status(201).json({ data: sanitizeResume(resume), conflictCount });
}));

// PUT /api/resumes/:id（owner 或 admin）
resumesRouter.put('/:id', asyncHandler(async (req, res) => {
  const existing = findResumeById(String(req.params.id));
  if (!existing) throw new ApiError(404, '简历不存在');
  if (!isAdmin(req.user) && existing.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权修改此简历');
  }
  const b = req.body ?? {};

  // 重新计算手机号脱敏+哈希、邮箱脱敏
  let phoneMasked: string | null | undefined = undefined;
  let phoneHash: string | null | undefined = undefined;
  if (b.phone !== undefined) {
    if (b.phone) {
      phoneMasked = maskPhone(String(b.phone));
      phoneHash = hashPhone(String(b.phone));
    } else {
      phoneMasked = null;
      phoneHash = null;
    }
  }
  let emailMasked: string | null | undefined = undefined;
  let emailOriginal: string | null | undefined = undefined;
  if (b.email !== undefined) {
    if (b.email) {
      emailOriginal = String(b.email).trim();
      emailMasked = maskEmail(emailOriginal);
    } else {
      emailOriginal = null;
      emailMasked = null;
    }
  }

  const updated = updateResume(String(req.params.id), {
    name: b.name,
    age: b.age,
    education: b.education,
    current_company: b.current_company,
    current_title: b.current_title,
    work_experience: b.work_experience,
    skills: b.skills,
    projects: b.projects,
    expectation: b.expectation,
    expected_city: b.expected_city,
    raw_text: b.raw_text,
    source: b.source,
    phone_masked: phoneMasked,
    phone_hash: phoneHash,
    email_masked: emailMasked,
    email_original: emailOriginal,
    has_wechat: b.has_wechat !== undefined ? (b.has_wechat ? 1 : 0) : undefined,
    wechat_id: b.wechat_id,
    contact_preference: b.contact_preference,
    candidate_status: b.candidate_status,
    expected_onboard_date: b.expected_onboard_date,
    tags: Array.isArray(b.tags) ? b.tags : undefined,
    common_grounds: b.common_grounds,
    risk_warning: b.risk_warning,
    remark: b.remark,
  });

  // 触发撞单检测
  if (updated && (phoneHash || emailOriginal || (b.name && b.current_company))) {
    detectAndCreateConflicts({
      resumeId: updated.id,
      candidateName: updated.name,
      phoneHash: updated.phone_hash ?? null,
      email: updated.email_original ?? null,
      currentCompany: updated.current_company ?? null,
      ownerId: updated.owner_id,
    });
  }

  res.json({ data: sanitizeResume(updated) });
}));

// DELETE /api/resumes/:id（owner 或 admin）
resumesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const existing = findResumeById(String(req.params.id));
  if (!existing) throw new ApiError(404, '简历不存在');
  if (!isAdmin(req.user) && existing.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权删除此简历');
  }
  deleteResume(String(req.params.id));
  res.json({ ok: true });
}));

// POST /api/resumes/upload（multer 上传文件，提取文本）
resumesRouter.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
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
