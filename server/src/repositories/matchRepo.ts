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

// 批量填充关联的 resume 和 position 信息
function enrichMatches(matches: Match[]): Match[] {
  if (matches.length === 0) return matches;

  const resumeIds = [...new Set(matches.map(m => m.resume_id))];
  const positionIds = [...new Set(matches.map(m => m.position_id))];

  const resumeMap = new Map<string, any>();
  if (resumeIds.length > 0) {
    const placeholders = resumeIds.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT id, name, age, education, current_company, current_title,
              skills, expected_city, candidate_status, risk_warning, tags, owner_id
       FROM resumes WHERE id IN (${placeholders})`
    ).all(...resumeIds) as any[];
    for (const r of rows) {
      resumeMap.set(r.id, {
        id: r.id,
        name: r.name,
        age: r.age,
        education: r.education,
        current_company: r.current_company,
        current_title: r.current_title,
        skills: r.skills,
        expected_city: r.expected_city,
        candidate_status: r.candidate_status,
        risk_warning: parseAny(r.risk_warning, null),
        tags: parseAny(r.tags, []),
        owner_id: r.owner_id,
      });
    }
  }

  const positionMap = new Map<string, any>();
  if (positionIds.length > 0) {
    const placeholders = positionIds.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT id, title, client_id, department, location, salary_min, salary_max,
              experience, education, status
       FROM positions WHERE id IN (${placeholders})`
    ).all(...positionIds) as any[];
    for (const p of rows) {
      positionMap.set(p.id, {
        id: p.id,
        title: p.title,
        client_id: p.client_id,
        department: p.department,
        location: p.location,
        salary_min: p.salary_min,
        salary_max: p.salary_max,
        experience: p.experience,
        education: p.education,
        status: p.status,
      });
    }
  }

  return matches.map(m => ({
    ...m,
    resume: resumeMap.get(m.resume_id) ?? undefined,
    position: positionMap.get(m.position_id) ?? undefined,
  }));
}

export function findMatchById(id: string): Match | null {
  const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(id) as MatchRow | undefined;
  if (!row) return null;
  return enrichMatches([toMatch(row)])[0];
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
  return { data: enrichMatches(rows.map(toMatch)), total: totalRow.cnt };
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
