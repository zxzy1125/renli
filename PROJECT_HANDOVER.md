# 招聘辅助工具 — 项目说明

## 项目概述

人力代招公司专用的 AI 招聘辅助工具，核心是"AI 起草 + 人工审核"半人工工作流。

- **前端**：React 18 + Vite + TypeScript + TailwindCSS + Zustand
- **后端**：Node.js + Express + TypeScript + SQLite + JWT
- **AI**：OpenAI 兼容协议（智谱 GLM / OpenAI / DeepSeek 等）

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 18 + React Router 7 |
| 构建工具 | Vite 6 |
| 类型系统 | TypeScript 5.8 |
| 样式 | TailwindCSS 3 |
| 状态管理 | Zustand 5 |
| HTTP | Axios |
| 图表 | Recharts |
| 图标 | lucide-react |
| Markdown | react-markdown + remark-gfm |
| 时间 | dayjs |
| 后端框架 | Express 5 |
| 数据库 | better-sqlite3 |
| 鉴权 | jsonwebtoken + bcryptjs |
| 文件上传 | multer |
| ID 生成 | nanoid |

## 目录结构

```
/workspace/
├── .trae/documents/         # 开发文档
│   ├── PRD.md                # 产品需求文档
│   ├── TechnicalArchitecture.md  # 技术架构文档
│   ├── Prompts.md            # 9 套 AI 提示词
│   ├── BOSS规范.md           # BOSS 直聘规范操作指南
│   ├── HR话术方法论知识库.md  # HR 招聘话术方法论
│   └── 产品价值介绍.md       # 产品价值介绍（员工+管理视角）
│
├── server/                   # 后端代码
│   ├── src/
│   │   ├── index.ts          # Express 入口
│   │   ├── db/               # 数据库（schema + seed）
│   │   ├── middleware/       # 鉴权 + 错误处理
│   │   ├── repositories/     # 9 个数据访问层
│   │   ├── routes/           # 13 个路由模块
│   │   ├── services/         # AI 服务 + 提示词模板 + 撞单检测
│   │   ├── types/            # 类型定义
│   │   └── utils/            # JWT + 加密 + 日志
│   └── tsconfig.json
│
├── src/                      # 前端代码
│   ├── components/           # 通用组件（13 个）
│   ├── pages/                # 页面（按模块组织）
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── Positions/        # 职位库
│   │   ├── Resumes/          # 简历库
│   │   ├── Clients/          # 客户公司
│   │   ├── Matches/          # 匹配管理（18 条话术）
│   │   ├── Followups/        # 跟进管理（AI 作战卡片）
│   │   ├── Conversions/      # 转化跟踪
│   │   ├── Conflicts/        # 撞单管理
│   │   └── Settings/         # 设置
│   ├── store/                # Zustand store
│   ├── lib/                  # API 封装 + 工具
│   ├── types.ts              # 全局类型
│   └── App.tsx               # 路由配置
│
├── package.json              # 依赖 + 脚本
├── tsconfig.json             # 前端 TS 配置
├── vite.config.ts            # Vite 配置（含 /api 代理）
├── tailwind.config.js        # Tailwind 主题（forest/cream/ochre/ai/risk）
├── postcss.config.js
└── index.html
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动后端（端口 3001）

```bash
npm run server:dev
```

### 3. 启动前端（端口 5173）

```bash
npm run dev
```

### 4. 同时启动前后端

```bash
npm run dev:all
```

### 5. 默认管理员账号

- 用户名：`admin`
- 密码：`admin123`

### 6. 配置 AI

登录后进入「设置 → AI 配置」填入：
- 服务商：智谱 GLM / OpenAI / 自定义
- API Key
- Base URL
- 模型名（如 glm-4-plus / gpt-4o-mini）

## 核心功能

| 模块 | 说明 |
|------|------|
| 总览工作台 | 统计卡片 + 漏斗图 + 今日待回访 + 最近匹配 |
| 职位库 | 管理员录入（AI 解析） + 全员查看 |
| 客户公司 | 管理员 CRUD + 全员查看 |
| 简历库 | 员工录入（AI 解析 + 风险识别 + 撞单检测） |
| 匹配管理 | 选职位+选简历 → AI 匹配报告 + 18 条话术矩阵 |
| 跟进管理 | 回访计划 + AI 作战卡片 + AI 深度分析 + 应对话术 |
| 转化跟踪 | 漏斗图 + 状态分布 + 匹配记录 + 管理员报表 |
| 撞单管理 | 自动检测 + 4 种处理方式（管理员） |
| 设置 | 个人/团队/AI配置/运营规范知识库 |

## 权限模型

| 操作 | 管理员 | 员工 |
|------|--------|------|
| 职位录入 | ✅ | ❌ |
| 职位查看 | ✅ | ✅ |
| 简历查看 | ✅ 全部 | ✅ 仅自己 |
| 匹配/话术/跟进 | ✅ 全部 | ✅ 仅自己 |
| 撞单管理 | ✅ | ❌ |
| 团队管理 | ✅ | ❌ |
| AI 配置 | ✅ | ❌ |
| BOSS 文案生成 | ✅ | ✅ |

## AI 能力（9 套提示词）

1. 职位解析（管理员录入流程）
2. 简历解析（含风险识别 + 共同点挖掘）
3. 匹配分析（评分 + 亮点 + 疑虑 + 薪资 + 转化预测）
4. 18 条话术生成（3 渠道 × 6 场景）
5. 回访前作战卡片
6. 回访后深度分析
7. 应对话术生成（3 渠道）
8. 话术润色优化
9. BOSS 发布文案生成

所有 AI 调用注入 BOSS 硬约束 + HR 话术方法论知识库。

## 部署

### 公网部署

```bash
# 构建
npm run build

# 部署 dist/ 到云服务器
# 后端用 pm2 守护
pm2 start "npx tsx server/src/index.ts" --name recruit-api
```

### 打包成 EXE（后续）

用 Electron 把前端 + 后端打包成桌面应用。

## 后续开发建议

1. 浏览器插件（半自动读取 Boss/猎聘简历）
2. 企业微信/钉钉 API 对接
3. 话术共享库
4. 招聘平台对接
5. 移动端 H5

## 文档导航

- 产品需求：`.trae/documents/PRD.md`
- 技术架构：`.trae/documents/TechnicalArchitecture.md`
- AI 提示词：`.trae/documents/Prompts.md`
- BOSS 规范：`.trae/documents/BOSS规范.md`
- HR 方法论：`.trae/documents/HR话术方法论知识库.md`
- 产品价值：`.trae/documents/产品价值介绍.md`
```
