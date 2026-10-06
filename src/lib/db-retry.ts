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

/**
 * 「这个错多半是因为运行中的 Prisma 客户端比 schema 旧」的判定。
 *
 * 同一个根因有两种表现，**这个函数只管第二种**：
 * - 整个模型缺失 → `Cannot read properties of undefined (reading 'findFirst')`，
 *   启动时由 `db.ts` 的 `assertGeneratedModels` 拦下（报错本身看不出与 schema 有关）
 * - 模型在、字段不在 → `Unknown field 'viewCount' for select statement on model 'Questionnaire'`，
 *   只有真跑起来才暴露：字段级的差异不在客户端的模型清单里，启动检查发现不了
 *
 * 判据故意放宽到「Unknown field / argument」：这两种提示**有可能是我们自己敲错了字段名**，
 * 所以它的产出是一句「先怎么做」的提示，而不是一个结论 —— 原文照旧抛出，不多不少。
 */
const STALE_CLIENT_PATTERNS = [
  'for select statement on model',
  'for include statement on model',
  'Unknown field',
  'Unknown argument',
];

export function describeStaleClientHint(error: unknown): string | null {
  if (!error) return null;

  const message = errorMessage(error);
  if (!STALE_CLIENT_PATTERNS.some((pattern) => message.includes(pattern))) return null;

  return (
    '[db] 查询里的模型/字段与 Prisma 客户端对不上。两种可能：\n' +
    '① **改了 schema 之后没重启服务**（最常见）：migrate 会重新生成客户端，' +
    '但运行中的进程仍握着旧模块，重启一次即可（`pnpm db:generate` 之后重跑 `pnpm dev`）。\n' +
    '② 这处查询确实写错了字段名 —— 那就不是环境问题，去看那个 `select`。'
  );
}
