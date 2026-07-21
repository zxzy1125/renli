// Playwright CDP 连接管理：连接到用户已启动的 Chrome（端口 9222）
// 用户需先执行：chrome.exe --remote-debugging-port=9222 --user-data-dir=...
// 并手动登录 Boss 直聘
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { logger } from '../../utils/logger.js';

const CDP_ENDPOINT = process.env.BOSS_CDP_ENDPOINT || 'http://localhost:9222';

let browser: Browser | null = null;
let context: BrowserContext | null = null;

/**
 * 连接到用户已启动的 Chrome 浏览器（通过 CDP 协议）
 * 不会启动新浏览器，复用用户已登录的会话
 */
export async function connectToBrowser(): Promise<BrowserContext> {
  if (context) {
    // 检查连接是否还活着
    try {
      await context.pages();
      return context;
    } catch {
      context = null;
      browser = null;
    }
  }

  try {
    browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    const contexts = browser.contexts();
    context = contexts[0] || (await browser.newContext());
    logger.info('已连接到 Chrome（CDP）', { endpoint: CDP_ENDPOINT });
    return context;
  } catch (err: any) {
    throw new Error(
      '无法连接 Chrome，请先启动带调试端口的 Chrome：\n' +
      '  chrome.exe --remote-debugging-port=9222 --user-data-dir="D:\\boss-profile"\n' +
      '并手动登录 Boss 直聘后重试。\n' +
      '原始错误：' + (err?.message || err)
    );
  }
}

/**
 * 获取 Boss 直聘页面（优先复用已打开的，没有就新开）
 */
export async function getBossPage(): Promise<Page> {
  const ctx = await connectToBrowser();
  const pages = ctx.pages();
  const bossPage = pages.find(p => p.url().includes('zhipin.com'));
  if (bossPage) return bossPage;
  const page = await ctx.newPage();
  await page.goto('https://www.zhipin.com/');
  return page;
}

/**
 * 获取当前登录的 Boss 用户信息（从页面 cookie/localStorage 提取）
 */
export async function getBossUserInfo(): Promise<{ uid: string; name: string } | null> {
  try {
    const page = await getBossPage();
    // 从页面 JS 读取当前登录用户
    const info = await page.evaluate(() => {
      const g = globalThis as any;
      const uid = g.__INITIAL_STATE__?.user?.uid
        || g.__STORE__?.state?.user?.uid
        || g.document?.cookie?.match(/wd_guid=([^;]+)/)?.[1]
        || '';
      const name = g.__INITIAL_STATE__?.user?.name
        || g.__STORE__?.state?.user?.name
        || '';
      return { uid, name };
    }).catch(() => ({ uid: '', name: '' }));
    return info.uid ? info : null;
  } catch {
    return null;
  }
}

/**
 * 获取当前所有 Cookie（用于持久化）
 */
export async function getCookies(): Promise<any[]> {
  const ctx = await connectToBrowser();
  return await ctx.cookies();
}

/**
 * 断开连接（不关闭浏览器，只断开 CDP 连接）
 */
export async function disconnectBrowser(): Promise<void> {
  if (browser) {
    try {
      await browser.close();
    } catch {
      // ignore
    }
    browser = null;
    context = null;
    logger.info('已断开 Chrome CDP 连接');
  }
}

/**
 * 检查连接状态
 */
export async function checkConnection(): Promise<boolean> {
  try {
    if (!browser) return false;
    await browser.version();
    return true;
  } catch {
    return false;
  }
}
