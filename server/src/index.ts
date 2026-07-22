// Express 应用入口
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { WebSocketServer } from 'ws';

// 引入数据库初始化（执行 schema + seed）
import './db/index.js';
import { seedDatabase } from './db/seed.js';

// 路由
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { clientsRouter } from './routes/clients.js';
import { positionsRouter } from './routes/positions.js';
import { resumesRouter } from './routes/resumes.js';
import { matchesRouter } from './routes/matches.js';
import { pitchesRouter } from './routes/pitches.js';
import { followupsRouter } from './routes/followups.js';
import { conflictsRouter } from './routes/conflicts.js';
import { aiRouter } from './routes/ai.js';
import { aiConfigRouter } from './routes/aiConfig.js';
import { reportsRouter } from './routes/reports.js';
import { guidelinesRouter } from './routes/guidelines.js';
import { chatRouter } from './routes/chat.js';
import { bossAutoRouter } from './routes/boss-auto.js';
import { searchRouter } from './routes/search.js';
import { notificationsRouter } from './routes/notifications.js';

// Boss 自动化：Agent WebSocket 服务
import { setupAgentWebSocket } from './boss/agent-ws.js';

// 中间件
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { requestLogger } from './middleware/requestLogger.js';
import { startBackupService } from './services/backupService.js';
import { logger } from './utils/logger.js';

const PORT = Number(process.env.PORT) || 3001;

// 初始化种子数据
seedDatabase();

const app = express();

// 安全中间件
app.use(helmet());
// CORS 白名单（可通过 CORS_ORIGINS 环境变量配置，逗号分隔）
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('CORS 不允许该来源'));
    }
  },
  credentials: true,
}));
// 解析 JSON 请求体（限制 5MB 以支持简历原文上传）
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 登录接口限流：15分钟内最多 5 次
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: '登录尝试过多，请 15 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI 接口限流：1分钟内最多 30 次
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'AI 请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 确保上传目录存在
const uploadsDir = path.resolve(process.cwd(), 'server/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 请求日志
app.use(requestLogger);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'recruit-server', time: new Date().toISOString() });
});

// 挂载路由（统一前缀 /api）
app.use('/api/auth', loginLimiter, authRouter);
app.use('/api/users', usersRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/resumes', resumesRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/pitches', pitchesRouter);
app.use('/api/followups', followupsRouter);
app.use('/api/conflicts', conflictsRouter);
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/ai-config', aiConfigRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/guidelines', guidelinesRouter);
app.use('/api/chat', aiLimiter, chatRouter);
app.use('/api/boss-auto', bossAutoRouter);
app.use('/api/search', searchRouter);
app.use('/api/notifications', notificationsRouter);

// 404
app.use(notFoundHandler);
// 错误处理
app.use(errorHandler);

// 启动服务器（同时挂载 WebSocket Server 用于本地 Agent 连接）
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/boss-agent' });
setupAgentWebSocket(wss);

server.listen(PORT, () => {
  logger.info(`招聘辅助后端服务已启动，监听端口 ${PORT}`);
  logger.info(`健康检查: http://localhost:${PORT}/api/health`);
  logger.info(`Boss Agent WebSocket: ws://localhost:${PORT}/boss-agent`);
  // 启动时自动备份数据库
  startBackupService();
});

// 处理未捕获异常
process.on('uncaughtException', (err) => {
  logger.error('未捕获异常', err.message);
});
process.on('unhandledRejection', (reason) => {
  logger.error('未处理的 Promise 拒绝', String(reason));
});
