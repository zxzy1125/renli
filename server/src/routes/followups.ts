// 跟进回访路由
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth, isAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import {
  listPlans,
  findPlanById,
  listTodayPlans,
  listOverduePlans,
  createPlan,
  updatePlan,
  deletePlan,
  listRecords,
  findRecordById,
  createRecord,
  computeNextRemindDate,
} from '../repositories/followupRepo.js';
import { findResumeById } from '../repositories/resumeRepo.js';
import { findPositionById } from '../repositories/positionRepo.js';
import { createAnalysis } from '../repositories/aiAnalysisRepo.js';
import { callByPromptKey } from '../services/aiService.js';

export const followupsRouter = Router();

followupsRouter.use(requireAuth);

// 校验计划归属
function assertPlanOwnerOrAdmin(plan: { employee_id: string }, user: any) {
  if (!isAdmin(user) && plan.employee_id !== user.id) {
    throw new ApiError(403, '无权访问此回访计划');
  }
}

// ===== 计划 =====

// GET /api/followups/plans
followupsRouter.get('/plans', (req, res) => {
  const { status, resume_id } = req.query;
  const employeeFilter = isAdmin(req.user) ? undefined : req.user!.id;
  const plans = listPlans({
    employee_id: employeeFilter,
    status: status ? String(status) : undefined,
    resume_id: resume_id ? String(resume_id) : undefined,
  });
  res.json({ data: plans });
});

// GET /api/followups/plans/:id
followupsRouter.get('/plans/:id', asyncHandler(async (req, res) => {
  const p = findPlanById(String(req.params.id));
  if (!p) throw new ApiError(404, '回访计划不存在');
  assertPlanOwnerOrAdmin(p, req.user);
  res.json({ data: p });
}));

// POST /api/followups/plans
followupsRouter.post('/plans', asyncHandler(async (req, res) => {
  const b = req.body ?? {};
  if (!b.resume_id || !b.title || !b.next_remind_date) {
    throw new ApiError(400, 'resume_id, title, next_remind_date 不能为空');
  }
  const resume = findResumeById(String(b.resume_id));
  if (!resume) throw new ApiError(404, '简历不存在');
  if (!isAdmin(req.user) && resume.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权对他人简历创建回访计划');
  }
  const plan = createPlan({
    id: nanoid(),
    resume_id: String(b.resume_id),
    employee_id: req.user!.id,
    title: String(b.title),
    type: b.type ?? 'once',
    interval_days: b.interval_days ? Number(b.interval_days) : null,
    max_times: b.max_times ? Number(b.max_times) : 5,
    remind_date: b.remind_date ?? null,
    custom_dates: Array.isArray(b.custom_dates) ? b.custom_dates : [],
    purpose: b.purpose ?? null,
    position_ids: Array.isArray(b.position_ids) ? b.position_ids : [],
    status: b.status ?? 'active',
    next_remind_date: String(b.next_remind_date),
  });
  res.status(201).json({ data: plan });
}));

// PUT /api/followups/plans/:id
followupsRouter.put('/plans/:id', asyncHandler(async (req, res) => {
  const existing = findPlanById(String(req.params.id));
  if (!existing) throw new ApiError(404, '回访计划不存在');
  assertPlanOwnerOrAdmin(existing, req.user);
  const b = req.body ?? {};
  const updated = updatePlan(String(req.params.id), {
    title: b.title,
    type: b.type,
    interval_days: b.interval_days !== undefined ? (b.interval_days === null ? null : Number(b.interval_days)) : undefined,
    max_times: b.max_times !== undefined ? (b.max_times === null ? null : Number(b.max_times)) : undefined,
    remind_date: b.remind_date,
    custom_dates: Array.isArray(b.custom_dates) ? b.custom_dates : undefined,
    purpose: b.purpose,
    position_ids: Array.isArray(b.position_ids) ? b.position_ids : undefined,
    status: b.status,
    next_remind_date: b.next_remind_date,
    completed_times: b.completed_times !== undefined ? Number(b.completed_times) : undefined,
  });
  res.json({ data: updated });
}));

// DELETE /api/followups/plans/:id
followupsRouter.delete('/plans/:id', asyncHandler(async (req, res) => {
  const existing = findPlanById(String(req.params.id));
  if (!existing) throw new ApiError(404, '回访计划不存在');
  assertPlanOwnerOrAdmin(existing, req.user);
  deletePlan(String(req.params.id));
  res.json({ ok: true });
}));

// GET /api/followups/today（今日待回访）
followupsRouter.get('/today', (_req, res) => {
  const employeeFilter = isAdmin(_req.user) ? undefined : _req.user!.id;
  res.json({ data: listTodayPlans(employeeFilter) });
});

// GET /api/followups/overdue（逾期未回访）
followupsRouter.get('/overdue', (_req, res) => {
  const employeeFilter = isAdmin(_req.user) ? undefined : _req.user!.id;
  res.json({ data: listOverduePlans(employeeFilter) });
});

// ===== 记录 =====

// GET /api/followups/records?plan_id=xxx
followupsRouter.get('/records', (req, res) => {
  const { plan_id, resume_id } = req.query;
  const employeeFilter = isAdmin(req.user) ? undefined : req.user!.id;
  const records = listRecords({
    plan_id: plan_id ? String(plan_id) : undefined,
    resume_id: resume_id ? String(resume_id) : undefined,
    employee_id: employeeFilter,
  });
  res.json({ data: records });
});

// POST /api/followups/records（录入回访，更新计划 next_remind_date）
followupsRouter.post('/records', asyncHandler(async (req, res) => {
  const b = req.body ?? {};
  if (!b.resume_id || !b.followup_date) {
    throw new ApiError(400, 'resume_id 和 followup_date 不能为空');
  }
  const resume = findResumeById(String(b.resume_id));
  if (!resume) throw new ApiError(404, '简历不存在');
  if (!isAdmin(req.user) && resume.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权对他人简历录入回访记录');
  }

  const record = createRecord({
    id: nanoid(),
    plan_id: b.plan_id ?? null,
    resume_id: String(b.resume_id),
    employee_id: req.user!.id,
    followup_date: String(b.followup_date),
    contact_channel: b.contact_channel ?? null,
    result: b.result ?? null,
    note: b.note ?? null,
    introduced_positions: Array.isArray(b.introduced_positions) ? b.introduced_positions : [],
    next_action: b.next_action ?? null,
  });

  // 如果关联了计划，更新计划的 next_remind_date 和 completed_times
  if (b.plan_id) {
    const plan = findPlanById(String(b.plan_id));
    if (plan && plan.employee_id === req.user!.id) {
      const nextDate = computeNextRemindDate(plan);
      const completedTimes = (plan.completed_times ?? 0) + 1;
      const maxTimes = plan.max_times ?? 5;
      const newStatus = nextDate === null || completedTimes >= maxTimes ? 'completed' : plan.status;
      updatePlan(plan.id, {
        next_remind_date: nextDate ?? plan.next_remind_date,
        completed_times: completedTimes,
        status: newStatus,
      });
    }
  }

  res.status(201).json({ data: record });
}));

// ===== AI 分析 =====

// POST /api/followups/pre-analysis（回访前 AI 作战卡片）
followupsRouter.post('/pre-analysis', asyncHandler(async (req, res) => {
  const { resume_id, position_id, candidate_status, followup_history, sent_pitches } = req.body ?? {};
  if (!resume_id) throw new ApiError(400, 'resume_id 不能为空');
  const resume = findResumeById(String(resume_id));
  if (!resume) throw new ApiError(404, '简历不存在');
  if (!isAdmin(req.user) && resume.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权对此简历生成 AI 分析');
  }
  let position: any = null;
  if (position_id) {
    position = findPositionById(String(position_id));
  }
  const result = await callByPromptKey('preFollowup', {
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
    position_data: JSON.stringify(position ?? {}),
    followup_history: followup_history ?? '[]',
    candidate_status: candidate_status ?? resume.candidate_status ?? 'passive',
    sent_pitches: sent_pitches ?? '[]',
  });
  // 保存分析记录
  const analysis = createAnalysis({
    id: nanoid(),
    type: 'pre_followup',
    input: { resume_id, position_id, candidate_status },
    output: result,
  });
  res.json({ data: result, analysis });
}));

// POST /api/followups/post-analysis（回访后 AI 深度分析）
followupsRouter.post('/post-analysis', asyncHandler(async (req, res) => {
  const { followup_record_id, resume_id, position_id, employee_input, followup_history, previous_analyses } = req.body ?? {};
  if (!resume_id || !employee_input) throw new ApiError(400, 'resume_id 和 employee_input 不能为空');
  const resume = findResumeById(String(resume_id));
  if (!resume) throw new ApiError(404, '简历不存在');
  if (!isAdmin(req.user) && resume.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权对此简历生成 AI 分析');
  }
  let position: any = null;
  if (position_id) {
    position = findPositionById(String(position_id));
  }
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
    followup_record_id: followup_record_id ?? null,
    type: 'post_followup',
    input: { resume_id, position_id, employee_input },
    output: result,
  });
  res.json({ data: result, analysis });
}));

// POST /api/followups/concern-pitch（应对话术生成）
followupsRouter.post('/concern-pitch', asyncHandler(async (req, res) => {
  const { resume_id, position_id, specific_concern, strategy, previous_pitches } = req.body ?? {};
  if (!resume_id || !specific_concern) throw new ApiError(400, 'resume_id 和 specific_concern 不能为空');
  const resume = findResumeById(String(resume_id));
  if (!resume) throw new ApiError(404, '简历不存在');
  if (!isAdmin(req.user) && resume.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权对此简历生成 AI 分析');
  }
  let position: any = null;
  if (position_id) {
    position = findPositionById(String(position_id));
  }
  const result = await callByPromptKey('concernPitch', {
    resume_data: JSON.stringify({
      name: resume.name,
      currentCompany: resume.current_company,
      currentTitle: resume.current_title,
      skills: resume.skills,
      workExperience: resume.work_experience,
      commonGrounds: resume.common_grounds,
    }),
    position_data: JSON.stringify(position ?? {}),
    specific_concern: String(specific_concern),
    strategy: strategy ?? '',
    previous_pitches: previous_pitches ?? '[]',
  });
  res.json({ data: result });
}));
