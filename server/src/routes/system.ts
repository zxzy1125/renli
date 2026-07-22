// 系统管理路由（管理员）
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logger } from '../utils/logger.js';
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';

export const systemRouter = Router();

systemRouter.use(requireAuth, requireAdmin);

const PROJECT_ROOT = '/opt/recruit-tool';
const STATUS_FILE = path.join(PROJECT_ROOT, 'logs', 'update-status.json');
const SCRIPT_FILE = path.join(PROJECT_ROOT, 'logs', 'update.sh');
const COOLDOWN_MS = 60_000;

function readStatus(): Record<string, any> {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch {
    return { status: 'idle' };
  }
}

// GET /api/system/update-status
systemRouter.get('/update-status', (_req, res) => {
  res.json(readStatus());
});

// GET /api/system/git-status
systemRouter.get('/git-status', asyncHandler(async (_req, res) => {
  if (!fs.existsSync(PROJECT_ROOT)) {
    throw new ApiError(400, '在线更新仅在服务器环境可用');
  }
  try {
    execSync('git fetch origin', { cwd: PROJECT_ROOT, timeout: 10_000, stdio: 'pipe' });
  } catch (err: any) {
    throw new ApiError(500, `git fetch 失败: ${err.message}`);
  }
  try {
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: PROJECT_ROOT, timeout: 5_000 })
      .toString().trim();
    const behindRaw = execSync('git rev-list HEAD..origin/main --count', { cwd: PROJECT_ROOT, timeout: 5_000 })
      .toString().trim();
    const behind = parseInt(behindRaw, 10) || 0;
    let commits: string[] = [];
    if (behind > 0) {
      const log = execSync('git log HEAD..origin/main --oneline', { cwd: PROJECT_ROOT, timeout: 5_000 })
        .toString().trim();
      commits = log ? log.split('\n') : [];
    }
    res.json({ currentBranch, behind, commits });
  } catch (err: any) {
    throw new ApiError(500, `获取 git 状态失败: ${err.message}`);
  }
}));

// POST /api/system/update
systemRouter.post('/update', asyncHandler(async (_req, res) => {
  if (!fs.existsSync(PROJECT_ROOT)) {
    throw new ApiError(400, '在线更新仅在服务器环境可用');
  }

  const status = readStatus();

  // 并发检测
  if (status.status === 'running') {
    throw new ApiError(409, '更新正在进行中，请等待完成');
  }

  // 冷却期检测
  if (status.completedAt) {
    const elapsed = Date.now() - new Date(status.completedAt).getTime();
    if (elapsed < COOLDOWN_MS) {
      throw new ApiError(429, `更新刚刚完成，请等待 ${Math.ceil((COOLDOWN_MS - elapsed) / 1000)} 秒后再试`);
    }
  }

  // 确保 logs 目录存在
  const logsDir = path.join(PROJECT_ROOT, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // 写初始状态
  const initialStatus = {
    status: 'running',
    step: 'pull',
    steps: {} as Record<string, { status: string; message?: string }>,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(STATUS_FILE, JSON.stringify(initialStatus, null, 2));

  // 写 shell 脚本
  const script = `#!/bin/bash
PROJECT_ROOT="${PROJECT_ROOT}"
STATUS_FILE="${STATUS_FILE}"

update_status() {
  local step="$1" st="$2" msg="$3"
  node -e "
    const fs = require('fs');
    const s = JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
    s.steps[process.argv[2]] = { status: process.argv[3], message: process.argv[4] || '' };
    s.step = process.argv[2];
    s.updatedAt = new Date().toISOString();
    if (process.argv[3] === 'error') s.status = 'error';
    fs.writeFileSync(process.argv[1], JSON.stringify(s, null, 2));
  " "$STATUS_FILE" "$step" "$st" "$msg"
}

cd "$PROJECT_ROOT" || exit 1

# Step 1: git pull
update_status "pull" "running"
PULL_OUT=$(git pull 2>&1) || { update_status "pull" "error" "$PULL_OUT"; exit 1; }
update_status "pull" "success" "$PULL_OUT"

# Step 2: npm install（仅当 package 文件有变更时）
if echo "$PULL_OUT" | grep -q "package"; then
  update_status "install" "running"
  INSTALL_OUT=$(npm install 2>&1) || { update_status "install" "error" "$INSTALL_OUT"; exit 1; }
  update_status "install" "success"
else
  update_status "install" "skipped"
fi

# Step 3: npm run build
update_status "build" "running"
BUILD_OUT=$(npm run build 2>&1) || { update_status "build" "error" "$BUILD_OUT"; exit 1; }
update_status "build" "success"

# Step 4: 部署前端
update_status "copy" "running"
mkdir -p /var/www/renli
cp -r dist/* /var/www/renli/ || { update_status "copy" "error" "复制前端文件失败"; exit 1; }
update_status "copy" "success"

# Step 5: 重启服务（setsid 创建独立进程，避免 pm2 restart 杀掉父进程树）
# 先标记全部完成（前端 5 秒倒计时足够 pm2 重启完毕）
node -e "
  const fs = require('fs');
  const s = JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
  s.status = 'completed';
  s.completedAt = new Date().toISOString();
  s.step = 'restart';
  s.steps['restart'] = { status: 'success' };
  fs.writeFileSync(process.argv[1], JSON.stringify(s, null, 2));
" "$STATUS_FILE"

setsid bash -c 'sleep 1 && pm2 restart recruit-api' &
`;

  fs.writeFileSync(SCRIPT_FILE, script, { mode: 0o755 });

  // 以 detached 方式启动脚本
  const child = spawn('bash', [SCRIPT_FILE], {
    detached: true,
    stdio: 'ignore',
    cwd: PROJECT_ROOT,
  });
  child.unref();

  logger.info('系统更新已触发', { pid: child.pid });
  res.json({ ok: true, message: '更新已开始，请稍候...' });
}));
