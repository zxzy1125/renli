-- 招聘辅助工具数据库 Schema
-- 注意：所有 JSON 字段以 TEXT 存储，应用层负责序列化/反序列化

-- 用户表（员工表）
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  real_name TEXT NOT NULL,
  department TEXT,
  role TEXT NOT NULL DEFAULT 'consultant',  -- admin / consultant
  status TEXT NOT NULL DEFAULT 'active',     -- active / disabled
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 客户公司表
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  industry TEXT,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 职位表
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  client_id TEXT REFERENCES clients(id),
  department TEXT,
  location TEXT,
  headcount INTEGER,
  salary_min TEXT,
  salary_max TEXT,
  experience TEXT,
  education TEXT,
  job_type TEXT DEFAULT 'fulltime',
  work_mode TEXT DEFAULT 'onsite',
  priority TEXT DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  jd TEXT,
  requirements TEXT,
  bonus TEXT,
  keywords TEXT,        -- JSON 数组
  raw_text TEXT,
  ai_meta TEXT,         -- JSON：AI 解析的完整原始结果（highlights/confidence/uncertainFields/clientCompany/salaryUnit 等）
  source_filename TEXT, -- 上传时的原文件名（粘贴录入为 NULL）
  source_ext TEXT,      -- 上传文件扩展名（.txt / .pdf / .docx）
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 简历表
CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age TEXT,
  education TEXT,
  current_company TEXT,
  current_title TEXT,
  work_experience TEXT,
  skills TEXT,
  projects TEXT,
  expectation TEXT,
  expected_city TEXT,
  raw_text TEXT,
  source TEXT,
  phone_masked TEXT,
  phone_hash TEXT,
  email_masked TEXT,
  email_original TEXT,                      -- 用于撞单检测，不返回前端
  has_wechat INTEGER NOT NULL DEFAULT 0,
  wechat_id TEXT,
  contact_preference TEXT DEFAULT 'wechat',
  candidate_status TEXT DEFAULT 'passive',
  expected_onboard_date TEXT,
  tags TEXT,                                 -- JSON 数组
  common_grounds TEXT,                       -- JSON 对象
  risk_warning TEXT,                          -- JSON 对象
  remark TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 匹配记录表
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES positions(id),
  resume_id TEXT NOT NULL REFERENCES resumes(id),
  owner_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'consulting',
  score INTEGER,
  highlights TEXT,        -- JSON
  concerns TEXT,          -- JSON
  salary_analysis TEXT,   -- JSON
  conversion_probability INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 话术表
CREATE TABLE IF NOT EXISTS pitches (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id),
  owner_id TEXT NOT NULL REFERENCES users(id),
  channel TEXT NOT NULL,   -- wechat / phone / platform
  scene TEXT NOT NULL,     -- outreach / intro / concern / interview / salary / offer
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / accepted / edited / discarded
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 回访计划表
CREATE TABLE IF NOT EXISTS followup_plans (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL REFERENCES resumes(id),
  employee_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL,         -- once / recurring / custom
  interval_days INTEGER,
  max_times INTEGER DEFAULT 5,
  remind_date TEXT,
  custom_dates TEXT,          -- JSON
  purpose TEXT,
  position_ids TEXT,          -- JSON
  status TEXT NOT NULL DEFAULT 'active',
  next_remind_date TEXT NOT NULL,
  completed_times INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 回访记录表
CREATE TABLE IF NOT EXISTS followup_records (
  id TEXT PRIMARY KEY,
  plan_id TEXT REFERENCES followup_plans(id),
  resume_id TEXT NOT NULL REFERENCES resumes(id),
  employee_id TEXT NOT NULL REFERENCES users(id),
  followup_date TEXT NOT NULL,
  contact_channel TEXT,
  result TEXT,
  note TEXT,
  introduced_positions TEXT,  -- JSON
  next_action TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- AI 分析记录表
CREATE TABLE IF NOT EXISTS ai_analysis_records (
  id TEXT PRIMARY KEY,
  followup_record_id TEXT REFERENCES followup_records(id),
  type TEXT NOT NULL,
  input TEXT,            -- JSON
  output TEXT,           -- JSON
  review_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 撞单记录表
CREATE TABLE IF NOT EXISTS conflict_records (
  id TEXT PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  phone_hash TEXT,
  email TEXT,
  resume_id_a TEXT NOT NULL REFERENCES resumes(id),
  resume_id_b TEXT NOT NULL REFERENCES resumes(id),
  employee_id_a TEXT NOT NULL REFERENCES users(id),
  employee_id_b TEXT NOT NULL REFERENCES users(id),
  match_field TEXT NOT NULL,    -- phone / email / name_company
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / assigned_a / assigned_b / shared / false_alarm
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users(id)
);

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  detail TEXT,  -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- AI 配置表（全局单条）
CREATE TABLE IF NOT EXISTS ai_config (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'openai',
  api_key TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL DEFAULT 'https://open.bigmodel.cn/api/paas/v4',
  model TEXT NOT NULL DEFAULT 'glm-4-plus',
  temperature REAL NOT NULL DEFAULT 0.7,
  prompts TEXT,        -- JSON
  -- 多模态模型配置（文件解析有图片时自动切换）
  -- 留空时回退到上方文本模型，即用同一个模型处理文本和图片
  mm_enabled INTEGER NOT NULL DEFAULT 0,       -- 0=不启用独立多模态配置，1=启用
  mm_provider TEXT NOT NULL DEFAULT '',        -- 多模态服务商（可不同于文本模型）
  mm_api_key TEXT NOT NULL DEFAULT '',         -- 多模态 API Key（空则回退到 api_key）
  mm_base_url TEXT NOT NULL DEFAULT '',        -- 多模态 base_url（空则回退到 base_url）
  mm_model TEXT NOT NULL DEFAULT '',           -- 多模态模型名，如 glm-4v-plus / qwen-vl-max / gpt-4o
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 对话会话表（BOSS 实时对话辅助）
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES positions(id),
  resume_id TEXT REFERENCES resumes(id),          -- 可选，初次接触时可能没简历
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT,                                      -- 会话标题（自动生成：求职者名+职位名）
  status TEXT NOT NULL DEFAULT 'active',           -- active / closed
  candidate_name TEXT,                             -- 求职者显示名（没简历时用）
  last_message_at TEXT,                            -- 最后消息时间，用于排序
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 对话消息表
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id),
  role TEXT NOT NULL,                              -- candidate / hr
  content TEXT NOT NULL,
  ai_analysis TEXT,                                -- JSON：求职者消息的 AI 分析结果
  selected_reply TEXT,                             -- JSON：HR 选用的回复策略（含 strategy/content）
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_created_by ON positions(created_by);
CREATE INDEX IF NOT EXISTS idx_resumes_owner ON resumes(owner_id);
CREATE INDEX IF NOT EXISTS idx_resumes_phone_hash ON resumes(phone_hash);
CREATE INDEX IF NOT EXISTS idx_resumes_email_original ON resumes(email_original);
CREATE INDEX IF NOT EXISTS idx_matches_owner ON matches(owner_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_position ON matches(position_id);
CREATE INDEX IF NOT EXISTS idx_matches_resume ON matches(resume_id);
CREATE INDEX IF NOT EXISTS idx_pitches_match ON pitches(match_id);
CREATE INDEX IF NOT EXISTS idx_pitches_owner ON pitches(owner_id);
CREATE INDEX IF NOT EXISTS idx_followup_plans_employee ON followup_plans(employee_id);
CREATE INDEX IF NOT EXISTS idx_followup_plans_next_remind ON followup_plans(next_remind_date);
CREATE INDEX IF NOT EXISTS idx_followup_plans_status ON followup_plans(status);
CREATE INDEX IF NOT EXISTS idx_followup_records_resume ON followup_records(resume_id);
CREATE INDEX IF NOT EXISTS idx_followup_records_plan ON followup_records(plan_id);
CREATE INDEX IF NOT EXISTS idx_followup_records_employee ON followup_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflict_records(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_owner ON chat_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_position ON chat_sessions(position_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_resume ON chat_sessions(resume_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

-- ===== Boss 自动化相关表（阶段一新增） =====

-- Boss 自动化配置表
CREATE TABLE IF NOT EXISTS boss_config (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  boss_username TEXT,
  max_daily_hello INTEGER NOT NULL DEFAULT 50,
  work_start_time TEXT NOT NULL DEFAULT '09:00',
  work_end_time TEXT NOT NULL DEFAULT '18:00',
  is_running INTEGER NOT NULL DEFAULT 0,
  cookie_json TEXT,
  last_active_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Boss 岗位自动化配置表
CREATE TABLE IF NOT EXISTS boss_post_config (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  position_id TEXT REFERENCES positions(id),
  encrypt_job_id TEXT NOT NULL,
  city TEXT,
  filter_json TEXT,
  say_hello_template TEXT,
  follow_up_template TEXT,
  ai_knowledge TEXT,
  max_hello_times INTEGER NOT NULL DEFAULT 50,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Boss 候选人消息记录表
CREATE TABLE IF NOT EXISTS boss_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  boss_user_id TEXT,
  candidate_id TEXT,
  candidate_name TEXT,
  direction TEXT NOT NULL,
  content TEXT,
  msg_type TEXT NOT NULL DEFAULT 'text',
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Boss 操作行为日志表（防封号追溯）
CREATE TABLE IF NOT EXISTS boss_action_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Boss 自动化运行统计表
CREATE TABLE IF NOT EXISTS boss_stat_daily (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  d_date TEXT NOT NULL,
  say_hello_times INTEGER NOT NULL DEFAULT 0,
  follow_up_times INTEGER NOT NULL DEFAULT 0,
  reply_times INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_boss_config_user ON boss_config(user_id);
CREATE INDEX IF NOT EXISTS idx_boss_post_config_user ON boss_post_config(user_id);
CREATE INDEX IF NOT EXISTS idx_boss_messages_user ON boss_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_boss_messages_candidate ON boss_messages(candidate_id);
CREATE INDEX IF NOT EXISTS idx_boss_action_logs_user ON boss_action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_boss_stat_daily_user_date ON boss_stat_daily(user_id, d_date);

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  entity_type TEXT,
  entity_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- ===== 补充索引（高频查询字段）=====
CREATE INDEX IF NOT EXISTS idx_ai_analysis_record_id ON ai_analysis_records(followup_record_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_created ON ai_analysis_records(created_at);
CREATE INDEX IF NOT EXISTS idx_resumes_candidate_status ON resumes(candidate_status);
CREATE INDEX IF NOT EXISTS idx_matches_position_resume ON matches(position_id, resume_id);
CREATE INDEX IF NOT EXISTS idx_followup_records_date ON followup_records(followup_date);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
