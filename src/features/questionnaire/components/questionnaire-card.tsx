import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/utils/cn';

import type { QuestionnaireCard as QuestionnaireCardData } from '../api/questionnaires';
import { CardActions } from './card-actions';
import { CardPrimaryActions } from './card-primary-actions';

/**
 * 问卷卡片（设计稿 W02 / P02）。
 *
 * 底部的主操作在 `card-primary-actions.tsx`：它随状态换内容（已截止换成「复制」、
 * 已归档只剩「恢复 + 数据」），窄屏还换一套形状。
 */
export function QuestionnaireCardItem({
  questionnaire,
  canEdit,
  canManage,
}: {
  questionnaire: QuestionnaireCardData;
  /** 能改内容（复制 / 导入导出 / 另存为模板）：权限矩阵里的「编辑者」 */
  canEdit: boolean;
  /** 能改状态（归档 / 删除 / 发布）：矩阵里的「管理员」 */
  canManage: boolean;
}) {
  const archived = questionnaire.status === 'ARCHIVED';
  const limit = questionnaire.responseLimit;

  return (
    <div
      className={cn(
        'border-ink-200 flex flex-col rounded-xl border bg-white p-5 transition-all duration-150',
        archived ? 'opacity-70' : 'hover:shadow-card hover:border-brand-200',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <StatusBadge status={questionnaire.status} />
        <CardActions questionnaire={questionnaire} canEdit={canEdit} canManage={canManage} />
      </div>

      <h3
        className={cn(
          'mb-1.5 truncate text-[15px] font-semibold',
          archived ? 'text-ink-600' : 'text-ink-900',
        )}
      >
        {questionnaire.title}
      </h3>

      <p
        className={cn(
          'mb-4 line-clamp-2 min-h-10 text-[12.5px] leading-5',
          archived ? 'text-ink-400' : 'text-ink-500',
        )}
      >
        {questionnaire.intro ??
          (questionnaire.questionCount > 0
            ? `共 ${questionnaire.questionCount} 道题`
            : '还没有题目，进入编辑器开始设计')}
      </p>

      {limit ? (
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between text-[12px]">
            <span className="text-ink-500">回收进度</span>
            <span className="text-ink-700 font-mono">
              <b className="text-ink-900">{questionnaire.responseCount}</b> / {limit}
            </span>
          </div>
          <Progress
            value={Math.min(100, Math.round((questionnaire.responseCount / limit) * 100))}
          />
        </div>
      ) : (
        <div className="text-ink-400 mb-4 flex items-center justify-between text-[12px]">
          <span>{archived ? '已归档' : '回收进度'}</span>
          <span className="font-mono">{questionnaire.responseCount} 份</span>
        </div>
      )}

      <CardPrimaryActions questionnaire={questionnaire} canEdit={canEdit} canManage={canManage} />
    </div>
  );
}
