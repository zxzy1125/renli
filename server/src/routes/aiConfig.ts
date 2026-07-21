// AI 配置路由（管理员）
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { getAiConfig, updateAiConfig } from '../repositories/aiAnalysisRepo.js';
import { testAIConnection, testMultimodalConnection } from '../services/aiService.js';
import { PROMPT_TEMPLATES } from '../services/promptTemplates.js';

export const aiConfigRouter = Router();
aiConfigRouter.use(requireAuth);

// GET /api/ai-config（仅管理员）
aiConfigRouter.get('/', requireAdmin, (_req, res) => {
  const cfg = getAiConfig();
  if (!cfg) throw new ApiError(404, 'AI 配置不存在');
  res.json({ data: cfg });
});

// PUT /api/ai-config（管理员）
// 支持文本模型字段和多模态模型字段（mm_*）
aiConfigRouter.put('/', requireAdmin, asyncHandler(async (req, res) => {
  const {
    provider, api_key, base_url, model, temperature, prompts,
    // 多模态字段
    mm_enabled, mm_provider, mm_api_key, mm_base_url, mm_model,
  } = req.body ?? {};
  const updated = updateAiConfig({
    provider, api_key, base_url, model,
    temperature: temperature !== undefined ? Number(temperature) : undefined,
    prompts,
    mm_enabled: mm_enabled !== undefined ? Number(mm_enabled) : undefined,
    mm_provider, mm_api_key, mm_base_url, mm_model,
  });
  if (!updated) throw new ApiError(404, 'AI 配置不存在');
  res.json({ data: updated });
}));

// POST /api/ai-config/test（测试文本模型连接）
aiConfigRouter.post('/test', requireAdmin, asyncHandler(async (_req, res) => {
  const result = await testAIConnection();
  res.json({ data: result });
}));

// POST /api/ai-config/test-multimodal（测试多模态模型连接）
aiConfigRouter.post('/test-multimodal', requireAdmin, asyncHandler(async (_req, res) => {
  const result = await testMultimodalConnection();
  res.json({ data: result });
}));

// GET /api/ai-config/prompts（管理员查看所有提示词）
aiConfigRouter.get('/prompts', requireAdmin, (_req, res) => {
  const cfg = getAiConfig();
  const prompts = cfg?.prompts ?? PROMPT_TEMPLATES;
  res.json({ data: prompts });
});

// PUT /api/ai-config/prompts/:key（管理员更新单个提示词）
aiConfigRouter.put('/prompts/:key', requireAdmin, asyncHandler(async (req, res) => {
  const key = String(req.params.key);
  const { system, user } = req.body ?? {};
  if (!system || !user) throw new ApiError(400, 'system 和 user 不能为空');
  const cfg = getAiConfig();
  if (!cfg) throw new ApiError(404, 'AI 配置不存在');
  const newPrompts = { ...cfg.prompts, [key]: { system, user } };
  const updated = updateAiConfig({ prompts: newPrompts });
  res.json({ data: updated?.prompts[key] });
}));

// 重置单个提示词为默认
aiConfigRouter.post('/prompts/:key/reset', requireAdmin, asyncHandler(async (req, res) => {
  const key = String(req.params.key);
  const defaultTpl = (PROMPT_TEMPLATES as any)[key];
  if (!defaultTpl) throw new ApiError(404, `提示词模板不存在: ${key}`);
  const cfg = getAiConfig();
  if (!cfg) throw new ApiError(404, 'AI 配置不存在');
  const newPrompts = { ...cfg.prompts, [key]: { system: defaultTpl.system, user: defaultTpl.user } };
  updateAiConfig({ prompts: newPrompts });
  res.json({ data: defaultTpl });
}));
