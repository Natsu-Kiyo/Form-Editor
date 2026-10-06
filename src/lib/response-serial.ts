import 'server-only';

import { prisma } from '@/lib/db';

/**
 * 答卷编号（明细页与结果页上的「#128」）。
 *
 * 口径：**按提交时间的名次，且把已标记无效的也算进去**。
 *
 * 两处都是踩过坑才定下来的：
 * - **必须含无效的**：明细页会把无效答卷一并列出来（勾上「显示无效答卷」），
 *   若只数有效答卷，一份无效答卷的编号会和它后面那份有效答卷**撞号** ——
 *   同一张表里出现两个 `#126`。这一条正是 M7 写明细页时发现的（M5 当时只数有效）。
 * - **不能拿「当前总数」当编号**：别人继续提交时，同一份答卷的编号会跟着变。
 *
 * 已知边界：两份答卷的 `submittedAt` 完全相同时，这里给它们同一个编号（按 `<=` 计数），
 * 而列表按 `(submittedAt, id)` 排序给出的是相邻的两个编号。秒级撞车概率极低，
 * 不值得为它加一列自增序号。
 */
export async function responseSerial(questionnaireId: string, submittedAt: Date) {
  return prisma.response.count({ where: { questionnaireId, submittedAt: { lte: submittedAt } } });
}
