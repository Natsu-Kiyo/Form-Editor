/**
 * 「这次失败值不值得重试」的判定。
 *
 * 单独放一个文件、不放进 `db.ts`：`db.ts` 一被导入就会建连接（`server-only`），
 * 没法在单测里直接 import。而这些字符串判定又是**必须被单测盖住**的部分 ——
 * 判错了要么把 SQL 错误重试三遍（浪费几百毫秒还报同样的错），
 * 要么把连接抖动漏给用户（页面上就是一个 Runtime Error）。
 */

/** 只在连接层面出错时重试：这些错重试一次基本就好了，而 SQL 错误重试多少次都一样 */
const TRANSIENT_ERROR_PATTERNS = [
  'Connection terminated due to connection timeout',
  'Connection terminated unexpectedly',
  'timeout expired',
  'Connection reset by peer',
  'ECONNRESET',
  'ETIMEDOUT',
  // 下面两条来自我们自己设的查询级超时（`statement_timeout` / `query_timeout`）。
  // 超时本身多半意味着「这条连接已经不可用」，重试会拿到一条新连接 —— 正是我们要的
  'canceling statement due to statement timeout',
  'Query read timeout',
  // 连接被对端关掉的各种说法，不同驱动/平台措辞不同，一并认下
  'Client has encountered a connection error',
  'Server has closed the connection',
];

/** Prisma 的连接类错误码：P1001 连不上 / P1002 超时 / P1017 连接被关闭 */
const TRANSIENT_ERROR_CODES = ['P1001', 'P1002', 'P1017'];

/**
 * 重试的等待时长；数组长度即「最多额外重试几次」。
 * 交付间隔递增：第一次几乎立刻重试（多数抖动一次就过），
 * 后面留出一点时间让上游（Neon 唤醒计算节点）走完。
 */
export const RETRY_DELAYS_MS = [300, 900];

/**
 * 取出错误的文字描述。
 * 不能只认 `instanceof Error`：驱动与中间层抛出来的可能是普通对象
 * （Prisma 会把底层错误包一层），只认 Error 会让一部分抖动漏过去。
 */
function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }

  return String(error);
}

export function isTransientConnectionError(error: unknown) {
  if (!error) return false;

  if (typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code ?? '');
    if (TRANSIENT_ERROR_CODES.includes(code)) return true;
  }

  const message = errorMessage(error);
  return TRANSIENT_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
