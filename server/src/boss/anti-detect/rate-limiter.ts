// 滑动窗口限流器（参考 AI 速聘 app/boss/helper/rate_limit.py）
// 控制单位时间内操作次数，防止频率过高触发风控

/**
 * 滑动窗口限流器
 */
export class RateLimiter {
  private actions: Map<string, number[]> = new Map();

  constructor(
    /** 时间窗口（毫秒），默认 1 分钟 */
    private windowMs: number = 60_000,
    /** 窗口内最大操作次数 */
    private maxActions: number = 20
  ) {}

  /**
   * 检查是否还能执行操作
   */
  canDo(action: string = 'default'): boolean {
    const now = Date.now();
    const history = (this.actions.get(action) || []).filter(
      t => now - t < this.windowMs
    );
    if (history.length >= this.maxActions) return false;
    history.push(now);
    this.actions.set(action, history);
    return true;
  }

  /**
   * 如果限流就等待，直到可以执行
   */
  async waitIfNeed(action: string = 'default'): Promise<void> {
    while (!this.canDo(action)) {
      // 计算还需要等多久
      const now = Date.now();
      const history = (this.actions.get(action) || []).filter(
        t => now - t < this.windowMs
      );
      if (history.length === 0) break;
      const oldest = Math.min(...history);
      const waitMs = this.windowMs - (now - oldest) + 100;
      await new Promise(r => setTimeout(r, Math.min(waitMs, 10_000)));
    }
  }

  /**
   * 获取当前窗口已用次数
   */
  count(action: string = 'default'): number {
    const now = Date.now();
    const history = (this.actions.get(action) || []).filter(
      t => now - t < this.windowMs
    );
    return history.length;
  }

  /**
   * 重置某类操作
   */
  reset(action: string = 'default'): void {
    this.actions.delete(action);
  }
}

// 预定义的限流器（参考 AI 速聘的限流配置）
// Boss 直聘风控较严，建议保守设置
export const helloLimiter = new RateLimiter(60_000, 10);    // 每分钟最多 10 次打招呼
export const messageLimiter = new RateLimiter(60_000, 30);  // 每分钟最多 30 条消息
export const browseLimiter = new RateLimiter(60_000, 40);   // 每分钟最多 40 次浏览
export const apiLimiter = new RateLimiter(60_000, 60);      // 每分钟最多 60 次 API 调用

// 每日上限（防止超量操作）
export class DailyLimit {
  private static counts: Map<string, number> = new Map();
  private static dates: Map<string, string> = new Map();

  static canDo(action: string, maxPerDay: number): boolean {
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = this.dates.get(action);
    if (lastDate !== today) {
      this.counts.set(action, 0);
      this.dates.set(action, today);
    }
    const count = this.counts.get(action) || 0;
    if (count >= maxPerDay) return false;
    this.counts.set(action, count + 1);
    return true;
  }

  static count(action: string): number {
    const today = new Date().toISOString().slice(0, 10);
    if (this.dates.get(action) !== today) return 0;
    return this.counts.get(action) || 0;
  }
}

// 每日打招呼上限（参考 AI 速聘 say_hello_max_times，默认 50）
export const MAX_DAILY_HELLO = 50;
