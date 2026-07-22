// AI 服务路由
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth, requireAdmin, isAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { callByPromptKey } from '../services/aiService.js';
import { findPositionById, findAllPositionsByStatus } from '../repositories/positionRepo.js';
import { findResumeById, findResumesByCandidateStatuses } from '../repositories/resumeRepo.js';
import { findMatchById, findExistingMatchKeys } from '../repositories/matchRepo.js';
import { prefilterResumes, executeSmartMatch } from '../services/smartMatchService.js';
import { listPitchesByMatch } from '../repositories/pitchRepo.js';
import { createAnalysis } from '../repositories/aiAnalysisRepo.js';

export const aiRouter = Router();

aiRouter.use(requireAuth);

// POST /api/ai/parse-position（管理员，支持多模态）
// body: { raw_text: string, images?: [{ name, mime, base64 }] }
// 有图片时自动切换到多模态模型配置（mm_*）
aiRouter.post('/parse-position', requireAdmin, asyncHandler(async (req, res) => {
  const { raw_text, images } = req.body ?? {};
  if (!raw_text) throw new ApiError(400, 'raw_text 不能为空');
  // 校验图片资产格式，防止脏数据进入 AI 调用
  const safeImages = Array.isArray(images)
    ? images
        .filter((img: any) => img && typeof img.base64 === 'string' && typeof img.mime === 'string')
        .map((img: any) => ({ name: String(img.name || 'image'), mime: String(img.mime), base64: String(img.base64) }))
        .slice(0, 12) // 服务端再设一次上限，避免前端发太多
    : [];
  const result = await callByPromptKey('parsePosition', {
    raw_text: String(raw_text),
  }, safeImages.length > 0 ? { images: safeImages, timeoutMs: 120000 } : undefined);
  res.json({ data: result });
}));

// POST /api/ai/parse-resume（员工，支持多模态）
// body: { raw_text: string, images?: [{ name, mime, base64 }] }
// 有图片时自动切换到多模态模型配置（mm_*）
aiRouter.post('/parse-resume', asyncHandler(async (req, res) => {
  const { raw_text, images } = req.body ?? {};
  if (!raw_text) throw new ApiError(400, 'raw_text 不能为空');
  const safeImages = Array.isArray(images)
    ? images
        .filter((img: any) => img && typeof img.base64 === 'string' && typeof img.mime === 'string')
        .map((img: any) => ({ name: String(img.name || 'image'), mime: String(img.mime), base64: String(img.base64) }))
        .slice(0, 12)
    : [];
  const result = await callByPromptKey('parseResume', {
    raw_text: String(raw_text),
  }, safeImages.length > 0 ? { images: safeImages, timeoutMs: 120000 } : undefined);
  res.json({ data: result });
}));

// POST /api/ai/match-analysis（员工）
aiRouter.post('/match-analysis', asyncHandler(async (req, res) => {
  const { position_id, resume_id } = req.body ?? {};
  if (!position_id || !resume_id) throw new ApiError(400, 'position_id 和 resume_id 不能为空');
  const position = findPositionById(String(position_id));
  if (!position) throw new ApiError(404, '职位不存在');
  const resume = findResumeById(String(resume_id));
  if (!resume) throw new ApiError(404, '简历不存在');
  if (!isAdmin(req.user) && resume.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权对他人简历进行分析');
  }
  const result = await callByPromptKey('matchAnalysis', {
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
  res.json({ data: result });
}));

// POST /api/ai/generate-pitches（员工）
aiRouter.post('/generate-pitches', asyncHandler(async (req, res) => {
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
  const existing = listPitchesByMatch(match.id);
  const result = await callByPromptKey('generatePitches', {
    resume_data: JSON.stringify({
      name: resume.name,
      currentCompany: resume.current_company,
      currentTitle: resume.current_title,
      skills: resume.skills,
      workExperience: resume.work_experience,
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
    previous_pitches: JSON.stringify(existing.map(p => ({ channel: p.channel, scenario: p.scene, content: p.content }))),
  });
  res.json({ data: result });
}));

// POST /api/ai/pre-followup（员工）
aiRouter.post('/pre-followup', asyncHandler(async (req, res) => {
  const { resume_id, position_id, candidate_status, followup_history, sent_pitches } = req.body ?? {};
  if (!resume_id) throw new ApiError(400, 'resume_id 不能为空');
  const resume = findResumeById(String(resume_id));
  if (!resume) throw new ApiError(404, '简历不存在');
  if (!isAdmin(req.user) && resume.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权对此简历进行分析');
  }
  const position = position_id ? findPositionById(String(position_id)) : null;
  const result = await callByPromptKey('preFollowup', {
    resume_data: JSON.stringify({
      name: resume.name,
      currentCompany: resume.current_company,
      currentTitle: resume.current_title,
      skills: resume.skills,
      workExperience: resume.work_experience,
      commonGrounds: resume.common_grounds,
    }),
    position_data: JSON.stringify(position ?? {}),
    followup_history: followup_history ?? '[]',
    candidate_status: candidate_status ?? resume.candidate_status ?? 'passive',
    sent_pitches: sent_pitches ?? '[]',
  });
  const analysis = createAnalysis({
    id: nanoid(),
    type: 'pre_followup',
    input: { resume_id, position_id },
    output: result,
  });
  res.json({ data: result, analysis });
}));

// POST /api/ai/post-followup（员工）
aiRouter.post('/post-followup', asyncHandler(async (req, res) => {
  const { resume_id, position_id, employee_input, followup_history, previous_analyses } = req.body ?? {};
  if (!resume_id || !employee_input) throw new ApiError(400, 'resume_id 和 employee_input 不能为空');
  const resume = findResumeById(String(resume_id));
  if (!resume) throw new ApiError(404, '简历不存在');
  if (!isAdmin(req.user) && resume.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权对此简历进行分析');
  }
  const position = position_id ? findPositionById(String(position_id)) : null;
  const result = await callByPromptKey('postFollowup', {
    resume_data: JSON.stringify({
      name: resume.name,
      currentCompany: resume.current_company,
      currentTitle: resume.current_title,
      skills: resume.skills,
      workExperience: resume.work_experience,
    }),
    position_data: JSON.stringify(position ?? {}),
    employee_input: String(employee_input),
    followup_history: followup_history ?? '[]',
    previous_analyses: previous_analyses ?? '[]',
  });
  const analysis = createAnalysis({
    id: nanoid(),
    type: 'post_followup',
    input: { resume_id, position_id, employee_input },
    output: result,
  });
  res.json({ data: result, analysis });
}));

// POST /api/ai/concern-pitch（员工）
aiRouter.post('/concern-pitch', asyncHandler(async (req, res) => {
  const { resume_id, position_id, specific_concern, strategy, previous_pitches } = req.body ?? {};
  if (!resume_id || !specific_concern) throw new ApiError(400, 'resume_id 和 specific_concern 不能为空');
  const resume = findResumeById(String(resume_id));
  if (!resume) throw new ApiError(404, '简历不存在');
  if (!isAdmin(req.user) && resume.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权对此简历进行分析');
  }
  const position = position_id ? findPositionById(String(position_id)) : null;
  const result = await callByPromptKey('concernPitch', {
    resume_data: JSON.stringify({
      name: resume.name,
      currentCompany: resume.current_company,
      currentTitle: resume.current_title,
      skills: resume.skills,
      commonGrounds: resume.common_grounds,
    }),
    position_data: JSON.stringify(position ?? {}),
    specific_concern: String(specific_concern),
    strategy: strategy ?? '',
    previous_pitches: previous_pitches ?? '[]',
  });
  res.json({ data: result });
}));

// POST /api/ai/polish（员工）
aiRouter.post('/polish', asyncHandler(async (req, res) => {
  const { original_content, channel_and_scenario, resume_id } = req.body ?? {};
  if (!original_content) throw new ApiError(400, 'original_content 不能为空');
  let resumeData = '{}';
  if (resume_id) {
    const resume = findResumeById(String(resume_id));
    if (resume) {
      if (!isAdmin(req.user) && resume.owner_id !== req.user!.id) {
        throw new ApiError(403, '无权对此简历进行分析');
      }
      resumeData = JSON.stringify({
        name: resume.name,
        currentCompany: resume.current_company,
        currentTitle: resume.current_title,
        skills: resume.skills,
      });
    }
  }
  const result = await callByPromptKey('polish', {
    original_content: String(original_content),
    channel_and_scenario: channel_and_scenario ?? '',
    resume_data: resumeData,
  });
  res.json({ data: result });
}));

// POST /api/ai/generate-boss-posting（全员）
// 支持可选 style 参数：指定单个风格时只生成该风格的文案
aiRouter.post('/generate-boss-posting', asyncHandler(async (req, res) => {
  const { position_id, industry, city, style } = req.body ?? {};
  if (!position_id) throw new ApiError(400, 'position_id 不能为空');
  const position = findPositionById(String(position_id));
  if (!position) throw new ApiError(404, '职位不存在');
  const positionData = JSON.stringify({
    title: position.title,
    requirements: position.requirements,
    jd: position.jd,
    salaryMin: position.salary_min,
    salaryMax: position.salary_max,
    location: position.location,
    keywords: position.keywords,
  });
  const industryVal = industry ?? '';
  const cityVal = city ?? position.location ?? '';

  if (style) {
    // 单风格重新生成
    const result = await callByPromptKey('generateBossPostingSingle', {
      position_data: positionData,
      industry: industryVal,
      city: cityVal,
      style: String(style),
    });
    res.json({ data: result });
  } else {
    // 全部 3 套
    const result = await callByPromptKey('generateBossPosting', {
      position_data: positionData,
      industry: industryVal,
      city: cityVal,
    });
    res.json({ data: result });
  }
}));

// POST /api/ai/batch-match（批量 AI 匹配：一个职位 → 多份简历）
aiRouter.post('/batch-match', asyncHandler(async (req, res) => {
  const { position_id, resume_ids } = req.body ?? {};
  if (!position_id) throw new ApiError(400, 'position_id 不能为空');
  if (!Array.isArray(resume_ids) || resume_ids.length === 0) {
    throw new ApiError(400, '请提供 resume_ids 数组（最多 50 条）');
  }
  if (resume_ids.length > 50) throw new ApiError(400, '单次最多匹配 50 份简历');

  const position = findPositionById(String(position_id));
  if (!position) throw new ApiError(404, '职位不存在');

  const positionData = JSON.stringify({
    title: position.title,
    requirements: position.requirements,
    jd: position.jd,
    salaryMin: position.salary_min,
    salaryMax: position.salary_max,
    experience: position.experience,
    education: position.education,
    location: position.location,
  });

  const results = await Promise.allSettled(
    resume_ids.map(async (rid: string) => {
      const resume = findResumeById(String(rid));
      if (!resume) return { resume_id: String(rid), error: '简历不存在' };
      if (!isAdmin(req.user) && resume.owner_id !== req.user!.id) {
        return { resume_id: String(rid), error: '无权对此简历进行分析' };
      }
      const result = await callByPromptKey('matchAnalysis', {
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
        position_data: positionData,
      });
      return { resume_id: String(rid), resume_name: resume.name, data: result };
    })
  );

  const data = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return { resume_id: String(resume_ids[i]), error: (r.reason as Error)?.message || '分析失败' };
  });

  res.json({ data });
}));

// GET /api/ai/smart-match/stats — 获取智能匹配预估统计
aiRouter.get('/smart-match/stats', asyncHandler(async (_req, res) => {
  const openPositions = findAllPositionsByStatus('open');
  const availableResumes = findResumesByCandidateStatuses(['looking', 'unemployed']);
  const existingKeys = findExistingMatchKeys();

  // 预估去重后的对数
  let estimatedPairs = 0;
  for (const pos of openPositions) {
    for (const resume of availableResumes) {
      if (!existingKeys.has(`${pos.id}:${resume.id}`)) {
        estimatedPairs++;
      }
    }
  }

  res.json({
    data: {
      open_positions: openPositions.length,
      available_resumes: availableResumes.length,
      existing_matches: existingKeys.size,
      estimated_pairs: estimatedPairs,
    },
  });
}));

// POST /api/ai/smart-match — 智能匹配（SSE 推送进度）
aiRouter.post('/smart-match', asyncHandler(async (req, res) => {
  const { position_ids, status_filter } = req.body ?? {};

  // 确定简历范围
  const resumeStatuses = Array.isArray(status_filter) && status_filter.length > 0
    ? status_filter
    : ['looking', 'unemployed'];
  const resumes = findResumesByCandidateStatuses(resumeStatuses);
  if (resumes.length === 0) throw new ApiError(400, '暂无可匹配的空闲人才');

  // 确定职位范围
  let positions;
  if (Array.isArray(position_ids) && position_ids.length > 0) {
    positions = position_ids
      .map((id: string) => findPositionById(String(id)))
      .filter((p): p is NonNullable<typeof p> => p !== null && p.status === 'open');
  } else {
    positions = findAllPositionsByStatus('open');
  }
  if (positions.length === 0) throw new ApiError(400, '暂无开放职位');

  // 去重 + 预筛选
  const existingKeys = findExistingMatchKeys();
  const pairs = positions
    .map(pos => ({
      position: pos,
      resumes: prefilterResumes(pos, resumes, existingKeys),
    }))
    .filter(p => p.resumes.length > 0);

  if (pairs.length === 0) {
    throw new ApiError(400, '所有职位与简历组合已匹配过，暂无新的匹配对');
  }

  // SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const result = await executeSmartMatch(pairs, req.user!.id, (progress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    });
    // 最终结果（冗余推送一次 complete，确保前端收到）
    res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: err?.message || '智能匹配失败' })}\n\n`);
  } finally {
    res.end();
  }
}));
