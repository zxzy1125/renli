// AI 代理服务（OpenAI 兼容协议）
import { getAiConfig } from '../repositories/aiAnalysisRepo.js';
import { PROMPT_TEMPLATES, fillTemplate } from './promptTemplates.js';
import { logger } from '../utils/logger.js';

// AI 消息格式
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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

// 基础 chat 调用（OpenAI 兼容协议）
export async function callAI(
  messages: ChatMessage[],
  options?: { temperature?: number; timeoutMs?: number }
): Promise<string> {
  const cfg = getConfig();
  if (!cfg.api_key) {
    throw new Error('AI 未配置 API Key，请联系管理员在设置中配置');
  }
  const baseUrl = cfg.base_url.replace(/\/$/, '');
  // OpenAI 兼容协议：POST {base_url}/chat/completions
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model: cfg.model,
    messages,
    temperature: options?.temperature ?? cfg.temperature,
  };
  const timeoutMs = options?.timeoutMs ?? 60000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI 调用失败: HTTP ${response.status} ${text.slice(0, 200)}`);
    }
    const data = await response.json() as any;
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
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
  options?: { temperature?: number; timeoutMs?: number }
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
  options?: { temperature?: number; timeoutMs?: number }
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
