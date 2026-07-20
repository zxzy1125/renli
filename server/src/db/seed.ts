// 种子数据：默认管理员账号 + 默认 AI 配置
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { db } from './index.js';
import { PROMPT_TEMPLATES } from '../services/promptTemplates.js';
import type { User, AiConfig } from '../types/index.js';

// 初始化种子数据（幂等）
export function seedDatabase(): void {
  // 1. 创建默认管理员
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (id, username, password_hash, real_name, department, role, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      nanoid(),
      'admin',
      passwordHash,
      '系统管理员',
      '管理部',
      'admin',
      'active'
    );
    console.log('[seed] 默认管理员账号已创建：admin / admin123');
  }

  // 2. 创建默认 AI 配置（全局单条）
  const existingConfig = db.prepare('SELECT id FROM ai_config LIMIT 1').get();
  if (!existingConfig) {
    db.prepare(`
      INSERT INTO ai_config (id, provider, api_key, base_url, model, temperature, prompts, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      nanoid(),
      'openai',
      '',
      'https://open.bigmodel.cn/api/paas/v4',
      'glm-4-plus',
      0.7,
      JSON.stringify(PROMPT_TEMPLATES),
    );
    console.log('[seed] 默认 AI 配置已创建');
  }
}

// 获取管理员账号（用于测试）
export function getDefaultAdmin(): User | null {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get('admin') as User | undefined;
  return row ?? null;
}

// 获取 AI 配置
export function getAiConfig(): AiConfig | null {
  const row = db.prepare('SELECT * FROM ai_config LIMIT 1').get() as AiConfig | undefined;
  if (!row) return null;
  return row;
}
