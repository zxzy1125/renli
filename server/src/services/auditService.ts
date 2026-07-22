// 审计日志服务：复用现有 audit_logs 表
import { db } from '../db/index.js';
import { nanoid } from 'nanoid';

interface AuditEntry {
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  detail?: Record<string, unknown>;
}

export function writeAudit(entry: AuditEntry): void {
  try {
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      nanoid(),
      entry.userId,
      entry.action,
      entry.entityType ?? null,
      entry.entityId ?? null,
      entry.detail ? JSON.stringify(entry.detail) : null,
    );
  } catch (err) {
    // 审计写入失败不应阻塞业务，仅记录警告
    console.error('[audit] 写入失败', err);
  }
}

export function getAuditLogs(opts: {
  userId?: string;
  entityType?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}) {
  const { userId, entityType, action, page = 1, pageSize = 20 } = opts;
  const where: string[] = [];
  const params: unknown[] = [];

  if (userId) { where.push('user_id = ?'); params.push(userId); }
  if (entityType) { where.push('entity_type = ?'); params.push(entityType); }
  if (action) { where.push('action = ?'); params.push(action); }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) as count FROM audit_logs ${whereClause}`).get(...params) as { count: number };
  const data = db.prepare(
    `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, (page - 1) * pageSize);

  return { data, total: total.count };
}
