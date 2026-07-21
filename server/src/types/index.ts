// 所有 TypeScript 类型定义

// 用户角色
export type UserRole = 'admin' | 'consultant';

// 用户状态
export type UserStatus = 'active' | 'disabled';

// 用户
export interface User {
  id: string;
  username: string;
  password_hash: string;
  real_name: string;
  department?: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

// 不含密码的用户视图
export type SafeUser = Omit<User, 'password_hash'>;

// 客户公司
export interface Client {
  id: string;
  name: string;
  contact_name?: string | null;
  contact_phone?: string | null;
  industry?: string | null;
  notes?: string | null;
  created_by: string;
  created_at: string;
}

// 职位
export interface Position {
  id: string;
  title: string;
  client_id?: string | null;
  department?: string | null;
  location?: string | null;
  headcount?: number | null;
  salary_min?: string | null;
  salary_max?: string | null;
  experience?: string | null;
  education?: string | null;
  job_type?: string | null;
  work_mode?: string | null;
  priority?: string | null;
  status: string;
  jd?: string | null;
  requirements?: string | null;
  bonus?: string | null;
  keywords: string[]; // JSON
  raw_text?: string | null;
  ai_meta?: Record<string, unknown> | null; // JSON：AI 解析的完整原始结果
  source_filename?: string | null;
  source_ext?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// 简历
export interface Resume {
  id: string;
  name: string;
  age?: string | null;
  education?: string | null;
  current_company?: string | null;
  current_title?: string | null;
  work_experience?: string | null;
  skills?: string | null;
  projects?: string | null;
  expectation?: string | null;
  expected_city?: string | null;
  raw_text?: string | null;
  source?: string | null;
  phone_masked?: string | null;
  phone_hash?: string | null;
  email_masked?: string | null;
  email_original?: string | null; // 仅内存中使用，不返回前端
  has_wechat: number; // 0/1
  wechat_id?: string | null;
  contact_preference?: string | null;
  candidate_status?: string | null;
  expected_onboard_date?: string | null;
  tags: string[]; // JSON
  common_grounds: Record<string, string>; // JSON
  risk_warning: { isRisky: boolean; reasons: string[] }; // JSON
  remark?: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

// 匹配
export interface Match {
  id: string;
  position_id: string;
  resume_id: string;
  owner_id: string;
  status: string;
  score?: number | null;
  highlights: any[]; // JSON
  concerns: any[]; // JSON
  salary_analysis: any; // JSON
  conversion_probability?: number | null;
  created_at: string;
  updated_at: string;
}

// 话术
export type PitchChannel = 'wechat' | 'phone' | 'platform';
export type PitchScene = 'outreach' | 'intro' | 'concern' | 'interview' | 'salary' | 'offer';
export type PitchStatus = 'pending' | 'accepted' | 'edited' | 'discarded';

export interface Pitch {
  id: string;
  match_id: string;
  owner_id: string;
  channel: PitchChannel;
  scene: PitchScene;
  content: string;
  status: PitchStatus;
  created_at: string;
  updated_at: string;
}

// 回访计划
export type FollowupPlanType = 'once' | 'recurring' | 'custom';

export interface FollowupPlan {
  id: string;
  resume_id: string;
  employee_id: string;
  title: string;
  type: FollowupPlanType;
  interval_days?: number | null;
  max_times?: number | null;
  remind_date?: string | null;
  custom_dates: string[]; // JSON
  purpose?: string | null;
  position_ids: string[]; // JSON
  status: string;
  next_remind_date: string;
  completed_times: number;
  created_at: string;
  updated_at: string;
}

// 回访记录
export interface FollowupRecord {
  id: string;
  plan_id?: string | null;
  resume_id: string;
  employee_id: string;
  followup_date: string;
  contact_channel?: string | null;
  result?: string | null;
  note?: string | null;
  introduced_positions: string[]; // JSON
  next_action?: string | null;
  created_at: string;
}

// AI 分析记录
export interface AiAnalysisRecord {
  id: string;
  followup_record_id?: string | null;
  type: string;
  input: any; // JSON
  output: any; // JSON
  review_status: string;
  created_at: string;
}

// 撞单记录
export type ConflictStatus = 'pending' | 'assigned_a' | 'assigned_b' | 'shared' | 'false_alarm';
export type ConflictMatchField = 'phone' | 'email' | 'name_company';

export interface ConflictRecord {
  id: string;
  candidate_name: string;
  phone_hash?: string | null;
  email?: string | null;
  resume_id_a: string;
  resume_id_b: string;
  employee_id_a: string;
  employee_id_b: string;
  match_field: ConflictMatchField;
  status: ConflictStatus;
  note?: string | null;
  created_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

// 审计日志
export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  detail: any; // JSON
  created_at: string;
}

// AI 配置
export interface AiConfig {
  id: string;
  provider: string;
  api_key: string;
  base_url: string;
  model: string;
  temperature: number;
  prompts: Record<string, { system: string; user: string }>; // JSON
  // 多模态模型配置（文件解析有图片时自动切换）
  // mm_enabled=0 或 mm_model 为空时，回退到文本模型处理图片
  mm_enabled: number;        // 0/1
  mm_provider: string;
  mm_api_key: string;        // 空则回退到 api_key
  mm_base_url: string;       // 空则回退到 base_url
  mm_model: string;          // 如 glm-4v-plus / qwen-vl-max / gpt-4o
  updated_at: string;
}

// Express Request 扩展
declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

// 登录请求/响应
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: SafeUser;
}

// 通用分页响应
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 撞单检测结果
export interface ConflictCheckResult {
  conflict: boolean;
  matchField?: ConflictMatchField;
  existingResume?: Resume;
}

// AI 配置脱敏视图
export type AiConfigMasked = Omit<AiConfig, 'api_key'> & { api_key_masked: string };
