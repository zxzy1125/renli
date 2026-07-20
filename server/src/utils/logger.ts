// 简单日志工具
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatMsg(level: LogLevel, msg: string, meta?: any): string {
  const ts = new Date().toISOString();
  if (meta !== undefined) {
    return `[${ts}] [${level.toUpperCase()}] ${msg} ${typeof meta === 'object' ? JSON.stringify(meta) : meta}`;
  }
  return `[${ts}] [${level.toUpperCase()}] ${msg}`;
}

export const logger = {
  info(msg: string, meta?: any): void {
    console.log(formatMsg('info', msg, meta));
  },
  warn(msg: string, meta?: any): void {
    console.warn(formatMsg('warn', msg, meta));
  },
  error(msg: string, meta?: any): void {
    console.error(formatMsg('error', msg, meta));
  },
  debug(msg: string, meta?: any): void {
    if (process.env.NODE_ENV !== 'production') {
      console.log(formatMsg('debug', msg, meta));
    }
  },
};
