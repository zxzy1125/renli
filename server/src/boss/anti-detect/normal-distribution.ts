// 正态分布随机延时（参考 AI 速聘 app/boss/helper/normal_distribution.py）
// 让操作间隔符合正态分布，避免固定 sleep 被识别为机器人
// 用 Box-Muller 变换生成正态分布随机数

/**
 * 生成一个正态分布的随机延时（毫秒）
 * @param mean 均值（默认 2000ms = 2秒）
 * @param stddev 标准差（默认 500ms）
 * @param min 最小值（默认 800ms）
 * @param max 最大值（默认 5000ms）
 */
export function normalDelay(
  mean: number = 2000,
  stddev: number = 500,
  min: number = 800,
  max: number = 5000
): number {
  // Box-Muller 变换
  const u1 = Math.random() || 1e-10;  // 避免 0
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const value = mean + z * stddev;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * 异步等待一段正态分布的时间
 * @param mean 均值毫秒
 * @param stddev 标准差毫秒
 */
export async function humanSleep(
  mean: number = 2000,
  stddev: number = 500
): Promise<number> {
  const delay = normalDelay(mean, stddev);
  await new Promise(resolve => setTimeout(resolve, delay));
  return delay;
}

/**
 * 模拟阅读时长（看简历、看消息等）
 * 通常 3-8 秒
 */
export async function readingSleep(): Promise<number> {
  return await humanSleep(5000, 1500);
}

/**
 * 模拟打字时长（根据字数估算）
 * 普通人打字速度约 40-80 字/分钟
 */
export async function typingSleep(textLength: number): Promise<number> {
  // 每字 600-1200ms
  const perChar = 600 + Math.random() * 600;
  const total = textLength * perChar;
  // 加点随机抖动
  const jitter = normalDelay(500, 200);
  const final = Math.min(30000, total + jitter);  // 最多 30 秒
  await new Promise(resolve => setTimeout(resolve, final));
  return final;
}
