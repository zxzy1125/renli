// 数据库连接与初始化
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件目录
const dataDir = path.resolve(__dirname, '../../data');
const dbPath = path.join(dataDir, 'recruit.db');

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库实例（同步 API）
export const db = new Database(dbPath);

// 开启 WAL 模式以提升并发读性能
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 初始化数据库：执行 schema.sql
export function initDatabase(): void {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);
  // schema.sql 用 CREATE TABLE IF NOT EXISTS，对已存在的表不会加新列
  // 这里手动 migrate：给旧库补 ai_meta / source_filename / source_ext 等新增列
  migratePositions();
  // 给 ai_config 补多模态相关列（老库没有）
  migrateAiConfig();
}

// 已有 positions 表补列（ALTER TABLE ADD COLUMN，先检查列是否存在）
function migratePositions(): void {
  const cols = db.prepare("PRAGMA table_info(positions)").all() as Array<{ name: string }>;
  const exists = new Set(cols.map((c) => c.name));
  const addColumnIfMissing = (col: string, decl: string) => {
    if (!exists.has(col)) {
      db.exec(`ALTER TABLE positions ADD COLUMN ${col} ${decl}`);
    }
  };
  addColumnIfMissing('ai_meta', 'TEXT');
  addColumnIfMissing('source_filename', 'TEXT');
  addColumnIfMissing('source_ext', 'TEXT');
}

// ai_config 表补多模态列（mm_*）
function migrateAiConfig(): void {
  const cols = db.prepare("PRAGMA table_info(ai_config)").all() as Array<{ name: string }>;
  const exists = new Set(cols.map((c) => c.name));
  const addColumnIfMissing = (col: string, decl: string) => {
    if (!exists.has(col)) {
      db.exec(`ALTER TABLE ai_config ADD COLUMN ${col} ${decl}`);
    }
  };
  addColumnIfMissing('mm_enabled', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('mm_provider', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('mm_api_key', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('mm_base_url', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('mm_model', "TEXT NOT NULL DEFAULT ''");
}

// 自动执行初始化
initDatabase();
