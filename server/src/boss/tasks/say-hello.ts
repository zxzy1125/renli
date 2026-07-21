// 自动打招呼任务（参考 AI 速聘 app/boss/recommend.py + app/boss/interaction.py）
// 流程：进入推荐页 → 滚动加载候选人 → 找打招呼按钮 → 点击 → 记录 → 随机浏览
//
// 注意：Boss 直聘页面结构会随版本变化，下面的选择器需要你用浏览器 DevTools 实际确认
// 如果选择器失效，请打开 https://www.zhipin.com/web/chat/recommend
// F12 查看"打招呼"按钮的实际 class，更新下方 SELECTORS
import type { Page } from 'playwright';
import { getBossPage } from '../automation/browser.js';
import { humanClick, humanScroll, humanMove } from '../anti-detect/mouse-trajectory.js';
import { humanSleep, readingSleep } from '../anti-detect/normal-distribution.js';
import { helloLimiter, DailyLimit, MAX_DAILY_HELLO } from '../anti-detect/rate-limiter.js';
import { logAction } from '../anti-detect/action-logger.js';
import { logger } from '../../utils/logger.js';

// ===== 选择器配置（Boss 直聘页面元素）=====
// 这些选择器可能随 Boss 网站改版而失效，需要定期维护
const SELECTORS = {
  // 推荐页候选人卡片
  candidateCard: '.card-item, .recommend-card, [class*="card"]',
  // 打招呼按钮（多种可能的 class）
  helloButton: '.btn-greet, .greet-btn, [class*="greet"], button[class*="hello"]',
  // 已打招呼状态（避免重复）
  helloDone: '.btn-greeted, .greeted, [class*="greeted"]',
  // 候选人姓名
  candidateName: '.name, .candidate-name, [class*="name"]',
  // 简历链接
  resumeLink: '.name a, .candidate-name a',
  // 下一页按钮
  nextPage: '.next, [class*="next"]',
};

export interface SayHelloConfig {
  userId: string;
  city?: string;              // 城市 code（如 101010100 表示北京）
  jobId?: string;             // 加密后的岗位 ID（从 Boss 后台拿）
  template?: string;          // 自定义打招呼话术（不填用 Boss 默认）
  maxCount?: number;          // 本次最大打招呼数（默认 50）
  browseRatio?: number;       // 随机浏览简历的概率（0-1，默认 0.2）
}

export interface SayHelloResult {
  total: number;              // 总打招呼数
  success: number;            // 成功数
  failed: number;             // 失败数
  browsed: number;            // 浏览简历数
  stopped: boolean;           // 是否被外部停止
  stopReason?: string;        // 停止原因
  startedAt: string;
  finishedAt: string;
}

// 全局任务状态（用于外部停止）
let currentTask: {
  isRunning: boolean;
  shouldStop: boolean;
  result: SayHelloResult | null;
} = {
  isRunning: false,
  shouldStop: false,
  result: null,
};

// 任务状态变更回调（Agent 模式下注入，用于通过 WebSocket 上报给服务器）
type StatusReporter = (status: typeof currentTask) => void;
let statusReporter: StatusReporter | null = null;

/**
 * 注入状态上报器（Agent 模式下用）
 * 传入 null 则清除，不再上报
 */
export function setStatusReporter(reporter: StatusReporter | null): void {
  statusReporter = reporter;
}

// 内部：更新状态并触发上报
function updateTaskStatus(patch: Partial<typeof currentTask>): void {
  Object.assign(currentTask, patch);
  if (statusReporter) {
    try {
      statusReporter({ ...currentTask });
    } catch {
      // 上报失败不影响任务执行
    }
  }
}

/**
 * 停止当前打招呼任务
 */
export function stopSayHello(reason: string = '用户手动停止'): void {
  if (currentTask.isRunning) {
    currentTask.shouldStop = true;
    logger.info('打招呼任务收到停止信号', { reason });
    if (statusReporter) statusReporter({ ...currentTask });
  }
}

/**
 * 获取当前任务状态
 */
export function getTaskStatus() {
  return { ...currentTask };
}

/**
 * 启动自动打招呼任务
 */
export async function runSayHello(config: SayHelloConfig): Promise<SayHelloResult> {
  if (currentTask.isRunning) {
    throw new Error('已有打招呼任务在运行，请先停止');
  }

  const maxCount = Math.min(config.maxCount || MAX_DAILY_HELLO, MAX_DAILY_HELLO);
  const browseRatio = config.browseRatio ?? 0.2;

  const result: SayHelloResult = {
    total: 0,
    success: 0,
    failed: 0,
    browsed: 0,
    stopped: false,
    startedAt: new Date().toISOString(),
    finishedAt: '',
  };

  updateTaskStatus({ isRunning: true, shouldStop: false, result });

  try {
    // 检查每日上限
    const todayCount = DailyLimit.count('say_hello');
    if (todayCount >= maxCount) {
      result.stopReason = `今日已打招呼 ${todayCount} 次，达到上限`;
      result.stopped = true;
      return result;
    }
    const remainingToday = maxCount - todayCount;

    const page = await getBossPage();

    // 进入推荐页
    const recommendUrl = config.city
      ? `https://www.zhipin.com/web/chat/recommend?city=${config.city}`
      : 'https://www.zhipin.com/web/chat/recommend';
    await page.goto(recommendUrl, { waitUntil: 'domcontentloaded' });
    await humanSleep(3000, 800);
    logger.info('已进入推荐页', { url: recommendUrl, remainingToday });

    let scrolledTimes = 0;
    const maxScrolls = 30;  // 最多滚动 30 次防死循环

    while (result.success < remainingToday && !currentTask.shouldStop) {
      // 限流：每分钟最多 10 次
      await helloLimiter.waitIfNeed('say_hello');

      // 检查是否被停止
      if (currentTask.shouldStop) break;

      // 查找页面上的打招呼按钮
      const helloButtons = await page.locator(SELECTORS.helloButton).all();
      const visibleButtons = [];
      for (const btn of helloButtons) {
        if (await btn.isVisible().catch(() => false)) {
          visibleButtons.push(btn);
        }
      }

      if (visibleButtons.length === 0) {
        // 没有可打招呼的，滚动加载更多
        if (scrolledTimes >= maxScrolls) {
          result.stopReason = '已滚动到底，没有更多候选人';
          break;
        }
        await humanScroll(page, 600 + Math.random() * 400);
        await humanSleep(2000, 500);
        scrolledTimes++;
        continue;
      }

      // 点第一个可打招呼的
      try {
        // 获取候选人姓名（用于日志）
        const card = visibleButtons[0].locator('xpath=ancestor::*[contains(@class,"card")][1]');
        const nameText = await card.locator(SELECTORS.candidateName).first().textContent().catch(() => '未知');
        const candidateName = (nameText || '').trim();

        // 点击打招呼
        await humanClick(page, SELECTORS.helloButton);
        await humanSleep(1500, 400);

        // 如果有自定义话术，填写
        if (config.template) {
          await fillGreetingTemplate(page, config.template);
        }

        result.success++;
        result.total++;
        logAction({
          userId: config.userId,
          action: 'say_hello',
          target: candidateName,
          detail: { jobId: config.jobId, city: config.city },
        });
        logger.info('打招呼成功', { candidate: candidateName, count: result.success });
        // 实时上报进度（Agent 模式下会转发给服务器）
        updateTaskStatus({ result });

        // 随机浏览简历（伪装行为）
        if (Math.random() < browseRatio) {
          await browseResume(page);
          result.browsed++;
          updateTaskStatus({ result });
        }

        // 滚动一下，避免一直点同一位置
        await humanScroll(page, 100 + Math.random() * 200);
        scrolledTimes = 0;
      } catch (err: any) {
        result.failed++;
        result.total++;
        logger.warn('打招呼失败', { error: err?.message });
        await humanSleep(2000, 500);
        // 滚动跳过这个
        await humanScroll(page, 300);
      }
    }

    if (currentTask.shouldStop) {
      result.stopped = true;
      result.stopReason = result.stopReason || '用户手动停止';
    }
  } catch (err: any) {
    result.stopped = true;
    result.stopReason = '异常: ' + (err?.message || err);
    logger.error('打招呼任务异常', err?.message);
  } finally {
    result.finishedAt = new Date().toISOString();
    updateTaskStatus({ isRunning: false, result });
  }

  return result;
}

/**
 * 填写自定义打招呼话术（如果有弹窗）
 */
async function fillGreetingTemplate(page: Page, template: string): Promise<void> {
  try {
    // Boss 可能弹出话术输入框
    const textarea = page.locator('textarea[class*="greet"], textarea[class*="message"]').first();
    if (await textarea.isVisible({ timeout: 1000 }).catch(() => false)) {
      await textarea.fill('');
      await textarea.type(template, { delay: 50 });
      // 点发送
      const sendBtn = page.locator('button[class*="send"], [class*="submit"]').first();
      if (await sendBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await sendBtn.click();
      }
    }
  } catch {
    // 没有话术输入框就跳过（用默认打招呼）
  }
}

/**
 * 随机浏览一份简历（伪装行为，参考 AI 速聘 other_random_api.py）
 */
async function browseResume(page: Page): Promise<void> {
  try {
    const resumeLink = page.locator(SELECTORS.resumeLink).first();
    if (await resumeLink.isVisible({ timeout: 1000 }).catch(() => false)) {
      await humanClick(page, SELECTORS.resumeLink);
      await readingSleep();  // 看简历 3-8 秒
      await page.goBack();
      await humanSleep(1500, 400);
    }
  } catch {
    // 浏览失败就算了
  }
}
