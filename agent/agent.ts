// 本地 Agent 主程序
// 部署在用户本地电脑，通过 WebSocket 连接代招助手服务器，接收并执行 Boss 自动化任务
//
// 架构：
//   [代招助手服务器]  ←──WebSocket──  [本地 Agent]  ──CDP──  [Chrome 浏览器]
//   （Linux 无桌面）                   （本地电脑）            （登录 Boss）
//
// 启动方式：
//   1. 先填写 agent/config.json（参考 config.example.json）
//   2. 运行 agent/start.bat（会先启动 Chrome，再启动 Agent）
//   3. 保持本窗口运行，关闭则 Agent 离线
import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 复用服务器端的 boss 模块（tsx 会把 .js 路径解析为 .ts）
import {
  connectToBrowser,
  disconnectBrowser,
  checkConnection,
  getBossUserInfo,
} from '../server/src/boss/automation/browser.js';
import {
  runSayHello,
  stopSayHello,
  setStatusReporter,
} from '../server/src/boss/tasks/say-hello.js';
import { setLogHandler, type ActionLog } from '../server/src/boss/anti-detect/action-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 配置读取 =====
const configPath = path.resolve(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('[Agent] 未找到配置文件 agent/config.json');
  console.error('[Agent] 请复制 config.example.json 为 config.json 并填写服务器地址和账号');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
  serverUrl: string;      // 服务器地址，如 http://your-server:3001
  username: string;       // 代招助手登录账号
  password: string;       // 代招助手登录密码
};

console.log('[Agent] 本地 Agent 启动中...');
console.log('[Agent] 服务器:', config.serverUrl);
console.log('[Agent] 账号:', config.username);

// ===== 登录获取 token =====
async function login(): Promise<string> {
  const res = await fetch(`${config.serverUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: config.username, password: config.password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`登录失败 (HTTP ${res.status}): ${text}`);
  }
  const data: any = await res.json();
  if (!data.token) throw new Error('登录返回未包含 token');
  return data.token as string;
}

// ===== WebSocket 连接管理 =====
let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;

function send(msg: any): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function connect(): Promise<void> {
  try {
    const token = await login();
    const wsUrl = config.serverUrl.replace(/^http/, 'ws') + '/boss-agent?token=' + encodeURIComponent(token);
    console.log('[Agent] 正在连接 WebSocket...');
    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log('[Agent] ✓ 已连接到服务器，等待指令');
      // 注入日志和状态转发器：让 say-hello 任务把日志/状态通过 WS 发给服务器
      setupForwarders();
    });

    ws.on('message', (raw) => handleCommand(raw).catch(e => console.error('[Agent] 指令处理异常', e)));

    ws.on('close', () => {
      console.log('[Agent] 连接已关闭');
      ws = null;
      // 清除转发器，避免向已关闭的 socket 发数据
      setLogHandler(null);
      setStatusReporter(null);
      if (!isShuttingDown) scheduleReconnect();
    });

    ws.on('error', (err) => {
      console.error('[Agent] 连接错误:', err.message);
    });
  } catch (e: any) {
    console.error('[Agent] 连接失败:', e.message);
    if (!isShuttingDown) scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  console.log('[Agent] 5 秒后重连...');
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 5000);
}

// ===== 注入转发器 =====
function setupForwarders(): void {
  // 日志转发：Agent 端不写本地库，把日志发给服务器写库
  setLogHandler((log: ActionLog) => {
    send({ type: 'log', data: log });
  });
  // 状态转发：任务进度变化时实时上报给服务器
  setStatusReporter((status) => {
    send({ type: 'status', data: status });
  });
}

// ===== 指令处理 =====
async function handleCommand(raw: WebSocket.RawData): Promise<void> {
  let msg: any;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }
  if (msg.type !== 'request') return;
  const { requestId, action, data } = msg;

  console.log('[Agent] 收到指令:', action);
  try {
    let result: any;
    switch (action) {
      case 'check-chrome':
        result = await handleCheckChrome();
        break;
      case 'connect-chrome':
        result = await handleConnectChrome();
        break;
      case 'disconnect-chrome':
        result = await handleDisconnectChrome();
        break;
      case 'start-say-hello':
        result = await handleStartSayHello(data);
        break;
      case 'stop-say-hello':
        stopSayHello('服务器下发停止');
        result = { ok: true, message: '已发送停止信号' };
        break;
      default:
        throw new Error('未知指令: ' + action);
    }
    send({ type: 'response', requestId, data: result });
  } catch (e: any) {
    console.error('[Agent] 指令执行失败:', e.message);
    send({ type: 'response', requestId, error: e.message });
  }
}

async function handleCheckChrome() {
  const connected = await checkConnection();
  let bossUser: { uid: string; name: string } | null = null;
  if (connected) bossUser = await getBossUserInfo();
  return {
    connected,
    bossUser,
    message: connected
      ? `Chrome 已连接${bossUser ? '，Boss 用户：' + bossUser.name : ''}`
      : 'Chrome 未连接，请先运行 chrome-debug.bat 启动并登录 Boss',
  };
}

async function handleConnectChrome() {
  await connectToBrowser();
  const bossUser = await getBossUserInfo();
  if (bossUser) send({ type: 'boss-user', data: bossUser });
  return {
    ok: true,
    bossUser,
    message: '连接成功' + (bossUser ? `，Boss 用户：${bossUser.name}` : '（未检测到 Boss 登录，请在 Chrome 里登录 Boss 直聘）'),
  };
}

async function handleDisconnectChrome() {
  await disconnectBrowser();
  return { ok: true };
}

async function handleStartSayHello(data: any) {
  // 异步启动任务，立即回复"已启动"
  // 任务运行中的进度通过 statusReporter 实时上报
  runSayHello(data).catch((e) => {
    console.error('[Agent] 打招呼任务异常', e.message);
  });
  return { ok: true, message: '打招呼任务已启动' };
}

// ===== 优雅退出 =====
process.on('SIGINT', () => {
  console.log('\n[Agent] 正在退出...');
  isShuttingDown = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) ws.close();
  setLogHandler(null);
  setStatusReporter(null);
  setTimeout(() => process.exit(0), 500);
});

// ===== 启动 =====
connect();
