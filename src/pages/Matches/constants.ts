// 匹配与话术相关常量定义
import type { MatchStatus, PitchChannel, PitchScene, PitchStatus } from '@/types';

// 匹配状态中文标签
export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  consulting: '咨询中',
  interview_invited: '已邀面试',
  interview_passed: '面试通过',
  offer_sent: '已发 Offer',
  onboarded: '已入职',
  lost: '已流失',
};

// 匹配状态对应的色调（forest/ochre/risk）
export const MATCH_STATUS_COLORS: Record<MatchStatus, 'forest' | 'ochre' | 'risk'> = {
  consulting: 'forest',
  interview_invited: 'ochre',
  interview_passed: 'forest',
  offer_sent: 'forest',
  onboarded: 'forest',
  lost: 'risk',
};

// 话术渠道中文标签
export const PITCH_CHANNEL_LABELS: Record<PitchChannel, string> = {
  wechat: '微信文字',
  phone: '电话话术',
  platform: '站内信',
};

// 话术场景中文标签
export const PITCH_SCENE_LABELS: Record<PitchScene, string> = {
  outreach: '触达开场白',
  intro: '职位介绍',
  concern: '疑虑应对',
  interview: '面试邀约',
  salary: '薪资沟通',
  offer: 'Offer 促签',
};

// 话术状态中文标签
export const PITCH_STATUS_LABELS: Record<PitchStatus, string> = {
  pending: '待审核',
  accepted: '已接受',
  edited: '已编辑',
  discarded: '已放弃',
};

// 状态流转图：每个状态可推进到的下一步状态
export const STATUS_FLOW: Record<MatchStatus, MatchStatus[]> = {
  consulting: ['interview_invited', 'lost'],
  interview_invited: ['interview_passed', 'lost'],
  interview_passed: ['offer_sent', 'lost'],
  offer_sent: ['onboarded', 'lost'],
  onboarded: [],
  lost: [],
};

// 主流程顺序（用于横向流程图展示，不含 lost）
export const STATUS_PIPELINE: MatchStatus[] = [
  'consulting',
  'interview_invited',
  'interview_passed',
  'offer_sent',
  'onboarded',
];

// 渠道顺序（矩阵列）
export const PITCH_CHANNELS: PitchChannel[] = ['wechat', 'phone', 'platform'];

// 场景顺序（矩阵行）
export const PITCH_SCENES: PitchScene[] = [
  'outreach',
  'intro',
  'concern',
  'interview',
  'salary',
  'offer',
];

// 话术状态对应的色调
export const PITCH_STATUS_TONES: Record<PitchStatus, 'gray' | 'green' | 'yellow' | 'red'> = {
  pending: 'yellow',
  accepted: 'green',
  edited: 'green',
  discarded: 'gray',
};

// 根据匹配分数返回文字颜色类
export function scoreColorClass(score: number): string {
  if (score < 60) return 'text-risk-600';
  if (score <= 80) return 'text-ochre-600';
  return 'text-forest-600';
}

// 根据匹配分数返回星级字符串（5 星制）
export function scoreStars(score: number): string {
  const stars = Math.max(0, Math.min(5, Math.round(score / 20)));
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}
