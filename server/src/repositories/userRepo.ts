// 用户数据访问层
import { db } from '../db/index.js';
import type { User, SafeUser, UserRole, UserStatus } from '../types/index.js';

// 行类型（数据库原始字段）
interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  real_name: string;
  department: string | null;
  role: string;
  status: string;
  created_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    password_hash: row.password_hash,
    real_name: row.real_name,
    department: row.department,
    role: row.role as UserRole,
    status: row.status as UserStatus,
    created_at: row.created_at,
  };
}

function toSafeUser(row: UserRow): SafeUser {
  const { password_hash, ...rest } = toUser(row);
  return rest;
}

export function findUserById(id: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function findUserByUsername(username: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function listUsers(): SafeUser[] {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all() as UserRow[];
  return rows.map(toSafeUser);
}

export interface CreateUserInput {
  id: string;
  username: string;
  password_hash: string;
  real_name: string;
  department?: string | null;
  role: UserRole;
  status?: UserStatus;
}

export function createUser(input: CreateUserInput): SafeUser {
  db.prepare(`
    INSERT INTO users (id, username, password_hash, real_name, department, role, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    input.id,
    input.username,
    input.password_hash,
    input.real_name,
    input.department ?? null,
    input.role,
    input.status ?? 'active'
  );
  const user = findUserById(input.id);
  if (!user) throw new Error('创建用户失败');
  const { password_hash, ...safe } = user;
  return safe;
}

export interface UpdateUserInput {
  real_name?: string;
  department?: string | null;
  role?: UserRole;
  status?: UserStatus;
}

export function updateUser(id: string, input: UpdateUserInput): SafeUser | null {
  const fields: string[] = [];
  const values: any[] = [];
  if (input.real_name !== undefined) { fields.push('real_name = ?'); values.push(input.real_name); }
  if (input.department !== undefined) { fields.push('department = ?'); values.push(input.department); }
  if (input.role !== undefined) { fields.push('role = ?'); values.push(input.role); }
  if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status); }
  if (fields.length === 0) {
    const u = findUserById(id);
    return u ? toSafeUser(u as UserRow) : null;
  }
  values.push(id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const user = findUserById(id);
  return user ? toSafeUser(user as UserRow) : null;
}

export function updatePassword(id: string, passwordHash: string): void {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
}

export function deleteUser(id: string): void {
  // 软删除：禁用账号
  db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(id);
}

export function hardDeleteUser(id: string): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}
