'use client';

import Link from 'next/link';
import { useState } from 'react';

import { FileTextIcon, SearchIcon } from '@/components/icons/ui-icons';
import { EmptyState } from '@/components/ui/empty-state';

import type {
  QuestionnaireCard,
  QuestionnaireFilter,
  QuestionnaireSort,
  QuestionnaireSummary,
} from '../api/questionnaires';
import { CreateQuestionnaireDialog } from './create-questionnaire-dialog';
import { ListToolbar } from './list-toolbar';
import { QuestionnaireCardItem } from './questionnaire-card';
import { QuestionnaireGridSkeleton } from './questionnaire-list-skeleton';

/**
 * 列表页的「工具条 + 列表区」（R80）。
 *
 * 为什么这一块是客户端组件：切筛选 / 排序都是**同路由换 searchParams**，
 * 而 Next 对同路由的参数变化不会重新挂载 `loading.tsx` 的边界（页面不重挂、
 * 只是收到新 props）—— 整页骨架兜不住这一段，得由这一块自己按时序摆出来
 * （与模板中心切 Tab 是同一套，见 `template-gallery.tsx`）。
 *
 * 等待态由**数据落地**清除：点了哪一颗就记住哪一颗，等 `filter` / `sort`
 * 这两个 props 真的变成它 —— 不用计时器（与答卷详情 R68、删除 R78 同一条规矩）。
 */
export function QuestionnaireBoard({
  list,
  summary,
  filter,
  sort,
  keyword,
  canEdit,
  canManage,
  basePath,
}: {
  list: QuestionnaireCard[];
  summary: QuestionnaireSummary;
  filter: QuestionnaireFilter;
  sort: QuestionnaireSort;
  keyword: string;
  canEdit: boolean;
  canManage: boolean;
  basePath: string;
}) {
  const [pendingFilter, setPendingFilter] = useState<QuestionnaireFilter | null>(null);
  const [pendingSort, setPendingSort] = useState<QuestionnaireSort | null>(null);

  /*
   * 落地判断（渲染期根据 prop 调整 state，React 官方写法）：新 props 到了、
   * 且正是刚点的那一颗，等待态就退场。点回当前那颗也走这里 —— 不会有导航，立刻清掉。
   */
  if (pendingFilter !== null && pendingFilter === filter) setPendingFilter(null);
  if (pendingSort !== null && pendingSort === sort) setPendingSort(null);
  const navPending = pendingFilter !== null || pendingSort !== null;

  const searching = keyword.trim().length > 0 || filter !== 'ALL';

  return (
    <>
      <ListToolbar
        filter={filter}
        sort={sort}
        keyword={keyword}
        summary={summary}
        basePath={basePath}
        onNavigate={(next) => {
          if (next.status) setPendingFilter(next.status);
          if (next.sort) setPendingSort(next.sort);
        }}
      />

      {/*
        正在换数据：**只换列表区**（工具条、汇总卡、顶栏保持在场 —— 刚点的那颗胶囊
        不该跟着消失）。骨架与 `loading.tsx` 共用同一份卡片形状。
      */}
      {navPending ? (
        <div aria-busy="true" className="qw-fade-up">
          <span role="status" className="sr-only">
            正在加载问卷列表…
          </span>
          <QuestionnaireGridSkeleton />
        </div>
      ) : list.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((questionnaire) => (
            <QuestionnaireCardItem
              key={questionnaire.id}
              questionnaire={questionnaire}
              canEdit={canEdit}
              canManage={canManage}
            />
          ))}
        </div>
      ) : searching ? (
        <EmptyState
          icon={<SearchIcon />}
          title="没有匹配的问卷"
          description={
            keyword.trim()
              ? `没有名称或简介包含「${keyword.trim()}」的问卷`
              : '这个状态下还没有问卷'
          }
          action={
            <Link
              href={basePath}
              className="border-ink-200 text-ink-700 hover:border-ink-300 inline-flex h-8 items-center rounded-lg border bg-white px-3.5 text-[12px] font-medium transition-colors duration-150"
            >
              清空筛选
            </Link>
          }
        />
      ) : (
        <EmptyState
          icon={<FileTextIcon />}
          title="还没有问卷"
          description="从空白创建，或挑一个模板开始"
          action={canEdit ? <CreateQuestionnaireDialog variant="empty" /> : undefined}
        />
      )}
    </>
  );
}
