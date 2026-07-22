// 数据库自动备份服务：启动时备份，保留最近 7 天
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../utils/logger.js';

const DB_PATH = path.resolve(process.cwd(), 'server/data/recruit.db');
const BACKUP_DIR = path.resolve(process.cwd(), 'server/data/backups');
const MAX_BACKUPS = 7;

export function startBackupService(): void {
  try {
    if (!fs.existsSync(DB_PATH)) {
      logger.warn('[backup] 数据库文件不存在，跳过备份');
      return;
    }

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(BACKUP_DIR, `recruit-${timestamp}.db`);

    fs.copyFileSync(DB_PATH, backupPath);
    logger.info(`[backup] 数据库已备份: ${backupPath}`);

    // 清理超过 MAX_BACKUPS 的旧备份（按文件名倒序，即最新在前）
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('recruit-') && f.endsWith('.db'))
      .sort()
      .reverse();

    for (const old of backups.slice(MAX_BACKUPS)) {
      fs.unlinkSync(path.join(BACKUP_DIR, old));
      logger.info(`[backup] 已清理旧备份: ${old}`);
    }
  } catch (err) {
    logger.error('[backup] 备份失败', String(err));
  }
}
