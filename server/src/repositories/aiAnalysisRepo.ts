// AI 分析记录 + AI 配置 数据访问层
import { db } from '../db/index.js';
import type { AiAnalysisRecord, AiConfig } from '../types/index.js';

// ===== AI 分析记录 =====

interface AnalysisRow {
  id: string;
  followup_record_id: string | null;
  type: string;
  input: string | null;
  output: string | null;
  review_status: string;
  created_at: string;
}

function parseAny(val: string | null, fallback: any): any {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function toAnalysis(row: AnalysisRow): AiAnalysisRecord {
  return {
    id: row.id,
    followup_record_id: row.followup_record_id,
    type: row.type,
    input: parseAny(row.input, {}),
    output: parseAny(row.output, {}),
    review_status: row.review_status,
    created_at: row.created_at,
  };
}

export function findAnalysisById(id: string): AiAnalysisRecord | null {
  const row = db.prepare('SELECT * FROM ai_analysis_records WHERE id = ?').get(id) as AnalysisRow | undefined;
  return row ? toAnalysis(row) : null;
}

export function listAnalysisByRecord(followupRecordId: string): AiAnalysisRecord[] {
  const rows = db.prepare('SELECT * FROM ai_analysis_records WHERE followup_record_id = ? ORDER BY created_at DESC').all(followupRecordId) as AnalysisRow[];
  return rows.map(toAnalysis);
}

export interface CreateAnalysisInput {
  id: string;
  followup_record_id?: string | null;
  type: string;
  input?: any;
  output?: any;
  review_status?: string;
}

export function createAnalysis(input: CreateAnalysisInput): AiAnalysisRecord {
  db.prepare(`
    INSERT INTO ai_analysis_records (id, followup_record_id, type, input, output, review_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    input.id,
    input.followup_record_id ?? null,
    input.type,
    input.input ? JSON.stringify(input.input) : null,
    input.output ? JSON.stringify(input.output) : null,
    input.review_status ?? 'pending'
  );
  const a = findAnalysisById(input.id);
  if (!a) throw new Error('创建 AI 分析记录失败');
  return a;
}

// ===== AI 配置 =====

interface ConfigRow {
  id: string;
  provider: string;
  api_key: string;
  base_url: string;
  model: string;
  temperature: number;
  prompts: string | null;
  mm_enabled: number;
  mm_provider: string;
  mm_api_key: string;
  mm_base_url: string;
  mm_model: string;
  updated_at: string;
}

function toConfig(row: ConfigRow): AiConfig {
  return {
    id: row.id,
    provider: row.provider,
    api_key: row.api_key,
    base_url: row.base_url,
    model: row.model,
    temperature: row.temperature,
    prompts: parseAny(row.prompts, {}),
    mm_enabled: row.mm_enabled ?? 0,
    mm_provider: row.mm_provider ?? '',
    mm_api_key: row.mm_api_key ?? '',
    mm_base_url: row.mm_base_url ?? '',
    mm_model: row.mm_model ?? '',
    updated_at: row.updated_at,
  };
}

export function getAiConfig(): AiConfig | null {
  const row = db.prepare('SELECT * FROM ai_config LIMIT 1').get() as ConfigRow | undefined;
  return row ? toConfig(row) : null;
}

export interface UpdateAiConfigInput {
  provider?: string;
  api_key?: string;
  base_url?: string;
  model?: string;
  temperature?: number;
  prompts?: Record<string, { system: string; user: string }>;
  // 多模态字段
  mm_enabled?: number;
  mm_provider?: string;
  mm_api_key?: string;
  mm_base_url?: string;
  mm_model?: string;
}

export function updateAiConfig(input: UpdateAiConfigInput): AiConfig | null {
  const existing = getAiConfig();
  if (!existing) return null;
  const fields: string[] = [];
  const values: any[] = [];
  if (input.provider !== undefined) { fields.push('provider = ?'); values.push(input.provider); }
  if (input.api_key !== undefined) { fields.push('api_key = ?'); values.push(input.api_key); }
  if (input.base_url !== undefined) { fields.push('base_url = ?'); values.push(input.base_url); }
  if (input.model !== undefined) { fields.push('model = ?'); values.push(input.model); }
  if (input.temperature !== undefined) { fields.push('temperature = ?'); values.push(input.temperature); }
  if (input.prompts !== undefined) { fields.push('prompts = ?'); values.push(JSON.stringify(input.prompts)); }
  if (input.mm_enabled !== undefined) { fields.push('mm_enabled = ?'); values.push(input.mm_enabled); }
  if (input.mm_provider !== undefined) { fields.push('mm_provider = ?'); values.push(input.mm_provider); }
  if (input.mm_api_key !== undefined) { fields.push('mm_api_key = ?'); values.push(input.mm_api_key); }
  if (input.mm_base_url !== undefined) { fields.push('mm_base_url = ?'); values.push(input.mm_base_url); }
  if (input.mm_model !== undefined) { fields.push('mm_model = ?'); values.push(input.mm_model); }
  if (fields.length === 0) return existing;
  fields.push("updated_at = datetime('now')");
  values.push(existing.id);
  db.prepare(`UPDATE ai_config SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getAiConfig();
}
