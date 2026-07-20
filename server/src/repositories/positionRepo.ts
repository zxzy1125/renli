// 职位数据访问层
import { db } from '../db/index.js';
import type { Position } from '../types/index.js';

interface PositionRow {
  id: string;
  title: string;
  client_id: string | null;
  department: string | null;
  location: string | null;
  headcount: number | null;
  salary_min: string | null;
  salary_max: string | null;
  experience: string | null;
  education: string | null;
  job_type: string | null;
  work_mode: string | null;
  priority: string | null;
  status: string;
  jd: string | null;
  requirements: string | null;
  bonus: string | null;
  keywords: string | null;
  raw_text: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function parseArray(val: string | null): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

function toPosition(row: PositionRow): Position {
  return {
    id: row.id,
    title: row.title,
    client_id: row.client_id,
    department: row.department,
    location: row.location,
    headcount: row.headcount,
    salary_min: row.salary_min,
    salary_max: row.salary_max,
    experience: row.experience,
    education: row.education,
    job_type: row.job_type,
    work_mode: row.work_mode,
    priority: row.priority,
    status: row.status,
    jd: row.jd,
    requirements: row.requirements,
    bonus: row.bonus,
    keywords: parseArray(row.keywords),
    raw_text: row.raw_text,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function findPositionById(id: string): Position | null {
  const row = db.prepare('SELECT * FROM positions WHERE id = ?').get(id) as PositionRow | undefined;
  return row ? toPosition(row) : null;
}

export interface PositionQuery {
  keyword?: string;
  status?: string;
  client_id?: string;
  page?: number;
  pageSize?: number;
}

export function listPositions(query: PositionQuery = {}): { data: Position[]; total: number } {
  const where: string[] = [];
  const params: any[] = [];
  if (query.keyword) {
    where.push('(title LIKE ? OR jd LIKE ? OR requirements LIKE ? OR keywords LIKE ?)');
    const kw = `%${query.keyword}%`;
    params.push(kw, kw, kw, kw);
  }
  if (query.status) {
    where.push('status = ?');
    params.push(query.status);
  }
  if (query.client_id) {
    where.push('client_id = ?');
    params.push(query.client_id);
  }
  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM positions ${whereSql}`).get(...params) as { cnt: number };
  const rows = db.prepare(`SELECT * FROM positions ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as PositionRow[];
  return { data: rows.map(toPosition), total: totalRow.cnt };
}

export interface CreatePositionInput {
  id: string;
  title: string;
  client_id?: string | null;
  department?: string | null;
  location?: string | null;
  headcount?: number | null;
  salary_min?: string | null;
  salary_max?: string | null;
  experience?: string | null;
  education?: string | null;
  job_type?: string | null;
  work_mode?: string | null;
  priority?: string | null;
  status?: string;
  jd?: string | null;
  requirements?: string | null;
  bonus?: string | null;
  keywords?: string[];
  raw_text?: string | null;
  created_by: string;
}

export function createPosition(input: CreatePositionInput): Position {
  db.prepare(`
    INSERT INTO positions (
      id, title, client_id, department, location, headcount,
      salary_min, salary_max, experience, education, job_type, work_mode,
      priority, status, jd, requirements, bonus, keywords, raw_text,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    input.id,
    input.title,
    input.client_id ?? null,
    input.department ?? null,
    input.location ?? null,
    input.headcount ?? null,
    input.salary_min ?? null,
    input.salary_max ?? null,
    input.experience ?? null,
    input.education ?? null,
    input.job_type ?? null,
    input.work_mode ?? null,
    input.priority ?? null,
    input.status ?? 'open',
    input.jd ?? null,
    input.requirements ?? null,
    input.bonus ?? null,
    input.keywords ? JSON.stringify(input.keywords) : null,
    input.raw_text ?? null,
    input.created_by
  );
  const p = findPositionById(input.id);
  if (!p) throw new Error('创建职位失败');
  return p;
}

export interface UpdatePositionInput {
  title?: string;
  client_id?: string | null;
  department?: string | null;
  location?: string | null;
  headcount?: number | null;
  salary_min?: string | null;
  salary_max?: string | null;
  experience?: string | null;
  education?: string | null;
  job_type?: string | null;
  work_mode?: string | null;
  priority?: string | null;
  status?: string;
  jd?: string | null;
  requirements?: string | null;
  bonus?: string | null;
  keywords?: string[];
  raw_text?: string | null;
}

export function updatePosition(id: string, input: UpdatePositionInput): Position | null {
  const fields: string[] = [];
  const values: any[] = [];
  const setField = (col: string, val: any) => { fields.push(`${col} = ?`); values.push(val); };
  if (input.title !== undefined) setField('title', input.title);
  if (input.client_id !== undefined) setField('client_id', input.client_id);
  if (input.department !== undefined) setField('department', input.department);
  if (input.location !== undefined) setField('location', input.location);
  if (input.headcount !== undefined) setField('headcount', input.headcount);
  if (input.salary_min !== undefined) setField('salary_min', input.salary_min);
  if (input.salary_max !== undefined) setField('salary_max', input.salary_max);
  if (input.experience !== undefined) setField('experience', input.experience);
  if (input.education !== undefined) setField('education', input.education);
  if (input.job_type !== undefined) setField('job_type', input.job_type);
  if (input.work_mode !== undefined) setField('work_mode', input.work_mode);
  if (input.priority !== undefined) setField('priority', input.priority);
  if (input.status !== undefined) setField('status', input.status);
  if (input.jd !== undefined) setField('jd', input.jd);
  if (input.requirements !== undefined) setField('requirements', input.requirements);
  if (input.bonus !== undefined) setField('bonus', input.bonus);
  if (input.keywords !== undefined) setField('keywords', input.keywords ? JSON.stringify(input.keywords) : null);
  if (input.raw_text !== undefined) setField('raw_text', input.raw_text);
  if (fields.length === 0) return findPositionById(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE positions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findPositionById(id);
}

export function updatePositionStatus(id: string, status: string): Position | null {
  db.prepare("UPDATE positions SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  return findPositionById(id);
}

export function deletePosition(id: string): void {
  db.prepare('DELETE FROM positions WHERE id = ?').run(id);
}
