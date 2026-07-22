// 简历数据访问层
import { db } from '../db/index.js';
import type { Resume } from '../types/index.js';
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

interface ResumeRow {
  id: string;
  name: string;
  age: string | null;
  education: string | null;
  current_company: string | null;
  current_title: string | null;
  work_experience: string | null;
  skills: string | null;
  projects: string | null;
  expectation: string | null;
  expected_city: string | null;
  raw_text: string | null;
  source: string | null;
  phone_masked: string | null;
  phone_hash: string | null;
  email_masked: string | null;
  email_original: string | null;
  has_wechat: number;
  wechat_id: string | null;
  contact_preference: string | null;
  candidate_status: string | null;
  expected_onboard_date: string | null;
  tags: string | null;
  common_grounds: string | null;
  risk_warning: string | null;
  remark: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

// 带默认值的 JSON 解析
function parseObjectWithDefault(val: string | null, fallback: any): any {
  const parsed = parseJson(val);
  return parsed ?? fallback;
}

function toResume(row: ResumeRow): Resume {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    education: row.education,
    current_company: row.current_company,
    current_title: row.current_title,
    work_experience: row.work_experience,
    skills: row.skills,
    projects: row.projects,
    expectation: row.expectation,
    expected_city: row.expected_city,
    raw_text: row.raw_text,
    source: row.source,
    phone_masked: row.phone_masked,
    phone_hash: row.phone_hash,
    email_masked: row.email_masked,
    email_original: row.email_original,
    has_wechat: row.has_wechat,
    wechat_id: row.wechat_id,
    contact_preference: row.contact_preference,
    candidate_status: row.candidate_status,
    expected_onboard_date: row.expected_onboard_date,
    tags: parseArray(row.tags),
    common_grounds: parseObjectWithDefault(row.common_grounds, {}),
    risk_warning: parseObjectWithDefault(row.risk_warning, { isRisky: false, reasons: [] }),
    remark: row.remark,
    owner_id: row.owner_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function findResumeById(id: string): Resume | null {
  return findById('resumes', id, toResume);
}

export interface ResumeQuery extends PaginatedQuery {
  keyword?: string;
  owner_id?: string;
  candidate_status?: string;
}

export function listResumes(query: ResumeQuery = {}): PaginatedResult<Resume> {
  return buildPaginatedQuery(
    'resumes',
    query,
    (q) => {
      const conditions: Array<{ field: string; operator?: string; value: any } | null> = [];
      
      // 所有者筛选
      if (q.owner_id) {
        conditions.push({ field: 'owner_id', value: q.owner_id });
      }
      
      // 关键词搜索
      const likeSearch = buildLikeSearch(
        ['name', 'current_company', 'current_title', 'skills', 'tags'],
        q.keyword || ''
      );
      if (likeSearch) {
        conditions.push({ field: `(${likeSearch.clause})`, value: likeSearch.params });
      }
      
      // 候选人状态筛选
      if (q.candidate_status) {
        conditions.push({ field: 'candidate_status', value: q.candidate_status });
      }
      
      return buildWhereClause(conditions);
    },
    toResume
  );
}

// 查询全部简历（无分页，用于撞单检测等）
export function findAllResumes(): Resume[] {
  const rows = db.prepare('SELECT * FROM resumes ORDER BY created_at DESC').all() as ResumeRow[];
  return rows.map(toResume);
}

// 通过 phone_hash 查询
export function findResumesByPhoneHash(phoneHash: string, excludeId?: string): Resume[] {
  const sql = excludeId
    ? 'SELECT * FROM resumes WHERE phone_hash = ? AND id != ?'
    : 'SELECT * FROM resumes WHERE phone_hash = ?';
  const params = excludeId ? [phoneHash, excludeId] : [phoneHash];
  const rows = db.prepare(sql).all(...params) as ResumeRow[];
  return rows.map(toResume);
}

// 通过 email 查询
export function findResumesByEmail(email: string, excludeId?: string): Resume[] {
  const sql = excludeId
    ? 'SELECT * FROM resumes WHERE email_original = ? AND id != ?'
    : 'SELECT * FROM resumes WHERE email_original = ?';
  const params = excludeId ? [email, excludeId] : [email];
  const rows = db.prepare(sql).all(...params) as ResumeRow[];
  return rows.map(toResume);
}

// 通过 name + current_company 弱匹配
export function findResumesByNameAndCompany(name: string, company: string, excludeId?: string): Resume[] {
  const where = ['name = ?', 'current_company = ?'];
  const params: any[] = [name, company];
  if (excludeId) { where.push('id != ?'); params.push(excludeId); }
  const rows = db.prepare(`SELECT * FROM resumes WHERE ${where.join(' AND ')}`).all(...params) as ResumeRow[];
  return rows.map(toResume);
}

export interface CreateResumeInput {
  id: string;
  name: string;
  age?: string | null;
  education?: string | null;
  current_company?: string | null;
  current_title?: string | null;
  work_experience?: string | null;
  skills?: string | null;
  projects?: string | null;
  expectation?: string | null;
  expected_city?: string | null;
  raw_text?: string | null;
  source?: string | null;
  phone_masked?: string | null;
  phone_hash?: string | null;
  email_masked?: string | null;
  email_original?: string | null;
  has_wechat?: number;
  wechat_id?: string | null;
  contact_preference?: string | null;
  candidate_status?: string | null;
  expected_onboard_date?: string | null;
  tags?: string[];
  common_grounds?: Record<string, string>;
  risk_warning?: { isRisky: boolean; reasons: string[] };
  remark?: string | null;
  owner_id: string;
}

export function createResume(input: CreateResumeInput): Resume {
  db.prepare(`
    INSERT INTO resumes (
      id, name, age, education, current_company, current_title,
      work_experience, skills, projects, expectation, expected_city,
      raw_text, source, phone_masked, phone_hash, email_masked, email_original,
      has_wechat, wechat_id, contact_preference, candidate_status,
      expected_onboard_date, tags, common_grounds, risk_warning, remark,
      owner_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    input.id,
    input.name,
    input.age ?? null,
    input.education ?? null,
    input.current_company ?? null,
    input.current_title ?? null,
    input.work_experience ?? null,
    input.skills ?? null,
    input.projects ?? null,
    input.expectation ?? null,
    input.expected_city ?? null,
    input.raw_text ?? null,
    input.source ?? null,
    input.phone_masked ?? null,
    input.phone_hash ?? null,
    input.email_masked ?? null,
    input.email_original ?? null,
    input.has_wechat ?? 0,
    input.wechat_id ?? null,
    input.contact_preference ?? 'wechat',
    input.candidate_status ?? 'passive',
    input.expected_onboard_date ?? null,
    input.tags ? JSON.stringify(input.tags) : null,
    input.common_grounds ? JSON.stringify(input.common_grounds) : null,
    input.risk_warning ? JSON.stringify(input.risk_warning) : null,
    input.remark ?? null,
    input.owner_id
  );
  const r = findResumeById(input.id);
  if (!r) throw new Error('创建简历失败');
  return r;
}

export interface UpdateResumeInput {
  name?: string;
  age?: string | null;
  education?: string | null;
  current_company?: string | null;
  current_title?: string | null;
  work_experience?: string | null;
  skills?: string | null;
  projects?: string | null;
  expectation?: string | null;
  expected_city?: string | null;
  raw_text?: string | null;
  source?: string | null;
  phone_masked?: string | null;
  phone_hash?: string | null;
  email_masked?: string | null;
  email_original?: string | null;
  has_wechat?: number;
  wechat_id?: string | null;
  contact_preference?: string | null;
  candidate_status?: string | null;
  expected_onboard_date?: string | null;
  tags?: string[];
  common_grounds?: Record<string, string>;
  risk_warning?: { isRisky: boolean; reasons: string[] };
  remark?: string | null;
}

// 字段映射配置
const resumeFieldMap: FieldMap<UpdateResumeInput> = {
  name: (v) => v,
  age: (v) => v ?? null,
  education: (v) => v ?? null,
  current_company: (v) => v ?? null,
  current_title: (v) => v ?? null,
  work_experience: (v) => v ?? null,
  skills: (v) => v ?? null,
  projects: (v) => v ?? null,
  expectation: (v) => v ?? null,
  expected_city: (v) => v ?? null,
  raw_text: (v) => v ?? null,
  source: (v) => v ?? null,
  phone_masked: (v) => v ?? null,
  phone_hash: (v) => v ?? null,
  email_masked: (v) => v ?? null,
  email_original: (v) => v ?? null,
  has_wechat: (v) => v,
  wechat_id: (v) => v ?? null,
  contact_preference: (v) => v ?? null,
  candidate_status: (v) => v ?? null,
  expected_onboard_date: (v) => v ?? null,
  tags: (v) => v ? JSON.stringify(v) : null,
  common_grounds: (v) => v ? JSON.stringify(v) : null,
  risk_warning: (v) => v ? JSON.stringify(v) : null,
  remark: (v) => v ?? null,
};

export function updateResume(id: string, input: UpdateResumeInput): Resume | null {
  buildUpdateSQL('resumes', id, input, resumeFieldMap);
  return findResumeById(id);
}

export function deleteResume(id: string): void {
  deleteById('resumes', id);
}

// 按多个 candidate_status 查询（无分页，用于智能匹配）
export function findResumesByCandidateStatuses(statuses: string[]): Resume[] {
  if (statuses.length === 0) return [];
  const placeholders = statuses.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM resumes WHERE candidate_status IN (${placeholders}) ORDER BY created_at DESC`).all(...statuses) as ResumeRow[];
  return rows.map(toResume);
}
