import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/utils/cn';

import type { QuestionnaireCard as QuestionnaireCardData } from '../api/questionnaires';
import { CardActions } from './card-actions';
import { CardEditLink } from './card-edit-link';
import { RestoreButton } from './restore-button';

/**
 * 问卷卡片。
 *
 * **底部没有「编辑 / 数据 / 分享」三个按钮** —— 它们分别属于 M3（编辑器）、
 * M6（统计）、M4（分享分发），对应的页面还不存在。
 * 画一个点了没反应的按钮比少一个按钮糟得多，所以宁可先空着，
 * 等各自里程碑落地时按设计稿补回来。
 */
export function QuestionnaireCardItem({ questionnaire }: { questionnaire: QuestionnaireCardData }) {
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
        <CardActions questionnaire={questionnaire} />
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

      {archived ? (
        <div className="border-ink-100 flex items-center gap-1 border-t pt-3.5">
          <RestoreButton questionnaireId={questionnaire.id} title={questionnaire.title} />
        </div>
      ) : (
        <CardEditLink questionnaireId={questionnaire.id} title={questionnaire.title} />
      )}
    </div>
  );
}
