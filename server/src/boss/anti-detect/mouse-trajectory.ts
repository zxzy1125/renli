// 人类鼠标轨迹模拟（参考 AI 速聘 app/boss/human_web_cursor.py）
// 用贝塞尔曲线模拟人类鼠标移动，不是直线瞬移
import type { Page } from 'playwright';

/**
 * 生成三次贝塞尔曲线上的点
 */
function bezier3(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u * u * u * p0
    + 3 * u * u * t * p1
    + 3 * u * t * t * p2
    + t * t * t * p3;
}

/**
 * 模拟人类鼠标移动到目标坐标（贝塞尔曲线轨迹）
 */
export async function humanMove(
  page: Page,
  x: number,
  y: number,
  options: { steps?: number; jitter?: number } = {}
): Promise<void> {
  const { steps = 25, jitter = 50 } = options;

  // 获取当前鼠标位置（从页面读取）
  const start = await page.evaluate(() => ({
    x: (globalThis as any).__mouseX ?? (globalThis as any).innerWidth / 2,
    y: (globalThis as any).__mouseY ?? (globalThis as any).innerHeight / 2,
  })).catch(() => ({ x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 }));

  // 两个控制点（让曲线弯一弯，不是直线）
  const control1 = {
    x: start.x + (x - start.x) * 0.3 + (Math.random() - 0.5) * jitter,
    y: start.y + (y - start.y) * 0.3 + (Math.random() - 0.5) * jitter,
  };
  const control2 = {
    x: start.x + (x - start.x) * 0.7 + (Math.random() - 0.5) * jitter,
    y: start.y + (y - start.y) * 0.7 + (Math.random() - 0.5) * jitter,
  };

  // 沿曲线移动
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = bezier3(t, start.x, control1.x, control2.x, x);
    const py = bezier3(t, start.y, control1.y, control2.y, y);
    await page.mouse.move(px, py);
    // 每步间隔 10-30ms（人类移动速度）
    await new Promise(r => setTimeout(r, 10 + Math.random() * 20));
  }

  // 记录最终位置
  await page.evaluate(([px, py]) => {
    (globalThis as any).__mouseX = px;
    (globalThis as any).__mouseY = py;
  }, [x, y]).catch(() => {});
}

/**
 * 模拟人类点击（移动 + 按下 + 停留 + 抬起）
 */
export async function humanClick(
  page: Page,
  selector: string,
  options: { jitter?: number } = {}
): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible', timeout: 10_000 });
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`元素不存在或不可见: ${selector}`);

  // 在元素范围内随机选一个点（不是中心点）
  const x = box.x + box.width * (0.2 + Math.random() * 0.6);
  const y = box.y + box.height * (0.2 + Math.random() * 0.6);

  await humanMove(page, x, y, options);
  // 按下前短暂停留
  await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
  await page.mouse.down();
  // 按下停留 50-150ms（人类点击有持续时间）
  await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
  await page.mouse.up();
}

/**
 * 模拟人类输入文字（逐字输入，不是一次性填充）
 */
export async function humanType(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible' });
  await humanClick(page, selector);
  // 清空
  await page.fill(selector, '');
  // 逐字输入
  for (const char of text) {
    await page.type(selector, char, { delay: 80 + Math.random() * 120 });
  }
}

/**
 * 模拟人类滚动页面
 */
export async function humanScroll(
  page: Page,
  deltaY: number = 300
): Promise<void> {
  // 分多次滚动，每次 50-100px
  const steps = Math.ceil(Math.abs(deltaY) / 80);
  const stepSize = deltaY / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepSize);
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
  }
  await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
}
