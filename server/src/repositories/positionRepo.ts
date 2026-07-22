// 职位数据访问层
import { db } from '../db/index.js';
import type { Position } from '../types/index.js';
import {
  parseArray,
  parseJson,
  findById,
  deleteById,
  buildUpdateSQL,
  buildPaginatedQuery,
  buildLikeSearch,
  buildWhereClause,
  type FieldMap,
  type PaginatedQuery,
  type PaginatedResult,
} from './base.js';

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
  ai_meta: string | null;
  source_filename: string | null;
  source_ext: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// 行映射器
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
    ai_meta: parseJson(row.ai_meta),
    source_filename: row.source_filename,
    source_ext: row.source_ext,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function findPositionById(id: string): Position | null {
  return findById('positions', id, toPosition);
}

export interface PositionQuery extends PaginatedQuery {
  keyword?: string;
  status?: string;
  client_id?: string;
}

export function listPositions(query: PositionQuery = {}): PaginatedResult<Position> {
  return buildPaginatedQuery(
    'positions',
    query,
    (q) => {
      const conditions: Array<{ field: string; operator?: string; value: any } | null> = [];
      
      // 关键词搜索
      const likeSearch = buildLikeSearch(
        ['title', 'jd', 'requirements', 'keywords'],
        q.keyword || ''
      );
      if (likeSearch) {
        conditions.push({ field: `(${likeSearch.clause})`, value: likeSearch.params });
      }
      
      // 状态筛选
      if (q.status) {
        conditions.push({ field: 'status', value: q.status });
      }
      
      // 客户筛选
      if (q.client_id) {
        conditions.push({ field: 'client_id', value: q.client_id });
      }
      
      return buildWhereClause(conditions);
    },
    toPosition
  );
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
  ai_meta?: Record<string, unknown> | null;
  source_filename?: string | null;
  source_ext?: string | null;
  created_by: string;
}

export function createPosition(input: CreatePositionInput): Position {
  db.prepare(`
    INSERT INTO positions (
      id, title, client_id, department, location, headcount,
      salary_min, salary_max, experience, education, job_type, work_mode,
      priority, status, jd, requirements, bonus, keywords, raw_text,
      ai_meta, source_filename, source_ext,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
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
    input.ai_meta ? JSON.stringify(input.ai_meta) : null,
    input.source_filename ?? null,
    input.source_ext ?? null,
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
  ai_meta?: Record<string, unknown> | null;
  source_filename?: string | null;
  source_ext?: string | null;
}

// 字段映射配置
const positionFieldMap: FieldMap<UpdatePositionInput> = {
  title: (v) => v,
  client_id: (v) => v ?? null,
  department: (v) => v ?? null,
  location: (v) => v ?? null,
  headcount: (v) => v ?? null,
  salary_min: (v) => v ?? null,
  salary_max: (v) => v ?? null,
  experience: (v) => v ?? null,
  education: (v) => v ?? null,
  job_type: (v) => v ?? null,
  work_mode: (v) => v ?? null,
  priority: (v) => v ?? null,
  status: (v) => v,
  jd: (v) => v ?? null,
  requirements: (v) => v ?? null,
  bonus: (v) => v ?? null,
  keywords: (v) => v ? JSON.stringify(v) : null,
  raw_text: (v) => v ?? null,
  ai_meta: (v) => v ? JSON.stringify(v) : null,
  source_filename: (v) => v ?? null,
  source_ext: (v) => v ?? null,
};

export function updatePosition(id: string, input: UpdatePositionInput): Position | null {
  buildUpdateSQL('positions', id, input, positionFieldMap);
  return findPositionById(id);
}

export function updatePositionStatus(id: string, status: string): Position | null {
  buildUpdateSQL('positions', id, { status }, { status: (v) => v });
  return findPositionById(id);
}

export function deletePosition(id: string): void {
  deleteById('positions', id);
}

// 按状态查询全部职位（无分页，用于智能匹配）
export function findAllPositionsByStatus(status: string): Position[] {
  const rows = db.prepare('SELECT * FROM positions WHERE status = ? ORDER BY created_at DESC').all(status) as PositionRow[];
  return rows.map(toPosition);
}
