# 求职者转化话术生成工具 - 技术架构文档

## 1. 整体架构

```mermaid
flowchart TB
    subgraph "客户端"
        "Web 浏览器"
        "Chrome 插件"
    end

    subgraph "部署层"
        "Nginx<br/>HTTPS + 静态资源 + 反代"
    end

    subgraph "应用层 Node.js"
        "Express API"
        "JWT 鉴权中间件"
        "RBAC 权限中间件"
        "AI 代理服务"
        "撞单检测服务"
    end

    subgraph "数据层"
        "SQLite 数据库"
    end

    subgraph "外部服务"
        "智谱 GLM / OpenAI 兼容 API"
    end

    "Web 浏览器" --> "Nginx"
    "Chrome 插件" --> "Nginx"
    "Nginx" --> "Express API"
    "Express API" --> "JWT 鉴权中间件"
    "JWT 鉴权中间件" --> "RBAC 权限中间件"
    "RBAC 权限中间件" --> "AI 代理服务"
    "RBAC 权限中间件" --> "撞单检测服务"
    "AI 代理服务" --> "智谱 GLM / OpenAI 兼容 API"
    "Express API" --> "SQLite 数据库"
```

## 2. 技术选型

### 2.1 前端

- React@18 + Vite@6 + TypeScript
- TailwindCSS@3 + CSS 变量
- React Router v7
- lucide-react
- Zustand（状态管理）
- Axios（HTTP 客户端）
- pdfjs-dist + mammoth.js（文件解析）

### 2.2 后端

- Node.js@20 + Express + TypeScript
- better-sqlite3（SQLite 驱动）
- bcryptjs（密码加密）
- jsonwebtoken（JWT）
- zod（请求参数校验）
- cookie-parser（Cookie 处理）

### 2.3 浏览器插件

- Manifest V3
- Chrome Extension API
- TypeScript + Vite 插件模式打包

### 2.4 部署

- Docker + docker-compose
- Nginx 反代
- Let's Encrypt 自动 HTTPS

## 3. 项目目录结构

```
/workspace
├── server/                          # 后端
│   ├── src/
│   │   ├── routes/                  # API 路由
│   │   │   ├── auth.routes.ts       # 登录/注册
│   │   │   ├── user.routes.ts       # 员工管理
│   │   │   ├── client.routes.ts     # 客户公司
│   │   │   ├── position.routes.ts   # 职位
│   │   │   ├── resume.routes.ts     # 简历
│   │   │   ├── match.routes.ts      # 匹配
│   │   │   ├── pitch.routes.ts      # 话术
│   │   │   ├── followup.routes.ts   # 跟进
│   │   │   ├── conflict.routes.ts   # 撞单
│   │   │   ├── report.routes.ts     # 报表
│   │   │   └── ai.routes.ts         # AI 代理
│   │   ├── middleware/
│   │   │   ├── auth.ts              # JWT 鉴权
│   │   │   ├── rbac.ts              # RBAC 权限
│   │   │   └── error.ts             # 错误处理
│   │   ├── repositories/            # 数据访问层
│   │   │   ├── user.repo.ts
│   │   │   ├── client.repo.ts
│   │   │   ├── position.repo.ts
│   │   │   ├── resume.repo.ts
│   │   │   ├── match.repo.ts
│   │   │   ├── pitch.repo.ts
│   │   │   ├── followup.repo.ts
│   │   │   ├── conflict.repo.ts
│   │   │   └── audit.repo.ts
│   │   ├── services/
│   │   │   ├── ai.service.ts        # AI 调用
│   │   │   ├── conflict.service.ts  # 撞单检测
│   │   │   ├── auth.service.ts      # 鉴权
│   │   │   └── prompts.ts           # 提示词
│   │   ├── db/
│   │   │   ├── schema.ts            # 建表 SQL
│   │   │   ├── migrate.ts           # 迁移脚本
│   │   │   └── index.ts             # 数据库连接
│   │   ├── utils/
│   │   │   ├── phone.ts             # 手机号脱敏
│   │   │   ├── jwt.ts
│   │   │   └── logger.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── config.ts
│   │   └── index.ts                 # 入口
│   ├── data/                        # SQLite 数据文件
│   │   └── app.db
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── web/                             # 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Layout.tsx
│   │   │   │   └── Header.tsx
│   │   │   ├── ui/                  # 基础组件
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Textarea.tsx
│   │   │   │   ├── Select.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Tabs.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   └── Empty.tsx
│   │   │   ├── PositionCard.tsx
│   │   │   ├── ResumeCard.tsx
│   │   │   ├── MatchCard.tsx
│   │   │   ├── PitchMatrix.tsx
│   │   │   ├── PitchCard.tsx
│   │   │   ├── FollowupCard.tsx
│   │   │   ├── FunnelChart.tsx
│   │   │   └── FileUploader.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── positions/
│   │   │   │   ├── PositionList.tsx
│   │   │   │   ├── PositionForm.tsx
│   │   │   │   └── PositionDetail.tsx
│   │   │   ├── resumes/
│   │   │   │   ├── ResumeList.tsx
│   │   │   │   ├── ResumeForm.tsx
│   │   │   │   └── ResumeDetail.tsx
│   │   │   ├── matches/
│   │   │   │   ├── MatchList.tsx
│   │   │   │   ├── MatchNew.tsx
│   │   │   │   └── MatchDetail.tsx
│   │   │   ├── followups/
│   │   │   │   ├── FollowupDashboard.tsx
│   │   │   │   ├── FollowupPlanList.tsx
│   │   │   │   └── FollowupRecordList.tsx
│   │   │   ├── Conversions.tsx
│   │   │   ├── Conflicts.tsx
│   │   │   └── settings/
│   │   │       ├── SettingsIndex.tsx
│   │   │       ├── PersonalSettings.tsx
│   │   │       ├── TeamSettings.tsx
│   │   │       ├── AIConfigSettings.tsx
│   │   │       └── PromptSettings.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useApi.ts
│   │   │   └── ...
│   │   ├── lib/
│   │   │   ├── api.ts               # Axios 实例
│   │   │   ├── utils.ts
│   │   │   ├── parser.ts            # 文件解析
│   │   │   └── constants.ts
│   │   ├── store/
│   │   │   └── useAuthStore.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── extension/                       # Chrome 插件
│   ├── src/
│   │   ├── manifest.json
│   │   ├── background.ts            # Service Worker
│   │   ├── content/
│   │   │   ├── boss.ts              # Boss 直聘页面解析
│   │   │   └── liepin.ts            # 猎聘页面解析
│   │   ├── popup/
│   │   │   ├── popup.html
│   │   │   ├── popup.ts
│   │   │   └── popup.css
│   │   └── utils/
│   │       ├── extractor.ts         # 简历文本提取
│   │       └── api.ts               # 与后端通信
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
└── .trae/documents/
    ├── PRD.md
    ├── TechnicalArchitecture.md
    └── Prompts.md
```

## 4. 数据库设计

### 4.1 表结构

```sql
-- 用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  real_name TEXT NOT NULL,
  department TEXT,
  role TEXT NOT NULL DEFAULT 'employee',  -- admin / employee
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 客户公司表
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  industry TEXT,
  notes TEXT,
  owner_id TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 职位表
CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  client_id TEXT REFERENCES clients(id),
  client_company TEXT,
  department TEXT,
  salary_min TEXT,
  salary_max TEXT,
  salary_unit TEXT DEFAULT 'K',
  experience TEXT,
  education TEXT,
  location TEXT,
  job_type TEXT DEFAULT 'fulltime',
  work_mode TEXT DEFAULT 'onsite',
  responsibilities TEXT,
  requirements TEXT,
  highlights TEXT,
  keywords TEXT,  -- JSON 数组
  raw_text TEXT,
  source TEXT,
  status TEXT DEFAULT 'open',
  owner_id TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 简历表
CREATE TABLE resumes (
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
  expected_city TEXT,                          -- 意向求职城市（风险识别用）
  raw_text TEXT,
  source TEXT,
  phone_masked TEXT,
  phone_hash TEXT,
  email_masked TEXT,
  has_wechat INTEGER DEFAULT 0,
  wechat_id TEXT,
  contact_preference TEXT DEFAULT 'wechat',
  candidate_status TEXT DEFAULT 'passive',
  expected_onboard_date TEXT,
  tags TEXT,                                    -- JSON 数组
  common_grounds TEXT,                         -- JSON: {alumni, hometown, previousCompany, hobby}
  risk_warning TEXT,                           -- JSON: {isRisky, reasons[]}
  remark TEXT,                                 -- 人选备注（时间+姓名+年龄+学历+岗位方向）
  owner_id TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 匹配表
CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  position_id TEXT REFERENCES positions(id),
  resume_id TEXT REFERENCES resumes(id),
  match_score INTEGER,
  score_breakdown TEXT,    -- JSON
  highlights TEXT,         -- JSON
  concerns TEXT,           -- JSON
  salary_analysis TEXT,    -- JSON
  conversion_prediction TEXT,  -- JSON
  recommendation TEXT,
  recommendation_reason TEXT,
  status TEXT DEFAULT 'consulting',
  owner_id TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 话术表
CREATE TABLE pitches (
  id TEXT PRIMARY KEY,
  match_id TEXT REFERENCES matches(id),
  channel TEXT NOT NULL,
  scenario TEXT NOT NULL,
  content TEXT NOT NULL,
  edited_content TEXT,
  hook TEXT,
  core_message TEXT,
  personalized_element TEXT,
  psychology_trick TEXT,
  review_status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

-- 跟进计划表
CREATE TABLE followup_plans (
  id TEXT PRIMARY KEY,
  resume_id TEXT REFERENCES resumes(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL,         -- once / recurring / custom
  interval_days INTEGER,
  max_times INTEGER DEFAULT 5,
  remind_date TEXT,
  custom_dates TEXT,          -- JSON
  purpose TEXT,
  position_ids TEXT,          -- JSON
  status TEXT DEFAULT 'active',
  next_remind_date TEXT NOT NULL,
  completed_times INTEGER DEFAULT 0,
  owner_id TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 回访记录表
CREATE TABLE followup_records (
  id TEXT PRIMARY KEY,
  plan_id TEXT REFERENCES followup_plans(id),
  resume_id TEXT REFERENCES resumes(id),
  followup_date TEXT NOT NULL,
  contact_channel TEXT,
  result TEXT,
  note TEXT,
  introduced_positions TEXT,  -- JSON
  next_action TEXT,
  owner_id TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- AI 分析记录表
CREATE TABLE ai_analyses (
  id TEXT PRIMARY KEY,
  followup_record_id TEXT REFERENCES followup_records(id),
  type TEXT NOT NULL,    -- pre_followup / post_followup / script_generation
  input TEXT,            -- JSON
  output TEXT,           -- JSON
  owner_id TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- 时间轴事件表
CREATE TABLE timeline_events (
  id TEXT PRIMARY KEY,
  match_id TEXT REFERENCES matches(id),
  status TEXT NOT NULL,
  note TEXT,
  operator_id TEXT REFERENCES users(id),
  timestamp TEXT DEFAULT (datetime('now'))
);

-- 撞单记录表
CREATE TABLE conflict_records (
  id TEXT PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  phone_hash TEXT,
  email TEXT,
  resume_id_a TEXT REFERENCES resumes(id),
  resume_id_b TEXT REFERENCES resumes(id),
  employee_id_a TEXT REFERENCES users(id),
  employee_id_b TEXT REFERENCES users(id),
  match_field TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users(id)
);

-- 系统配置表
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 操作日志表
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  detail TEXT,  -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX idx_positions_owner ON positions(owner_id);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_resumes_owner ON resumes(owner_id);
CREATE INDEX idx_resumes_phone_hash ON resumes(phone_hash);
CREATE INDEX idx_matches_owner ON matches(owner_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_pitches_match ON pitches(match_id);
CREATE INDEX idx_followup_plans_owner ON followup_plans(owner_id);
CREATE INDEX idx_followup_plans_next_remind ON followup_plans(next_remind_date);
CREATE INDEX idx_followup_records_resume ON followup_records(resume_id);
CREATE INDEX idx_timeline_match ON timeline_events(match_id);
CREATE INDEX idx_conflicts_status ON conflict_records(status);
```

## 5. API 设计

### 5.1 鉴权 API

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/auth/login | 登录 |
| POST | /api/auth/logout | 登出 |
| GET | /api/auth/me | 获取当前用户 |
| PUT | /api/auth/password | 修改密码 |

### 5.2 用户管理（管理员）

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/users | 用户列表 |
| POST | /api/users | 创建用户 |
| PUT | /api/users/:id | 编辑用户 |
| DELETE | /api/users/:id | 禁用用户 |
| POST | /api/users/:id/reset-password | 重置密码 |

### 5.3 客户公司（管理员）

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/clients | 列表 |
| POST | /api/clients | 创建 |
| GET | /api/clients/:id | 详情 |
| PUT | /api/clients/:id | 编辑 |
| DELETE | /api/clients/:id | 删除 |

### 5.4 职位

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/positions | 列表（全员可见） |
| GET | /api/positions/:id | 详情 |
| POST | /api/positions | 创建（仅管理员） |
| PUT | /api/positions/:id | 编辑（仅管理员） |
| DELETE | /api/positions/:id | 删除（仅管理员） |

### 5.5 简历

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/resumes | 列表（仅自己的，管理员看全部） |
| GET | /api/resumes/:id | 详情 |
| POST | /api/resumes | 创建（含撞单检测） |
| PUT | /api/resumes/:id | 编辑 |
| DELETE | /api/resumes/:id | 删除 |

### 5.6 匹配

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/matches | 列表 |
| GET | /api/matches/:id | 详情（含话术） |
| POST | /api/matches | 创建 |
| PUT | /api/matches/:id/status | 推进状态 |
| DELETE | /api/matches/:id | 删除 |

### 5.7 话术

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/pitches/match/:matchId | 某匹配的全部话术 |
| POST | /api/pitches/generate | 生成 18 条套件 |
| POST | /api/pitches/:id/review | 审核（接受/编辑/放弃） |
| POST | /api/pitches/:id/regenerate | 重新生成 |
| PUT | /api/pitches/:id | 编辑话术内容 |

### 5.8 跟进

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/followups/plans | 计划列表 |
| GET | /api/followups/today | 今日待回访 |
| POST | /api/followups/plans | 创建计划 |
| PUT | /api/followups/plans/:id | 编辑计划 |
| DELETE | /api/followups/plans/:id | 删除计划 |
| GET | /api/followups/records | 回访记录 |
| POST | /api/followups/records | 录入回访 |

### 5.9 AI 服务

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /api/ai/parse-position | 解析职位（录入流程环节，解析+入库一体） | 管理员 |
| POST | /api/ai/parse-resume | 解析简历 | 员工 |
| POST | /api/ai/match-analysis | 匹配分析 | 员工 |
| POST | /api/ai/generate-pitches | 生成 18 条话术 | 员工 |
| POST | /api/ai/pre-followup | 回访前作战卡片 | 员工 |
| POST | /api/ai/post-followup | 回访后深度分析 | 员工 |
| POST | /api/ai/concern-pitch | 应对话术生成 | 员工 |
| POST | /api/ai/polish | 话术润色 | 员工 |
| POST | /api/ai/generate-boss-posting | BOSS 岗位发布文案生成 | 🟢 全员 |

> **说明**：职位解析是管理员录入职位的**环节之一**（粘贴杂乱原文→AI 解析成结构化字段→审核→入库），不是独立功能。入库后员工看到的是结构化清晰版，原始文本作为 rawText 保留在数据库，可在详情页折叠区展开核对。

### 5.10 撞单管理（管理员）

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/conflicts | 撞单列表 |
| GET | /api/conflicts/:id | 详情 |
| POST | /api/conflicts/:id/resolve | 处理撞单 |

### 5.11 报表（管理员）

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/reports/funnel | 转化漏斗 |
| GET | /api/reports/employees | 员工绩效 |
| GET | /api/reports/clients | 客户公司报表 |

### 5.12 设置（管理员）

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/config/ai | 获取 AI 配置 |
| PUT | /api/config/ai | 更新 AI 配置 |
| GET | /api/config/prompts | 获取提示词 |
| PUT | /api/config/prompts/:key | 更新提示词 |
| GET | /api/config/export | 导出全部数据 |
| POST | /api/config/import | 导入数据 |

## 6. AI 代理服务设计

### 6.1 统一 AI 调用接口

```typescript
// server/src/services/ai.service.ts
class AIService {
  async chat(messages: ChatMessage[], options?: { temperature?: number }): Promise<string> {
    const config = await this.getConfig();
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options?.temperature ?? 0.7
      })
    });
    if (!response.ok) throw new Error(`AI 调用失败: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }

  async chatJSON<T>(messages: ChatMessage[]): Promise<T> {
    const content = await this.chat(messages);
    return parseAIJson(content);  // 容错解析（去 markdown 代码块）
  }
}
```

### 6.2 API Key 保护

- API Key 仅存在后端数据库 system_config 表
- 前端调用 AI 走 `/api/ai/*` 接口，由后端代理
- 前端永远看不到 API Key

## 7. 撞单检测服务

```typescript
// server/src/services/conflict.service.ts
class ConflictService {
  async checkConflict(resume: ResumeInput): Promise<ConflictResult> {
    const phoneHash = resume.phone ? hash(resume.phone) : null;
    
    // 查询同手机号
    if (phoneHash) {
      const existing = await resumeRepo.findByPhoneHash(phoneHash);
      if (existing) {
        return {
          conflict: true,
          matchField: 'phone',
          existingResume: existing
        };
      }
    }
    
    // 查询同邮箱
    if (resume.email) {
      const existing = await resumeRepo.findByEmail(resume.email);
      if (existing) {
        return { conflict: true, matchField: 'email', existingResume: existing };
      }
    }
    
    // 查询姓名+现公司
    if (resume.name && resume.currentCompany) {
      const existing = await resumeRepo.findByNameAndCompany(
        resume.name, resume.currentCompany
      );
      if (existing) {
        return { conflict: true, matchField: 'name_company', existingResume: existing };
      }
    }
    
    return { conflict: false };
  }
}
```

## 8. 浏览器插件设计

### 8.1 Manifest V3

```json
{
  "manifest_version": 3,
  "name": "招聘助手 - 简历导入",
  "version": "1.0.0",
  "description": "一键读取 Boss/猎聘简历，导入到招聘辅助工具",
  "permissions": ["activeTab", "storage", "clipboardWrite"],
  "host_permissions": [
    "https://www.zhipin.com/*",
    "https://www.liepin.com/*",
    "https://your-domain.com/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.zhipin.com/*"],
      "js": ["boss.js"]
    },
    {
      "matches": ["https://www.liepin.com/*"],
      "js": ["liepin.js"]
    }
  ]
}
```

### 8.2 工作流程

```
1. 员工在 Boss/猎聘打开简历页
2. 点击插件图标 → Popup 弹出
3. Popup 检测当前页面平台
4. 调用 Content Script 提取简历文本
5. Popup 展示提取结果（可编辑）
6. 员工点"导入到工具"
7. 插件调后端 API /api/resumes/import-from-extension
   - 携带员工 JWT Token（插件设置页配置）
   - POST 简历原文
8. 后端调 AI 解析 + 撞单检测 + 入库
9. 返回简历 ID
10. 插件打开新标签：https://your-domain.com/resumes/:id
```

### 8.3 配置

插件 Popup 有"设置"按钮：
- 工具服务器地址（如 https://your-domain.com）
- JWT Token（粘贴登录后的 Token）

## 9. 部署架构

### 9.1 Dockerfile（多阶段构建）

```dockerfile
# 阶段 1: 构建前端
FROM node:20-alpine AS web-builder
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ .
RUN npm run build

# 阶段 2: 构建后端
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ .
RUN npm run build

# 阶段 3: 运行
FROM node:20-alpine
WORKDIR /app
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package.json ./server/
COPY --from=web-builder /app/web/dist ./web/dist
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["sh", "-c", "node server/dist/index.js & nginx -g 'daemon off;'"]
```

### 9.2 docker-compose.yml

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./data:/app/server/data
      - ./certs:/etc/nginx/certs
    environment:
      - NODE_ENV=production
      - JWT_SECRET=your-jwt-secret
      - DB_PATH=/app/server/data/app.db
    restart: unless-stopped
```

### 9.3 Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 静态资源
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
    
    # API 反代
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 10. 安全设计

### 10.1 鉴权流程

```
1. 用户登录 POST /api/auth/login
2. 后端验证密码 → 生成 JWT Token
3. Token 通过 HttpOnly Cookie 返回
4. 前端每次请求自动携带 Cookie
5. 后端 auth 中间件验证 Token
6. RBAC 中间件根据用户角色校验权限
```

### 10.2 密码安全

- bcrypt 加密（salt rounds = 10）
- 密码强度要求（最少 8 位，含字母数字）
- 登录失败 5 次锁定 30 分钟

### 10.3 数据安全

- 手机号脱敏存储（138****5678）
- 邮箱脱敏存储
- API Key 仅存后端
- SQL 参数化查询防注入
- XSS 防护（输出转义）
- CSRF 防护（SameSite Cookie）

## 11. 初始化数据

系统首次启动时自动创建：
- 默认管理员账号：admin / admin123（首次登录强制改密码）
- 默认 AI 配置（智谱 GLM，需填 API Key）
- 默认 8 套提示词

## 12. 性能优化

- 后端：better-sqlite3 同步调用，性能优于异步驱动
- 数据库索引：owner_id、status、phone_hash、next_remind_date
- 前端：路由懒加载
- 静态资源：Nginx gzip + 强缓存
- AI 调用：超时 60s，失败可重试
