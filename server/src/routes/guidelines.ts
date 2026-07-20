// 运营规范路由
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const guidelinesRouter = Router();

guidelinesRouter.use(requireAuth);

// 读取文档内容（向上查找 .trae/documents 目录）
function readDoc(filename: string): string {
  // server/src/routes/guidelines.ts → server/src → server → workspace
  const candidates = [
    path.resolve(__dirname, '../../../.trae/documents', filename),
    path.resolve(process.cwd(), '.trae/documents', filename),
    path.resolve(process.cwd(), '../.trae/documents', filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8');
    }
  }
  throw new ApiError(404, `文档不存在: ${filename}`);
}

// GET /api/guidelines/boss（返回 BOSS 规范内容）
guidelinesRouter.get('/boss', asyncHandler(async (_req, res) => {
  const content = readDoc('BOSS规范.md');
  res.json({ data: { title: 'BOSS 直聘运营规范指南', content } });
}));

// GET /api/guidelines/hr-methodology（返回 HR 话术方法论）
guidelinesRouter.get('/hr-methodology', asyncHandler(async (_req, res) => {
  const content = readDoc('HR话术方法论知识库.md');
  res.json({ data: { title: 'HR 招聘话术方法论知识库', content } });
}));
