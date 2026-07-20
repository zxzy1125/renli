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
}

// 自动执行初始化
initDatabase();
