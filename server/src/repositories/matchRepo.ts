// 匹配数据访问层
import { db } from '../db/index.js';
import type { Match } from '../types/index.js';

interface MatchRow {
  id: string;
  position_id: string;
  resume_id: string;
  owner_id: string;
  status: string;
  score: number | null;
  highlights: string | null;
  concerns: string | null;
  salary_analysis: string | null;
  conversion_probability: number | null;
  created_at: string;
  updated_at: string;
}

function parseAny(val: string | null, fallback: any): any {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function toMatch(row: MatchRow): Match {
  return {
    id: row.id,
    position_id: row.position_id,
    resume_id: row.resume_id,
    owner_id: row.owner_id,
    status: row.status,
    score: row.score,
    highlights: parseAny(row.highlights, []),
    concerns: parseAny(row.concerns, []),
    salary_analysis: parseAny(row.salary_analysis, {}),
    conversion_probability: row.conversion_probability,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function findMatchById(id: string): Match | null {
  const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(id) as MatchRow | undefined;
  return row ? toMatch(row) : null;
}

export interface MatchQuery {
  owner_id?: string;
  position_id?: string;
  resume_id?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export function listMatches(query: MatchQuery = {}): { data: Match[]; total: number } {
  const where: string[] = [];
  const params: any[] = [];
  if (query.owner_id) { where.push('owner_id = ?'); params.push(query.owner_id); }
  if (query.position_id) { where.push('position_id = ?'); params.push(query.position_id); }
  if (query.resume_id) { where.push('resume_id = ?'); params.push(query.resume_id); }
  if (query.status) { where.push('status = ?'); params.push(query.status); }
  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM matches ${whereSql}`).get(...params) as { cnt: number };
  const rows = db.prepare(`SELECT * FROM matches ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as MatchRow[];
  return { data: rows.map(toMatch), total: totalRow.cnt };
}

export interface CreateMatchInput {
  id: string;
  position_id: string;
  resume_id: string;
  owner_id: string;
  status?: string;
  score?: number | null;
  highlights?: any[];
  concerns?: any[];
  salary_analysis?: any;
  conversion_probability?: number | null;
}

export function createMatch(input: CreateMatchInput): Match {
  db.prepare(`
    INSERT INTO matches (
      id, position_id, resume_id, owner_id, status, score,
      highlights, concerns, salary_analysis, conversion_probability,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    input.id,
    input.position_id,
    input.resume_id,
    input.owner_id,
    input.status ?? 'consulting',
    input.score ?? null,
    input.highlights ? JSON.stringify(input.highlights) : null,
    input.concerns ? JSON.stringify(input.concerns) : null,
    input.salary_analysis ? JSON.stringify(input.salary_analysis) : null,
    input.conversion_probability ?? null
  );
  const m = findMatchById(input.id);
  if (!m) throw new Error('创建匹配失败');
  return m;
}

export function updateMatchStatus(id: string, status: string): Match | null {
  db.prepare("UPDATE matches SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  return findMatchById(id);
}

export function updateMatch(id: string, input: Partial<CreateMatchInput>): Match | null {
  const fields: string[] = [];
  const values: any[] = [];
  const setField = (col: string, val: any) => { fields.push(`${col} = ?`); values.push(val); };
  if (input.status !== undefined) setField('status', input.status);
  if (input.score !== undefined) setField('score', input.score);
  if (input.highlights !== undefined) setField('highlights', input.highlights ? JSON.stringify(input.highlights) : null);
  if (input.concerns !== undefined) setField('concerns', input.concerns ? JSON.stringify(input.concerns) : null);
  if (input.salary_analysis !== undefined) setField('salary_analysis', input.salary_analysis ? JSON.stringify(input.salary_analysis) : null);
  if (input.conversion_probability !== undefined) setField('conversion_probability', input.conversion_probability);
  if (fields.length === 0) return findMatchById(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE matches SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findMatchById(id);
}

export function deleteMatch(id: string): void {
  db.prepare('DELETE FROM matches WHERE id = ?').run(id);
}

// 返回所有已存在的 positionId:resumeId 组合，用于智能匹配去重
export function findExistingMatchKeys(): Set<string> {
  const rows = db.prepare('SELECT position_id, resume_id FROM matches').all() as Array<{ position_id: string; resume_id: string }>;
  return new Set(rows.map(r => `${r.position_id}:${r.resume_id}`));
}
