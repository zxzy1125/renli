// 简历数据访问层
import { db } from '../db/index.js';
import type { Resume } from '../types/index.js';

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

function parseArray(val: string | null): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

function parseObject(val: string | null, fallback: any): any {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
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
    common_grounds: parseObject(row.common_grounds, {}),
    risk_warning: parseObject(row.risk_warning, { isRisky: false, reasons: [] }),
    remark: row.remark,
    owner_id: row.owner_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function findResumeById(id: string): Resume | null {
  const row = db.prepare('SELECT * FROM resumes WHERE id = ?').get(id) as ResumeRow | undefined;
  return row ? toResume(row) : null;
}

export interface ResumeQuery {
  keyword?: string;
  owner_id?: string; // 仅查某员工
  candidate_status?: string;
  page?: number;
  pageSize?: number;
}

export function listResumes(query: ResumeQuery = {}): { data: Resume[]; total: number } {
  const where: string[] = [];
  const params: any[] = [];
  if (query.owner_id) {
    where.push('owner_id = ?');
    params.push(query.owner_id);
  }
  if (query.keyword) {
    where.push('(name LIKE ? OR current_company LIKE ? OR current_title LIKE ? OR skills LIKE ? OR tags LIKE ?)');
    const kw = `%${query.keyword}%`;
    params.push(kw, kw, kw, kw, kw);
  }
  if (query.candidate_status) {
    where.push('candidate_status = ?');
    params.push(query.candidate_status);
  }
  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM resumes ${whereSql}`).get(...params) as { cnt: number };
  const rows = db.prepare(`SELECT * FROM resumes ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as ResumeRow[];
  return { data: rows.map(toResume), total: totalRow.cnt };
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

export function updateResume(id: string, input: UpdateResumeInput): Resume | null {
  const fields: string[] = [];
  const values: any[] = [];
  const setField = (col: string, val: any) => { fields.push(`${col} = ?`); values.push(val); };
  if (input.name !== undefined) setField('name', input.name);
  if (input.age !== undefined) setField('age', input.age);
  if (input.education !== undefined) setField('education', input.education);
  if (input.current_company !== undefined) setField('current_company', input.current_company);
  if (input.current_title !== undefined) setField('current_title', input.current_title);
  if (input.work_experience !== undefined) setField('work_experience', input.work_experience);
  if (input.skills !== undefined) setField('skills', input.skills);
  if (input.projects !== undefined) setField('projects', input.projects);
  if (input.expectation !== undefined) setField('expectation', input.expectation);
  if (input.expected_city !== undefined) setField('expected_city', input.expected_city);
  if (input.raw_text !== undefined) setField('raw_text', input.raw_text);
  if (input.source !== undefined) setField('source', input.source);
  if (input.phone_masked !== undefined) setField('phone_masked', input.phone_masked);
  if (input.phone_hash !== undefined) setField('phone_hash', input.phone_hash);
  if (input.email_masked !== undefined) setField('email_masked', input.email_masked);
  if (input.email_original !== undefined) setField('email_original', input.email_original);
  if (input.has_wechat !== undefined) setField('has_wechat', input.has_wechat);
  if (input.wechat_id !== undefined) setField('wechat_id', input.wechat_id);
  if (input.contact_preference !== undefined) setField('contact_preference', input.contact_preference);
  if (input.candidate_status !== undefined) setField('candidate_status', input.candidate_status);
  if (input.expected_onboard_date !== undefined) setField('expected_onboard_date', input.expected_onboard_date);
  if (input.tags !== undefined) setField('tags', input.tags ? JSON.stringify(input.tags) : null);
  if (input.common_grounds !== undefined) setField('common_grounds', input.common_grounds ? JSON.stringify(input.common_grounds) : null);
  if (input.risk_warning !== undefined) setField('risk_warning', input.risk_warning ? JSON.stringify(input.risk_warning) : null);
  if (input.remark !== undefined) setField('remark', input.remark);
  if (fields.length === 0) return findResumeById(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE resumes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findResumeById(id);
}

export function deleteResume(id: string): void {
  db.prepare('DELETE FROM resumes WHERE id = ?').run(id);
}
