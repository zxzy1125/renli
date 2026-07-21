// Agent WebSocket 服务端
// 管理本地 Agent 的 WebSocket 连接，提供 HTTP→Agent 的请求转发能力
//
// 架构：
//   [浏览器] --HTTP--> [服务器路由] --WebSocket--> [本地Agent] --CDP--> [Chrome]
//                                          <--状态/日志--          <--操作--
import type { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import { verifyToken } from '../utils/jwt.js';
import { findUserById } from '../repositories/userRepo.js';
import { logAction, type ActionLog } from './anti-detect/action-logger.js';
import { logger } from '../utils/logger.js';

// Agent 连接信息
interface AgentConnection {
  socket: WebSocket;
  user: { id: string; name: string };
  connectedAt: string;
  bossUser: { uid: string; name: string } | null;
}

// 当前已连接的 Agent（单用户自用模式，只支持一个 Agent 连接）
let agentConn: AgentConnection | null = null;

// 待响应的请求映射
interface PendingRequest {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}
const pendingRequests = new Map<string, PendingRequest>();

// Agent 上报的最新任务状态（供 HTTP 接口查询）
let agentTaskStatus: any = null;

/**
 * 在 HTTP 服务器上挂载 WebSocket Server
 * 路径：/boss-agent  （Agent 连接 ws://server:port/boss-agent?token=xxx）
 */
export function setupAgentWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
    // 从 URL query 解析 token
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) {
      socket.close(1008, '未提供 token');
      return;
    }
    const payload = verifyToken(token);
    if (!payload) {
      socket.close(1008, 'token 无效或已过期');
      return;
    }
    const user = findUserById(payload.id);
    if (!user || user.status !== 'active') {
      socket.close(1008, '用户无效或已禁用');
      return;
    }

    // 如果已有 Agent 连接，关闭旧的（单用户模式）
    if (agentConn && agentConn.socket.readyState === 1) {
      try {
        agentConn.socket.close(1000, '被新连接替换');
      } catch {}
    }

    agentConn = {
      socket,
      user: { id: user.id, name: user.real_name },
      connectedAt: new Date().toISOString(),
      bossUser: null,
    };
    logger.info('[Agent-WS] 本地 Agent 已连接', { user: agentConn.user });

    socket.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch (e) {
        logger.error('[Agent-WS] 消息解析失败', String(e));
        return;
      }
      handleAgentMessage(msg);
    });

    socket.on('close', () => {
      if (agentConn?.socket === socket) {
        logger.info('[Agent-WS] 本地 Agent 已断开', { user: agentConn.user });
        agentConn = null;
        agentTaskStatus = null;
      }
      // 拒绝所有 pending 请求
      for (const [id, req] of pendingRequests) {
        clearTimeout(req.timer);
        req.reject(new Error('Agent 已断开'));
        pendingRequests.delete(id);
      }
    });

    socket.on('error', (err) => {
      logger.error('[Agent-WS] 连接错误', err.message);
    });
  });
}

/**
 * 处理 Agent 发来的消息
 */
function handleAgentMessage(msg: any): void {
  switch (msg.type) {
    // Agent 对某次请求的响应
    case 'response': {
      const req = pendingRequests.get(msg.requestId);
      if (req) {
        clearTimeout(req.timer);
        pendingRequests.delete(msg.requestId);
        if (msg.error) req.reject(new Error(msg.error));
        else req.resolve(msg.data);
      }
      break;
    }
    // Agent 主动上报任务状态
    case 'status': {
      agentTaskStatus = msg.data;
      break;
    }
    // Agent 上报行为日志（服务器写入库）
    case 'log': {
      try {
        const log: ActionLog = msg.data;
        logAction(log);
      } catch (e) {
        logger.error('[Agent-WS] 日志写入失败', String(e));
      }
      break;
    }
    // Agent 上报 Boss 用户信息（连接 Chrome 后）
    case 'boss-user': {
      if (agentConn) agentConn.bossUser = msg.data;
      break;
    }
  }
}

/**
 * Agent 是否已连接
 */
export function isAgentConnected(): boolean {
  return agentConn !== null && agentConn.socket.readyState === 1; // OPEN
}

/**
 * 获取 Agent 连接信息（供 HTTP 接口返回前端）
 */
export function getAgentInfo(): {
  connected: boolean;
  user: { name: string } | null;
  connectedAt: string | null;
  bossUser: { uid: string; name: string } | null;
} {
  if (!agentConn) {
    return { connected: false, user: null, connectedAt: null, bossUser: null };
  }
  return {
    connected: agentConn.socket.readyState === 1,
    user: { name: agentConn.user.name },
    connectedAt: agentConn.connectedAt,
    bossUser: agentConn.bossUser,
  };
}

/**
 * 获取 Agent 上报的最新任务状态
 */
export function getAgentTaskStatus(): any {
  return agentTaskStatus;
}

/**
 * 设置 Agent 任务状态（HTTP 启动任务时先置为初始态）
 */
export function setAgentTaskStatus(s: any): void {
  agentTaskStatus = s;
}

/**
 * 发送请求给 Agent 并等待响应（Promise 封装）
 * 超时默认 30 秒
 */
export function sendToAgent<T = any>(
  action: string,
  data: any = {},
  timeout = 30_000
): Promise<T> {
  if (!agentConn || agentConn.socket.readyState !== 1) {
    return Promise.reject(
      new Error('本地 Agent 未连接，请在本地启动 Agent 脚本并确保已登录')
    );
  }
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`Agent 响应超时（${timeout / 1000}秒）`));
    }, timeout);
    pendingRequests.set(requestId, { resolve, reject, timer });
    agentConn!.socket.send(JSON.stringify({ type: 'request', requestId, action, data }));
  });
}
