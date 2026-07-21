// Repository 基础工具函数：减少重复的 CRUD 操作代码
import { db } from '../db/index.js';

// 通用 JSON 解析（带容错）
export function parseJson<T>(val: string | null | undefined): T | null {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

// 通用数组解析（带容错）
export function parseArray<T = string>(val: string | null | undefined): T[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

// 字段映射类型
export type FieldMap<T> = Record<string, (val: any, input?: Partial<T>) => any>;

// 通用更新构建器：动态构建 UPDATE SQL
export function buildUpdateSQL<T extends Record<string, any>>(
  table: string,
  id: string,
  input: Partial<T>,
  fieldMap: FieldMap<T>
): boolean {
  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, transform] of Object.entries(fieldMap)) {
    if (input[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(transform(input[key], input));
    }
  }

  if (fields.length === 0) return false;
  
  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE ${table} SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values);
  return true;
}

// 通用分页查询构建器
export interface PaginatedQuery {
  page?: number;
  pageSize?: number;
  [key: string]: any;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export function buildPaginatedQuery<T>(
  table: string,
  query: PaginatedQuery,
  whereBuilder: (query: PaginatedQuery) => { where: string; params: any[] },
  rowMapper: (row: any) => T,
  orderBy: string = 'created_at DESC'
): PaginatedResult<T> {
  const { where, params } = whereBuilder(query);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const whereSql = where ? `WHERE ${where}` : '';
  
  const totalRow = db.prepare(
    `SELECT COUNT(*) as cnt FROM ${table} ${whereSql}`
  ).get(...params) as { cnt: number };

  const rows = db.prepare(
    `SELECT * FROM ${table} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset) as any[];

  return {
    data: rows.map(rowMapper),
    total: totalRow.cnt,
  };
}

// 通用单条查询
export function findById<T>(
  table: string,
  id: string,
  rowMapper: (row: any) => T
): T | null {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  return row ? rowMapper(row) : null;
}

// 通用删除
export function deleteById(table: string, id: string): void {
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
}

// 通用查询构建器（带多个 WHERE 条件）
export function buildWhereClause(
  conditions: Array<{ field: string; operator?: string; value: any } | null>
): { where: string; params: any[] } {
  const validConditions = conditions.filter(Boolean) as Array<{ field: string; operator?: string; value: any }>;
  
  if (validConditions.length === 0) {
    return { where: '', params: [] };
  }

  const clauses: string[] = [];
  const params: any[] = [];

  for (const cond of validConditions) {
    const op = cond.operator ?? '=';
    if (op === 'LIKE') {
      clauses.push(`${cond.field} LIKE ?`);
      params.push(`%${cond.value}%`);
    } else {
      clauses.push(`${cond.field} ${op} ?`);
      params.push(cond.value);
    }
  }

  return {
    where: clauses.join(' AND '),
    params,
  };
}

// 批量 LIKE 搜索构建器
export function buildLikeSearch(
  fields: string[],
  keyword: string
): { clause: string; params: string[] } | null {
  if (!keyword) return null;
  
  const kw = `%${keyword}%`;
  return {
    clause: fields.map(f => `${f} LIKE ?`).join(' OR '),
    params: fields.map(() => kw),
  };
}
