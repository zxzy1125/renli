// 错误处理中间件
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// 自定义业务错误
export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

// 404 处理
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: '接口不存在' });
}

// 统一错误处理
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    logger.error('未处理错误', err.message);
    logger.error('堆栈', err.stack ?? '');
    res.status(500).json({ error: err.message });
    return;
  }
  logger.error('未知错误', String(err));
  res.status(500).json({ error: '服务器内部错误' });
}

// async 路由包装器：捕获 promise 异常交给错误中间件
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
