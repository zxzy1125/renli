// Boss 自动化路由
// 所有接口都需要登录（requireAuth）
//
// 架构说明：
// 代招助手部署在 Linux 服务器（无桌面），无法直接跑 Chrome 登录 Boss。
// 因此采用「本地 Agent + 服务器 WebSocket」架构：
//   - 用户在本地电脑跑 Agent 脚本（agent/agent.ts），启动 Chrome 登录 Boss
//   - Agent 通过 WebSocket 连接服务器，接收任务、上报状态/日志
//   - 本路由只负责 HTTP 接口，把请求转发给已连接的 Agent
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getAgentInfo,
  getAgentTaskStatus,
  setAgentTaskStatus,
  sendToAgent,
} from '../boss/agent-ws.js';
import { getActionLogs, getTodayStat } from '../boss/anti-detect/action-logger.js';
import { db } from '../db/index.js';

export const bossAutoRouter = Router();

// 所有接口都需要登录
bossAutoRouter.use(requireAuth);

/**
 * 检查 Agent + Chrome 连接状态
 * GET /api/boss-auto/status
 * 返回：Agent 是否在线、Boss 登录用户信息
 */
bossAutoRouter.get('/status', async (_req, res) => {
  const info = getAgentInfo();
  if (!info.connected) {
    return res.json({
      connected: false,
      agentOnline: false,
      bossUser: null,
      message: '本地 Agent 未连接，请在本地启动 agent/start.bat',
    });
  }
  // Agent 在线，查 Chrome 连接状态
  try {
    const r = await sendToAgent<{ connected: boolean; bossUser: any; message: string }>(
      'check-chrome',
      {},
      10_000
    );
    res.json({
      connected: r.connected,
      agentOnline: true,
      agentUser: info.user,
      bossUser: r.bossUser,
      message: r.message,
    });
  } catch (err: any) {
    res.json({
      connected: false,
      agentOnline: true,
      agentUser: info.user,
      bossUser: null,
      message: err?.message || '查询 Chrome 状态失败',
    });
  }
});

/**
 * 连接 Chrome（让 Agent 通过 CDP 连接本地 Chrome）
 * POST /api/boss-auto/connect
 */
bossAutoRouter.post('/connect', async (_req, res) => {
  try {
    const r = await sendToAgent<{ ok: boolean; bossUser: any; message: string }>(
      'connect-chrome',
      {},
      15_000
    );
    res.json(r);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || '连接失败' });
  }
});

/**
 * 断开 Chrome（让 Agent 断开 CDP，不关浏览器）
 * POST /api/boss-auto/disconnect
 */
bossAutoRouter.post('/disconnect', async (_req, res) => {
  try {
    const r = await sendToAgent<{ ok: boolean }>('disconnect-chrome', {}, 10_000);
    res.json(r);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || '断开失败' });
  }
});

/**
 * 启动自动打招呼任务
 * POST /api/boss-auto/say-hello/start
 * body: { city?, jobId?, template?, maxCount?, browseRatio? }
 *
 * 注意：任务实际在本地 Agent 上执行，服务器只转发指令
 */
bossAutoRouter.post('/say-hello/start', async (req, res) => {
  try {
    const config = {
      userId: req.user!.id,
      city: req.body.city,
      jobId: req.body.jobId,
      template: req.body.template,
      maxCount: req.body.maxCount,
      browseRatio: req.body.browseRatio,
    };
    // 先置初始状态，让前端立即看到"运行中"
    setAgentTaskStatus({
      isRunning: true,
      shouldStop: false,
      result: {
        total: 0,
        success: 0,
        failed: 0,
        browsed: 0,
        stopped: false,
        startedAt: new Date().toISOString(),
        finishedAt: '',
      },
    });
    // 发给 Agent，Agent 异步执行并立即回复"已启动"
    const r = await sendToAgent<{ ok: boolean; message: string }>(
      'start-say-hello',
      config,
      15_000
    );
    res.json(r);
  } catch (err: any) {
    setAgentTaskStatus(null);
    res.status(500).json({ error: err?.message || '启动失败' });
  }
});

/**
 * 停止自动打招呼任务
 * POST /api/boss-auto/say-hello/stop
 */
bossAutoRouter.post('/say-hello/stop', async (_req, res) => {
  try {
    const r = await sendToAgent<{ ok: boolean; message: string }>(
      'stop-say-hello',
      {},
      10_000
    );
    res.json(r);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || '停止失败' });
  }
});

/**
 * 获取当前任务状态（从 Agent 上报缓存读取）
 * GET /api/boss-auto/task/status
 */
bossAutoRouter.get('/task/status', async (_req, res) => {
  const status = getAgentTaskStatus();
  res.json(status || { isRunning: false, shouldStop: false, result: null });
});

/**
 * 获取今日统计（从本地数据库读，日志由 Agent 上报后服务器写库）
 * GET /api/boss-auto/stat/today
 */
bossAutoRouter.get('/stat/today', async (req, res) => {
  const stat = getTodayStat(req.user!.id);
  res.json(stat);
});

/**
 * 获取行为日志
 * GET /api/boss-auto/logs?action=say_hello&limit=100
 */
bossAutoRouter.get('/logs', async (req, res) => {
  const logs = getActionLogs(req.user!.id, {
    action: req.query.action as string | undefined,
    limit: parseInt(req.query.limit as string) || 100,
    offset: parseInt(req.query.offset as string) || 0,
  });
  res.json(logs);
});

/**
 * 获取 Boss 消息列表（阶段二接入 MQTT 后会有数据）
 * GET /api/boss-auto/messages
 */
bossAutoRouter.get('/messages', async (req, res) => {
  const messages = db.prepare(
    `SELECT * FROM boss_messages WHERE user_id = ?
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(
    req.user!.id,
    parseInt(req.query.limit as string) || 50,
    parseInt(req.query.offset as string) || 0
  );
  res.json(messages);
});
