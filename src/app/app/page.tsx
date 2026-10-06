import type { Metadata } from 'next';
import Link from 'next/link';

import { FileTextIcon, SearchIcon } from '@/components/icons/ui-icons';
import { Topbar } from '@/components/layout/topbar';
import { EmptyState } from '@/components/ui/empty-state';
import { getNotifications, getUnreadNotificationCount } from '@/features/account/api/notifications';
import { NotificationPanel } from '@/features/account/components/notification-panel';
import {
  getQuestionnaireSummary,
  listQuestionnaires,
  type QuestionnaireFilter,
  type QuestionnaireSort,
} from '@/features/questionnaire/api/questionnaires';
import { listOfficialTemplates } from '@/features/questionnaire/api/templates';
import { CreateQuestionnaireDialog } from '@/features/questionnaire/components/create-questionnaire-dialog';
import { ListToolbar } from '@/features/questionnaire/components/list-toolbar';
import { QuestionnaireCardItem } from '@/features/questionnaire/components/questionnaire-card';
import { SearchField } from '@/components/ui/search-field';
import { SummaryCards } from '@/features/questionnaire/components/summary-cards';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';

export const metadata: Metadata = { title: '问卷列表' };

const LIST_PATH = '/app';

const FILTERS: readonly QuestionnaireFilter[] = [
  'ALL',
  'DRAFT',
  'PUBLISHED',
  'PAUSED',
  'CLOSED',
  'ARCHIVED',
];

const SORTS: readonly QuestionnaireSort[] = ['UPDATED', 'CREATED', 'STALE'];

function parseFilter(value: string | string[] | undefined): QuestionnaireFilter {
  // URL 是用户可改的，所以一律白名单校验，非法值静默回落到默认口径
  return typeof value === 'string' && (FILTERS as readonly string[]).includes(value)
    ? (value as QuestionnaireFilter)
    : 'ALL';
}

function parseSort(value: string | string[] | undefined): QuestionnaireSort {
  return typeof value === 'string' && (SORTS as readonly string[]).includes(value)
    ? (value as QuestionnaireSort)
    : 'UPDATED';
}

/**
 * 问卷列表（W02 / P04）。
 *
 * 筛选、搜索、排序全部走 URL 查询参数，页面是纯服务端组件：
 * 这样每个视图都能分享、能前进后退，也不需要为「列表状态」引入任何客户端 store。
 *
 * 权限边界在这里：页面第一行就 `requireActiveWorkspace`，
 * 后面所有查询都用它返回的 workspace.id —— 工作区 id 绝不从 URL 或表单里取。
 */
export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ user, workspace }, params] = await Promise.all([
    requireActiveWorkspace('VIEWER'),
    searchParams,
  ]);

  const filter = parseFilter(params.status);
  const sort = parseSort(params.sort);
  const keyword = typeof params.q === 'string' ? params.q : '';

  const [summary, list, templates, notifications, unreadCount] = await Promise.all([
    getQuestionnaireSummary(workspace.id),
    listQuestionnaires({ workspaceId: workspace.id, filter, keyword, sort }),
    listOfficialTemplates(),
    getNotifications(user.id),
    getUnreadNotificationCount(user.id),
  ]);

  const searching = keyword.trim().length > 0 || filter !== 'ALL';

  return (
    <>
      <Topbar
        title="问卷列表"
        notifications={
          <NotificationPanel notifications={notifications} unreadCount={unreadCount} />
        }
        actions={
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <SearchField
                basePath={LIST_PATH}
                initialKeyword={keyword}
                preserveQuery={{
                  ...(filter !== 'ALL' ? { status: filter } : {}),
                  ...(sort !== 'UPDATED' ? { sort } : {}),
                }}
                placeholder="搜索问卷名称…"
                label="搜索问卷名称"
              />
            </div>
            <CreateQuestionnaireDialog templates={templates} />
          </div>
        }
      />

      <main className="mx-auto w-full max-w-[1180px] px-6 py-7">
        <SummaryCards summary={summary} />

        <ListToolbar
          filter={filter}
          sort={sort}
          keyword={keyword}
          summary={summary}
          basePath={LIST_PATH}
        />

        {list.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((questionnaire) => (
              <QuestionnaireCardItem key={questionnaire.id} questionnaire={questionnaire} />
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
                href={LIST_PATH}
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
            action={<CreateQuestionnaireDialog templates={templates} variant="empty" />}
          />
        )}
      </main>
    </>
  );
}
