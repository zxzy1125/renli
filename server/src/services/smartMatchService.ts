// 智能匹配服务：预筛选 + 批量 AI 匹配
import { nanoid } from 'nanoid';
import type { Position, Resume } from '../types/index.js';
import { callByPromptKey } from './aiService.js';
import { createMatch, updateMatch } from '../repositories/matchRepo.js';
import { logger } from '../utils/logger.js';

// 预筛选：关键词 + 城市规则过滤，减少 AI 调用量
export function prefilterResumes(
  position: Position,
  resumes: Resume[],
  existingMatchKeys: Set<string>
): Resume[] {
  const posKeywords = (position.keywords || []).map(k => k.toLowerCase());
  const posLocation = (position.location || '').toLowerCase();
  const posTitle = (position.title || '').toLowerCase();

  return resumes.filter(resume => {
    // 排除已存在匹配
    const key = `${position.id}:${resume.id}`;
    if (existingMatchKeys.has(key)) return false;

    const resumeSkills = (resume.skills || '').toLowerCase();
    const resumeTitle = (resume.current_title || '').toLowerCase();
    const resumeCompany = (resume.current_company || '').toLowerCase();
    const resumeCity = (resume.expected_city || '').toLowerCase();
    const resumeText = `${resumeSkills} ${resumeTitle} ${resumeCompany}`;

    // 关键词匹配：职位关键词 与 简历文本交集
    let keywordHit = false;
    if (posKeywords.length > 0) {
      keywordHit = posKeywords.some(kw => resumeText.includes(kw));
    }
    // 标题模糊匹配也算关键词命中
    if (!keywordHit && posTitle && (resumeTitle.includes(posTitle) || posTitle.includes(resumeTitle))) {
      keywordHit = true;
    }

    // 城市匹配
    let cityHit = false;
    if (posLocation && resumeCity) {
      cityHit = posLocation.includes(resumeCity) || resumeCity.includes(posLocation);
    }

    // 关键词 OR 城市命中即保留
    if (keywordHit || cityHit) return true;

    // 数据不全时保留（宁多勿漏）
    const posDataIncomplete = posKeywords.length === 0 && !posLocation;
    const resumeDataIncomplete = !resume.skills && !resume.current_title && !resume.expected_city;
    if (posDataIncomplete || resumeDataIncomplete) return true;

    return false;
  });
}

// 进度回调类型
export interface SmartMatchProgress {
  type: 'start' | 'progress' | 'complete' | 'error';
  total_pairs?: number;
  current?: number;
  position_title?: string;
  resume_name?: string;
  matched?: number;
  skipped?: number;
  failed?: number;
  result?: SmartMatchResult;
  error?: string;
}

// 单个匹配结果
export interface SmartMatchItem {
  position_id: string;
  position_title: string;
  resume_id: string;
  resume_name: string;
  match_id: string;
  score: number | null;
  recommendation: string;
}

// 按职位分组的结果
export interface SmartMatchPositionResult {
  position_id: string;
  position_title: string;
  matches: Array<{
    resume_id: string;
    resume_name: string;
    match_id: string;
    score: number | null;
    recommendation: string;
  }>;
}

// 汇总结果
export interface SmartMatchResult {
  total_pairs: number;
  matched: number;
  skipped: number;
  failed: number;
  results: SmartMatchPositionResult[];
}

const BATCH_SIZE = 5;

// 构造职位 JSON 数据（与 batch-match 路由一致）
function buildPositionData(position: Position): string {
  return JSON.stringify({
    title: position.title,
    requirements: position.requirements,
    jd: position.jd,
    salaryMin: position.salary_min,
    salaryMax: position.salary_max,
    experience: position.experience,
    education: position.education,
    location: position.location,
  });
}

// 构造简历 JSON 数据（与 batch-match 路由一致）
function buildResumeData(resume: Resume): string {
  return JSON.stringify({
    name: resume.name,
    currentCompany: resume.current_company,
    currentTitle: resume.current_title,
    skills: resume.skills,
    workExperience: resume.work_experience,
    projects: resume.projects,
    expectation: resume.expectation,
    expectedCity: resume.expected_city,
  });
}

// 执行智能匹配
export async function executeSmartMatch(
  pairs: Array<{ position: Position; resumes: Resume[] }>,
  userId: string,
  onProgress?: (progress: SmartMatchProgress) => void
): Promise<SmartMatchResult> {
  // 计算总对数
  const totalPairs = pairs.reduce((sum, p) => sum + p.resumes.length, 0);
  const result: SmartMatchResult = {
    total_pairs: totalPairs,
    matched: 0,
    skipped: 0,
    failed: 0,
    results: [],
  };

  onProgress?.({ type: 'start', total_pairs: totalPairs });

  let processed = 0;

  for (const { position, resumes } of pairs) {
    const positionResult: SmartMatchPositionResult = {
      position_id: position.id,
      position_title: position.title,
      matches: [],
    };

    const positionData = buildPositionData(position);

    // 分批处理
    for (let i = 0; i < resumes.length; i += BATCH_SIZE) {
      const batch = resumes.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (resume) => {
          processed++;
          onProgress?.({
            type: 'progress',
            current: processed,
            total_pairs: totalPairs,
            position_title: position.title,
            resume_name: resume.name,
            matched: result.matched,
            skipped: result.skipped,
            failed: result.failed,
          });

          const aiResult = await callByPromptKey('matchAnalysis', {
            resume_data: buildResumeData(resume),
            position_data: positionData,
          });

          // 创建匹配记录
          const matchId = nanoid();
          // matchScore 为提示词约定的字段名，score 作为向后兼容回退
          const score = aiResult?.matchScore ?? aiResult?.score ?? null;
          const matchStatus = score && score >= 70 ? 'interested' : 'consulting';

          createMatch({
            id: matchId,
            position_id: position.id,
            resume_id: resume.id,
            // owner_id 取简历归属人：管理员代他人匹配时，匹配仍归属于简历 owner
            owner_id: resume.owner_id,
            status: matchStatus,
            score,
            highlights: aiResult?.highlights || [],
            concerns: aiResult?.concerns || [],
            salary_analysis: aiResult?.salary_analysis || {},
            conversion_probability: aiResult?.conversion_probability ?? null,
          });

          return {
            resume_id: resume.id,
            resume_name: resume.name,
            match_id: matchId,
            score,
            recommendation: aiResult?.recommendation || '',
          };
        })
      );

      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          result.matched++;
          positionResult.matches.push(r.value);
        } else {
          result.failed++;
          logger.error(`智能匹配失败: ${position.title}`, (r.reason as Error)?.message);
          onProgress?.({
            type: 'error',
            current: processed,
            total_pairs: totalPairs,
            position_title: position.title,
            error: (r.reason as Error)?.message || 'AI 分析失败',
          });
        }
      }
    }

    if (positionResult.matches.length > 0) {
      // 按分数降序排列
      positionResult.matches.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      result.results.push(positionResult);
    }
  }

  onProgress?.({
    type: 'complete',
    current: processed,
    total_pairs: totalPairs,
    matched: result.matched,
    skipped: result.skipped,
    failed: result.failed,
    result,
  });

  return result;
}
