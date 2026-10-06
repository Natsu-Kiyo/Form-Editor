import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '@/config/env';
import { PrismaClient } from '@/generated/prisma/client';
import { withVerifiedTls } from '@/lib/database-url';
import { isTransientConnectionError, RETRY_DELAYS_MS, sleep } from '@/lib/db-retry';

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
 * 单次建连的超时时间。**宁可短，靠重试补**。
 *
 * 这个值原先写的是 5 秒，而「Connection terminated due to connection timeout」
 * 就是建连超过它时 pg 抛的原话：Neon 的计算节点空闲一段时间会挂起，
 * 唤醒它要几秒，于是只在「隔一阵子第一次访问」时偶发 —— 这也就是它难复现的原因。
 *
 * 但**把它调大并不是解法**（我先试了 10 秒，结果更糟）：冷启动期间
 * 第一次尝试本身就在推进唤醒，它超时失败并不白费。所以「5 秒失败 → 立刻重试 →
 * 第二次几秒内成功」比「一次死等 15 秒」更快，真连不上时也更快暴露。
 *
 * 实测（`/api/health` 探针）：
 * - 稳态往返 **~225ms**（数据在新加坡，这是跨区域的固有延迟）
 * - 冷启动唤醒 **3–4 秒**
 */
const CONNECTION_TIMEOUT_MS = 5_000;

/**
 * 单个实例的连接数。**保持 1**。
 *
 * 曾经把它放到 4，理由是「`max: 1` 会让并发查询在一条连接上串行，
 * 于是 `Promise.all` 白写」—— 这个理由是错的，代价还很大：
 * 页面里有几处 `Promise.all`，一旦放开连接数，池子会**同时开多条新连接**，
 * 而这个计算节点很小，并行建连本身就要十几秒。
 * 实测症状：保存动作卡在「保存中…」二十秒不返回，服务端日志是
 * `连接类错误（已耗时 10034ms）`。
 *
 * 结论：池化主机名解决的是「多个实例共用连接」，不是「一个实例多开连接」。
 * 想减少跨区域耗时，该做的是**减少查询次数**，不是加连接。
 */
const MAX_CONNECTIONS = 1;

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
 * 应用依赖的模型清单。
 *
 * **为什么需要这道检查**：`prisma migrate dev` 会重新生成客户端，但**运行中的 dev server
 * 不会重新加载它** —— 新加的模型在进程里就是 `undefined`，报错是
 * `Cannot read properties of undefined (reading 'findFirst')`，
 * 一句和「模型不存在」毫无关系的话（我们为它查了一整轮）。
 * 这里把「客户端是不是旧的」这件事直接说出来，并给出该做什么。
 */
const REQUIRED_MODELS = [
  'questionnaire',
  'question',
  'questionnaireVersion',
  'channel',
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
