// 客户公司数据访问层
import { db } from '../db/index.js';
import type { Client } from '../types/index.js';

interface ClientRow {
  id: string;
  name: string;
  contact_name: string | null;
  contact_phone: string | null;
  industry: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    contact_name: row.contact_name,
    contact_phone: row.contact_phone,
    industry: row.industry,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

export function findClientById(id: string): Client | null {
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as ClientRow | undefined;
  return row ? toClient(row) : null;
}

export function listClients(): Client[] {
  const rows = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all() as ClientRow[];
  return rows.map(toClient);
}

export interface CreateClientInput {
  id: string;
  name: string;
  contact_name?: string | null;
  contact_phone?: string | null;
  industry?: string | null;
  notes?: string | null;
  created_by: string;
}

export function createClient(input: CreateClientInput): Client {
  db.prepare(`
    INSERT INTO clients (id, name, contact_name, contact_phone, industry, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    input.id,
    input.name,
    input.contact_name ?? null,
    input.contact_phone ?? null,
    input.industry ?? null,
    input.notes ?? null,
    input.created_by
  );
  const c = findClientById(input.id);
  if (!c) throw new Error('创建客户公司失败');
  return c;
}

export interface UpdateClientInput {
  name?: string;
  contact_name?: string | null;
  contact_phone?: string | null;
  industry?: string | null;
  notes?: string | null;
}

export function updateClient(id: string, input: UpdateClientInput): Client | null {
  const fields: string[] = [];
  const values: any[] = [];
  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.contact_name !== undefined) { fields.push('contact_name = ?'); values.push(input.contact_name); }
  if (input.contact_phone !== undefined) { fields.push('contact_phone = ?'); values.push(input.contact_phone); }
  if (input.industry !== undefined) { fields.push('industry = ?'); values.push(input.industry); }
  if (input.notes !== undefined) { fields.push('notes = ?'); values.push(input.notes); }
  if (fields.length === 0) return findClientById(id);
  values.push(id);
  db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findClientById(id);
}

export function deleteClient(id: string): void {
  db.prepare('DELETE FROM clients WHERE id = ?').run(id);
}
