// AI 代理服务（OpenAI 兼容协议）
import { getAiConfig } from '../repositories/aiAnalysisRepo.js';
import { PROMPT_TEMPLATES, fillTemplate } from './promptTemplates.js';
import { logger } from '../utils/logger.js';

// 多模态消息内容：可由文本段和图片段组成
// OpenAI 协议：content 可以是 string，也可以是 [{type:'text',text:...},{type:'image_url',image_url:{url:'data:image/png;base64,...'}}]
export type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

// AI 消息格式（content 既支持纯文本也支持多模态数组）
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContentPart[];
}

// 单张图片资产（与 utils/fileParser.ts 中的 ParsedImage 对齐）
export interface ChatImage {
  name: string;
  mime: string;
  base64: string;
}

// 从 ai_config 表读取配置
function getConfig() {
  const cfg = getAiConfig();
  if (!cfg) {
    throw new Error('AI 配置未初始化，请联系管理员');
  }
  return cfg;
}

// 解析多模态调用时实际使用的配置：
// 当 mm_enabled=1 且 mm_model 非空时，用 mm_* 系列字段（空字段回退到文本模型字段）
// 否则回退到文本模型字段
function resolveMultimodalConfig(cfg: ReturnType<typeof getAiConfig>) {
  if (!cfg) return null;
  const useMM = cfg.mm_enabled === 1 && !!cfg.mm_model;
  if (!useMM) {
    return { apiKey: cfg.api_key, baseUrl: cfg.base_url, model: cfg.model, isMultimodal: false };
  }
  return {
    apiKey: cfg.mm_api_key || cfg.api_key,   // 空则回退到文本 key
    baseUrl: cfg.mm_base_url || cfg.base_url, // 空则回退到文本 base_url
    model: cfg.mm_model,
    isMultimodal: true,
  };
}

// 是否启用了独立的多模态配置（供外部判断展示用）
export function isMultimodalConfigured(): boolean {
  const cfg = getAiConfig();
  return !!cfg && cfg.mm_enabled === 1 && !!cfg.mm_model;
}

// 容错 JSON 解析（提取 ```json 代码块、去注释等）
export function parseAIJson(content: string): any {
  let cleaned = content.trim();
  // 去掉 markdown 代码块
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  // 去除单行注释 // ...
  cleaned = cleaned.replace(/\/\/[^\n\r]*/g, '');
  // 尝试找到首个 { 或 [ 与最后一个 } 或 ]
  const firstBrace = cleaned.search(/[\[{]/);
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (lastBrace > -1 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.slice(0, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

// 基础 chat 调用（OpenAI 兼容协议，流式请求避免上游超时 502）
// - messages: ChatMessage[]，content 可为纯文本或多模态数组
// - options.images: 可选图片资产数组，会作为 image_url 段追加到 user 消息末尾
//   当有图片时，若 ai_config.mm_enabled=1 且 mm_model 非空，自动切换到多模态模型配置
// - options.stream: 是否把流式 chunk 通过 onChunk 回调推送给调用方（用于 SSE 实时推送）
export async function callAI(
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    timeoutMs?: number;
    images?: ChatImage[];
    maxTokens?: number;
    // 流式回调：每收到一个 delta 就触发一次，供外层 SSE 实时推给前端
    onChunk?: (delta: string, fullContent: string) => void;
  }
): Promise<string> {
  const cfg = getConfig();
  const imgs = options?.images ?? [];
  // 有图片时尝试用多模态配置（mm_* 字段空则回退到文本模型字段）
  const mm = resolveMultimodalConfig(cfg);
  const useMultimodal = imgs.length > 0 && mm?.isMultimodal;
  const apiKey = useMultimodal ? mm!.apiKey : cfg.api_key;
  const baseUrlRaw = useMultimodal ? mm!.baseUrl : cfg.base_url;
  const model = useMultimodal ? mm!.model : cfg.model;

  if (!apiKey) {
    throw new Error(useMultimodal ? '多模态 AI 未配置 API Key' : 'AI 未配置 API Key，请联系管理员在设置中配置');
  }
  const baseUrl = baseUrlRaw.replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;

  // 如果有图片资产，把所有图片以 image_url 段追加到 user 消息末尾
  let finalMessages = messages;
  if (imgs.length > 0) {
    finalMessages = messages.map((m) => {
      if (m.role !== 'user') return m;
      const textPart = typeof m.content === 'string' ? m.content : '';
      const parts: MessageContentPart[] = [];
      if (textPart) parts.push({ type: 'text', text: textPart });
      for (const img of imgs) {
        parts.push({
          type: 'image_url',
          image_url: {
            url: `data:${img.mime};base64,${img.base64}`,
            detail: 'auto',
          },
        });
      }
      return { role: m.role, content: parts } as ChatMessage;
    });
  }

  const body: Record<string, unknown> = {
    model,
    messages: finalMessages,
    // 结构化解析类任务用 temperature=0（确定性输出，更快更稳）
    temperature: options?.temperature ?? 0,
    stream: true,
    // 限制输出长度，防止 AI 跑题生成超长 JSON
    max_tokens: options?.maxTokens ?? 4000,
  };
  // 多模态调用通常更慢，给更长默认超时
  const timeoutMs = options?.timeoutMs ?? (imgs.length > 0 ? 120000 : 60000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const tag = useMultimodal ? '[AI/MM]' : '[AI]';
  logger.info(`${tag} 请求 ${url}  model=${model}  imgs=${imgs.length}  timeout=${timeoutMs}ms  stream=true  max_tokens=${body.max_tokens}`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    logger.info(`[AI] 响应 status=${response.status}`);
    if (!response.ok) {
      const text = await response.text();
      logger.error(`[AI] 错误响应体: ${text.slice(0, 500)}`);
      throw new Error(`AI 调用失败: HTTP ${response.status} ${text.slice(0, 200)}`);
    }
    // 流式读取 SSE，拼接完整内容
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let content = '';
    let buffer = '';
    let rawChunks = ''; // 诊断用
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const chunk = JSON.parse(data);
          const delta = chunk?.choices?.[0]?.delta?.content;
          if (delta) {
            content += delta;
            // 实时推送给外层（SSE 用）
            if (options?.onChunk) options.onChunk(delta, content);
          }
          // 记录原始 chunk 用于诊断
          if (!rawChunks && !delta) rawChunks = JSON.stringify(chunk).slice(0, 500);
        } catch {
          // 跳过解析失败的 chunk
        }
      }
    }
    if (!content) {
      if (rawChunks) logger.error(`[AI] 内容为空，首个 chunk: ${rawChunks}`);
      throw new Error('AI 返回内容为空');
    }
    return content;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`AI 调用超时（${timeoutMs}ms）`);
    }
    logger.error('AI 调用错误', err.message);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// 调用 AI 并容错解析 JSON
export async function callAIJson<T = any>(
  messages: ChatMessage[],
  options?: { temperature?: number; timeoutMs?: number; images?: ChatImage[]; maxTokens?: number; onChunk?: (delta: string, fullContent: string) => void }
): Promise<T> {
  const content = await callAI(messages, options);
  try {
    return parseAIJson(content) as T;
  } catch (err: any) {
    logger.error('AI JSON 解析失败', { content: content.slice(0, 500), error: err.message });
    throw new Error(`AI 返回内容无法解析为 JSON: ${err.message}`);
  }
}

// 按提示词 key 调用 AI（自动注入 system + user）
export async function callByPromptKey(
  promptKey: string,
  variables: Record<string, string>,
  options?: { temperature?: number; timeoutMs?: number; images?: ChatImage[]; maxTokens?: number; onChunk?: (delta: string, fullContent: string) => void }
): Promise<any> {
  // 优先用数据库中的自定义提示词，回退到代码默认
  const cfg = getAiConfig();
  let tpl = PROMPT_TEMPLATES[promptKey];
  if (cfg?.prompts?.[promptKey]) {
    tpl = cfg.prompts[promptKey];
  }
  if (!tpl) {
    throw new Error(`提示词模板不存在: ${promptKey}`);
  }
  const system = fillTemplate(tpl.system, variables);
  const user = fillTemplate(tpl.user, variables);
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  return callAIJson(messages, options);
}

// 测试 AI 连接
export async function testAIConnection(): Promise<{ ok: boolean; message: string; model?: string }> {
  try {
    const cfg = getConfig();
    if (!cfg.api_key) {
      return { ok: false, message: '未配置 API Key' };
    }
    const content = await callAI(
      [
        { role: 'system', content: '你是测试助手。' },
        { role: 'user', content: '请回复"OK"。' },
      ],
      { temperature: 0, timeoutMs: 15000 }
    );
    return { ok: true, message: `连接成功，模型响应: ${content.slice(0, 50)}`, model: cfg.model };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

// 测试多模态 AI 连接（用一张 1x1 红点 PNG 测试视觉能力）
export async function testMultimodalConnection(): Promise<{ ok: boolean; message: string; model?: string }> {
  try {
    const cfg = getConfig();
    if (cfg.mm_enabled !== 1 || !cfg.mm_model) {
      return { ok: false, message: '未启用独立多模态配置（mm_enabled=0 或 mm_model 为空）' };
    }
    const mm = resolveMultimodalConfig(cfg);
    if (!mm?.apiKey) {
      return { ok: false, message: '多模态 API Key 未配置（mm_api_key 和 api_key 均为空）' };
    }
    // 1x1 红点 PNG（base64）
    const redDotBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const content = await callAI(
      [
        { role: 'system', content: '你是视觉测试助手。' },
        { role: 'user', content: '请回复"OK"。' },
      ],
      {
        temperature: 0,
        timeoutMs: 30000,
        images: [{ name: 'test.png', mime: 'image/png', base64: redDotBase64 }],
      }
    );
    return {
      ok: true,
      message: `多模态连接成功，模型 ${mm.model} 响应: ${content.slice(0, 50)}`,
      model: mm.model,
    };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}
