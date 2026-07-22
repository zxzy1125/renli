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

// Docker 模式下 PROJECT_ROOT 从环境变量读取（docker-compose.yml 中挂载的宿主机目录）
const DOCKER_MODE = process.env.DOCKER_MODE === 'true';
const PROJECT_ROOT = process.env.PROJECT_ROOT || '/opt/recruit-tool';
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
  res.json({ ...readStatus(), dockerMode: DOCKER_MODE });
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
    res.json({ currentBranch, behind, commits, dockerMode: DOCKER_MODE });
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
    dockerMode: DOCKER_MODE,
  };
  fs.writeFileSync(STATUS_FILE, JSON.stringify(initialStatus, null, 2));

  // 根据部署模式生成不同的更新脚本
  const script = DOCKER_MODE ? buildDockerScript() : buildPm2Script();

  fs.writeFileSync(SCRIPT_FILE, script, { mode: 0o755 });

  // 以 detached 方式启动脚本
  const child = spawn('bash', [SCRIPT_FILE], {
    detached: true,
    stdio: 'ignore',
    cwd: PROJECT_ROOT,
  });
  child.unref();

  logger.info(`系统更新已触发 (${DOCKER_MODE ? 'Docker' : 'PM2'} 模式)`, { pid: child.pid });
  res.json({ ok: true, message: '更新已开始，请稍候...' });
}));

// ===== PM2 模式更新脚本（传统部署：git pull → npm install → npm run build → cp dist → pm2 restart）=====
function buildPm2Script(): string {
  return `#!/bin/bash
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
  INSTALL_OUT=$(npm install --no-audit --no-fund 2>&1) || {
    INSTALL_OUT2=$(npm install --no-audit --no-fund --omit=optional 2>&1) || { update_status "install" "error" "$INSTALL_OUT2"; exit 1; }
    INSTALL_OUT="$INSTALL_OUT\\n[可选依赖安装失败，已降级跳过]"
  }
  update_status "install" "success"
else
  update_status "install" "skipped"
fi

# Step 3: npm run build
update_status "build" "running"
BUILD_OUT=$(npm run build 2>&1)
BUILD_EXIT=$?
echo "$BUILD_OUT" > "$PROJECT_ROOT/logs/build.log"
if [ $BUILD_EXIT -ne 0 ]; then
  ERR_SUMMARY=$(echo "$BUILD_OUT" | tail -n 10 | tr '\\n' ' ' | head -c 500)
  update_status "build" "error" "$ERR_SUMMARY（完整日志见 logs/build.log）"
  exit 1
fi
update_status "build" "success"

# Step 4: 部署前端
update_status "copy" "running"
mkdir -p /var/www/renli
cp -r dist/* /var/www/renli/ || { update_status "copy" "error" "复制前端文件失败"; exit 1; }
update_status "copy" "success"

# Step 5: 重启服务
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
}

// ===== Docker 模式更新脚本（git pull → docker compose build → 独立容器执行 docker compose up -d）=====
// 核心难点：backend 容器不能直接执行 docker compose up -d（会杀掉自己），
// 解决方案：通过 docker socket 启动一个独立的 docker:27-cli 容器来执行重建，
// 该容器不受 backend 容器重建影响
function buildDockerScript(): string {
  return `#!/bin/bash
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

# Step 1: git pull（在 backend 容器内执行，项目目录已挂载，安全）
update_status "pull" "running"
PULL_OUT=$(git pull 2>&1) || { update_status "pull" "error" "$PULL_OUT"; exit 1; }
update_status "pull" "success" "$PULL_OUT"

# Step 2: 安装依赖（Docker 模式下依赖在镜像里，跳过）
update_status "install" "skipped" "Docker 模式：依赖在镜像构建时安装"

# Step 3: docker compose build（通过 docker socket 在宿主机构建新镜像，不重建容器，安全）
update_status "build" "running" "正在构建 Docker 镜像..."
BUILD_OUT=$(docker compose build 2>&1)
BUILD_EXIT=$?
echo "$BUILD_OUT" > "$PROJECT_ROOT/logs/build.log"
if [ $BUILD_EXIT -ne 0 ]; then
  ERR_SUMMARY=$(echo "$BUILD_OUT" | tail -n 10 | tr '\\n' ' ' | head -c 500)
  update_status "build" "error" "$ERR_SUMMARY（完整日志见 logs/build.log）"
  exit 1
fi
update_status "build" "success" "镜像构建完成"

# Step 4: 部署前端（Docker 模式下前端在镜像里，跳过）
update_status "copy" "skipped" "Docker 模式：前端在镜像内"

# Step 5: 重建容器
# 先标记完成状态（状态文件在挂载目录里，新容器能读到）
node -e "
  const fs = require('fs');
  const s = JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
  s.status = 'completed';
  s.completedAt = new Date().toISOString();
  s.step = 'restart';
  s.steps['restart'] = { status: 'success' };
  fs.writeFileSync(process.argv[1], JSON.stringify(s, null, 2));
" "$STATUS_FILE"

# 通过独立容器执行 docker compose up -d（避免 backend 容器自我毁灭）
# setsid 创建独立进程 → docker run 启动 docker:27-cli 容器 → 在其中执行 compose up
# 即使 backend 容器被重建杀掉，dockerd 已接受请求，docker:27-cli 容器会继续完成重建
setsid bash -c '
  sleep 2
  cd "$PROJECT_ROOT"
  docker run --rm \\
    -v /var/run/docker.sock:/var/run/docker.sock \\
    -v "$PROJECT_ROOT":"$PROJECT_ROOT" \\
    -w "$PROJECT_ROOT" \\
    docker:27-cli \\
    docker compose up -d --remove-orphans
' &
`;
}
