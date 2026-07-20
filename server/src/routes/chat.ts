// 对话辅助路由（BOSS 实时对话辅助）
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth, isAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import {
  listSessions,
  findSessionById,
  createSession,
  updateSession,
  deleteSession,
  listMessages,
  findMessageById,
  createMessage,
  updateMessage,
  deleteMessage,
} from '../repositories/chatRepo.js';
import { findPositionById } from '../repositories/positionRepo.js';
import { findResumeById } from '../repositories/resumeRepo.js';
import { callByPromptKey } from '../services/aiService.js';

export const chatRouter = Router();

chatRouter.use(requireAuth);

// ===== 会话管理 =====

// GET /api/chat/sessions - 会话列表
chatRouter.get('/sessions', asyncHandler(async (req, res) => {
  const query: any = {};
  // 普通员工只看自己的会话，管理员可看全部
  if (!isAdmin(req.user)) {
    query.owner_id = req.user!.id;
  } else if (req.query.owner_id) {
    query.owner_id = String(req.query.owner_id);
  }
  if (req.query.status) query.status = String(req.query.status);
  if (req.query.position_id) query.position_id = String(req.query.position_id);
  if (req.query.resume_id) query.resume_id = String(req.query.resume_id);
  if (req.query.keyword) query.keyword = String(req.query.keyword);
  if (req.query.page) query.page = Number(req.query.page);
  if (req.query.pageSize) query.pageSize = Number(req.query.pageSize);

  const result = listSessions(query);
  res.json({ data: result.data, total: result.total });
}));

// GET /api/chat/sessions/:id - 会话详情（含所有消息）
chatRouter.get('/sessions/:id', asyncHandler(async (req, res) => {
  const session = findSessionById(String(req.params.id));
  if (!session) throw new ApiError(404, '会话不存在');
  if (!isAdmin(req.user) && session.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权访问此会话');
  }
  const messages = listMessages(session.id);
  // 附带职位和简历信息
  const position = findPositionById(session.position_id);
  const resume = session.resume_id ? findResumeById(session.resume_id) : null;
  res.json({
    data: {
      ...session,
      position: position ? {
        id: position.id,
        title: position.title,
        salary_min: position.salary_min,
        salary_max: position.salary_max,
        location: position.location,
      } : null,
      resume: resume ? {
        id: resume.id,
        name: resume.name,
        current_company: resume.current_company,
        current_title: resume.current_title,
        skills: resume.skills,
        common_grounds: resume.common_grounds,
      } : null,
      messages,
    },
  });
}));

// POST /api/chat/sessions - 创建会话
chatRouter.post('/sessions', asyncHandler(async (req, res) => {
  const { position_id, resume_id, candidate_name, title } = req.body ?? {};
  if (!position_id) throw new ApiError(400, 'position_id 不能为空');
  const position = findPositionById(String(position_id));
  if (!position) throw new ApiError(404, '职位不存在');

  // 如指定简历，校验权限
  let resume = null;
  if (resume_id) {
    resume = findResumeById(String(resume_id));
    if (!resume) throw new ApiError(404, '简历不存在');
    if (!isAdmin(req.user) && resume.owner_id !== req.user!.id) {
      throw new ApiError(403, '无权使用他人简历');
    }
  }

  const sessionTitle = title || (resume ? `${resume.name} - ${position.title}` : `${candidate_name || '求职者'} - ${position.title}`);

  const session = createSession({
    id: nanoid(),
    position_id: String(position_id),
    resume_id: resume_id ? String(resume_id) : null,
    owner_id: req.user!.id,
    title: sessionTitle,
    candidate_name: candidate_name || resume?.name || null,
  });
  res.json({ data: session });
}));

// PATCH /api/chat/sessions/:id - 更新会话（如绑定简历、关闭会话）
chatRouter.patch('/sessions/:id', asyncHandler(async (req, res) => {
  const session = findSessionById(String(req.params.id));
  if (!session) throw new ApiError(404, '会话不存在');
  if (!isAdmin(req.user) && session.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权修改此会话');
  }
  const { title, status, resume_id, candidate_name } = req.body ?? {};
  // 如绑定简历，校验权限
  if (resume_id) {
    const resume = findResumeById(String(resume_id));
    if (!resume) throw new ApiError(404, '简历不存在');
    if (!isAdmin(req.user) && resume.owner_id !== req.user!.id) {
      throw new ApiError(403, '无权使用他人简历');
    }
  }
  const updated = updateSession(session.id, {
    title,
    status,
    resume_id: resume_id !== undefined ? (resume_id ? String(resume_id) : null) : undefined,
    candidate_name,
  });
  res.json({ data: updated });
}));

// DELETE /api/chat/sessions/:id - 删除会话（连带消息）
chatRouter.delete('/sessions/:id', asyncHandler(async (req, res) => {
  const session = findSessionById(String(req.params.id));
  if (!session) throw new ApiError(404, '会话不存在');
  if (!isAdmin(req.user) && session.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权删除此会话');
  }
  deleteSession(session.id);
  res.json({ ok: true });
}));

// ===== 消息管理 =====

// GET /api/chat/sessions/:id/messages - 列出会话所有消息
chatRouter.get('/sessions/:id/messages', asyncHandler(async (req, res) => {
  const session = findSessionById(String(req.params.id));
  if (!session) throw new ApiError(404, '会话不存在');
  if (!isAdmin(req.user) && session.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权访问此会话');
  }
  const messages = listMessages(session.id);
  res.json({ data: messages });
}));

// POST /api/chat/sessions/:id/messages - 添加消息（candidate 或 hr）
chatRouter.post('/sessions/:id/messages', asyncHandler(async (req, res) => {
  const session = findSessionById(String(req.params.id));
  if (!session) throw new ApiError(404, '会话不存在');
  if (!isAdmin(req.user) && session.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权在此会话发消息');
  }
  const { role, content } = req.body ?? {};
  if (!role || !content) throw new ApiError(400, 'role 和 content 不能为空');
  if (role !== 'candidate' && role !== 'hr') {
    throw new ApiError(400, 'role 必须是 candidate 或 hr');
  }
  const message = createMessage({
    id: nanoid(),
    session_id: session.id,
    role,
    content: String(content),
  });
  res.json({ data: message });
}));

// DELETE /api/chat/messages/:id - 删除单条消息
chatRouter.delete('/messages/:id', asyncHandler(async (req, res) => {
  const messageId = String(req.params.id);
  const message = findMessageById(messageId);
  if (!message) throw new ApiError(404, '消息不存在');
  const session = findSessionById(message.session_id);
  if (!session) throw new ApiError(404, '会话不存在');
  if (!isAdmin(req.user) && session.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权删除此消息');
  }
  deleteMessage(messageId);
  res.json({ ok: true });
}));

// ===== AI 分析 =====

// POST /api/chat/sessions/:id/analyze - AI 分析求职者最新消息并生成 3 套回复
chatRouter.post('/sessions/:id/analyze', asyncHandler(async (req, res) => {
  const session = findSessionById(String(req.params.id));
  if (!session) throw new ApiError(404, '会话不存在');
  if (!isAdmin(req.user) && session.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权在此会话进行 AI 分析');
  }
  const { latest_message } = req.body ?? {};
  if (!latest_message) throw new ApiError(400, 'latest_message 不能为空');

  const position = findPositionById(session.position_id);
  if (!position) throw new ApiError(404, '职位不存在');

  const resume = session.resume_id ? findResumeById(session.resume_id) : null;

  // 取出已有对话历史（不含本次最新消息，最新消息由前端传入）
  const history = listMessages(session.id);

  // 先把求职者最新消息存入数据库
  const candidateMsg = createMessage({
    id: nanoid(),
    session_id: session.id,
    role: 'candidate',
    content: String(latest_message),
  });

  // 调 AI 分析
  const result = await callByPromptKey('chatAssist', {
    position_data: JSON.stringify({
      title: position.title,
      requirements: position.requirements,
      jd: position.jd,
      salaryMin: position.salary_min,
      salaryMax: position.salary_max,
      location: position.location,
    }),
    resume_data: JSON.stringify(resume ? {
      name: resume.name,
      currentCompany: resume.current_company,
      currentTitle: resume.current_title,
      skills: resume.skills,
      workExperience: resume.work_experience,
      commonGrounds: resume.common_grounds,
      expectedCity: resume.expected_city,
    } : {}),
    chat_history: JSON.stringify(history.map(m => ({
      role: m.role,
      content: m.content,
    }))),
    latest_message: String(latest_message),
  });

  // 把 AI 分析结果写回求职者消息
  const updatedMsg = updateMessage(candidateMsg.id, { ai_analysis: result });

  res.json({ data: result, message: updatedMsg });
}));

// POST /api/chat/sessions/:id/send - HR 选定某条回复并发送（记录到对话历史）
chatRouter.post('/sessions/:id/send', asyncHandler(async (req, res) => {
  const session = findSessionById(String(req.params.id));
  if (!session) throw new ApiError(404, '会话不存在');
  if (!isAdmin(req.user) && session.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权在此会话发消息');
  }
  const { candidate_message_id, reply } = req.body ?? {};
  if (!reply || !reply.content) throw new ApiError(400, 'reply.content 不能为空');

  // 创建 HR 消息
  const hrMsg = createMessage({
    id: nanoid(),
    session_id: session.id,
    role: 'hr',
    content: String(reply.content),
    selected_reply: reply, // 保存选用的策略（含 strategyName, content, rationale）
  });

  // 如果传了 candidate_message_id，把选用的回复也写回求职者消息
  if (candidate_message_id) {
    updateMessage(String(candidate_message_id), { selected_reply: reply });
  }

  res.json({ data: hrMsg });
}));

// POST /api/chat/sessions/:id/regenerate - 重新生成回复策略（不存新消息，只返回新建议）
chatRouter.post('/sessions/:id/regenerate', asyncHandler(async (req, res) => {
  const session = findSessionById(String(req.params.id));
  if (!session) throw new ApiError(404, '会话不存在');
  if (!isAdmin(req.user) && session.owner_id !== req.user!.id) {
    throw new ApiError(403, '无权在此会话进行 AI 分析');
  }
  const { candidate_message_id, latest_message } = req.body ?? {};
  if (!latest_message) throw new ApiError(400, 'latest_message 不能为空');

  const position = findPositionById(session.position_id);
  if (!position) throw new ApiError(404, '职位不存在');
  const resume = session.resume_id ? findResumeById(session.resume_id) : null;

  // 取出对话历史（排除要重新分析的这条消息）
  const allMessages = listMessages(session.id);
  const history = candidate_message_id
    ? allMessages.filter(m => m.id !== candidate_message_id)
    : allMessages;

  const result = await callByPromptKey('chatAssist', {
    position_data: JSON.stringify({
      title: position.title,
      requirements: position.requirements,
      jd: position.jd,
      salaryMin: position.salary_min,
      salaryMax: position.salary_max,
      location: position.location,
    }),
    resume_data: JSON.stringify(resume ? {
      name: resume.name,
      currentCompany: resume.current_company,
      currentTitle: resume.current_title,
      skills: resume.skills,
      workExperience: resume.work_experience,
      commonGrounds: resume.common_grounds,
      expectedCity: resume.expected_city,
    } : {}),
    chat_history: JSON.stringify(history.map(m => ({
      role: m.role,
      content: m.content,
    }))),
    latest_message: String(latest_message),
  });

  // 如果有 candidate_message_id，更新这条消息的 AI 分析
  if (candidate_message_id) {
    updateMessage(String(candidate_message_id), { ai_analysis: result });
  }

  res.json({ data: result });
}));
