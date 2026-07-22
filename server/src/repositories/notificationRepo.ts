// 通知 Repository
import { db } from '../db/index.js';
import { nanoid } from 'nanoid';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: number;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

export function createNotification(opts: {
  userId: string;
  type?: string;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string;
}): Notification {
  const id = nanoid();
  db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(id, opts.userId, opts.type ?? 'info', opts.title, opts.message ?? null, opts.entityType ?? null, opts.entityId ?? null);
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as Notification;
}

export function listNotifications(userId: string, opts: { page?: number; pageSize?: number; unreadOnly?: boolean }) {
  const { page = 1, pageSize = 20, unreadOnly = false } = opts;
  const where = unreadOnly ? 'WHERE user_id = ? AND is_read = 0' : 'WHERE user_id = ?';
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM notifications ${where}`).get(userId) as { cnt: number }).cnt;
  const data = db.prepare(
    `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(userId, pageSize, (page - 1) * pageSize) as Notification[];
  return { data, total };
}

export function getUnreadCount(userId: string): number {
  return (db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0').get(userId) as { cnt: number }).cnt;
}

export function markAsRead(id: string, userId: string): boolean {
  const result = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

export function markAllAsRead(userId: string): void {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(userId);
}
