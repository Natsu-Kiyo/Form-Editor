import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '@/config/env';
import { PrismaClient } from '@/generated/prisma/client';
import { withVerifiedTls } from '@/lib/database-url';
import {
  describeStaleClientHint,
  isTransientConnectionError,
  RETRY_DELAYS_MS,
  sleep,
} from '@/lib/db-retry';

/**
 * 全应用唯一的数据库访问出口。
 *
 * 规则（见 AGENTS.md）：
 * - 组件与 Server Action 都不得自行 `new PrismaClient()`。
 * - 所有查询写在 `src/features/<name>/api/*.ts`，并在文件首行 `import 'server-only'`。
 *
 * Prisma 7 起 SQL 客户端不再带 Rust 引擎，必须显式传入 driver adapter。
 * 真正的池化由 Neon 的**池化主机名**（`...-pooler...`）承担，而不是连接串参数。
 *
 * 连接串过一道 `withVerifiedTls`：生产环境的 DATABASE_URL 由平台注入、
 * 值不受我们控制，TLS 强度要在我们自己的代码里钉死（见该文件顶部说明）。
 */

/**
 * 单个请求**从池子里拿到连接**的最长时间（同时也管建连超时）。
 *
 * 这个值原本是 5 秒，理由是「冷启动第一次尝试本身就在推进唤醒，失败不白费，
 * 5 秒失败 → 立刻重试 → 第二次几秒内成功，比一次死等 15 秒更快」。
 *
 * **那个理由只对「建连」成立，对「排队」是错的** —— 而它在 E2E 里真正触发的全是后者：
 * `max` 很小时，任何一条查询占着连接超过这个上限，同时打进来的请求就会直接抛
 * `timeout exceeded when trying to connect`。**那不是网络慢，是等不到连接**。
 *
 * 实测（临时脚本跑的三组对照，跑完已删）：
 * - `max: 1` + 5 秒 → 占用者 sleep 6 秒时，并发那条**立刻失败**
 * - `max: 1` + 20 秒 → 同一条并发请求**成功，等了 6.7 秒**
 * - `max: 2` + 5 秒 → 同一条并发请求成功，等了 2.6 秒
 *
 * 另外量了「建连本身有多慢」，结论是**这个上限根本不该在建连上触发**：
 * 裸 TCP 建连 205–468ms，含 TLS 与认证的首次查询 1.7–3.0 秒，
 * 稳态往返 220ms（跨区域到新加坡的固有延迟）。
 *
 * 所以把它调大**不会拖慢冷启动**（那种情况压根碰不到上限），只会让排在后面的请求
 * 从**失败**变成**等待** —— 而失败还会被重试层再排三次队，通常比直接等更慢。
 * 全量 E2E 日志里那 120 条「已耗时 5009ms」就是它。
 */
const CONNECTION_TIMEOUT_MS = 15_000;

/**
 * 单个实例的连接数。
 *
 * 曾经是 **4**，后来收回 **1**：放到 4 之后「保存卡在『保存中…』二十秒」，
 * 服务端日志是 `连接类错误（已耗时 10034ms）`，当时的结论是「并行建连本身要十几秒」。
 *
 * 那个观察是真的，但**结论下早了**：今天在同一台库上实测，第二条连接建起来只要 **2.3 秒**，
 * 而 `max: 1` 的代价是实打实的 —— 一条 4–6 秒的写入事务会把**所有**并发请求挡在门外，
 * 挡满 5 秒就报错（见上面 `CONNECTION_TIMEOUT_MS` 的实测）。
 *
 * 取 **2** 而不是 4：pg 的池子是**懒建**的，第二条只在第一条忙的时候才建，
 * 空下来 60 秒后还回去 —— 于是稳态仍是一条连接（实测稳态往返 220ms 不变），
 * 只有真出现并发时才多花一次建连。这既解掉了排队，又不会回到「4 条并行建连」的老问题。
 *
 * 想减少跨区域耗时，真正的办法仍然是**减少查询次数**，不是加连接；这里只是不再让
 * 「一条慢查询」升级成「所有请求一起报错」。
 */
const MAX_CONNECTIONS = 2;

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: withVerifiedTls(env.DATABASE_URL),
    max: MAX_CONNECTIONS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    /**
     * **尽量复用连接，不要频繁还回去**。
     *
     * 这里调过三次，最后落在 60 秒，每次的依据都是实测：
     * - 稳态查询往返 **223ms**（复用一条活连接就是这个数）
     * - pg 默认的空闲 10 秒就还连接 → 每次空闲后都要重新建连，
     *   而重连意味着让 Neon 新建一个**服务端后端**，当前环境下实测 **5–10 秒**，
     *   有时直接超时。整套 E2E 因此从 5.7 分钟涨到 11 分钟。
     *
     * 复用的代价是「偶尔撞上一条已被池化层收回、但客户端还不知道的连接」——
     * 那会让查询挂住，但已经有 `query_timeout`（12 秒）把它掐掉并重试。
     * 「偶尔多花 12 秒」比「隔一会儿就多花 5–10 秒」划算得多。
     */
    idleTimeoutMillis: 60_000,
    /**
     * **查询级超时**，两把都要有。
     *
     * 没有它会出现最糟的一种故障：连接被静默掐断（计算节点挂起时 TCP 半开，
     * 中间设备不一定会回 RST），而 `max: 1` 时那条唯一连接上挂着的查询就**一直等**下去
     * （Windows 的 TCP 超时可以长达两小时）—— 既不报错、也不会有异常可重试，
     * 页面就那么白着。E2E 里表现为「等了 180 秒也没等到按钮」，服务端一声不吭。
     *
     * 服务端那把（`statement_timeout`）先触发，返回的是正常的 Postgres 错误；
     * 客户端这把（`query_timeout`）略长一点兜底 —— 万一连服务端的回包都回不来，
     * 本地也要能自己把连接掐掉并重试。
     */
    statement_timeout: 10_000,
    query_timeout: 12_000,
  });

  const base = new PrismaClient({
    adapter,
    /**
     * **交互式事务的超时（默认只有 5 秒，对这个库太短了）**。
     *
     * Prisma 默认 `timeout: 5000`。而我们的写路径都是「一个事务里连发 N 条语句」——
     * 建一份问卷（问卷 + N 道题 + 选项）、保存草稿（更新 + 删旧题 + 逐题重建）、
     * 回滚版本…… 数据在境外，一次往返 **223ms**，语句一多就撑破 5 秒，
     * 报错是 `A query cannot be executed on an expired transaction`
     * （实测：`timeout for this transaction was 5000 ms, however 8571 ms passed`）。
     *
     * 这个坑一直潜伏着，只是保存路径变重之后被触发得更频繁 —— 它才是
     * E2E 里「点保存之后一直不返回」那几次的根因。
     *
     * `maxWait` 是从池子里拿连接的最长等待：单连接 + 偶尔建连要几秒，10 秒才够。
     */
    transactionOptions: { timeout: 20_000, maxWait: 10_000 },
  });

  /**
   * 给所有查询套一层「连接类错误重试」。
   *
   * 库在境外且会挂起，冷启动失败属于**基础设施的瞬态问题**，不该让它冒到页面上
   * 变成一个 Runtime Error（用户看到的会是「连接超时」，而不是「哪里点错了」）。
   * 只对连接类错误重试两次，并**每次都记日志** —— 重试不能是静默的，
   * 否则「数据库一直在抖」这件事会被悄悄吞掉。
   */
  const extended = base.$extends({
    name: 'connection-retry',
    query: {
      $allOperations({ args, query }) {
        const run = async () => {
          const startedAt = Date.now();
          let lastError: unknown;

          for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
            try {
              return await query(args);
            } catch (error) {
              lastError = error;
              const delay = RETRY_DELAYS_MS[attempt];

              /**
               * 「客户端比 schema 旧」既不是抖动也不是业务错误，重试多少次都一样，
               * 而报错原文（`Unknown field 'viewCount' for select statement on model ...`）
               * 完全看不出该去重启服务 —— 我们为它查了一整轮，所以在抛出前把话说清楚。
               */
              const hint = describeStaleClientHint(error);
              if (hint) {
                const original = error instanceof Error ? error.message : String(error);
                throw new Error(`${hint}\n\n—— 原始报错 ——\n${original}`, { cause: error });
              }

              if (delay === undefined || !isTransientConnectionError(error)) throw error;

              // 带上已经耗掉的时间：这段日志是判断「重试到底有没有用」的唯一线索，
              // 只写「重试了」而不写「等了多久」的话，下次复盘还得靠猜
              console.warn(
                `[db] 连接类错误（已耗时 ${Date.now() - startedAt}ms），${delay}ms 后重试（第 ${attempt + 1} 次）：`,
                error instanceof Error ? error.message : error,
              );
              await sleep(delay);
            }
          }

          throw lastError;
        };

        return run();
      },
    },
  });

  /**
   * 返回**原始**类型。
   *
   * 扩展只在运行时加一层重试，没有改变任何操作的入参与返回；但 `$extends` 会让 TS
   * 丢掉对 `select` / `include` 的推断 —— 全局的读查询都会退化成「不含 `_count` 的模型类型」。
   * 这个代价赔不起：M4 加扩展时就让 `row._count.questions` 直接报「属性不存在」，
   * 而那条查询本身完全正常。
   */
  return extended as unknown as PrismaClient;
}

/**
 * 应用依赖的模型清单（= schema.prisma 里的全部模型）。
 *
 * **为什么需要这道检查**：`prisma migrate dev` 会重新生成客户端，但**运行中的 dev server
 * 不会重新加载它** —— 新加的模型在进程里就是 `undefined`，报错是
 * `Cannot read properties of undefined (reading 'findFirst')`，
 * 一句和「模型不存在」毫无关系的话（我们为它查了一整轮）。
 * 这里把「客户端是不是旧的」这件事直接说出来，并给出该做什么。
 *
 * **列的是全部模型**（不是只列最近加的）：清单缺一个，那种「新表在旧客户端里
 * 不存在」的情况就会绕过这条预警，直接炸在某个 `findMany` 上 ——
 * `templateFavorite`（X2 新增）就是这么漏过去一次。加表时在**同一处**补一行。
 */
const REQUIRED_MODELS = [
  'user',
  'session',
  'workspace',
  'invitation',
  'membership',
  'notification',
  'feedback',
  'questionnaire',
  'questionnaireVersion',
  'question',
  'option',
  'channel',
  'response',
  'answer',
  'template',
  'templateFavorite',
  'operationLog',
] as const;

export function assertGeneratedModels() {
  // 客户端实例缺失时它连 `undefined` 都不是，所以按索引查，不直接点属性
  const client = prisma as unknown as Record<string, unknown>;
  const missing = REQUIRED_MODELS.filter((model) => !client[model]);

  if (missing.length === 0) return;

  throw new Error(
    `Prisma 客户端里缺少模型：${missing.join('、')}。` +
      '这多半是改了 schema 之后没有重启服务 —— migrate 会重新生成客户端，' +
      '但**运行中的进程仍握着旧模块**。执行 `pnpm db:generate` 并重启服务即可。',
  );
}

type DatabaseClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma?: DatabaseClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  // 开发环境下热更新会重复执行模块，缓存到 globalThis 避免连接泄漏
  globalForPrisma.prisma = prisma;

  // 启动时就把「客户端是旧的」这件事喊出来：它只发生在开发环境
  //（生产是全新进程加载构建产物），所以不在那里做检查，免得白花时间
  try {
    assertGeneratedModels();
  } catch (error) {
    console.warn('[db]', error instanceof Error ? error.message : error);
  }
}

export function assertModelsForDev() {
  if (process.env.NODE_ENV === 'production') return;

  assertGeneratedModels();
}
