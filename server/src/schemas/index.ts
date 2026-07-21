// Schema 验证：使用 zod 进行输入验证和类型推导
import { z } from 'zod';

// ===== 职位 Schema =====
export const createPositionSchema = z.object({
  title: z.string().min(1, '职位标题不能为空').max(100, '标题过长'),
  client_id: z.string().nullable().optional(),
  department: z.string().max(50).nullable().optional(),
  location: z.string().max(100).nullable().optional(),
  headcount: z.number().int().positive().nullable().optional(),
  salary_min: z.string().max(20).nullable().optional(),
  salary_max: z.string().max(20).nullable().optional(),
  experience: z.string().max(50).nullable().optional(),
  education: z.string().max(50).nullable().optional(),
  job_type: z.enum(['fulltime', 'parttime', 'intern', 'outsourcing']).nullable().optional(),
  work_mode: z.enum(['onsite', 'remote', 'hybrid']).nullable().optional(),
  priority: z.enum(['high', 'medium', 'low']).nullable().optional(),
  status: z.enum(['open', 'paused', 'closed']).default('open'),
  jd: z.string().max(10000).nullable().optional(),
  requirements: z.string().max(5000).nullable().optional(),
  bonus: z.string().max(2000).nullable().optional(),
  keywords: z.array(z.string()).default([]),
  raw_text: z.string().nullable().optional(),
  ai_meta: z.record(z.unknown()).nullable().optional(),
  source_filename: z.string().max(255).nullable().optional(),
  source_ext: z.string().max(20).nullable().optional(),
});

export const updatePositionSchema = createPositionSchema.partial();

export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;

// ===== 简历 Schema =====
export const createResumeSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(50),
  age: z.string().max(10).nullable().optional(),
  education: z.string().max(50).nullable().optional(),
  current_company: z.string().max(100).nullable().optional(),
  current_title: z.string().max(100).nullable().optional(),
  work_experience: z.string().max(10000).nullable().optional(),
  skills: z.string().max(5000).nullable().optional(),
  projects: z.string().max(10000).nullable().optional(),
  expectation: z.string().max(2000).nullable().optional(),
  expected_city: z.string().max(50).nullable().optional(),
  raw_text: z.string().nullable().optional(),
  source: z.string().max(50).nullable().optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确').optional(),
  email: z.string().email('邮箱格式不正确').optional(),
  has_wechat: z.number().int().min(0).max(1).default(0),
  wechat_id: z.string().max(50).nullable().optional(),
  contact_preference: z.enum(['wechat', 'phone', 'platform']).default('wechat'),
  candidate_status: z.enum(['looking', 'unemployed', 'passive', 'not_now']).default('passive'),
  expected_onboard_date: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  common_grounds: z.record(z.string()).optional(),
  risk_warning: z.object({
    isRisky: z.boolean(),
    reasons: z.array(z.string()),
  }).optional(),
  remark: z.string().max(500).nullable().optional(),
});

export const updateResumeSchema = createResumeSchema.partial();

export type CreateResumeInput = z.infer<typeof createResumeSchema>;
export type UpdateResumeInput = z.infer<typeof updateResumeSchema>;

// ===== 匹配 Schema =====
export const createMatchSchema = z.object({
  position_id: z.string().min(1, '职位ID不能为空'),
  resume_id: z.string().min(1, '简历ID不能为空'),
});

export const updateMatchStatusSchema = z.object({
  status: z.enum(['consulting', 'interview_invited', 'interview_passed', 'offer_sent', 'onboarded', 'lost']),
  lostReason: z.string().max(500).optional(),
});

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type UpdateMatchStatusInput = z.infer<typeof updateMatchStatusSchema>;

// ===== 通用查询 Schema =====
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const keywordSearchSchema = z.object({
  keyword: z.string().max(100).optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
export type KeywordSearchInput = z.infer<typeof keywordSearchSchema>;

// ===== 通用验证中间件 =====
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../middleware/error.js';

export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.errors.map(e => e.message).join('; ');
        next(new ApiError(400, message));
      } else {
        next(err);
      }
    }
  };
}

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.errors.map(e => e.message).join('; ');
        next(new ApiError(400, message));
      } else {
        next(err);
      }
    }
  };
}
