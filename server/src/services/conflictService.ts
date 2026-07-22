// 撞单检测服务
import { nanoid } from 'nanoid';
import {
  findResumesByPhoneHash,
  findResumesByEmail,
  findResumesByNameAndCompany,
  findAllResumes,
} from '../repositories/resumeRepo.js';
import { createConflict } from '../repositories/conflictRepo.js';
import type { ConflictCheckResult, ConflictMatchField } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Levenshtein 距离（用于姓名模糊匹配）
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// 去除空格和标点，统一为小写，用于模糊比对
function normalizeForMatch(s: string): string {
  return s.replace(/[\s\-_.·]/g, '').toLowerCase();
}

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

  // 4. 模糊姓名匹配（Levenshtein 距离 ≤ 2 或相似度 > 0.8）
  if (input.candidateName) {
    const allResumes = findAllResumes();
    const normalizedName = normalizeForMatch(input.candidateName);
    for (const existing of allResumes) {
      if (existing.id === input.resumeId) continue;
      if (existing.owner_id === input.ownerId) continue;
      if (results.some(r => r.existingResume?.id === existing.id)) continue;
      const existingName = normalizeForMatch(existing.name);
      const dist = levenshtein(normalizedName, existingName);
      const maxLen = Math.max(normalizedName.length, existingName.length, 1);
      const similarity = 1 - dist / maxLen;
      if (dist <= 2 && similarity > 0.8) {
        results.push({
          conflict: true,
          matchField: 'name_company' as ConflictMatchField,
          existingResume: existing,
        });
      }
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
