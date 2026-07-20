// 匹配路由
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth, isAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import {
  listMatches,
  findMatchById,
  createMatch,
  updateMatchStatus,
  updateMatch,
  deleteMatch,
} from '../repositories/matchRepo.js';
import { findPositionById } from '../repositories/positionRepo.js';
import { findResumeById } from '../repositories/resumeRepo.js';
import { callByPromptKey } from '../services/aiService.js';

export const matchesRouter = Router();

matchesRouter.use(requireAuth);

// 校验匹配归属
function assertOwnerOrAdmin(match: { owner_id: string }, user: any) {
  if (!isAdmin(user) && match.owner_id !== user.id) {
    throw new ApiError(403, '无权访问此匹配');
  }
}

// GET /api/matches（owner 或 admin）
matchesRouter.get('/', (req, res) => {
  const { position_id, resume_id, status, page, pageSize } = req.query;
  const ownerFilter = isAdmin(req.user) ? undefined : req.user!.id;
  const result = listMatches({
    position_id: position_id ? String(position_id) : undefined,
    resume_id: resume_id ? String(resume_id) : undefined,
    status: status ? String(status) : undefined,
    owner_id: ownerFilter,
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20,
  });
  res.json({
    data: result.data,
    total: result.total,
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20,
  });
});

// GET /api/matches/:id
matchesRouter.get('/:id', asyncHandler(async (req, res) => {
  const m = findMatchById(String(req.params.id));
  if (!m) throw new ApiError(404, '匹配不存在');
  assertOwnerOrAdmin(m, req.user);
  res.json({ data: m });
}));

// POST /api/matches（创建匹配，调 AI 生成匹配报告）
matchesRouter.post('/', asyncHandler(async (req, res) => {
  const { position_id, resume_id } = req.body ?? {};
  if (!position_id || !resume_id) {
    throw new ApiError(400, 'position_id 和 resume_id 不能为空');
  }
  const position = findPositionById(String(position_id));
  if (!position) throw new ApiError(404, '职位不存在');
  const resume = findResumeById(String(resume_id));
  if (!resume) throw new ApiError(404, '简历不存在');
  // 员工只能针对自己的简历创建匹配
  if (!isAdmin(req.user) && resume.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权对他人简历创建匹配');
  }

  // 先创建一个初始匹配记录
  const match = createMatch({
    id: nanoid(),
    position_id: position.id,
    resume_id: resume.id,
    owner_id: req.user!.id,
    status: 'consulting',
  });

  // 尝试调用 AI 生成匹配报告（失败则返回基础记录）
  let aiReport: any = null;
  try {
    aiReport = await callByPromptKey('matchAnalysis', {
      resume_data: JSON.stringify({
        name: resume.name,
        currentCompany: resume.current_company,
        currentTitle: resume.current_title,
        skills: resume.skills,
        workExperience: resume.work_experience,
        projects: resume.projects,
        expectation: resume.expectation,
        expectedCity: resume.expected_city,
      }),
      position_data: JSON.stringify({
        title: position.title,
        requirements: position.requirements,
        jd: position.jd,
        salaryMin: position.salary_min,
        salaryMax: position.salary_max,
        experience: position.experience,
        education: position.education,
        location: position.location,
      }),
    });
    // 更新匹配记录
    updateMatch(match.id, {
      score: aiReport?.matchScore ?? null,
      highlights: aiReport?.highlights ?? [],
      concerns: aiReport?.concerns ?? [],
      salary_analysis: aiReport?.salaryAnalysis ?? {},
      conversion_probability: aiReport?.conversionPrediction?.probability ?? null,
    });
  } catch (err: any) {
    // AI 调用失败不阻塞匹配创建
    aiReport = { warning: `AI 匹配分析失败：${err.message}` };
  }

  const finalMatch = findMatchById(match.id);
  res.status(201).json({ data: finalMatch, aiReport });
}));

// PATCH /api/matches/:id/status（推进状态）
matchesRouter.patch('/:id/status', asyncHandler(async (req, res) => {
  const m = findMatchById(String(req.params.id));
  if (!m) throw new ApiError(404, '匹配不存在');
  assertOwnerOrAdmin(m, req.user);
  const { status } = req.body ?? {};
  if (!status) throw new ApiError(400, 'status 不能为空');
  const updated = updateMatchStatus(String(req.params.id), String(status));
  res.json({ data: updated });
}));

// DELETE /api/matches/:id
matchesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const m = findMatchById(String(req.params.id));
  if (!m) throw new ApiError(404, '匹配不存在');
  assertOwnerOrAdmin(m, req.user);
  deleteMatch(String(req.params.id));
  res.json({ ok: true });
}));
