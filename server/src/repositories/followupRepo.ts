// 回访计划与记录数据访问层
import { db } from '../db/index.js';
import type { FollowupPlan, FollowupRecord, FollowupPlanType } from '../types/index.js';

interface PlanRow {
  id: string;
  resume_id: string;
  employee_id: string;
  title: string;
  type: string;
  interval_days: number | null;
  max_times: number | null;
  remind_date: string | null;
  custom_dates: string | null;
  purpose: string | null;
  position_ids: string | null;
  status: string;
  next_remind_date: string;
  completed_times: number;
  created_at: string;
  updated_at: string;
}

function parseArray(val: string | null): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

function toPlan(row: PlanRow): FollowupPlan {
  return {
    id: row.id,
    resume_id: row.resume_id,
    employee_id: row.employee_id,
    title: row.title,
    type: row.type as FollowupPlanType,
    interval_days: row.interval_days,
    max_times: row.max_times,
    remind_date: row.remind_date,
    custom_dates: parseArray(row.custom_dates),
    purpose: row.purpose,
    position_ids: parseArray(row.position_ids),
    status: row.status,
    next_remind_date: row.next_remind_date,
    completed_times: row.completed_times,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ===== 计划 =====

export function findPlanById(id: string): FollowupPlan | null {
  const row = db.prepare('SELECT * FROM followup_plans WHERE id = ?').get(id) as PlanRow | undefined;
  return row ? toPlan(row) : null;
}

export interface PlanQuery {
  employee_id?: string;
  status?: string;
  resume_id?: string;
}

export function listPlans(query: PlanQuery = {}): FollowupPlan[] {
  const where: string[] = [];
  const params: any[] = [];
  if (query.employee_id) { where.push('employee_id = ?'); params.push(query.employee_id); }
  if (query.status) { where.push('status = ?'); params.push(query.status); }
  if (query.resume_id) { where.push('resume_id = ?'); params.push(query.resume_id); }
  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM followup_plans ${whereSql} ORDER BY next_remind_date ASC`).all(...params) as PlanRow[];
  return rows.map(toPlan);
}

// 今日待回访
export function listTodayPlans(employeeId?: string): FollowupPlan[] {
  const sql = employeeId
    ? "SELECT * FROM followup_plans WHERE status = 'active' AND date(next_remind_date) = date('now') AND employee_id = ? ORDER BY next_remind_date ASC"
    : "SELECT * FROM followup_plans WHERE status = 'active' AND date(next_remind_date) = date('now') ORDER BY next_remind_date ASC";
  const rows = (employeeId ? db.prepare(sql).all(employeeId) : db.prepare(sql).all()) as PlanRow[];
  return rows.map(toPlan);
}

// 逾期未回访
export function listOverduePlans(employeeId?: string): FollowupPlan[] {
  const sql = employeeId
    ? "SELECT * FROM followup_plans WHERE status = 'active' AND date(next_remind_date) < date('now') AND employee_id = ? ORDER BY next_remind_date ASC"
    : "SELECT * FROM followup_plans WHERE status = 'active' AND date(next_remind_date) < date('now') ORDER BY next_remind_date ASC";
  const rows = (employeeId ? db.prepare(sql).all(employeeId) : db.prepare(sql).all()) as PlanRow[];
  return rows.map(toPlan);
}

export interface CreatePlanInput {
  id: string;
  resume_id: string;
  employee_id: string;
  title: string;
  type: FollowupPlanType;
  interval_days?: number | null;
  max_times?: number | null;
  remind_date?: string | null;
  custom_dates?: string[];
  purpose?: string | null;
  position_ids?: string[];
  status?: string;
  next_remind_date: string;
  completed_times?: number;
}

export function createPlan(input: CreatePlanInput): FollowupPlan {
  db.prepare(`
    INSERT INTO followup_plans (
      id, resume_id, employee_id, title, type, interval_days, max_times,
      remind_date, custom_dates, purpose, position_ids, status,
      next_remind_date, completed_times, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    input.id,
    input.resume_id,
    input.employee_id,
    input.title,
    input.type,
    input.interval_days ?? null,
    input.max_times ?? 5,
    input.remind_date ?? null,
    input.custom_dates ? JSON.stringify(input.custom_dates) : null,
    input.purpose ?? null,
    input.position_ids ? JSON.stringify(input.position_ids) : null,
    input.status ?? 'active',
    input.next_remind_date,
    input.completed_times ?? 0
  );
  const p = findPlanById(input.id);
  if (!p) throw new Error('创建回访计划失败');
  return p;
}

export interface UpdatePlanInput {
  title?: string;
  type?: FollowupPlanType;
  interval_days?: number | null;
  max_times?: number | null;
  remind_date?: string | null;
  custom_dates?: string[];
  purpose?: string | null;
  position_ids?: string[];
  status?: string;
  next_remind_date?: string;
  completed_times?: number;
}

export function updatePlan(id: string, input: UpdatePlanInput): FollowupPlan | null {
  const fields: string[] = [];
  const values: any[] = [];
  const setField = (col: string, val: any) => { fields.push(`${col} = ?`); values.push(val); };
  if (input.title !== undefined) setField('title', input.title);
  if (input.type !== undefined) setField('type', input.type);
  if (input.interval_days !== undefined) setField('interval_days', input.interval_days);
  if (input.max_times !== undefined) setField('max_times', input.max_times);
  if (input.remind_date !== undefined) setField('remind_date', input.remind_date);
  if (input.custom_dates !== undefined) setField('custom_dates', input.custom_dates ? JSON.stringify(input.custom_dates) : null);
  if (input.purpose !== undefined) setField('purpose', input.purpose);
  if (input.position_ids !== undefined) setField('position_ids', input.position_ids ? JSON.stringify(input.position_ids) : null);
  if (input.status !== undefined) setField('status', input.status);
  if (input.next_remind_date !== undefined) setField('next_remind_date', input.next_remind_date);
  if (input.completed_times !== undefined) setField('completed_times', input.completed_times);
  if (fields.length === 0) return findPlanById(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE followup_plans SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findPlanById(id);
}

export function deletePlan(id: string): void {
  db.prepare('DELETE FROM followup_plans WHERE id = ?').run(id);
}

// ===== 记录 =====

interface RecordRow {
  id: string;
  plan_id: string | null;
  resume_id: string;
  employee_id: string;
  followup_date: string;
  contact_channel: string | null;
  result: string | null;
  note: string | null;
  introduced_positions: string | null;
  next_action: string | null;
  created_at: string;
}

function toRecord(row: RecordRow): FollowupRecord {
  return {
    id: row.id,
    plan_id: row.plan_id,
    resume_id: row.resume_id,
    employee_id: row.employee_id,
    followup_date: row.followup_date,
    contact_channel: row.contact_channel,
    result: row.result,
    note: row.note,
    introduced_positions: parseArray(row.introduced_positions),
    next_action: row.next_action,
    created_at: row.created_at,
  };
}

export function findRecordById(id: string): FollowupRecord | null {
  const row = db.prepare('SELECT * FROM followup_records WHERE id = ?').get(id) as RecordRow | undefined;
  return row ? toRecord(row) : null;
}

export function listRecords(query: { plan_id?: string; resume_id?: string; employee_id?: string } = {}): FollowupRecord[] {
  const where: string[] = [];
  const params: any[] = [];
  if (query.plan_id) { where.push('plan_id = ?'); params.push(query.plan_id); }
  if (query.resume_id) { where.push('resume_id = ?'); params.push(query.resume_id); }
  if (query.employee_id) { where.push('employee_id = ?'); params.push(query.employee_id); }
  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM followup_records ${whereSql} ORDER BY followup_date DESC, created_at DESC`).all(...params) as RecordRow[];
  return rows.map(toRecord);
}

export interface CreateRecordInput {
  id: string;
  plan_id?: string | null;
  resume_id: string;
  employee_id: string;
  followup_date: string;
  contact_channel?: string | null;
  result?: string | null;
  note?: string | null;
  introduced_positions?: string[];
  next_action?: string | null;
}

export function createRecord(input: CreateRecordInput): FollowupRecord {
  db.prepare(`
    INSERT INTO followup_records (
      id, plan_id, resume_id, employee_id, followup_date,
      contact_channel, result, note, introduced_positions, next_action, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    input.id,
    input.plan_id ?? null,
    input.resume_id,
    input.employee_id,
    input.followup_date,
    input.contact_channel ?? null,
    input.result ?? null,
    input.note ?? null,
    input.introduced_positions ? JSON.stringify(input.introduced_positions) : null,
    input.next_action ?? null
  );
  const r = findRecordById(input.id);
  if (!r) throw new Error('创建回访记录失败');
  return r;
}

// 计算下一个回访日期
export function computeNextRemindDate(plan: FollowupPlan): string | null {
  if (plan.type === 'once') {
    return null; // 一次性计划完成即结束
  }
  if (plan.type === 'recurring' && plan.interval_days) {
    const today = new Date();
    today.setDate(today.getDate() + plan.interval_days);
    return today.toISOString().slice(0, 10);
  }
  if (plan.type === 'custom' && plan.custom_dates && plan.custom_dates.length > 0) {
    // 找下一个未完成的日期
    const today = new Date().toISOString().slice(0, 10);
    const next = plan.custom_dates.find(d => d > today);
    return next ?? null;
  }
  return null;
}
