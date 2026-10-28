import 'server-only';

import type { PreviewQuestion } from '@/components/questionnaire/question-preview';
import { readQuestionnaireAccess } from '@/lib/auth/questionnaire-access';
import { prisma } from '@/lib/db';
import { questionnairePayloadSchema } from '@/lib/questionnaire-structure';
import { versionSummary } from '@/lib/version-summary';
import { formatDateTimeLocal } from '@/utils/format';

export type VersionRow = {
  id: string;
  version: number;
  /** 主文案：「修改自 v6 · 共 4 道题」。规则在 `lib/version-summary.ts`（有单测） */
  summary: string;
  authorName: string;
  createdAtLabel: string;
  /** 当前生效的版本（`Questionnaire.version` 指向它） */
  isCurrent: boolean;
};

export type VersionHistory = {
  versions: VersionRow[];
  /** 当前生效的版本号 */
  currentVersion: number;
  /**
   * 已有记录里的**最大编号**。
   * `latestVersion > currentVersion` ⇒ 回滚过、且之后没有再保存 ——
   * 抽屉顶部那条「已回滚到 vN」就靠这个差值判定（不是靠一次性的内存回执）。
   */
  latestVersion: number;
};

export type VersionPreview = {
  version: number;
  title: string;
  intro: string | null;
  questions: PreviewQuestion[];
};

export type VersionPreviewResult =
  { ok: true; preview: VersionPreview } | { ok: false; message: string };

/** 无权 / 不存在时给页面一个空历史，页面级 guard 另有兜底（与原来一致） */
const EMPTY_HISTORY: VersionHistory = { versions: [], currentVersion: 0, latestVersion: 0 };

/**
 * 版本历史（设计稿 W11 的抽屉）。
 *
 * 一次查询取版本列表与当前版本号：抽屉要标出「哪一条是当前版本」，
 * 而当前版本号在问卷行上，分两次查就是两次跨区域往返。
 */
export async function listVersions(questionnaireId: string): Promise<VersionHistory> {
  /*
   * 数据函数自己断言（审查 #14 补充）。版本快照里有整份历史结构，与当前结构同样敏感。
   * 无权 / 不存在都返回空历史：编辑器那边本来就有页面级 guard，这里只是让它不再依赖那个顺序。
   */
  if (!(await readQuestionnaireAccess(questionnaireId))) return EMPTY_HISTORY;

  const [versions, questionnaire] = await Promise.all([
    prisma.questionnaireVersion.findMany({
      where: { questionnaireId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        label: true,
        sourceVersion: true,
        questionCount: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    }),
    prisma.questionnaire.findUnique({
      where: { id: questionnaireId },
      select: { version: true },
    }),
  ]);

  const currentVersion = questionnaire?.version ?? 0;

  return {
    versions: versions.map((row) => ({
      id: row.id,
      version: row.version,
      summary: versionSummary(row),
      authorName: row.createdBy?.name ?? '已注销用户',
      createdAtLabel: formatDateTimeLocal(row.createdAt).replace('T', ' '),
      isCurrent: row.version === currentVersion,
    })),
    currentVersion,
    // 列表按 version desc 取，第一条就是最大编号
    latestVersion: versions[0]?.version ?? 0,
  };
}

/**
 * 某一版的结构快照（「预览这一版」用）。
 *
 * 与回滚共用同一份 `questionnairePayloadSchema`：抽屉里看到的，必须就是回滚会写回去的那一份。
 * 解析失败给一句人话 —— 历史行可能是结构不完整的老数据，不该在弹层里炸成白屏。
 */
export async function readVersionPreview(
  questionnaireId: string,
  versionId: string,
): Promise<VersionPreviewResult> {
  if (!(await readQuestionnaireAccess(questionnaireId))) {
    return { ok: false, message: '这份问卷不存在，或者你没有查看权限' };
  }

  const row = await prisma.questionnaireVersion.findFirst({
    where: { id: versionId, questionnaireId },
    select: { version: true, snapshot: true },
  });

  if (!row) return { ok: false, message: '这个版本不存在或不属于这份问卷' };

  const parsed = questionnairePayloadSchema.safeParse(row.snapshot);
  if (!parsed.success) return { ok: false, message: '这一版的结构不完整，无法预览' };

  const payload = parsed.data;

  return {
    ok: true,
    preview: {
      version: row.version,
      title: payload.title,
      intro: payload.intro ?? null,
      questions: payload.questions.map((question) => ({
        type: question.type,
        title: question.title,
        description: question.description ?? null,
        required: question.required,
        config: question.config,
        options: question.options,
      })),
    },
  };
}
