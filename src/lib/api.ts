// API 客户端：axios 实例 + 拦截器 + 所有端点封装
import axios from 'axios';
import type {
  AiConfig,
  BossPostingResult,
  ChatAnalysisResult,
  ChatMessage,
  ChatReply,
  ChatSession,
  Client,
  ConflictRecord,
  ConflictStatus,
  FollowupPlan,
  FollowupRecord,
  FunnelStage,
  LoginResponse,
  Match,
  MatchStatus,
  Paginated,
  Pitch,
  PitchStatus,
  Position,
  PostFollowupAnalysis,
  PreFollowupAnalysis,
  Resume,
  ResumeCreateResponse,
  User,
} from '@/types';

const api = axios.create({ baseURL: '/api', timeout: 120000 });

// 请求拦截：自动注入 Bearer Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截：自动解包 data，401 跳登录
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      // 避免在登录页时跳转造成死循环
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err.response?.data || err);
  }
);

export default api;

// ===== 通用错误信息提取 =====
export function getErrorMsg(err: unknown): string {
  if (!err) return '未知错误';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  const e = err as { error?: string; message?: string };
  return e.error || e.message || '请求失败';
}

// ===== 认证 API =====
export const authApi = {
  login: (username: string, password: string) =>
    api.post<unknown, LoginResponse>('/auth/login', { username, password }),
  me: () => api.post<unknown, { user: User }>('/auth/me').then((r) => r.user),
  // 兼容 GET 行为
  meGet: () => api.get<unknown, { user: User }>('/auth/me').then((r) => r.user),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { oldPassword, newPassword }),
};

// ===== 用户管理 API（管理员） =====
export const usersApi = {
  list: () => api.get<unknown, { data: User[] }>('/users').then((r) => r.data),
  create: (body: {
    username: string;
    password: string;
    real_name: string;
    department?: string;
    role?: 'admin' | 'consultant';
  }) => api.post<unknown, { data: User }>('/users', body).then((r) => r.data),
  update: (
    id: string,
    body: {
      real_name?: string;
      department?: string | null;
      role?: 'admin' | 'consultant';
      status?: 'active' | 'disabled';
    }
  ) => api.put<unknown, { data: User }>(`/users/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete<unknown, { ok: boolean }>(`/users/${id}`),
  resetPassword: (id: string, newPassword: string) =>
    api.post<unknown, { ok: boolean }>(`/users/${id}/reset-password`, { newPassword }),
};

// ===== 客户公司 API =====
export const clientsApi = {
  list: () => api.get<unknown, { data: Client[] }>('/clients').then((r) => r.data),
  create: (body: Partial<Client>) =>
    api.post<unknown, { data: Client }>('/clients', body).then((r) => r.data),
  update: (id: string, body: Partial<Client>) =>
    api.put<unknown, { data: Client }>(`/clients/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete<unknown, { ok: boolean }>(`/clients/${id}`),
};

// ===== 职位 API =====
export interface PositionQuery {
  keyword?: string;
  status?: string;
  client_id?: string;
  page?: number;
  pageSize?: number;
}

export const positionsApi = {
  list: (params: PositionQuery = {}) =>
    api.get<unknown, Paginated<Position>>('/positions', { params }),
  get: (id: string) =>
    api.get<unknown, { data: Position }>(`/positions/${id}`).then((r) => r.data),
  create: (body: Partial<Position>) =>
    api.post<unknown, { data: Position }>('/positions', body).then((r) => r.data),
  update: (id: string, body: Partial<Position>) =>
    api.put<unknown, { data: Position }>(`/positions/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete<unknown, { ok: boolean }>(`/positions/${id}`),
  patchStatus: (id: string, status: string) =>
    api.patch<unknown, { data: Position }>(`/positions/${id}/status`, { status }).then((r) => r.data),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post<unknown, { data: { text: string; filename: string } }>('/positions/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};

// ===== 简历 API =====
export interface ResumeQuery {
  keyword?: string;
  candidate_status?: string;
  page?: number;
  pageSize?: number;
}

export const resumesApi = {
  list: (params: ResumeQuery = {}) =>
    api.get<unknown, Paginated<Resume>>('/resumes', { params }),
  get: (id: string) =>
    api.get<unknown, { data: Resume }>(`/resumes/${id}`).then((r) => r.data),
  create: (body: Partial<Resume> & { phone?: string; email?: string }) =>
    api.post<unknown, ResumeCreateResponse>('/resumes', body),
  update: (id: string, body: Partial<Resume> & { phone?: string; email?: string }) =>
    api.put<unknown, { data: Resume }>(`/resumes/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete<unknown, { ok: boolean }>(`/resumes/${id}`),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post<unknown, { data: { text: string; filename: string } }>('/resumes/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};

// ===== 撞单 API（管理员） =====
export const conflictsApi = {
  list: (status?: string) =>
    api.get<unknown, { data: ConflictRecord[] }>('/conflicts', {
      params: status ? { status } : undefined,
    }),
  get: (id: string) =>
    api.get<unknown, { data: ConflictRecord }>(`/conflicts/${id}`).then((r) => r.data),
  resolve: (id: string, status: ConflictStatus, note?: string) =>
    api.post<unknown, { data: ConflictRecord }>(`/conflicts/${id}/resolve`, {
      status,
      note,
    }),
};

// ===== 运营规范 API =====
export const guidelinesApi = {
  boss: () =>
    api.get<unknown, { data: { title: string; content: string } }>('/guidelines/boss'),
  hrMethodology: () =>
    api.get<unknown, { data: { title: string; content: string } }>('/guidelines/hr-methodology'),
};

// ===== AI 配置 API（管理员） =====
export const aiConfigApi = {
  get: () => api.get<unknown, { data: AiConfig }>('/ai-config').then((r) => r.data),
  update: (body: Partial<AiConfig>) =>
    api.put<unknown, { data: AiConfig }>('/ai-config', body).then((r) => r.data),
  test: () => api.post<unknown, { data: unknown }>('/ai-config/test'),
};

// ===== 报表 API（管理员） =====
export const reportsApi = {
  funnel: () => api.get<unknown, { data: FunnelStage[] }>('/reports/funnel'),
  employeePerformance: () => api.get<unknown, { data: unknown[] }>('/reports/employee-performance'),
  clientSummary: () => api.get<unknown, { data: unknown[] }>('/reports/client-summary'),
};

// ===== AI 调用 API（员工/管理员） =====
export const aiApi = {
  parsePosition: (raw_text: string) =>
    api.post<unknown, { data: unknown }>('/ai/parse-position', { raw_text }),
  parseResume: (raw_text: string) =>
    api.post<unknown, { data: unknown }>('/ai/parse-resume', { raw_text }),
  generateBossPosting: (position_id: string, industry?: string, city?: string, style?: string) =>
    api
      .post<unknown, { data: BossPostingResult }>('/ai/generate-boss-posting', {
        position_id,
        industry,
        city,
        style,
      })
      .then((r) => r.data),
  matchAnalysis: (position_id: string, resume_id: string) =>
    api
      .post<unknown, { data: Match }>('/ai/match-analysis', { position_id, resume_id })
      .then((r) => r.data),
  generatePitches: (match_id: string) =>
    api
      .post<unknown, { data: Pitch[] }>('/ai/generate-pitches', { match_id })
      .then((r) => r.data),
  polishPitch: (pitch_id: string) =>
    api
      .post<unknown, { data: Pitch }>('/ai/polish', { pitch_id })
      .then((r) => r.data),
  preFollowup: (plan_id: string) =>
    // 后端 /ai/pre-followup 需要 resume_id 等字段，先解包 plan 再调用
    followupsApi
      .getPlan(plan_id)
      .then((plan) =>
        api
          .post<unknown, { data: PreFollowupAnalysis }>('/ai/pre-followup', {
            resume_id: plan.resume_id,
            position_id: plan.position_ids?.[0],
            candidate_status: plan.resume?.candidate_status,
          })
          .then((r) => r.data)
      ),
  postFollowup: (record_id: string) =>
    // 后端 /ai/post-followup 需要 resume_id 与 employee_input，先查记录再调用
    followupsApi
      .getRecord(record_id)
      .then((record) =>
        api
          .post<unknown, { data: PostFollowupAnalysis }>('/ai/post-followup', {
            resume_id: record.resume_id,
            employee_input: record.note || '',
            followup_record_id: record.id,
          })
          .then((r) => r.data)
      ),
  concernPitch: (record_id: string, concern: string, strategy?: string) =>
    // 后端 /ai/concern-pitch 需要 resume_id 与 specific_concern
    followupsApi
      .getRecord(record_id)
      .then((record) =>
        api
          .post<unknown, { data: { wechat: string; phone: string; platform: string } }>(
            '/ai/concern-pitch',
            {
              resume_id: record.resume_id,
              specific_concern: concern,
              strategy,
            }
          )
          .then((r) => r.data)
      ),
};

// ===== 匹配 API =====
export interface MatchQuery {
  keyword?: string;
  status?: MatchStatus | string;
  page?: number;
  pageSize?: number;
}

export const matchesApi = {
  list: (params: MatchQuery = {}) =>
    api.get<unknown, Paginated<Match>>('/matches', { params }),
  get: (id: string) =>
    api.get<unknown, { data: Match }>(`/matches/${id}`).then((r) => r.data),
  create: (body: { position_id: string; resume_id: string }) =>
    api.post<unknown, { data: Match }>('/matches', body).then((r) => r.data),
  patchStatus: (id: string, status: MatchStatus, lostReason?: string) =>
    api
      .patch<unknown, { data: Match }>(`/matches/${id}/status`, { status, lostReason })
      .then((r) => r.data),
  remove: (id: string) => api.delete<unknown, { ok: boolean }>(`/matches/${id}`),
};

// ===== 话术 API =====
export const pitchesApi = {
  list: (match_id: string) =>
    api
      .get<unknown, { data: Pitch[] }>('/pitches', { params: { match_id } })
      .then((r) => r.data),
  update: (id: string, body: { content?: string; status?: PitchStatus }) =>
    api.put<unknown, { data: Pitch }>(`/pitches/${id}`, body).then((r) => r.data),
};

// ===== 跟进 API =====
export const followupsApi = {
  // 计划
  listPlans: (params: { status?: string } = {}) =>
    api.get<unknown, { data: FollowupPlan[] }>('/followups/plans', { params }).then((r) => r.data),
  getPlan: (id: string) =>
    api.get<unknown, { data: FollowupPlan }>(`/followups/plans/${id}`).then((r) => r.data),
  createPlan: (body: Partial<FollowupPlan>) =>
    api.post<unknown, { data: FollowupPlan }>('/followups/plans', body).then((r) => r.data),
  updatePlan: (id: string, body: Partial<FollowupPlan>) =>
    api.put<unknown, { data: FollowupPlan }>(`/followups/plans/${id}`, body).then((r) => r.data),
  removePlan: (id: string) => api.delete<unknown, { ok: boolean }>(`/followups/plans/${id}`),
  // 今日待回访 / 逾期
  today: () =>
    api.get<unknown, { data: FollowupPlan[] }>('/followups/today').then((r) => r.data),
  overdue: () =>
    api.get<unknown, { data: FollowupPlan[] }>('/followups/overdue').then((r) => r.data),
  // 回访记录
  listRecords: (plan_id?: string) =>
    api
      .get<unknown, { data: FollowupRecord[] }>('/followups/records', {
        params: plan_id ? { plan_id } : undefined,
      })
      .then((r) => r.data),
  // 按 ID 查记录：后端没有 GET /:id 端点，通过 list 全量过滤（员工只能拿到自己的）
  getRecord: (record_id: string) =>
    api
      .get<unknown, { data: FollowupRecord[] }>('/followups/records')
      .then((r) => {
        const found = (r.data || []).find((x) => x.id === record_id);
        if (!found) throw new Error('回访记录不存在或无权访问');
        return found;
      }),
  createRecord: (body: Partial<FollowupRecord>) =>
    api.post<unknown, { data: FollowupRecord }>('/followups/records', body).then((r) => r.data),
};

// ===== 对话辅助 API（BOSS 实时对话） =====
export interface ChatSessionQuery {
  status?: 'active' | 'closed';
  position_id?: string;
  resume_id?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export const chatApi = {
  // 会话列表
  listSessions: (params: ChatSessionQuery = {}) =>
    api
      .get<unknown, { data: ChatSession[]; total: number }>('/chat/sessions', { params })
      .then((r) => ({ data: r.data || [], total: r.total || 0 })),
  // 会话详情（含所有消息 + 职位 + 简历）
  getSession: (id: string) =>
    api.get<unknown, { data: ChatSession }>(`/chat/sessions/${id}`).then((r) => r.data),
  // 创建会话
  createSession: (body: {
    position_id: string;
    resume_id?: string;
    candidate_name?: string;
    title?: string;
  }) => api.post<unknown, { data: ChatSession }>('/chat/sessions', body).then((r) => r.data),
  // 更新会话（绑定简历、关闭会话等）
  patchSession: (
    id: string,
    body: { title?: string; status?: 'active' | 'closed'; resume_id?: string | null; candidate_name?: string }
  ) => api.patch<unknown, { data: ChatSession }>(`/chat/sessions/${id}`, body).then((r) => r.data),
  // 删除会话
  removeSession: (id: string) => api.delete<unknown, { ok: boolean }>(`/chat/sessions/${id}`),
  // 删除单条消息
  removeMessage: (id: string) => api.delete<unknown, { ok: boolean }>(`/chat/messages/${id}`),
  // AI 分析求职者最新消息（自动存为 candidate 消息 + 返回 3 套回复）
  analyze: (sessionId: string, latestMessage: string) =>
    api
      .post<unknown, { data: ChatAnalysisResult; message: ChatMessage }>(
        `/chat/sessions/${sessionId}/analyze`,
        { latest_message: latestMessage }
      )
      .then((r) => ({ analysis: r.data, message: r.message })),
  // 重新生成 AI 分析（不存新消息）
  regenerate: (sessionId: string, candidateMessageId: string, latestMessage: string) =>
    api
      .post<unknown, { data: ChatAnalysisResult }>(`/chat/sessions/${sessionId}/regenerate`, {
        candidate_message_id: candidateMessageId,
        latest_message: latestMessage,
      })
      .then((r) => r.data),
  // HR 选定回复并发送（自动存为 hr 消息）
  sendReply: (sessionId: string, candidateMessageId: string, reply: ChatReply) =>
    api
      .post<unknown, { data: ChatMessage }>(`/chat/sessions/${sessionId}/send`, {
        candidate_message_id: candidateMessageId,
        reply,
      })
      .then((r) => r.data),
};
