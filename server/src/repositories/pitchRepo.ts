// 话术数据访问层
import { db } from '../db/index.js';
import type { Pitch, PitchChannel, PitchScene, PitchStatus } from '../types/index.js';

interface PitchRow {
  id: string;
  match_id: string;
  owner_id: string;
  channel: string;
  scene: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function toPitch(row: PitchRow): Pitch {
  return {
    id: row.id,
    match_id: row.match_id,
    owner_id: row.owner_id,
    channel: row.channel as PitchChannel,
    scene: row.scene as PitchScene,
    content: row.content,
    status: row.status as PitchStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function findPitchById(id: string): Pitch | null {
  const row = db.prepare('SELECT * FROM pitches WHERE id = ?').get(id) as PitchRow | undefined;
  return row ? toPitch(row) : null;
}

export function listPitchesByMatch(matchId: string): Pitch[] {
  const rows = db.prepare('SELECT * FROM pitches WHERE match_id = ? ORDER BY channel, scene').all(matchId) as PitchRow[];
  return rows.map(toPitch);
}

export interface CreatePitchInput {
  id: string;
  match_id: string;
  owner_id: string;
  channel: PitchChannel;
  scene: PitchScene;
  content: string;
  status?: PitchStatus;
}

export function createPitch(input: CreatePitchInput): Pitch {
  db.prepare(`
    INSERT INTO pitches (id, match_id, owner_id, channel, scene, content, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    input.id,
    input.match_id,
    input.owner_id,
    input.channel,
    input.scene,
    input.content,
    input.status ?? 'pending'
  );
  const p = findPitchById(input.id);
  if (!p) throw new Error('创建话术失败');
  return p;
}

// 批量创建
export function createPitches(inputs: CreatePitchInput[]): Pitch[] {
  const tx = db.transaction((items: CreatePitchInput[]) => {
    for (const input of items) {
      db.prepare(`
        INSERT INTO pitches (id, match_id, owner_id, channel, scene, content, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        input.id,
        input.match_id,
        input.owner_id,
        input.channel,
        input.scene,
        input.content,
        input.status ?? 'pending'
      );
    }
  });
  tx(inputs);
  return inputs.map(i => findPitchById(i.id)!).filter(Boolean);
}

export interface UpdatePitchInput {
  content?: string;
  status?: PitchStatus;
}

export function updatePitch(id: string, input: UpdatePitchInput): Pitch | null {
  const fields: string[] = [];
  const values: any[] = [];
  if (input.content !== undefined) { fields.push('content = ?'); values.push(input.content); }
  if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status); }
  if (fields.length === 0) return findPitchById(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE pitches SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findPitchById(id);
}
