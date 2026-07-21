// 行为日志记录器（参考 AI 速聘 app/boss/action_log.py）
// 记录所有自动化操作，便于回溯封号原因和统计
//
// 支持两种模式：
// 1. 服务器直连模式（默认）：直接写入本地 SQLite 数据库
// 2. Agent 模式：通过 setLogHandler 注入转发器，把日志通过 WebSocket 发给服务器
//
// 注意：db 采用惰性加载，避免 Agent 端 import 本模块时触发数据库初始化
import { createRequire } from 'node:module';
import { nanoid } from 'nanoid';
import { logger } from '../../utils/logger.js';

const require = createRequire(import.meta.url);

// 惰性获取数据库实例（仅在服务器直连模式下真正使用）
let _db: any = null;
function getDb(): any {
  if (!_db) {
    _db = require('../../db/index.js').db;
  }
  return _db;
}

export interface ActionLog {
  userId: string;
  action: string;
  target?: string;
  detail?: any;
}

// 日志处理器类型：接收一条日志，由具体模式实现落库或转发
type LogHandler = (log: ActionLog) => void;

// 默认处理器：写入本地数据库（服务器直连模式）
const defaultDbHandler: LogHandler = (log) => {
  getDb().prepare(
    `INSERT INTO boss_action_logs (id, user_id, action, target, detail, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    nanoid(),
    log.userId,
    log.action,
    log.target || null,
    log.detail ? JSON.stringify(log.detail) : null
  );
};

// 当前生效的日志处理器（默认写本地库；Agent 模式下会被替换为 WebSocket 转发）
let logHandler: LogHandler = defaultDbHandler;

/**
 * 注入日志处理器（Agent 模式下用）
 * 传入 null 则恢复默认的数据库处理器
 */
export function setLogHandler(handler: LogHandler | null): void {
  logHandler = handler || defaultDbHandler;
}

/**
 * 记录一条行为日志
 */
export function logAction(log: ActionLog): void {
  try {
    logHandler(log);
  } catch (err: any) {
    logger.error('写入行为日志失败', err?.message);
  }
}

/**
 * 查询行为日志
 */
export function getActionLogs(
  userId: string,
  options: { limit?: number; offset?: number; action?: string } = {}
): any[] {
  const { limit = 100, offset = 0, action } = options;
  if (action) {
    return getDb().prepare(
      `SELECT * FROM boss_action_logs WHERE user_id = ? AND action = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(userId, action, limit, offset);
  }
  return getDb().prepare(
    `SELECT * FROM boss_action_logs WHERE user_id = ?
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(userId, limit, offset);
}

/**
 * 获取今日统计
 */
export function getTodayStat(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const logs = getDb().prepare(
    `SELECT action, COUNT(*) as count FROM boss_action_logs
     WHERE user_id = ? AND date(created_at) = ?
     GROUP BY action`
  ).all(userId, today) as Array<{ action: string; count: number }>;

  const stat: Record<string, number> = {};
  for (const row of logs) {
    stat[row.action] = row.count;
  }
  return {
    sayHello: stat['say_hello'] || 0,
    followUp: stat['follow_up'] || 0,
    reply: stat['reply'] || 0,
    browse: stat['browse'] || 0,
    aiChat: stat['ai_chat'] || 0,
  };
}
