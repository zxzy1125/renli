// 对话辅助详情页：聊天流 + AI 资深 HR 分析 + 3 套回复策略选优发送
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Trash2,
  Send,
  Sparkles,
  Loader2,
  Copy,
  Pencil,
  RefreshCw,
  AlertTriangle,
  Brain,
  Target,
  Heart,
  TrendingUp,
  Lightbulb,
  ArrowRight,
  Building2,
  MapPin,
  Wallet,
  FileText,
  ChevronRight,
  Briefcase,
} from 'lucide-react';
import dayjs from 'dayjs';
import { chatApi, getErrorMsg } from '@/lib/api';
import type {
  ChatSession as ChatSessionType,
  ChatMessage,
  ChatAnalysisResult,
  ChatReply,
} from '@/types';
import Loading from '@/components/Loading';
import ConfirmDialog from '@/components/ConfirmDialog';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';

// 风险等级文案与色调
const RISK_LEVEL_TEXT: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};
const RISK_LEVEL_TONE: Record<string, string> = {
  low: 'bg-forest-100 text-forest-700 border-forest-200',
  medium: 'bg-ochre-100 text-ochre-700 border-ochre-200',
  high: 'bg-risk-100 text-risk-700 border-risk-200',
};

export default function ChatSessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<ChatSessionType | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 输入求职者消息
  const [input, setInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // 当前 AI 分析结果（展示在右栏）
  const [analysis, setAnalysis] = useState<ChatAnalysisResult | null>(null);
  // 当前 AI 分析关联的求职者消息 ID
  const [analysisMsgId, setAnalysisMsgId] = useState<string | null>(null);
  // 重新生成中
  const [regenerating, setRegenerating] = useState(false);

  // 编辑回复 Modal
  const [editReply, setEditReply] = useState<ChatReply | null>(null);
  const [editContent, setEditContent] = useState('');
  const [sending, setSending] = useState(false);

  // 删除会话
  const [toDelete, setToDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState('');

  // 消息流容器（自动滚动到底）
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  // 拉取会话详情
  const fetchSession = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await chatApi.getSession(id);
      setSession(data);
      setMessages(data.messages || []);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // 自动滚动到底
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // AI 分析：发送求职者消息并获取分析
  const handleAnalyze = async () => {
    if (!id || !input.trim()) return;
    setAnalyzing(true);
    setError('');
    try {
      const { analysis: result, message } = await chatApi.analyze(id, input.trim());
      setMessages((prev) => [...prev, message]);
      setAnalysis(result);
      setAnalysisMsgId(message.id);
      setInput('');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setAnalyzing(false);
    }
  };

  // 重新生成 AI 分析
  const handleRegenerate = async () => {
    if (!id || !analysisMsgId) return;
    setRegenerating(true);
    setError('');
    try {
      // 取出该求职者消息内容
      const msg = messages.find((m) => m.id === analysisMsgId);
      if (!msg) throw new Error('找不到原始求职者消息');
      const result = await chatApi.regenerate(id, analysisMsgId, msg.content);
      setAnalysis(result);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setRegenerating(false);
    }
  };

  // 选用某条回复发送（直接发送）
  const handleSendReply = async (reply: ChatReply) => {
    if (!id || !analysisMsgId) return;
    setSending(true);
    setError('');
    try {
      const hrMsg = await chatApi.sendReply(id, analysisMsgId, reply);
      setMessages((prev) => [...prev, hrMsg]);
      // 清空当前分析面板
      setAnalysis(null);
      setAnalysisMsgId(null);
      showToast('已发送回复');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setSending(false);
    }
  };

  // 编辑后发送
  const handleEditSend = async () => {
    if (!editReply || !editContent.trim()) return;
    await handleSendReply({ ...editReply, content: editContent.trim() });
    setEditReply(null);
    setEditContent('');
  };

  // 复制到剪贴板
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制到剪贴板');
    } catch {
      showToast('复制失败，请手动选择');
    }
  };

  // 切换会话状态
  const handleToggleStatus = async () => {
    if (!session) return;
    const next = session.status === 'active' ? 'closed' : 'active';
    try {
      const updated = await chatApi.patchSession(session.id, { status: next });
      setSession(updated);
    } catch (err) {
      setError(getErrorMsg(err));
    }
  };

  // 删除会话
  const handleDelete = async () => {
    if (!session) return;
    setDeleting(true);
    try {
      await chatApi.removeSession(session.id);
      navigate('/chat');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setDeleting(false);
    }
  };

  // 点击某条求职者消息上的"查看 AI 分析"
  const handleViewAnalysis = (msg: ChatMessage) => {
    if (msg.ai_analysis) {
      setAnalysis(msg.ai_analysis);
      setAnalysisMsgId(msg.id);
    }
  };

  if (loading) {
    return (
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <Loading />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <div className="card p-8 text-center">
          <p className="text-risk-600">{error || '会话不存在或无权访问'}</p>
          <Link to="/chat" className="btn-primary mt-4 inline-flex">
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-4 lg:py-6 max-w-[1600px] mx-auto">
      {/* 顶部 Header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/chat"
            className="btn-ghost text-sm flex items-center gap-1 flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </Link>
          <div className="min-w-0">
            <h1 className="font-serif text-xl font-bold text-forest-800 truncate">
              {session.title || session.candidate_name || '未命名会话'}
            </h1>
            <p className="text-xs text-forest-500 mt-0.5">
              创建于 {dayjs(session.created_at).format('YYYY-MM-DD HH:mm')}
              {session.last_message_at && (
                <> · 最后消息 {dayjs(session.last_message_at).format('MM-DD HH:mm')}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge
            status={session.status}
            text={session.status === 'active' ? '进行中' : '已关闭'}
          />
          <button
            type="button"
            onClick={handleToggleStatus}
            className="btn-ghost text-xs"
            disabled={deleting}
          >
            {session.status === 'active' ? '关闭会话' : '重新开启'}
          </button>
          <button
            type="button"
            onClick={() => setToDelete(true)}
            className="text-xs px-2 py-1 rounded text-risk-600 hover:bg-risk-50 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            删除
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700">
          {error}
        </div>
      )}

      {/* 主体三栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_400px] gap-4">
        {/* 左栏：会话信息 */}
        <div className="space-y-4">
          {/* 职位卡片 */}
          <div className="card p-4">
            <div className="flex items-center gap-1.5 text-xs text-forest-500 mb-2">
              <Briefcase className="w-3 h-3" />
              咨询职位
            </div>
            {session.position ? (
              <>
                <h3 className="font-medium text-forest-800">{session.position.title}</h3>
                <div className="text-xs text-forest-500 mt-2 space-y-1">
                  {session.position.salary_min && session.position.salary_max && (
                    <div className="flex items-center gap-1">
                      <Wallet className="w-3 h-3" />
                      {session.position.salary_min}-{session.position.salary_max}
                    </div>
                  )}
                  {session.position.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {session.position.location}
                    </div>
                  )}
                </div>
                {session.position.id && (
                  <Link
                    to={`/positions/${session.position.id}`}
                    className="text-xs text-forest-600 hover:underline mt-3 flex items-center gap-1"
                  >
                    查看职位详情
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </>
            ) : (
              <p className="text-sm text-forest-400">职位信息缺失</p>
            )}
          </div>

          {/* 简历卡片 */}
          <div className="card p-4">
            <div className="flex items-center gap-1.5 text-xs text-forest-500 mb-2">
              <FileText className="w-3 h-3" />
              求职者简历
            </div>
            {session.resume ? (
              <>
                <h3 className="font-medium text-forest-800">{session.resume.name}</h3>
                <div className="text-xs text-forest-500 mt-2 space-y-1">
                  {session.resume.current_company && (
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {session.resume.current_company}
                    </div>
                  )}
                  {session.resume.current_title && (
                    <div>当前职位：{session.resume.current_title}</div>
                  )}
                  {session.resume.skills && (
                    <div className="line-clamp-2">技能：{session.resume.skills}</div>
                  )}
                </div>
                {session.resume.id && (
                  <Link
                    to={`/resumes/${session.resume.id}`}
                    className="text-xs text-forest-600 hover:underline mt-3 flex items-center gap-1"
                  >
                    查看简历详情
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </>
            ) : (
              <div className="text-sm text-forest-400">
                <p>未绑定简历</p>
                <p className="text-xs mt-1">AI 分析将仅基于职位与对话内容</p>
              </div>
            )}
          </div>

          {/* 使用提示 */}
          <div className="card p-4 bg-cream-50/60 border-cream-200">
            <div className="flex items-center gap-1.5 text-xs text-forest-600 font-medium mb-2">
              <Lightbulb className="w-3.5 h-3.5" />
              使用方法
            </div>
            <ol className="text-xs text-forest-500 space-y-1.5 list-decimal list-inside">
              <li>在 BOSS 上复制求职者回复</li>
              <li>粘贴到下方输入框</li>
              <li>点击"AI 分析回复"</li>
              <li>从 3 套策略中选优</li>
              <li>可编辑后发送，记录入对话流</li>
            </ol>
          </div>
        </div>

        {/* 中栏：对话流 + 输入框 */}
        <div className="card flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
          {/* 对话流 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-forest-400">
                <Sparkles className="w-10 h-10 mb-3 text-forest-300" />
                <p className="text-sm">还没有对话消息</p>
                <p className="text-xs mt-1">
                  粘贴求职者在 BOSS 上的第一条回复开始对话
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onViewAnalysis={handleViewAnalysis}
                  onCopy={handleCopy}
                  isActiveAnalysis={analysisMsgId === msg.id}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 */}
          <div className="border-t border-forest-100 p-3 bg-cream-50/40">
            <div className="flex gap-2 items-end">
              <textarea
                className="input flex-1 resize-none min-h-[60px] max-h-[140px]"
                placeholder="粘贴求职者在 BOSS 上的最新回复..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleAnalyze();
                  }
                }}
                disabled={analyzing || session.status === 'closed'}
                rows={2}
              />
              <button
                type="button"
                onClick={handleAnalyze}
                className="btn-ai flex items-center gap-1 self-stretch px-4"
                disabled={analyzing || !input.trim() || session.status === 'closed'}
              >
                {analyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {analyzing ? '分析中' : 'AI 分析'}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 text-xs text-forest-400">
              <span>Ctrl/⌘ + Enter 快速分析</span>
              {session.status === 'closed' && (
                <span className="text-ochre-600">会话已关闭，重新开启后可继续</span>
              )}
            </div>
          </div>
        </div>

        {/* 右栏：AI 分析面板 */}
        <div className="card flex flex-col h-[calc(100vh-180px)] min-h-[500px] overflow-hidden">
          {analysis ? (
            <AnalysisPanel
              analysis={analysis}
              regenerating={regenerating}
              sending={sending}
              onRegenerate={handleRegenerate}
              onSendReply={handleSendReply}
              onCopy={handleCopy}
              onEdit={(reply) => {
                setEditReply(reply);
                setEditContent(reply.content);
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-forest-400 p-6">
              <Brain className="w-10 h-10 mb-3 text-forest-300" />
              <p className="text-sm font-medium text-forest-500">AI 资深 HR 分析面板</p>
              <p className="text-xs mt-2 leading-relaxed">
                发送求职者消息后，AI 会以资深 HR 视角分析意图、风险、情绪、画像，
                并生成 3 套不同策略的回复供你选优发送。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 删除确认 */}
      <ConfirmDialog
        open={toDelete}
        title="删除对话会话"
        message="确认删除该对话会话吗？所有对话消息将一并删除，此操作不可撤销。"
        confirmText={deleting ? '删除中...' : '确认删除'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(false)}
      />

      {/* 编辑回复 Modal */}
      <Modal
        open={!!editReply}
        title="编辑回复后发送"
        onClose={() => setEditReply(null)}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setEditReply(null)}
              disabled={sending}
            >
              取消
            </button>
            <button
              type="button"
              className="btn-ai flex items-center gap-1"
              onClick={handleEditSend}
              disabled={sending || !editContent.trim()}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? '发送中...' : '发送并记录'}
            </button>
          </div>
        }
      >
        {editReply && (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-forest-500 mb-1">策略名</div>
              <div className="text-sm font-medium text-forest-700">{editReply.strategyName}</div>
            </div>
            <div>
              <div className="text-xs text-forest-500 mb-1">策略原理</div>
              <p className="text-xs text-forest-500 leading-relaxed">{editReply.rationale}</p>
            </div>
            <div>
              <label className="block text-xs text-forest-500 mb-1">回复内容（可编辑）</label>
              <textarea
                className="input min-h-[180px] resize-y"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-forest-800 text-cream-50 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

// ===== 消息气泡 =====
function MessageBubble({
  message,
  onViewAnalysis,
  onCopy,
  isActiveAnalysis,
}: {
  message: ChatMessage;
  onViewAnalysis: (msg: ChatMessage) => void;
  onCopy: (text: string) => void;
  isActiveAnalysis: boolean;
}) {
  const isCandidate = message.role === 'candidate';
  const time = dayjs(message.created_at).format('HH:mm');

  return (
    <div className={`flex ${isCandidate ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[80%] ${isCandidate ? '' : 'text-right'}`}>
        {/* 角色标签 */}
        <div className={`text-xs text-forest-400 mb-1 ${isCandidate ? 'text-left' : 'text-right'}`}>
          {isCandidate ? '求职者' : '我（HR）'} · {time}
        </div>
        {/* 气泡 */}
        <div
          className={`inline-block px-3.5 py-2.5 rounded-lg text-sm whitespace-pre-wrap break-words text-left ${
            isCandidate
              ? 'bg-cream-50 border border-forest-100 text-forest-800 rounded-tl-sm'
              : 'bg-forest-700 text-cream-50 rounded-tr-sm'
          }`}
        >
          {message.content}
        </div>
        {/* 操作按钮 */}
        <div className={`mt-1 flex gap-2 text-xs ${isCandidate ? '' : 'justify-end'}`}>
          <button
            type="button"
            onClick={() => onCopy(message.content)}
            className="text-forest-400 hover:text-forest-600 flex items-center gap-0.5"
          >
            <Copy className="w-3 h-3" />
            复制
          </button>
          {isCandidate && message.ai_analysis && (
            <button
              type="button"
              onClick={() => onViewAnalysis(message)}
              className={`flex items-center gap-0.5 ${
                isActiveAnalysis ? 'text-forest-700 font-medium' : 'text-forest-400 hover:text-forest-600'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              {isActiveAnalysis ? '当前展示' : '查看 AI 分析'}
            </button>
          )}
        </div>
        {/* 已选回复标记 */}
        {isCandidate && message.selected_reply && (
          <div className="mt-1 text-xs text-forest-500">
            已发送：{message.selected_reply.strategyName}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== AI 分析面板 =====
function AnalysisPanel({
  analysis,
  regenerating,
  sending,
  onRegenerate,
  onSendReply,
  onCopy,
  onEdit,
}: {
  analysis: ChatAnalysisResult;
  regenerating: boolean;
  sending: boolean;
  onRegenerate: () => void;
  onSendReply: (reply: ChatReply) => void;
  onCopy: (text: string) => void;
  onEdit: (reply: ChatReply) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-forest-100 bg-cream-50/40">
        <div className="flex items-center gap-1.5 text-sm font-medium text-forest-700">
          <Brain className="w-4 h-4 text-forest-600" />
          AI 资深 HR 分析
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          className="text-xs text-forest-500 hover:text-forest-700 flex items-center gap-0.5"
          disabled={regenerating}
        >
          {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          重新生成
        </button>
      </div>

      {/* 滚动区 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* 转化概率 */}
        <div className="rounded-lg bg-gradient-to-br from-forest-50 to-cream-50 border border-forest-100 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-forest-500">
              <TrendingUp className="w-3.5 h-3.5" />
              转化入职概率
            </div>
            <span className="text-2xl font-bold font-mono text-forest-700">
              {analysis.conversionProbability}%
            </span>
          </div>
        </div>

        {/* 意图 */}
        <AnalysisBlock icon={<Target className="w-3.5 h-3.5" />} title="求职意图">
          <div className="text-sm text-forest-700">{analysis.intent}</div>
          {analysis.intentType && (
            <div className="mt-1">
              <span className="badge bg-forest-100 text-forest-700 text-xs">{analysis.intentType}</span>
            </div>
          )}
        </AnalysisBlock>

        {/* 风险 */}
        <AnalysisBlock icon={<AlertTriangle className="w-3.5 h-3.5" />} title="风险等级">
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
              RISK_LEVEL_TONE[analysis.riskLevel] || RISK_LEVEL_TONE.low
            }`}
          >
            {RISK_LEVEL_TEXT[analysis.riskLevel] || analysis.riskLevel}
          </span>
          {analysis.riskReasons && analysis.riskReasons.length > 0 && (
            <ul className="mt-2 text-xs text-forest-600 space-y-1 list-disc list-inside">
              {analysis.riskReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </AnalysisBlock>

        {/* 情绪 */}
        <AnalysisBlock icon={<Heart className="w-3.5 h-3.5" />} title="情绪状态">
          <div className="text-sm text-forest-700">{analysis.emotion}</div>
        </AnalysisBlock>

        {/* 画像分类 */}
        <AnalysisBlock icon={<Brain className="w-3.5 h-3.5" />} title="求职者画像">
          <div className="text-sm text-forest-700">{analysis.profileCategory}</div>
        </AnalysisBlock>

        {/* 总策略 */}
        <AnalysisBlock icon={<Lightbulb className="w-3.5 h-3.5" />} title="应对策略">
          <div className="text-xs text-forest-600 leading-relaxed">{analysis.strategy}</div>
        </AnalysisBlock>

        {/* 下一步 */}
        <AnalysisBlock icon={<ArrowRight className="w-3.5 h-3.5" />} title="下一步建议">
          <div className="text-xs text-forest-600 leading-relaxed">{analysis.nextStep}</div>
        </AnalysisBlock>

        {/* 3 套回复策略 */}
        <div className="pt-2">
          <div className="text-xs font-medium text-forest-700 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-ochre-500" />
            3 套回复策略（选优发送）
          </div>
          <div className="space-y-3">
            {analysis.replies.map((reply, idx) => (
              <ReplyCard
                key={idx}
                reply={reply}
                sending={sending}
                onSend={() => onSendReply(reply)}
                onCopy={() => onCopy(reply.content)}
                onEdit={() => onEdit(reply)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 分析块 =====
function AnalysisBlock({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-forest-100 bg-white p-3">
      <div className="flex items-center gap-1.5 text-xs text-forest-500 mb-1.5">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

// ===== 回复策略卡片 =====
function ReplyCard({
  reply,
  sending,
  onSend,
  onCopy,
  onEdit,
}: {
  reply: ChatReply;
  sending: boolean;
  onSend: () => void;
  onCopy: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-lg border border-forest-200 bg-cream-50/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-forest-700 px-2 py-0.5 rounded bg-forest-100">
          {reply.strategyName}
        </div>
      </div>
      <div className="text-sm text-forest-800 whitespace-pre-wrap leading-relaxed">
        {reply.content}
      </div>
      {reply.rationale && (
        <div className="mt-2 text-xs text-forest-500 leading-relaxed border-t border-forest-100 pt-2">
          <span className="font-medium">原理：</span>
          {reply.rationale}
        </div>
      )}
      {/* 操作按钮 */}
      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onSend}
          className="btn-ai text-xs flex items-center gap-1 px-2 py-1"
          disabled={sending}
        >
          {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          选用发送
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="btn-ghost text-xs flex items-center gap-1 px-2 py-1"
          disabled={sending}
        >
          <Pencil className="w-3 h-3" />
          编辑后发
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="text-xs px-2 py-1 rounded text-forest-500 hover:bg-forest-50 flex items-center gap-1"
        >
          <Copy className="w-3 h-3" />
          复制
        </button>
      </div>
    </div>
  );
}

// ===== 小图标组件（职位图标） =====
// 使用 lucide-react 的 Briefcase 图标，无需自定义
