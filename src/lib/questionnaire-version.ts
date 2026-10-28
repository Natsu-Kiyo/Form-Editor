import 'server-only';

import { assertModelsForDev, prisma } from '@/lib/db';
import { toJsonColumn } from '@/lib/json';
import { getQuestionnairePayload } from '@/lib/questionnaire-snapshot';
import type { QuestionnairePayload } from '@/lib/questionnaire-structure';
import { stableJson } from '@/utils/stable-json';

/**
 * 写一条题目结构的版本快照 —— **尽力而为，不抛错**。
 *
 * 调用方分属两个 feature（编辑器保存草稿、发布流程），而 features 之间禁止互相导入；
 * 更要紧的是**编号规则必须一致**（都取 `max(version) + 1`），
 * 各写一份必然出现两条快照抢同一个版本号。
 *
 * **回滚不调这个函数**（用户复测）：回滚只把 `Questionnaire.version` 指回目标版本 ——
 * 再写一条的话，那条记录与目标版本的内容完全相同，抽屉里很快全是看不出差别的重复项。
 * 于是版本号**不再总是等于「最新编号」**：指针可以落后于最大编号，
 * 界面正是靠这个差值显示「已回滚到 vN，还没再做修改」。
 *
 * **为什么吞掉异常**：调用方都是「先把结构写进库、再补一条版本」——
 * 结构已经落库之后，这里失败只意味着少一条历史记录。若把异常抛出去，
 * 用户看到的是「保存失败」，而实际上数据是存上的（刷新一下就都在了）。
 * 这正是使用者报过的现象：「保存失败，但刷新后又是好的」。
 * 所以我们选择**记日志 + 返回 null**，让保存的成功与否如实反映数据是否落库。
 *
 * 版本语义（相对设计稿有一处收敛）：设计稿写的是「共 N 个**发布**版本」，
 * 而本项目的状态机里一份问卷**只会发布一次**（发布即冻结、已截止不可重开）——
 * 只按发布写，抽屉里永远只有一条。所以按计划书 §M3 第 8 条的「发布 /**关键保存**」来写：
 * 编辑器每次保存草稿若结构确有变化写一条，发布时再写一条。
 */
export async function writeQuestionnaireVersion(input: {
  questionnaireId: string;
  label: string;
  createdById: string | null;
  /**
   * 已知的结构快照。**调用方手里已经有的话一定要传**：
   * 自己再读一遍结构要多花一次往返，而往返是跨区域的（~225ms）。
   */
  payload?: QuestionnairePayload;
}): Promise<number | null> {
  // 先确认客户端够新，**再**进 try —— 「生成的客户端是旧的」是配置问题，
  // 不能被下面的「尽力而为」吞掉：那只会让版本历史静默少几条，还查不出来。
  // 它要的是一条说得清怎么办的报错（见 lib/db.ts 的 assertGeneratedModels）
  assertModelsForDev();

  const snapshot = input.payload
    ? { payload: input.payload }
    : await getQuestionnairePayload(input.questionnaireId);

  if (!snapshot) return null;

  try {
    return await insertVersion(input, snapshot.payload);
  } catch (error) {
    // 版本号撞车（两个保存同时进来）：重读一次最新号再来一次
    if (isUniqueViolation(error)) {
      try {
        return await insertVersion(input, snapshot.payload);
      } catch (retryError) {
        console.error('[version] 版本快照重写仍失败（结构已保存，只是少一条历史）', retryError);
        return null;
      }
    }

    console.error('[version] 版本快照写入失败（结构已保存，只是少一条历史）', error);
    return null;
  }
}

async function insertVersion(
  input: { questionnaireId: string; label: string; createdById: string | null },
  payload: QuestionnairePayload,
): Promise<number> {
  /*
   * 一次查询同时拿到「当前指针」与「最新一条快照」，两个用途分得很清：
   * - **最新编号**用来递增（编号永远取 max + 1，不复用、不因回滚而回退）；
   * - **当前指针**用来记 `sourceVersion`（这一版是基于哪一版改的）。
   *   回滚过之后指针会落后于最新编号，此时若按最新编号记来源，
   *   就会把「基于 v6 改的」写成「修改自 v9」—— 一句编造的来源。
   */
  const current = await prisma.questionnaire.findUnique({
    where: { id: input.questionnaireId },
    select: {
      version: true,
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
        select: { version: true, snapshot: true },
      },
    },
  });

  const latest = current?.versions[0] ?? null;

  /*
   * 结构没变就不写：否则用户点十次保存就会得到十条一模一样的版本，
   * 抽屉变成噪音，真正的改动反而找不到。
   *
   * 比较必须用 `stableJson`（用户复测 #4）：`snapshot` 是 **JSONB**，Postgres 读回来时
   * 会重排键序，而 `JSON.stringify` 是顺序敏感的 —— 直接比永远不相等，
   * 上面那句话一直没兑现，每次保存都白写一条版本（还多一次 findFirst + 一次事务）。
   */
  if (latest && stableJson(latest.snapshot) === stableJson(payload)) {
    /*
     * 「跳过」时把指针指到这一条（用户复测 #3 之后补的边角）：
     * 指针的不变式是「指向内容与当前相同的那一版」。回滚后指针停在旧版本，
     * 若这时保存的内容恰好等于最新那条（改了又改回去），指针不挪就会让抽屉上
     * 「已回滚到 vN」与实际内容对不上。多一次写只发生在这个罕见分支上。
     */
    if (current && current.version !== latest.version) {
      await prisma.questionnaire.update({
        where: { id: input.questionnaireId },
        data: { version: latest.version },
      });
    }

    return latest.version;
  }

  const nextVersion = (latest?.version ?? 0) + 1;

  await prisma.$transaction([
    prisma.questionnaireVersion.create({
      data: {
        questionnaireId: input.questionnaireId,
        version: nextVersion,
        snapshot: toJsonColumn(payload),
        label: input.label,
        /*
         * 第一条快照没有来源 —— `Questionnaire.version` 的默认值是 1，
         * 直接拿它当来源会写出「v1 修改自 v1」这种废话（E2E 就是这么发现的）。
         */
        sourceVersion: latest === null ? null : (current?.version ?? null),
        questionCount: payload.questions.length,
        createdById: input.createdById,
      },
    }),
    prisma.questionnaire.update({
      where: { id: input.questionnaireId },
      data: { version: nextVersion },
    }),
  ]);

  return nextVersion;
}

/** Prisma 的唯一约束冲突码 */
function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}
