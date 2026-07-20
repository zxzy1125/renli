// 撞单数据访问层
import { db } from '../db/index.js';
import type { ConflictRecord, ConflictStatus, ConflictMatchField } from '../types/index.js';

interface ConflictRow {
  id: string;
  candidate_name: string;
  phone_hash: string | null;
  email: string | null;
  resume_id_a: string;
  resume_id_b: string;
  employee_id_a: string;
  employee_id_b: string;
  match_field: string;
  status: string;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

function toConflict(row: ConflictRow): ConflictRecord {
  return {
    id: row.id,
    candidate_name: row.candidate_name,
    phone_hash: row.phone_hash,
    email: row.email,
    resume_id_a: row.resume_id_a,
    resume_id_b: row.resume_id_b,
    employee_id_a: row.employee_id_a,
    employee_id_b: row.employee_id_b,
    match_field: row.match_field as ConflictMatchField,
    status: row.status as ConflictStatus,
    note: row.note,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
  };
}

export function findConflictById(id: string): ConflictRecord | null {
  const row = db.prepare('SELECT * FROM conflict_records WHERE id = ?').get(id) as ConflictRow | undefined;
  return row ? toConflict(row) : null;
}

export function listConflicts(query: { status?: string } = {}): ConflictRecord[] {
  const sql = query.status
    ? 'SELECT * FROM conflict_records WHERE status = ? ORDER BY created_at DESC'
    : 'SELECT * FROM conflict_records ORDER BY created_at DESC';
  const rows = (query.status ? db.prepare(sql).all(query.status) : db.prepare(sql).all()) as ConflictRow[];
  return rows.map(toConflict);
}

export interface CreateConflictInput {
  id: string;
  candidate_name: string;
  phone_hash?: string | null;
  email?: string | null;
  resume_id_a: string;
  resume_id_b: string;
  employee_id_a: string;
  employee_id_b: string;
  match_field: ConflictMatchField;
  status?: ConflictStatus;
  note?: string | null;
}

export function createConflict(input: CreateConflictInput): ConflictRecord {
  db.prepare(`
    INSERT INTO conflict_records (
      id, candidate_name, phone_hash, email, resume_id_a, resume_id_b,
      employee_id_a, employee_id_b, match_field, status, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    input.id,
    input.candidate_name,
    input.phone_hash ?? null,
    input.email ?? null,
    input.resume_id_a,
    input.resume_id_b,
    input.employee_id_a,
    input.employee_id_b,
    input.match_field,
    input.status ?? 'pending',
    input.note ?? null
  );
  const c = findConflictById(input.id);
  if (!c) throw new Error('创建撞单记录失败');
  return c;
}

export function resolveConflict(id: string, status: ConflictStatus, resolvedBy: string, note?: string): ConflictRecord | null {
  db.prepare(`
    UPDATE conflict_records SET status = ?, resolved_at = datetime('now'), resolved_by = ?, note = ? WHERE id = ?
  `).run(status, resolvedBy, note ?? null, id);
  return findConflictById(id);
}
