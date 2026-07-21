// 版本更新历史
// 每次发版时在数组头部插入新版本记录

export type VersionType = 'feature' | 'fix' | 'improvement';

export interface VersionEntry {
  version: string;       // 语义化版本号，如 "0.3.0"
  date: string;          // 发布日期 YYYY-MM-DD
  title: string;         // 本次更新标题
  type: VersionType;     // 更新类型
  changes: string[];     // 更新内容明细列表
}

// 当前版本（取版本历史首条）
export const CURRENT_VERSION = '0.3.0';

// 版本历史（新版本在前面）
export const VERSION_HISTORY: VersionEntry[] = [
  {
    version: '0.3.0',
    date: '2026-07-21',
    title: '多模态模型接入',
    type: 'feature',
    changes: [
      '新增独立的多模态模型配置接口（mm_enabled / mm_provider / mm_api_key / mm_base_url / mm_model）',
      'AI 配置页新增"多模态模型"配置区，支持启用开关、服务商选择、模型配置、连接测试',
      '文件解析时检测到图片自动切换多模态模型调用（OpenAI 兼容协议 image_url 格式）',
      '简历/职位上传接口统一返回图片资产（base64），前端透传给 AI 解析接口',
      '简历录入表单支持上传图片文件（.jpg/.png 等），展示图片缩略图和多模态识别提示',
      '多模态 API Key/BaseUrl 留空时自动回退到文本模型配置，适合同服务商不同模型场景',
      '新增多模态连接测试接口 POST /api/ai-config/test-multimodal（用 1x1 红点 PNG 测试视觉能力）',
      '简历解析提示词增加多模态识别说明，引导 AI 识别图片中的文字信息',
      'ai_config 表新增 5 个多模态字段，老库自动 ALTER TABLE 迁移',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-07-21',
    title: 'Boss 直聘自动化集成',
    type: 'feature',
    changes: [
      '集成 Boss 直聘自动化能力（本地 Agent + 服务器 WebSocket 架构）',
      '新增 Boss 自动化页面，支持连接 Chrome 调试浏览器、配置打招呼参数',
      '新增本地 Agent（agent/agent.ts），通过 WSS 连接服务器接收任务',
      '新增 say-hello 自动化任务，支持 CDP 复用会话、随机延时、鼠标轨迹防封号',
      '新增 chrome-debug.bat 脚本，以调试模式启动 Chrome 浏览器',
      'Nginx 配置 /boss-agent WebSocket 反向代理（86400s 超时，支持 Upgrade/Connection 头）',
      '前端新增 Boss 自动化菜单入口、5 个 UI 组件（Card/Button/Input/Textarea/Badge）',
      '部署到服务器 renli.xiaoqingai.top，支持 HTTPS + WSS',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-07-20',
    title: '代招助手初始版本',
    type: 'feature',
    changes: [
      '基础招聘管理：职位库、简历库、客户公司、匹配管理',
      'AI 智能解析：支持职位/简历文件上传解析（PDF/DOCX/Excel/图片），自动提取结构化字段',
      '11 套 AI 提示词模板：职位解析、简历解析、匹配分析、18 条话术生成、回访作战卡片等',
      '对话辅助：BOSS 实时对话 + AI 回复建议',
      '跟进管理：回访计划、作战卡片、深度分析',
      '撞单检测：手机号/邮箱/公司多维撞单识别',
      '团队管理：管理员/员工角色权限、数据隔离',
      '运营规范知识库：HR 招聘话术方法论、9 类求职者画像分类',
      '数据安全：手机号脱敏+哈希、邮箱脱敏、JWT 鉴权',
    ],
  },
];
