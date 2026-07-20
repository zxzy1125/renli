// 话术路由
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth, isAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import {
  listPitchesByMatch,
  findPitchById,
  createPitches,
  updatePitch,
} from '../repositories/pitchRepo.js';
import { findMatchById } from '../repositories/matchRepo.js';
import { findPositionById } from '../repositories/positionRepo.js';
import { findResumeById } from '../repositories/resumeRepo.js';
import { callByPromptKey } from '../services/aiService.js';

export const pitchesRouter = Router();

pitchesRouter.use(requireAuth);

// 校验话术归属
function assertPitchOwnerOrAdmin(pitch: { owner_id: string }, user: any) {
  if (!isAdmin(user) && pitch.owner_id !== user.id) {
    throw new ApiError(403, '无权访问此话术');
  }
}

// GET /api/pitches?match_id=xxx
pitchesRouter.get('/', (req, res) => {
  const { match_id } = req.query;
  if (!match_id) throw new ApiError(400, 'match_id 不能为空');
  const match = findMatchById(String(match_id));
  if (!match) throw new ApiError(404, '匹配不存在');
  if (!isAdmin(req.user) && match.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权访问此匹配的话术');
  }
  const pitches = listPitchesByMatch(String(match_id));
  // 员工只能看自己的话术
  const filtered = isAdmin(req.user) ? pitches : pitches.filter(p => p.owner_id === req.user!.id);
  res.json({ data: filtered });
});

// POST /api/pitches/generate（生成 18 条话术，调 AI）
pitchesRouter.post('/generate', asyncHandler(async (req, res) => {
  const { match_id } = req.body ?? {};
  if (!match_id) throw new ApiError(400, 'match_id 不能为空');
  const match = findMatchById(String(match_id));
  if (!match) throw new ApiError(404, '匹配不存在');
  if (!isAdmin(req.user) && match.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权对此匹配生成话术');
  }
  const position = findPositionById(match.position_id);
  const resume = findResumeById(match.resume_id);
  if (!position || !resume) throw new ApiError(404, '职位或简历不存在');

  // 调 AI 生成 18 条话术
  const pitchesData = await callByPromptKey('generatePitches', {
    resume_data: JSON.stringify({
      name: resume.name,
      currentCompany: resume.current_company,
      currentTitle: resume.current_title,
      skills: resume.skills,
      workExperience: resume.work_experience,
      expectation: resume.expectation,
      expectedCity: resume.expected_city,
      commonGrounds: resume.common_grounds,
    }),
    position_data: JSON.stringify({
      title: position.title,
      requirements: position.requirements,
      jd: position.jd,
      salaryMin: position.salary_min,
      salaryMax: position.salary_max,
    }),
    match_report: JSON.stringify({
      score: match.score,
      highlights: match.highlights,
      concerns: match.concerns,
      salaryAnalysis: match.salary_analysis,
    }),
    previous_pitches: '[]',
  });

  if (!Array.isArray(pitchesData)) {
    throw new ApiError(500, 'AI 返回话术格式不正确');
  }

  // 批量入库
  const inputs = pitchesData.slice(0, 18).map((p: any) => ({
    id: nanoid(),
    match_id: match.id,
    owner_id: req.user!.id,
    channel: p.channel ?? 'wechat',
    scene: p.scenario ?? 'outreach',
    content: p.content ?? '',
    status: 'pending' as const,
  }));
  const created = createPitches(inputs);
  res.status(201).json({ data: created, raw: pitchesData });
}));

// PUT /api/pitches/:id（更新话术内容/状态）
pitchesRouter.put('/:id', asyncHandler(async (req, res) => {
  const p = findPitchById(String(req.params.id));
  if (!p) throw new ApiError(404, '话术不存在');
  assertPitchOwnerOrAdmin(p, req.user);
  const { content, status } = req.body ?? {};
  const updated = updatePitch(String(req.params.id), {
    content,
    status,
  });
  res.json({ data: updated });
}));

// POST /api/pitches/:id/polish（润色优化，调 AI）
pitchesRouter.post('/:id/polish', asyncHandler(async (req, res) => {
  const p = findPitchById(String(req.params.id));
  if (!p) throw new ApiError(404, '话术不存在');
  assertPitchOwnerOrAdmin(p, req.user);
  const match = findMatchById(p.match_id);
  if (!match) throw new ApiError(404, '匹配不存在');
  const position = findPositionById(match.position_id);
  const resume = findResumeById(match.resume_id);
  if (!position || !resume) throw new ApiError(404, '职位或简历不存在');

  const result = await callByPromptKey('polish', {
    original_content: p.content,
    channel_and_scenario: `${p.channel} / ${p.scene}`,
    resume_data: JSON.stringify({
      name: resume.name,
      currentCompany: resume.current_company,
      currentTitle: resume.current_title,
      skills: resume.skills,
    }),
  });

  // 如果返回了 polished 字段，自动更新话术
  if (result?.polished && typeof result.polished === 'string') {
    updatePitch(p.id, { content: result.polished, status: 'edited' });
  }

  res.json({ data: result, pitch: findPitchById(p.id) });
}));
