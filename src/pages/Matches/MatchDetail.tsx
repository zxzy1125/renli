// 匹配详情页：匹配报告 + 状态流转 + 18 条话术矩阵 + 审核区
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Trash2,
  Check,
  AlertTriangle,
  Wallet,
  TrendingUp,
  Sparkles,
  Loader2,
  Copy,
  Pencil,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Download,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import dayjs from 'dayjs';
import { matchesApi, pitchesApi, aiApi, getErrorMsg } from '@/lib/api';
import type { Match, MatchStatus, Pitch, PitchChannel, PitchScene } from '@/types';
import Loading from '@/components/Loading';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { RiskBadge } from '@/components/RiskBadge';
import {
  MATCH_STATUS_LABELS,
  STATUS_FLOW,
  STATUS_PIPELINE,
  PITCH_CHANNEL_LABELS,
  PITCH_SCENE_LABELS,
  PITCH_STATUS_LABELS,
  PITCH_STATUS_TONES,
  PITCH_CHANNELS,
  PITCH_SCENES,
  scoreColorClass,
  scoreStars,
} from './constants';

// 话术状态徽章色调
const PITCH_TONE_CLASS: Record<string, string> = {
  green: 'bg-forest-100 text-forest-700 dark:bg-forest-800 dark:text-cream-200',
  yellow: 'bg-ochre-100 text-ochre-700 dark:bg-ochre-900/20 dark:text-ochre-400',
  gray: 'bg-gray-100 text-gray-500',
  red: 'bg-risk-100 text-risk-700 dark:bg-risk-900/20 dark:text-risk-400',
};

// 安全渲染 salary_analysis（可能是字符串或对象）
function renderSalaryAnalysis(sa: unknown): string {
  if (typeof sa === 'string') return sa || '暂无薪资分析';
  if (sa && typeof sa === 'object') {
    const obj = sa as Record<string, string>;
    const parts = [
      obj.candidateExpectation && `期望：${obj.candidateExpectation}`,
      obj.positionRange && `职位范围：${obj.positionRange}`,
      obj.gap && `差距：${obj.gap}`,
      obj.recommendation && `建议：${obj.recommendation}`,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join('；') : '暂无薪资分析';
  }
  return '暂无薪资分析';
}

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [match, setMatch] = useState<Match | null>(null);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 生成话术中（顶部按钮）
  const [generating, setGenerating] = useState(false);

  // 状态推进
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [lostReason, setLostReason] = useState('');

  // 删除
  const [toDelete, setToDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 话术审核 Modal
  const [reviewPitch, setReviewPitch] = useState<Pitch | null>(null);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  // toast 提示
  const [toast, setToast] = useState('');

  // 重新生成确认
  const [regenConfirm, setRegenConfirm] = useState(false);

  // 话术查找映射：`${channel}_${scene}` → Pitch
  const pitchMap = useMemo(() => {
    const m = new Map<string, Pitch>();
    pitches.forEach((p) => m.set(`${p.channel}_${p.scene}`, p));
    return m;
  }, [pitches]);

  const getPitch = (channel: PitchChannel, scene: PitchScene) =>
    pitchMap.get(`${channel}_${scene}`);

  // 拉取匹配详情
  const fetchMatch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const m = await matchesApi.get(id);
      setMatch(m);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 拉取话术列表
  const fetchPitches = useCallback(async () => {
    if (!id) return;
    try {
      const list = await pitchesApi.list(id);
      setPitches(list || []);
    } catch {
      // 忽略话术加载错误
    }
  }, [id]);

  useEffect(() => {
    fetchMatch();
    fetchPitches();
  }, [fetchMatch, fetchPitches]);

  // toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  // 生成全部 18 条话术
  const handleGenerateAll = async () => {
    if (!id) return;
    setGenerating(true);
    setError('');
    try {
      await aiApi.generatePitches(id);
      await fetchPitches();
      setToast('18 条话术已生成');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setGenerating(false);
    }
  };

  // 单格生成（后端会生成全部，前端刷新）
  const handleGenerateSingle = async () => {
    if (!id) return;
    setGenerating(true);
    setError('');
    try {
      await aiApi.generatePitches(id);
      await fetchPitches();
      setToast('话术已生成');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setGenerating(false);
    }
  };

  // 状态推进
  const handleStatusChange = async (status: MatchStatus, lostReason?: string) => {
    if (!id) return;
    setStatusUpdating(true);
    try {
      const updated = await matchesApi.patchStatus(id, status, lostReason);
      setMatch(updated);
      setLostModalOpen(false);
      setLostReason('');
      setToast(`状态已更新为「${MATCH_STATUS_LABELS[status]}」`);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setStatusUpdating(false);
    }
  };

  // 删除
  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await matchesApi.remove(id);
      navigate('/matches');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setDeleting(false);
    }
  };

  // 打开话术审核
  const openReview = (pitch: Pitch) => {
    setReviewPitch(pitch);
    setReviewContent(pitch.content);
    setReviewBusy(false);
  };

  // 接受话术
  const handleAccept = async () => {
    if (!reviewPitch) return;
    setReviewBusy(true);
    try {
      const updated = await pitchesApi.update(reviewPitch.id, { status: 'accepted' });
      setPitches((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setReviewPitch(null);
      setToast('话术已接受');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setReviewBusy(false);
    }
  };

  // 编辑后接受
  const handleEditAccept = async () => {
    if (!reviewPitch) return;
    setReviewBusy(true);
    try {
      const updated = await pitchesApi.update(reviewPitch.id, {
        content: reviewContent,
        status: 'edited',
      });
      setPitches((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setReviewPitch(null);
      setToast('话术已编辑并接受');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setReviewBusy(false);
    }
  };

  // 放弃话术
  const handleDiscard = async () => {
    if (!reviewPitch) return;
    setReviewBusy(true);
    try {
      const updated = await pitchesApi.update(reviewPitch.id, { status: 'discarded' });
      setPitches((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setReviewPitch(null);
      setToast('话术已放弃');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setReviewBusy(false);
    }
  };

  // 重新生成（覆盖现有全部话术）
  const handleRegenerate = async () => {
    if (!id || !reviewPitch) return;
    setReviewBusy(true);
    try {
      await aiApi.generatePitches(id);
      await fetchPitches();
      setReviewPitch(null);
      setRegenConfirm(false);
      setToast('18 条话术已重新生成');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setReviewBusy(false);
    }
  };

  // AI 润色
  const handlePolish = async () => {
    if (!reviewPitch) return;
    setReviewBusy(true);
    try {
      const polished = await aiApi.polishPitch(reviewPitch.id);
      setReviewContent(polished.content);
      setPitches((prev) => prev.map((p) => (p.id === polished.id ? polished : p)));
      setToast('AI 润色完成');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setReviewBusy(false);
    }
  };

  // 复制单条话术
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast('已复制');
    } catch {
      // 兜底方案
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setToast('已复制');
    }
  };

  // 复制全套话术（按渠道分组）
  const buildAllPitchesText = () => {
    const lines: string[] = [];
    PITCH_CHANNELS.forEach((channel) => {
      const channelPitches = PITCH_SCENES.map((scene) => getPitch(channel, scene)).filter(
        (p): p is Pitch => !!p && (p.status === 'accepted' || p.status === 'edited')
      );
      if (channelPitches.length === 0) return;
      lines.push(`=== ${PITCH_CHANNEL_LABELS[channel]} ===`);
      channelPitches.forEach((p) => {
        lines.push(`[${PITCH_SCENE_LABELS[p.scene]}]`);
        lines.push(p.content);
        lines.push('');
      });
    });
    return lines.join('\n');
  };

  const handleCopyAll = async () => {
    const text = buildAllPitchesText();
    if (!text.trim()) {
      setToast('暂无可复制的话术（需先接受）');
      return;
    }
    await handleCopy(text);
  };

  // 导出为文本文件
  const handleExport = () => {
    const text = buildAllPitchesText();
    if (!text.trim()) {
      setToast('暂无可导出的话术（需先接受）');
      return;
    }
    const resumeName = match?.resume?.name || '求职者';
    const positionTitle = match?.position?.title || '职位';
    const header = `${resumeName} × ${positionTitle} 话术套件\n生成时间：${dayjs().format('YYYY-MM-DD HH:mm')}\n\n`;
    const blob = new Blob([header + text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resumeName}_${positionTitle}_话术套件.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast('已导出为文本文件');
  };

  if (loading) return <Loading className="py-20" />;
  if (error && !match) {
    return (
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <div className="px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400 mb-4">
          {error}
        </div>
        <Link to="/matches" className="btn-ghost inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 返回匹配列表
        </Link>
      </div>
    );
  }
  if (!match) {
    return (
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <p className="text-sm text-forest-500 dark:text-forest-400">匹配记录不存在</p>
        <Link to="/matches" className="btn-ghost inline-flex items-center gap-1 mt-2">
          <ArrowLeft className="w-4 h-4" /> 返回匹配列表
        </Link>
      </div>
    );
  }

  const resumeName = match.resume?.name || '—';
  const positionTitle = match.position?.title || '—';
  const currentStatusIdx = STATUS_PIPELINE.indexOf(match.status);

  // 可流转的下一步状态
  const nextStatuses = STATUS_FLOW[match.status] || [];

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      {/* toast 提示 */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-forest-800 text-cream-50 text-sm shadow-cardHover">
          {toast}
        </div>
      )}

      {/* 顶部操作 */}
      <div className="flex items-center gap-2 mb-4">
        <Link to="/matches" className="btn-ghost inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 匹配列表
        </Link>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400">
          {error}
        </div>
      )}

      {/* 第一段：基本信息 + 匹配报告 */}
      <div className="card p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100 flex items-center gap-3">
              <span>{resumeName}</span>
              <span className="text-forest-300 dark:text-forest-600 text-base">×</span>
              <span>{positionTitle}</span>
            </h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-forest-500 dark:text-forest-400">
              {match.resume?.current_company && <span>{match.resume.current_company}</span>}
              {match.position?.location && (
                <>
                  <span className="text-forest-300 dark:text-forest-600">·</span>
                  <span>{match.position.location}</span>
                </>
              )}
              <span className="text-forest-300 dark:text-forest-600">·</span>
              <span>{dayjs(match.created_at).format('YYYY-MM-DD HH:mm')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={match.status} />
            <button
              type="button"
              onClick={() => setToDelete(true)}
              className="btn-ghost text-risk-600 hover:bg-risk-50 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          </div>
        </div>

        {/* 风险求职者红标 */}
        {match.resume?.risk_warning?.isRisky && (
          <div className="mb-4">
            <RiskBadge risk={match.resume.risk_warning} />
          </div>
        )}

        {/* 匹配报告 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 大号评分 */}
          <div className="lg:col-span-1 bg-cream-50 dark:bg-forest-800 rounded-lg p-5 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-forest-500 dark:text-forest-400 mb-1">匹配度评分</div>
            <div className={`font-mono font-bold text-5xl ${scoreColorClass(match.score)}`}>
              {match.score}
            </div>
            <div className="text-forest-400 dark:text-forest-500 text-sm mb-2">/ 100</div>
            <div className={`text-2xl ${scoreColorClass(match.score)}`}>{scoreStars(match.score)}</div>
          </div>

          {/* 亮点 + 疑虑 */}
          <div className="lg:col-span-2 space-y-3">
            {/* 亮点 */}
            <div>
              <div className="flex items-center gap-1.5 text-forest-700 dark:text-cream-200 font-medium text-sm mb-1">
                <CheckCircle2 className="w-4 h-4 text-forest-600 dark:text-cream-300" />
                匹配亮点
              </div>
              {match.highlights && match.highlights.length > 0 ? (
                <ul className="space-y-1">
                  {match.highlights.map((h, i) => (
                    <li key={i} className="text-sm text-forest-700 dark:text-cream-200 flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-forest-500 dark:text-forest-400 flex-shrink-0 mt-0.5" />
                      <span>{typeof h === 'string' ? h : h.point || JSON.stringify(h)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-forest-400 dark:text-forest-500">暂无亮点</p>
              )}
            </div>
            {/* 疑虑 */}
            <div>
              <div className="flex items-center gap-1.5 text-ochre-700 dark:text-ochre-400 font-medium text-sm mb-1">
                <AlertTriangle className="w-4 h-4 text-ochre-500" />
                潜在疑虑
              </div>
              {match.concerns && match.concerns.length > 0 ? (
                <ul className="space-y-1">
                  {match.concerns.map((c, i) => (
                    <li key={i} className="text-sm text-forest-700 dark:text-cream-200 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-ochre-500 flex-shrink-0 mt-0.5" />
                      <span>{typeof c === 'string' ? c : c.point || JSON.stringify(c)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-forest-400 dark:text-forest-500">暂无疑虑</p>
              )}
            </div>
          </div>
        </div>

        {/* 薪资分析 + 转化概率 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-cream-50 dark:bg-forest-800 rounded-lg p-4">
            <div className="flex items-center gap-1.5 text-forest-600 dark:text-cream-300 font-medium text-sm mb-2">
              <Wallet className="w-4 h-4 text-forest-500 dark:text-forest-400" />
              薪资分析
            </div>
            <p className="text-sm text-forest-700 dark:text-cream-200 leading-relaxed">
              {renderSalaryAnalysis(match.salary_analysis)}
            </p>
          </div>
          <div className="bg-cream-50 dark:bg-forest-800 rounded-lg p-4">
            <div className="flex items-center gap-1.5 text-forest-600 dark:text-cream-300 font-medium text-sm mb-2">
              <TrendingUp className="w-4 h-4 text-forest-500 dark:text-forest-400" />
              转化可能性
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-mono font-bold text-3xl text-forest-700 dark:text-cream-200">
                {match.conversion_probability ?? '-'}%
              </span>
            </div>
            <p className="text-xs text-forest-500 dark:text-forest-400">
              基于 matching 评分、求职者状态与薪资匹配度综合预测
            </p>
          </div>
        </div>
      </div>

      {/* 第二段：状态流转条 */}
      <div className="card p-5 mb-4">
        <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100 mb-4">状态流转</h2>
        {/* 横向流程图 */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
          {STATUS_PIPELINE.map((s, idx) => {
            const isCurrent = match.status === s;
            const isPassed = currentStatusIdx > idx;
            return (
              <div key={s} className="flex items-center flex-shrink-0">
                <div
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                    isCurrent
                      ? 'bg-forest-600 text-white'
                      : isPassed
                      ? 'bg-forest-100 dark:bg-forest-800 text-forest-600 dark:text-forest-300'
                      : 'bg-cream-100 dark:bg-forest-800/50 text-forest-400 dark:text-forest-500'
                  }`}
                >
                  {MATCH_STATUS_LABELS[s]}
                </div>
                {idx < STATUS_PIPELINE.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-forest-300 dark:text-forest-600 mx-0.5 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-wrap items-center gap-2">
          {match.status === 'lost' ? (
            <button
              type="button"
              disabled={statusUpdating}
              onClick={() => handleStatusChange('consulting')}
              className="btn-secondary flex items-center gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              重新激活（回到咨询中）
            </button>
          ) : (
            nextStatuses.map((s) => {
              if (s === 'lost') {
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={statusUpdating}
                    onClick={() => setLostModalOpen(true)}
                    className="btn-danger flex items-center gap-1"
                  >
                    <XCircle className="w-4 h-4" />
                    标记为已流失
                  </button>
                );
              }
              return (
                <button
                  key={s}
                  type="button"
                  disabled={statusUpdating}
                  onClick={() => handleStatusChange(s)}
                  className="btn-primary flex items-center gap-1"
                >
                  <ChevronRight className="w-4 h-4" />
                  推进到「{MATCH_STATUS_LABELS[s]}」
                </button>
              );
            })
          )}
          {statusUpdating && (
            <span className="text-sm text-forest-400 dark:text-forest-500 flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              更新中...
            </span>
          )}
          {nextStatuses.length === 0 && match.status !== 'lost' && (
            <span className="text-sm text-forest-400 dark:text-forest-500">已达终态</span>
          )}
        </div>
      </div>

      {/* 第三段：18 条话术矩阵 */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100">话术矩阵（18 条）</h2>
            <p className="text-xs text-forest-500 dark:text-forest-400 mt-0.5">3 渠道 × 6 场景 · 半人工审核</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAll}
              disabled={pitches.length === 0}
              className="btn-secondary flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Copy className="w-4 h-4" />
              复制全套
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={pitches.length === 0}
              className="btn-secondary flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              导出为文本
            </button>
            <button
              type="button"
              onClick={handleGenerateAll}
              disabled={generating}
              className="btn-ai flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generating ? 'AI 生成中...' : pitches.length === 0 ? '生成全部 18 条' : '重新生成全部'}
            </button>
          </div>
        </div>

        {/* 生成中提示 */}
        {generating && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-ochre-50 dark:bg-ochre-900/20 border border-ochre-100 dark:border-ochre-800 text-sm text-ochre-700 dark:text-ochre-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 animate-pulse" />
            AI 正在生成 18 条话术（3 渠道 × 6 场景），预计 30-60 秒，请勿离开页面...
          </div>
        )}

        {/* 空状态 */}
        {pitches.length === 0 && !generating ? (
          <div className="py-12 text-center">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-ochre-400 dark:text-ochre-500" />
            <p className="text-sm text-forest-500 dark:text-forest-400 mb-2">暂无话术</p>
            <p className="text-xs text-forest-400 dark:text-forest-500">点击「生成全部 18 条」开始</p>
          </div>
        ) : (
          /* 矩阵表格 */
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="border border-forest-100 dark:border-forest-800 bg-cream-100 dark:bg-forest-800/50 px-3 py-2 text-left text-forest-600 dark:text-forest-300 font-medium w-28">
                    场景 \ 渠道
                  </th>
                  {PITCH_CHANNELS.map((ch) => (
                    <th
                      key={ch}
                      className="border border-forest-100 dark:border-forest-800 bg-cream-100 dark:bg-forest-800/50 px-3 py-2 text-center text-forest-600 dark:text-forest-300 font-medium"
                    >
                      {PITCH_CHANNEL_LABELS[ch]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PITCH_SCENES.map((scene) => (
                  <tr key={scene}>
                    <th className="border border-forest-100 dark:border-forest-800 bg-cream-50 dark:bg-forest-800/30 px-3 py-2 text-left text-forest-700 dark:text-cream-200 font-medium align-top">
                      {PITCH_SCENE_LABELS[scene]}
                    </th>
                    {PITCH_CHANNELS.map((ch) => {
                      const pitch = getPitch(ch, scene);
                      return (
                        <td
                          key={ch}
                          className="border border-forest-100 dark:border-forest-800 px-2 py-2 align-top"
                        >
                          <PitchCell
                            pitch={pitch}
                            generating={generating}
                            onGenerate={handleGenerateSingle}
                            onReview={() => pitch && openReview(pitch)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 流失原因 Modal */}
      <Modal
        open={lostModalOpen}
        title="标记为已流失"
        onClose={() => setLostModalOpen(false)}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setLostModalOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              disabled={statusUpdating}
              onClick={() => handleStatusChange('lost', lostReason || undefined)}
              className="btn-danger"
            >
              {statusUpdating ? '提交中...' : '确认流失'}
            </button>
          </>
        }
      >
        <p className="text-sm text-forest-600 dark:text-cream-300 mb-3">请填写流失原因（可选）：</p>
        <textarea
          className="input"
          rows={4}
          placeholder="例如：求职者拒了 offer / 薪资未谈拢 / 已入职其他公司..."
          value={lostReason}
          onChange={(e) => setLostReason(e.target.value)}
        />
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={toDelete}
        title="删除匹配记录"
        message={`确认删除匹配「${resumeName} × ${positionTitle}」吗？关联的话术也将一并删除，此操作不可撤销。`}
        confirmText={deleting ? '删除中...' : '确认删除'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(false)}
      />

      {/* 话术审核 Modal */}
      {reviewPitch && (
        <Modal
          open={!!reviewPitch}
          title={`${PITCH_CHANNEL_LABELS[reviewPitch.channel]} × ${PITCH_SCENE_LABELS[reviewPitch.scene]}`}
          onClose={() => setReviewPitch(null)}
          size="lg"
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2">
                <span className="text-xs text-forest-500 dark:text-forest-400">状态：</span>
                <span className={`badge ${PITCH_TONE_CLASS[PITCH_STATUS_TONES[reviewPitch.status]]}`}>
                  {PITCH_STATUS_LABELS[reviewPitch.status]}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={reviewBusy}
                  onClick={() => handleCopy(reviewContent)}
                  className="btn-ghost text-xs flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  复制
                </button>
                <button
                  type="button"
                  disabled={reviewBusy}
                  onClick={handlePolish}
                  className="btn-ghost text-xs flex items-center gap-1 text-ochre-600 dark:text-ochre-400"
                >
                  {reviewBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  AI 润色
                </button>
              </div>
            </div>
          }
        >
          {/* 话术内容编辑区 */}
          <textarea
            className="input font-sans"
            rows={12}
            value={reviewContent}
            onChange={(e) => setReviewContent(e.target.value)}
          />

          {/* 操作按钮 */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-forest-100">
            <button
              type="button"
              disabled={reviewBusy}
              onClick={handleAccept}
              className="btn-primary flex items-center gap-1"
            >
              <Check className="w-4 h-4" />
              接受
            </button>
            <button
              type="button"
              disabled={reviewBusy}
              onClick={handleEditAccept}
              className="btn-secondary flex items-center gap-1"
            >
              <Pencil className="w-4 h-4" />
              编辑后接受
            </button>
            <button
              type="button"
              disabled={reviewBusy}
              onClick={() => setRegenConfirm(true)}
              className="btn-ghost flex items-center gap-1 text-ochre-600 dark:text-ochre-400"
            >
              <RefreshCw className="w-4 h-4" />
              重新生成
            </button>
            <button
              type="button"
              disabled={reviewBusy}
              onClick={handleDiscard}
              className="btn-ghost flex items-center gap-1 text-risk-600 dark:text-risk-400 hover:bg-risk-50 dark:hover:bg-risk-900/20"
            >
              <XCircle className="w-4 h-4" />
              放弃
            </button>
            {reviewBusy && (
              <span className="text-xs text-forest-400 dark:text-forest-500 flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                处理中...
              </span>
            )}
          </div>

          {/* 重新生成确认 */}
          <ConfirmDialog
            open={regenConfirm}
            title="重新生成话术"
            message="重新生成将覆盖现有全部 18 条话术（已接受/编辑的也会被覆盖），确认继续？"
            confirmText={reviewBusy ? '生成中...' : '确认重新生成'}
            danger
            onConfirm={handleRegenerate}
            onCancel={() => setRegenConfirm(false)}
          />
        </Modal>
      )}
    </div>
  );
}

// 状态药丸
function StatusPill({ status }: { status: MatchStatus }) {
  const toneClass =
    status === 'lost'
      ? 'bg-risk-100 dark:bg-risk-900/30 text-risk-700 dark:text-risk-400'
      : status === 'interview_invited'
      ? 'bg-ochre-100 dark:bg-ochre-900/30 text-ochre-700 dark:text-ochre-400'
      : 'bg-forest-100 dark:bg-forest-800 text-forest-700 dark:text-forest-300';
  return <span className={`badge ${toneClass} text-sm px-2.5 py-1`}>{MATCH_STATUS_LABELS[status]}</span>;
}

// 话术矩阵单元格
function PitchCell({
  pitch,
  generating,
  onGenerate,
  onReview,
}: {
  pitch: Pitch | undefined;
  generating: boolean;
  onGenerate: () => void;
  onReview: () => void;
}) {
  // 未生成：显示生成按钮
  if (!pitch) {
    return (
      <button
        type="button"
        disabled={generating}
        onClick={onGenerate}
        className="w-full min-h-[80px] rounded-lg border-2 border-dashed border-forest-200 hover:border-ochre-400 hover:bg-ochre-50/50 flex flex-col items-center justify-center gap-1 text-forest-400 hover:text-ochre-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            <span className="text-xs">生成</span>
          </>
        )}
      </button>
    );
  }

  // 已放弃：灰色显示
  if (pitch.status === 'discarded') {
    return (
      <button
        type="button"
        onClick={onReview}
        className="w-full min-h-[80px] rounded-lg border border-gray-200 bg-gray-50 p-2 text-left hover:bg-gray-100 transition-colors"
      >
        <div className="text-xs text-gray-400 italic line-through">
          {pitch.content.slice(0, 80)}
          {pitch.content.length > 80 ? '...' : ''}
        </div>
        <div className="mt-1">
          <span className={`badge ${PITCH_TONE_CLASS[PITCH_STATUS_TONES[pitch.status]]}`}>
            {PITCH_STATUS_LABELS[pitch.status]}
          </span>
        </div>
      </button>
    );
  }

  // 已生成：显示预览 + 状态
  return (
    <button
      type="button"
      onClick={onReview}
      className="w-full min-h-[80px] rounded-lg border border-forest-100 dark:border-forest-800 hover:border-forest-300 hover:bg-cream-50 dark:hover:bg-forest-800/50 p-2 text-left transition-colors"
    >
      <div className="text-xs text-forest-700 dark:text-cream-200 line-clamp-3">
        {pitch.content.slice(0, 80)}
        {pitch.content.length > 80 ? '...' : ''}
      </div>
      <div className="mt-1">
        <span className={`badge ${PITCH_TONE_CLASS[PITCH_STATUS_TONES[pitch.status]]}`}>
          {PITCH_STATUS_LABELS[pitch.status]}
        </span>
      </div>
    </button>
  );
}
