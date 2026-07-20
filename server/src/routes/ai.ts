// AI 服务路由
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth, requireAdmin, isAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { callByPromptKey } from '../services/aiService.js';
import { findPositionById } from '../repositories/positionRepo.js';
import { findResumeById } from '../repositories/resumeRepo.js';
import { findMatchById } from '../repositories/matchRepo.js';
import { listPitchesByMatch } from '../repositories/pitchRepo.js';
import { createAnalysis } from '../repositories/aiAnalysisRepo.js';

export const aiRouter = Router();

aiRouter.use(requireAuth);

// POST /api/ai/parse-position（管理员）
aiRouter.post('/parse-position', requireAdmin, asyncHandler(async (req, res) => {
  const { raw_text } = req.body ?? {};
  if (!raw_text) throw new ApiError(400, 'raw_text 不能为空');
  const result = await callByPromptKey('parsePosition', {
    raw_text: String(raw_text),
  });
  res.json({ data: result });
}));

// POST /api/ai/parse-resume（员工）
aiRouter.post('/parse-resume', asyncHandler(async (req, res) => {
  const { raw_text } = req.body ?? {};
  if (!raw_text) throw new ApiError(400, 'raw_text 不能为空');
  const result = await callByPromptKey('parseResume', {
    raw_text: String(raw_text),
  });
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
aiRouter.post('/generate-boss-posting', asyncHandler(async (req, res) => {
  const { position_id, industry, city } = req.body ?? {};
  if (!position_id) throw new ApiError(400, 'position_id 不能为空');
  const position = findPositionById(String(position_id));
  if (!position) throw new ApiError(404, '职位不存在');
  const result = await callByPromptKey('generateBossPosting', {
    position_data: JSON.stringify({
      title: position.title,
      requirements: position.requirements,
      jd: position.jd,
      salaryMin: position.salary_min,
      salaryMax: position.salary_max,
      location: position.location,
      keywords: position.keywords,
    }),
    industry: industry ?? '',
    city: city ?? position.location ?? '',
  });
  res.json({ data: result });
}));
