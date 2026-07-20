// 对话会话数据访问层（BOSS 实时对话辅助）
import { db } from '../db/index.js';

// 对话会话
export interface ChatSession {
  id: string;
  position_id: string;
  resume_id?: string | null;
  owner_id: string;
  title?: string | null;
  status: string;
  candidate_name?: string | null;
  last_message_at?: string | null;
  created_at: string;
  updated_at: string;
}

// 对话消息
export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'candidate' | 'hr';
  content: string;
  ai_analysis?: any | null;
  selected_reply?: any | null;
  created_at: string;
}

interface ChatSessionRow {
  id: string;
  position_id: string;
  resume_id: string | null;
  owner_id: string;
  title: string | null;
  status: string;
  candidate_name: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatMessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  ai_analysis: string | null;
  selected_reply: string | null;
  created_at: string;
}

function parseAny(val: string | null, fallback: any): any {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function toSession(row: ChatSessionRow): ChatSession {
  return {
    id: row.id,
    position_id: row.position_id,
    resume_id: row.resume_id,
    owner_id: row.owner_id,
    title: row.title,
    status: row.status,
    candidate_name: row.candidate_name,
    last_message_at: row.last_message_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    session_id: row.session_id,
    role: row.role as 'candidate' | 'hr',
    content: row.content,
    ai_analysis: parseAny(row.ai_analysis, null),
    selected_reply: parseAny(row.selected_reply, null),
    created_at: row.created_at,
  };
}

// 查找会话
export function findSessionById(id: string): ChatSession | null {
  const row = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id) as ChatSessionRow | undefined;
  return row ? toSession(row) : null;
}

// 列出会话（按 owner 过滤，普通员工只看自己的，管理员可看全部）
export interface SessionQuery {
  owner_id?: string;
  status?: string;
  position_id?: string;
  resume_id?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export function listSessions(query: SessionQuery = {}): { data: ChatSession[]; total: number } {
  const where: string[] = [];
  const params: any[] = [];
  if (query.owner_id) { where.push('owner_id = ?'); params.push(query.owner_id); }
  if (query.status) { where.push('status = ?'); params.push(query.status); }
  if (query.position_id) { where.push('position_id = ?'); params.push(query.position_id); }
  if (query.resume_id) { where.push('resume_id = ?'); params.push(query.resume_id); }
  if (query.keyword) {
    where.push('(title LIKE ? OR candidate_name LIKE ?)');
    params.push(`%${query.keyword}%`, `%${query.keyword}%`);
  }
  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const offset = (page - 1) * pageSize;
  const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM chat_sessions ${whereSql}`).get(...params) as { cnt: number };
  const rows = db.prepare(`SELECT * FROM chat_sessions ${whereSql} ORDER BY COALESCE(last_message_at, created_at) DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as ChatSessionRow[];
  return { data: rows.map(toSession), total: totalRow.cnt };
}

// 创建会话
export interface CreateSessionInput {
  id: string;
  position_id: string;
  resume_id?: string | null;
  owner_id: string;
  title?: string | null;
  candidate_name?: string | null;
}

export function createSession(input: CreateSessionInput): ChatSession {
  db.prepare(`
    INSERT INTO chat_sessions (id, position_id, resume_id, owner_id, title, status, candidate_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))
  `).run(
    input.id,
    input.position_id,
    input.resume_id ?? null,
    input.owner_id,
    input.title ?? null,
    input.candidate_name ?? null
  );
  const s = findSessionById(input.id);
  if (!s) throw new Error('创建会话失败');
  return s;
}

// 更新会话
export function updateSession(id: string, input: Partial<{
  title: string;
  status: string;
  resume_id: string | null;
  candidate_name: string;
}>): ChatSession | null {
  const fields: string[] = [];
  const values: any[] = [];
  const setField = (col: string, val: any) => { fields.push(`${col} = ?`); values.push(val); };
  if (input.title !== undefined) setField('title', input.title);
  if (input.status !== undefined) setField('status', input.status);
  if (input.resume_id !== undefined) setField('resume_id', input.resume_id);
  if (input.candidate_name !== undefined) setField('candidate_name', input.candidate_name);
  if (fields.length === 0) return findSessionById(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE chat_sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findSessionById(id);
}

// 删除会话（连带消息）
export function deleteSession(id: string): void {
  db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(id);
}

// 列出会话的所有消息（按时间正序）
export function listMessages(sessionId: string): ChatMessage[] {
  const rows = db.prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId) as ChatMessageRow[];
  return rows.map(toMessage);
}

// 查找单条消息
export function findMessageById(id: string): ChatMessage | null {
  const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as ChatMessageRow | undefined;
  return row ? toMessage(row) : null;
}

// 创建消息
export interface CreateMessageInput {
  id: string;
  session_id: string;
  role: 'candidate' | 'hr';
  content: string;
  ai_analysis?: any | null;
  selected_reply?: any | null;
}

export function createMessage(input: CreateMessageInput): ChatMessage {
  db.prepare(`
    INSERT INTO chat_messages (id, session_id, role, content, ai_analysis, selected_reply, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    input.id,
    input.session_id,
    input.role,
    input.content,
    input.ai_analysis ? JSON.stringify(input.ai_analysis) : null,
    input.selected_reply ? JSON.stringify(input.selected_reply) : null
  );
  // 更新会话最后消息时间
  db.prepare("UPDATE chat_sessions SET last_message_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .run(input.session_id);
  const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(input.id) as ChatMessageRow;
  return toMessage(row);
}

// 更新消息（用于 HR 选定某条回复策略后写回 selected_reply）
export function updateMessage(id: string, input: Partial<{
  ai_analysis: any;
  selected_reply: any;
}>): ChatMessage | null {
  const fields: string[] = [];
  const values: any[] = [];
  if (input.ai_analysis !== undefined) {
    fields.push('ai_analysis = ?');
    values.push(input.ai_analysis ? JSON.stringify(input.ai_analysis) : null);
  }
  if (input.selected_reply !== undefined) {
    fields.push('selected_reply = ?');
    values.push(input.selected_reply ? JSON.stringify(input.selected_reply) : null);
  }
  if (fields.length === 0) {
    const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as ChatMessageRow | undefined;
    return row ? toMessage(row) : null;
  }
  values.push(id);
  db.prepare(`UPDATE chat_messages SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as ChatMessageRow | undefined;
  return row ? toMessage(row) : null;
}

// 删除消息
export function deleteMessage(id: string): void {
  db.prepare('DELETE FROM chat_messages WHERE id = ?').run(id);
}
