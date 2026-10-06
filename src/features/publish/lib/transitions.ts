import type { QuestionnaireStatus } from '@/config/constants';

/**
 * 回收开关的动作与允许的迁移。
 *
 * 写成纯函数、单独一个文件：这是这一块唯一需要「想清楚」的判断
 * （哪个状态能暂停、暂停能不能恢复、截止为什么不可逆），
 * 而它必须被单测穷举 —— 这三种动作都会改数据库里的状态，靠手点验不完。
 */
export type CollectionAction = 'PUBLISH' | 'PAUSE' | 'RESUME' | 'CLOSE';

export type TransitionResult =
  { ok: true; next: QuestionnaireStatus } | { ok: false; message: string };

/**
 * 状态机：
 *
 * ```
 * 草稿 ──发布──> 回收中 ⇄ 已暂停 ──截止──> 已截止 ──归档──> 已归档
 *                              └──（到期 / 达上限自动截止）
 * ```
 *
 * **截止不可逆**是刻意的：链接一旦对外发出，「什么时候能填」必须是个能解释的事实。
 * 重新打开会让已经收到「已截止」通知的人无法理解，也会让统计口径出现断层。
 * 要再来一轮就复制成新问卷 —— 那是一条明确、不产生歧义的路径。
 */
export function resolveCollectionTransition(
  current: QuestionnaireStatus,
  action: CollectionAction,
  options: { pastEndTime: boolean },
): TransitionResult {
  switch (action) {
    case 'PUBLISH':
      if (current !== 'DRAFT') {
        return { ok: false, message: '只有草稿可以发布' };
      }
      return { ok: true, next: 'PUBLISHED' };

    case 'PAUSE':
      if (current !== 'PUBLISHED') {
        return { ok: false, message: '只有回收中的问卷可以暂停' };
      }
      return { ok: true, next: 'PAUSED' };

    case 'RESUME':
      if (current !== 'PAUSED') {
        return { ok: false, message: '只有已暂停的问卷可以恢复回收' };
      }
      // 已经过了结束时间就别恢复了：恢复完下一次访问又会自动截止，
      // 用户只会看到「点了恢复，链接还是不能填」
      if (options.pastEndTime) {
        return { ok: false, message: '结束时间已过，不能恢复回收；请复制为新问卷' };
      }
      return { ok: true, next: 'PUBLISHED' };

    case 'CLOSE':
      if (current !== 'PUBLISHED' && current !== 'PAUSED') {
        return { ok: false, message: '只有回收中或已暂停的问卷可以截止' };
      }
      return { ok: true, next: 'CLOSED' };
  }
}
