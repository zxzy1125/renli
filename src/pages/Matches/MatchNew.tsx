// 新建匹配页：左栏选职位 + 右栏选简历 → 调 AI 生成匹配报告
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  ArrowLeft,
  Check,
  Building2,
  MapPin,
  Wallet,
  Users,
  Loader2,
} from 'lucide-react';
import { positionsApi, resumesApi, matchesApi, getErrorMsg } from '@/lib/api';
import { clientsApi } from '@/lib/api';
import type { Client, Position, Resume } from '@/types';
import Loading from '@/components/Loading';
import StatusBadge from '@/components/StatusBadge';
import { RiskBadge } from '@/components/RiskBadge';
import { POSITION_STATUS_OPTIONS, getOptionLabel } from '@/pages/Positions/constants';

const PAGE_SIZE = 20;

export default function MatchNew() {
  const navigate = useNavigate();

  // 职位列表
  const [positions, setPositions] = useState<Position[]>([]);
  const [posKeyword, setPosKeyword] = useState('');
  const [posLoading, setPosLoading] = useState(false);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);

  // 简历列表
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [resKeyword, setResKeyword] = useState('');
  const [resLoading, setResLoading] = useState(false);
  const [selectedRes, setSelectedRes] = useState<Resume | null>(null);

  // 客户公司映射
  const [clients, setClients] = useState<Client[]>([]);
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  // 提交中
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 拉取客户公司
  useEffect(() => {
    clientsApi.list().then(setClients).catch(() => {});
  }, []);

  // 拉取职位列表
  const fetchPositions = useCallback(async () => {
    setPosLoading(true);
    try {
      const res = await positionsApi.list({
        keyword: posKeyword || undefined,
        status: 'open',
        page: 1,
        pageSize: PAGE_SIZE,
      });
      setPositions(res.data || []);
    } catch {
      setPositions([]);
    } finally {
      setPosLoading(false);
    }
  }, [posKeyword]);

  // 拉取简历列表
  const fetchResumes = useCallback(async () => {
    setResLoading(true);
    try {
      const res = await resumesApi.list({
        keyword: resKeyword || undefined,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      setResumes(res.data || []);
    } catch {
      setResumes([]);
    } finally {
      setResLoading(false);
    }
  }, [resKeyword]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const handlePosSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPositions();
  };

  const handleResSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResumes();
  };

  // 开始匹配：调 create，后端自动生成匹配报告
  const handleMatch = async () => {
    if (!selectedPos || !selectedRes) return;
    setSubmitting(true);
    setError('');
    try {
      const match = await matchesApi.create({
        position_id: selectedPos.id,
        resume_id: selectedRes.id,
      });
      // 跳转到匹配详情
      navigate(`/matches/${match.id}`);
    } catch (err) {
      setError(getErrorMsg(err));
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <div className="px-6 py-6 max-w-3xl mx-auto">
        <div className="card p-12 text-center">
          <Sparkles className="w-10 h-10 mx-auto mb-4 animate-pulse text-ochre-500" />
          <h2 className="font-serif text-xl font-semibold text-forest-800 dark:text-cream-100 mb-2">
            AI 正在分析匹配度...
          </h2>
          <p className="text-sm text-forest-500 dark:text-forest-400 mb-4">
            正在比对职位要求与简历背景，生成匹配报告（亮点 / 疑虑 / 薪资分析 / 转化概率）
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-forest-400 dark:text-forest-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            预计 10-30 秒，请稍候
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto pb-32">
      {/* 顶部 */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => navigate('/matches')}
          className="btn-ghost inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> 返回匹配列表
        </button>
      </div>
      <div className="mb-4">
        <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100">新建匹配</h1>
        <p className="text-sm text-forest-500 dark:text-forest-400 mt-1">
          选择 1 个职位 + 1 份简历，AI 自动生成匹配报告
        </p>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 dark:bg-risk-900/20 border border-risk-100 dark:border-risk-800 text-sm text-risk-700 dark:text-risk-400">
          {error}
        </div>
      )}

      {/* 左右分栏 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 左栏：选职位 */}
        <div className="card p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-5 h-5 text-forest-600 dark:text-cream-300" />
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100">选择职位</h2>
          </div>
          <form onSubmit={handlePosSearch} className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400 dark:text-forest-500" />
            <input
              type="text"
              className="input pl-9"
              placeholder="搜索职位标题/关键词"
              value={posKeyword}
              onChange={(e) => setPosKeyword(e.target.value)}
            />
          </form>
          <div className="flex-1 overflow-y-auto max-h-[60vh] space-y-2">
            {posLoading ? (
              <Loading />
            ) : positions.length === 0 ? (
              <p className="text-sm text-forest-400 dark:text-forest-500 text-center py-8">暂无可选职位</p>
            ) : (
              positions.map((p) => (
                <PositionSelectCard
                  key={p.id}
                  position={p}
                  clientName={p.client_id ? clientMap.get(p.client_id) : undefined}
                  selected={selectedPos?.id === p.id}
                  onSelect={() => setSelectedPos(p)}
                />
              ))
            )}
          </div>
        </div>

        {/* 右栏：选简历 */}
        <div className="card p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-forest-600 dark:text-cream-300" />
            <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100">选择简历</h2>
          </div>
          <form onSubmit={handleResSearch} className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-400 dark:text-forest-500" />
            <input
              type="text"
              className="input pl-9"
              placeholder="搜索姓名/现公司/技能"
              value={resKeyword}
              onChange={(e) => setResKeyword(e.target.value)}
            />
          </form>
          <div className="flex-1 overflow-y-auto max-h-[60vh] space-y-2">
            {resLoading ? (
              <Loading />
            ) : resumes.length === 0 ? (
              <p className="text-sm text-forest-400 dark:text-forest-500 text-center py-8">暂无可选简历</p>
            ) : (
              resumes.map((r) => (
                <ResumeSelectCard
                  key={r.id}
                  resume={r}
                  selected={selectedRes?.id === r.id}
                  onSelect={() => setSelectedRes(r)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* 底部固定按钮栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-forest-900 border-t border-forest-100 dark:border-forest-800 shadow-cardHover z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="text-sm text-forest-600 dark:text-cream-300 flex-1 min-w-0">
            <span className="text-forest-400 dark:text-forest-500">已选职位：</span>
            <span className="font-medium text-forest-800 dark:text-cream-100 truncate">
              {selectedPos ? selectedPos.title : '未选择'}
            </span>
            <span className="mx-2 text-forest-300 dark:text-forest-600">|</span>
            <span className="text-forest-400 dark:text-forest-500">已选简历：</span>
            <span className="font-medium text-forest-800 dark:text-cream-100 truncate">
              {selectedRes ? selectedRes.name : '未选择'}
            </span>
          </div>
          <button
            type="button"
            disabled={!selectedPos || !selectedRes}
            onClick={handleMatch}
            className="btn-ai flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            开始匹配
          </button>
        </div>
      </div>
    </div>
  );
}

// 职位选择卡片
function PositionSelectCard({
  position,
  clientName,
  selected,
  onSelect,
}: {
  position: Position;
  clientName?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const salary = [position.salary_min, position.salary_max].filter(Boolean).join(' - ');
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected
          ? 'border-forest-500 bg-forest-50 ring-1 ring-forest-400'
          : 'border-forest-100 hover:border-forest-300 hover:bg-cream-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-forest-800 dark:text-cream-100 flex-1">{position.title}</span>
        {selected && <Check className="w-4 h-4 text-forest-600 dark:text-cream-300 flex-shrink-0" />}
      </div>
      {clientName && (
        <div className="flex items-center gap-1 text-xs text-forest-500 dark:text-forest-400 mb-1">
          <Building2 className="w-3 h-3" />
          <span>{clientName}</span>
          {position.department && <span>· {position.department}</span>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs text-forest-500 dark:text-forest-400">
        {salary && (
          <span className="flex items-center gap-1">
            <Wallet className="w-3 h-3" />
            <span className="font-mono">{salary}</span>
          </span>
        )}
        {position.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {position.location}
          </span>
        )}
        <StatusBadge
          status={position.status}
          text={getOptionLabel(POSITION_STATUS_OPTIONS, position.status)}
        />
      </div>
    </button>
  );
}

// 简历选择卡片
function ResumeSelectCard({
  resume,
  selected,
  onSelect,
}: {
  resume: Resume;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected
          ? 'border-forest-500 bg-forest-50 ring-1 ring-forest-400'
          : 'border-forest-100 hover:border-forest-300 hover:bg-cream-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 flex-1">
          <span className="font-medium text-forest-800 dark:text-cream-100">{resume.name}</span>
          {resume.age && <span className="text-xs text-forest-400 dark:text-forest-500">{resume.age}岁</span>}
          <RiskBadge risk={resume.risk_warning} />
        </div>
        {selected && <Check className="w-4 h-4 text-forest-600 dark:text-cream-300 flex-shrink-0" />}
      </div>
      <div className="flex items-center gap-1 text-xs text-forest-500 dark:text-forest-400 mb-1">
        <Building2 className="w-3 h-3" />
        <span>{resume.current_company || '现公司未知'}</span>
        {resume.current_title && <span>· {resume.current_title}</span>}
      </div>
      {resume.expectation && (
        <div className="text-xs text-forest-500 dark:text-forest-400">
          期望：{resume.expected_city ? `${resume.expected_city} · ` : ''}
          {resume.expectation}
        </div>
      )}
    </button>
  );
}
