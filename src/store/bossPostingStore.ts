// 后台 BOSS 文案生成 store（跨页面持久化，支持通知提醒）
import { create } from 'zustand';
import { aiApi, getErrorMsg } from '@/lib/api';

export interface BossPosting {
  style: string;
  title: string;
  content: string;
}

export interface BossPostingTask {
  id: string;
  positionId: string;
  positionTitle: string;
  status: 'generating' | 'completed' | 'error';
  postings: BossPosting[];
  error: string;
  createdAt: number;
  notified: boolean; // 用户是否已看到通知
  regeneratingStyles?: string[]; // 正在重新生成的风格列表
}

interface BossPostingState {
  tasks: BossPostingTask[];
  pendingViewTaskId: string | null; // 从通知跳来时，等待页面打开的任务 ID
  // 发起后台生成（全部 3 套）
  startGeneration: (
    positionId: string,
    positionTitle: string,
    industry?: string,
    city?: string
  ) => string;
  // 重新生成单个风格
  regenerateStyle: (
    positionId: string,
    positionTitle: string,
    style: string,
    industry?: string,
    city?: string
  ) => string;
  // 标记通知已读
  markNotified: (taskId: string) => void;
  // 查看结果（清除未读状态）
  viewResult: (taskId: string) => void;
  // 标记待查看（通知跳转用）
  setPendingView: (taskId: string | null) => void;
  // 删除任务
  removeTask: (taskId: string) => void;
  // 获取指定职位的最新完成任务
  getLatestResult: (positionId: string) => BossPostingTask | undefined;
  // 是否有未读通知
  hasUnread: () => boolean;
  // 将某个任务的某个风格标记为重新生成中
  setStyleRegenerating: (taskId: string, style: string, regenerating: boolean) => void;
  // 替换某个任务中指定风格的文案
  replacePosting: (taskId: string, style: string, newPosting: BossPosting) => void;
}

let taskCounter = 0;

// 标准化单个 posting 对象的字段名
function normalizePosting(p: Record<string, unknown>): BossPosting {
  return {
    style: String(p.style || ''),
    title: String(p.title || p.jobTitle || ''),
    content: String(p.content || p.jobDescription || p.description || ''),
  };
}

// 兼容多种返回结构，提取 BossPosting 数组
export function extractPostings(data: unknown, fallbackTitle: string): BossPosting[] {
  const normalizeArray = (arr: unknown[]): BossPosting[] =>
    arr.map((item) =>
      item && typeof item === 'object'
        ? normalizePosting(item as Record<string, unknown>)
        : { style: '生成结果', title: fallbackTitle, content: String(item) }
    );

  if (Array.isArray(data)) return normalizeArray(data);
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.postings)) return normalizeArray(obj.postings);
    if (Array.isArray((obj as { results?: unknown[] }).results))
      return normalizeArray((obj as { results: unknown[] }).results);
    const candidate = (obj as { content?: unknown }).content;
    if (typeof candidate === 'string') return safeParsePostings(candidate, fallbackTitle);
    return [{ style: '生成结果', title: fallbackTitle, content: JSON.stringify(data, null, 2) }];
  }
  if (typeof data === 'string') return safeParsePostings(data, fallbackTitle);
  return [{ style: '生成结果', title: fallbackTitle, content: String(data) }];
}

function safeParsePostings(text: string, fallbackTitle: string): BossPosting[] {
  try {
    const parsed = JSON.parse(text);
    return extractPostings(parsed, fallbackTitle);
  } catch {
    return [{ style: '生成结果', title: 'BOSS 发布文案', content: text }];
  }
}

export const useBossPostingStore = create<BossPostingState>((set, get) => ({
  tasks: [],
  pendingViewTaskId: null,

  startGeneration: (positionId, positionTitle, industry, city) => {
    const taskId = `bp_${Date.now()}_${++taskCounter}`;
    const task: BossPostingTask = {
      id: taskId,
      positionId,
      positionTitle,
      status: 'generating',
      postings: [],
      error: '',
      createdAt: Date.now(),
      notified: false,
    };
    set((s) => ({ tasks: [...s.tasks, task] }));

    // 后台执行（不 await，不阻塞 UI）
    (async () => {
      try {
        const res = await aiApi.generateBossPosting(positionId, industry, city);
        const data = (res as { data?: unknown }).data ?? res;
        const postings = extractPostings(data, positionTitle);
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, status: 'completed' as const, postings } : t
          ),
        }));
      } catch (err) {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, status: 'error' as const, error: getErrorMsg(err) } : t
          ),
        }));
      }
    })();

    return taskId;
  },

  regenerateStyle: (positionId, positionTitle, style, industry, city) => {
    const taskId = `bp_${Date.now()}_${++taskCounter}`;
    const task: BossPostingTask = {
      id: taskId,
      positionId,
      positionTitle,
      status: 'generating',
      postings: [],
      error: '',
      createdAt: Date.now(),
      notified: false,
      regeneratingStyles: [style],
    };
    set((s) => ({ tasks: [...s.tasks, task] }));

    // 后台执行
    (async () => {
      try {
        const res = await aiApi.generateBossPosting(positionId, industry, city, style);
        const data = (res as { data?: unknown }).data ?? res;
        const postings = extractPostings(data, positionTitle);
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, status: 'completed' as const, postings } : t
          ),
        }));
      } catch (err) {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, status: 'error' as const, error: getErrorMsg(err) } : t
          ),
        }));
      }
    })();

    return taskId;
  },

  setStyleRegenerating: (taskId, style, regenerating) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const styles = t.regeneratingStyles ?? [];
        return {
          ...t,
          regeneratingStyles: regenerating
            ? [...new Set([...styles, style])]
            : styles.filter((s) => s !== style),
        };
      }),
    }));
  },

  replacePosting: (taskId, style, newPosting) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const idx = t.postings.findIndex((p) => p.style === style);
        if (idx === -1) return { ...t, postings: [...t.postings, newPosting] };
        const updated = [...t.postings];
        updated[idx] = newPosting;
        return { ...t, postings: updated };
      }),
    }));
  },

  markNotified: (taskId) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, notified: true } : t
      ),
    }));
  },

  viewResult: (taskId) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, notified: true } : t
      ),
    }));
  },

  setPendingView: (taskId) => {
    set({ pendingViewTaskId: taskId });
  },

  removeTask: (taskId) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }));
  },

  getLatestResult: (positionId) => {
    return get()
      .tasks.filter((t) => t.positionId === positionId && t.status === 'completed')
      .sort((a, b) => b.createdAt - a.createdAt)[0];
  },

  hasUnread: () => {
    return get().tasks.some(
      (t) => !t.notified && (t.status === 'completed' || t.status === 'error')
    );
  },
}));
