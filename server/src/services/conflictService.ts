// 撞单检测服务
import { nanoid } from 'nanoid';
import {
  findResumesByPhoneHash,
  findResumesByEmail,
  findResumesByNameAndCompany,
} from '../repositories/resumeRepo.js';
import { createConflict } from '../repositories/conflictRepo.js';
import type { ConflictCheckResult, ConflictMatchField } from '../types/index.js';
import { logger } from '../utils/logger.js';

// 简历输入（用于撞单检测）
export interface ConflictCheckInput {
  resumeId: string;        // 当前简历 ID
  candidateName: string;
  phoneHash?: string | null;
  email?: string | null;   // 原始 email
  currentCompany?: string | null;
  ownerId: string;         // 当前简历 owner
}

// 执行撞单检测：返回命中的所有冲突
export function checkConflicts(input: ConflictCheckInput): ConflictCheckResult[] {
  const results: ConflictCheckResult[] = [];

  // 1. phone_hash 强匹配
  if (input.phoneHash) {
    const existings = findResumesByPhoneHash(input.phoneHash, input.resumeId);
    for (const existing of existings) {
      // 同一员工的简历不算撞单
      if (existing.owner_id === input.ownerId) continue;
      results.push({
        conflict: true,
        matchField: 'phone' as ConflictMatchField,
        existingResume: existing,
      });
    }
  }

  // 2. email 匹配
  if (input.email) {
    const existings = findResumesByEmail(input.email, input.resumeId);
    for (const existing of existings) {
      if (existing.owner_id === input.ownerId) continue;
      // 避免与 phone 重复记录同一份简历
      if (results.some(r => r.existingResume?.id === existing.id)) continue;
      results.push({
        conflict: true,
        matchField: 'email' as ConflictMatchField,
        existingResume: existing,
      });
    }
  }

  // 3. name + current_company 弱匹配
  if (input.candidateName && input.currentCompany) {
    const existings = findResumesByNameAndCompany(input.candidateName, input.currentCompany, input.resumeId);
    for (const existing of existings) {
      if (existing.owner_id === input.ownerId) continue;
      if (results.some(r => r.existingResume?.id === existing.id)) continue;
      results.push({
        conflict: true,
        matchField: 'name_company' as ConflictMatchField,
        existingResume: existing,
      });
    }
  }

  return results;
}

// 检测并创建撞单记录
export function detectAndCreateConflicts(input: ConflictCheckInput): number {
  const results = checkConflicts(input);
  for (const r of results) {
    if (!r.existingResume) continue;
    try {
      createConflict({
        id: nanoid(),
        candidate_name: input.candidateName,
        phone_hash: input.phoneHash ?? null,
        email: input.email ?? null,
        resume_id_a: r.existingResume.id,        // 已存在的简历
        resume_id_b: input.resumeId,              // 新录入的简历
        employee_id_a: r.existingResume.owner_id,
        employee_id_b: input.ownerId,
        match_field: r.matchField!,
        status: 'pending',
        note: `撞单检测：${r.matchField === 'phone' ? '手机号相同' : r.matchField === 'email' ? '邮箱相同' : '姓名+公司相同'}（${r.matchField === 'name_company' ? '弱匹配，需人工核对' : '强匹配'}）`,
      });
      logger.info(`[conflict] 检测到撞单: ${input.candidateName} (${r.matchField})`);
    } catch (err: any) {
      logger.error('创建撞单记录失败', err.message);
    }
  }
  return results.length;
}
