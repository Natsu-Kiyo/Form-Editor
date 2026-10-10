import type { Metadata } from 'next';

import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { MobileWorkbenchHeader } from '@/components/layout/mobile-workbench-header';
import { Topbar } from '@/components/layout/topbar';
import { getWorkspacesForUser } from '@/features/workspace/api/workspaces';
import { CreateBlankFab } from '@/features/questionnaire/components/create-blank-fab';
import { getNotifications, getUnreadNotificationCount } from '@/features/account/api/notifications';
import { NotificationPanel } from '@/features/account/components/notification-panel';
import {
  getQuestionnaireSummary,
  listQuestionnaires,
  type QuestionnaireFilter,
  type QuestionnaireSort,
} from '@/features/questionnaire/api/questionnaires';
import { CreateQuestionnaireDialog } from '@/features/questionnaire/components/create-questionnaire-dialog';
import { QuestionnaireBoard } from '@/features/questionnaire/components/questionnaire-board';
import { SearchField } from '@/components/ui/search-field';
import { SummaryCards } from '@/features/questionnaire/components/summary-cards';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import { hasAtLeastRole } from '@/lib/auth/permissions';

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

  /*
   * 权限按**权限矩阵**分两档传给卡片（`features/members/lib/permissions-matrix.ts`）：
   * 编辑者能改内容（复制 / 导入导出 / 另存为模板），管理员才能改状态（归档 / 删除）与发布。
   * 界面只是不给入口，真正的拦截在每个 action 里 —— 少了任何一边都算漏。
   */
  const canEdit = hasAtLeastRole(workspace.role, 'EDITOR');
  const canManage = hasAtLeastRole(workspace.role, 'ADMIN');

  const [summary, list, notifications, unreadCount, workspaces] = await Promise.all([
    getQuestionnaireSummary(workspace.id),
    listQuestionnaires({ workspaceId: workspace.id, filter, keyword, sort }),
    getNotifications(user.id),
    getUnreadNotificationCount(user.id),
    // 只给窄屏顶栏的工作区切换器用（桌面端那份在侧栏里）
    getWorkspacesForUser(user.id),
  ]);

  return (
    <>
      {/*
        窄屏是 P04 的移动工作台：顶栏换成「工作区 / 通知 / 头像」三个入口（没有汉堡 ——
        导航已经在底部三格里），搜索从顶栏挪到内容区，新建变成悬浮「＋」。
        桌面端保持原样：顶栏 + 侧栏。
      */}
      <MobileWorkbenchHeader
        workspaces={workspaces}
        activeWorkspaceId={workspace.id}
        notifications={notifications}
        unreadCount={unreadCount}
        userName={user.name}
      />

      <div className="hidden shrink-0 lg:block">
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
              {/* 「新建问卷」是写入口：查看者不该看到它（矩阵里「创建问卷」= 编辑者） */}
              {canEdit ? <CreateQuestionnaireDialog /> : null}
            </div>
          }
        />
      </div>

      {/*
        移动端底部三格是固定条，内容要留出它的高度（否则最后一张卡被压在下面）。
        `flex-1 overflow-y-auto`：外壳把整页箍在视口内了，滚动只发生在这一块 ——
        于是顶栏与侧栏都不动（原先整页一起滚，侧栏底部那行账号得滚到底才看得见）。
      */}
      <main className="mx-auto min-h-0 w-full max-w-[1180px] flex-1 overflow-y-auto px-6 pt-6 pb-28 lg:py-7">
        {/* 窄屏没有顶栏搜索（P04 把搜索放在统计卡上方，通栏） */}
        <div className="mb-5 md:hidden">
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

        <SummaryCards summary={summary} />

        {/*
          「工具条 + 列表区」交给客户端组件：切筛选 / 排序是同路由换参数，
          `loading.tsx` 兜不住那一段，由它自己把列表区换成骨架（R80）
        */}
        <QuestionnaireBoard
          list={list}
          summary={summary}
          filter={filter}
          sort={sort}
          keyword={keyword}
          canEdit={canEdit}
          canManage={canManage}
          basePath={LIST_PATH}
        />
      </main>

      {/* 悬浮「＋」：直接建一份空白问卷进编辑器（设计稿 P04），只有编辑者看得到 */}
      {canEdit ? <CreateBlankFab /> : null}

      <MobileTabBar />
    </>
  );
}
