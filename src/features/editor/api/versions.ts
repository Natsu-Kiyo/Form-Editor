import 'server-only';

import { prisma } from '@/lib/db';
import { formatDateTimeLocal } from '@/utils/format';

export type VersionRow = {
  id: string;
  version: number;
  label: string;
  authorName: string;
  createdAtLabel: string;
  /** 当前生效的版本（`Questionnaire.version` 指向它） */
  isCurrent: boolean;
};

/**
 * 版本历史（设计稿 W11 的抽屉）。
 *
 * 一次查询取版本列表与当前版本号：抽屉要标出「哪一条是当前版本」，
 * 而当前版本号在问卷行上，分两次查就是两次跨区域往返。
 */
export async function listVersions(questionnaireId: string): Promise<VersionRow[]> {
  const [versions, questionnaire] = await Promise.all([
    prisma.questionnaireVersion.findMany({
      where: { questionnaireId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        label: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    }),
    prisma.questionnaire.findUnique({
      where: { id: questionnaireId },
      select: { version: true },
    }),
  ]);

  const currentVersion = questionnaire?.version ?? null;

  return versions.map((row) => ({
    id: row.id,
    version: row.version,
    label: row.label,
    authorName: row.createdBy?.name ?? '已注销用户',
    createdAtLabel: formatDateTimeLocal(row.createdAt).replace('T', ' '),
    isCurrent: row.version === currentVersion,
  }));
}
