// 客户公司路由
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import {
  listClients,
  findClientById,
  createClient,
  updateClient,
  deleteClient,
} from '../repositories/clientRepo.js';

export const clientsRouter = Router();

clientsRouter.use(requireAuth);

// GET /api/clients（全员可见）
clientsRouter.get('/', (_req, res) => {
  res.json({ data: listClients() });
});

// GET /api/clients/:id
clientsRouter.get('/:id', asyncHandler(async (req, res) => {
  const c = findClientById(String(req.params.id));
  if (!c) throw new ApiError(404, '客户公司不存在');
  res.json({ data: c });
}));

// POST /api/clients（管理员）
clientsRouter.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { name, contact_name, contact_phone, industry, notes } = req.body ?? {};
  if (!name) throw new ApiError(400, '客户公司名称不能为空');
  const c = createClient({
    id: nanoid(),
    name: String(name).trim(),
    contact_name: contact_name ?? null,
    contact_phone: contact_phone ?? null,
    industry: industry ?? null,
    notes: notes ?? null,
    created_by: req.user!.id,
  });
  res.status(201).json({ data: c });
}));

// PUT /api/clients/:id（管理员）
clientsRouter.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = findClientById(String(req.params.id));
  if (!existing) throw new ApiError(404, '客户公司不存在');
  const { name, contact_name, contact_phone, industry, notes } = req.body ?? {};
  const updated = updateClient(String(req.params.id), {
    name,
    contact_name,
    contact_phone,
    industry,
    notes,
  });
  res.json({ data: updated });
}));

// DELETE /api/clients/:id（管理员）
clientsRouter.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = findClientById(String(req.params.id));
  if (!existing) throw new ApiError(404, '客户公司不存在');
  deleteClient(String(req.params.id));
  res.json({ ok: true });
}));
