// 全局类型定义

// 用户角色与状态
export type UserRole = 'admin' | 'consultant';
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: string;
  username: string;
  real_name: string;
  department?: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

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

// 职位相关枚举
export type JobType = 'full_time' | 'part_time' | 'intern' | 'outsourcing';
export type WorkMode = 'onsite' | 'remote' | 'hybrid';
export type Priority = 'high' | 'medium' | 'low';
export type PositionStatus = 'open' | 'paused' | 'closed';

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
  keywords: string[];
  raw_text?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// 简历相关枚举
export type CandidateStatus = 'looking' | 'unemployed' | 'passive' | 'not_now';
export type ContactPreference = 'wechat' | 'phone' | 'platform';

export interface CommonGrounds {
  alumni?: string;
  hometown?: string;
  previousCompany?: string;
  hobby?: string;
  [key: string]: string | undefined;
}

export interface RiskWarning {
  isRisky: boolean;
  reasons: string[];
}

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
  email_masked?: string | null;
  has_wechat: number | boolean;
  wechat_id?: string | null;
  contact_preference?: string | null;
  candidate_status?: string | null;
  expected_onboard_date?: string | null;
  tags: string[];
  common_grounds: CommonGrounds;
  risk_warning: RiskWarning;
  remark?: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

// 撞单
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

// AI 配置
export interface AiConfig {
  id: string;
  provider: string;
  api_key: string;
  base_url: string;
  model: string;
  temperature: number;
  prompts: Record<string, { system: string; user: string }>;
  updated_at: string;
}

// 通用分页响应
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 单项数据响应
export interface DataResponse<T> {
  data: T;
}

// 漏斗数据
export interface FunnelStage {
  stage: string;
  count: number;
}

// 登录响应
export interface LoginResponse {
  token: string;
  user: User;
}

// 简历创建响应（含撞单计数）
export interface ResumeCreateResponse {
  data: Resume;
  conflictCount: number;
}

// 错误响应
export interface ApiError {
  error?: string;
  message?: string;
  statusCode?: number;
}

// ===== 匹配相关 =====
export type MatchStatus =
  | 'consulting'      // 咨询中
  | 'interview_invited' // 已邀面试
  | 'interview_passed'  // 面试通过
  | 'offer_sent'      // 已发 offer
  | 'onboarded'       // 已入职
  | 'lost';           // 已流失

export interface Match {
  id: string;
  position_id: string;
  resume_id: string;
  owner_id: string;
  status: MatchStatus;
  score: number;
  highlights: string[];
  concerns: string[];
  salary_analysis: string;
  conversion_probability: number;
  position?: Position;
  resume?: Resume;
  created_at: string;
  updated_at: string;
}

// ===== 话术相关 =====
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

// ===== 跟进相关 =====
export type FollowupPlanType = 'once' | 'recurring' | 'custom';
export type FollowupPlanStatus = 'active' | 'completed' | 'stopped';

export interface FollowupPlan {
  id: string;
  resume_id: string;
  employee_id: string;
  title: string;
  type: FollowupPlanType;
  interval_days?: number | null;
  max_times?: number | null;
  remind_date?: string | null;
  custom_dates?: string[] | null;
  purpose: string;
  position_ids: string[];
  status: FollowupPlanStatus;
  next_remind_date: string;
  completed_times: number;
  resume?: Resume;
  created_at: string;
  updated_at: string;
}

export type FollowupResult =
  | 'reached'
  | 'no_response'
  | 'rejected'
  | 'interview_invited'
  | 'other';

export interface FollowupRecord {
  id: string;
  plan_id: string;
  resume_id: string;
  employee_id: string;
  followup_date: string;
  contact_channel: PitchChannel;
  result: FollowupResult;
  note: string;
  introduced_positions: string[];
  next_action: string;
  resume?: Resume;
  created_at: string;
}

export interface PreFollowupAnalysis {
  profileSummary: string;
  followupGoals: string[];
  predictedConcerns: string[];
  openingScripts: Array<{ type: string; content: string }>;
  recommendedQuestions: string[];
  conversionProbability: number;
  strategy: string;
}

export interface PostFollowupAnalysis {
  concerns: Array<{ concern: string; strength: string; analysis: string }>;
  strategies: Array<{ strategy: string; priority: string; actions: string[] }>;
  conversionProbability: number;
  probabilityChange: number;
  changeReason: string;
  nextFollowup: {
    suggestedDate: string;
    focus: string;
    preparation: string[];
  };
  availableScripts: Array<{ type: string; available: boolean }>;
}

// ===== AI 通用 =====
export interface AiAnalysisRecord {
  id: string;
  followup_record_id?: string | null;
  type: 'pre_followup' | 'post_followup' | 'script_generation';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  review_status: 'pending' | 'accepted' | 'edited' | 'discarded';
  created_at: string;
}

// BOSS 文案生成结果
export interface BossPostingResult {
  postings: Array<{
    style: string;       // 诱惑型/神秘型/专业型
    title: string;       // 岗位名
    description: string; // 岗位描述
    hooks: string[];     // 钩子
  }>;
}
