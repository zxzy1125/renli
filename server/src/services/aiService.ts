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
export async function callAI(
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    timeoutMs?: number;
    images?: ChatImage[];
  }
): Promise<string> {
  const cfg = getConfig();
  if (!cfg.api_key) {
    throw new Error('AI 未配置 API Key，请联系管理员在设置中配置');
  }
  const baseUrl = cfg.base_url.replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;

  // 如果有图片资产，把所有图片以 image_url 段追加到 user 消息末尾
  let finalMessages = messages;
  const imgs = options?.images ?? [];
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

  const body = {
    model: cfg.model,
    messages: finalMessages,
    temperature: options?.temperature ?? cfg.temperature,
    stream: true,
  };
  // 多模态调用通常更慢，给更长默认超时
  const timeoutMs = options?.timeoutMs ?? (imgs.length > 0 ? 120000 : 60000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  logger.info(`[AI] 请求 ${url}  model=${cfg.model}  timeout=${timeoutMs}ms  stream=true`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.api_key}`,
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
          if (delta) content += delta;
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
  options?: { temperature?: number; timeoutMs?: number; images?: ChatImage[] }
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
  options?: { temperature?: number; timeoutMs?: number; images?: ChatImage[] }
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
