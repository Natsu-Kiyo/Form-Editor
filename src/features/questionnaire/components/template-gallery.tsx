'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchField } from '@/components/ui/search-field';
import { useToast } from '@/components/ui/toast';

import { useIsDesktop } from '@/hooks/use-is-desktop';
import { cn } from '@/utils/cn';

import { toggleTemplateFavoriteAction } from '../actions/favorite-template';
import { createFromTemplateAction } from '../actions/create-questionnaire';
import type { TemplateCardData, TemplateScope, TemplateSummary } from '../api/templates';
import { CreateQuestionnaireDialog } from './create-questionnaire-dialog';
import { TemplateCard } from './template-card';

/**
 * 模板中心（W08）。
 *
 * 四条刻意的处理：
 * - **Tab / 搜索 / 分类全部走 URL**（与其它管理页同一条规矩）：视图可分享、可后退。
 *   切 Tab 时会**清掉分类**（两个库的分类未必重合，留着会得到一个空列表）。
 * - 「使用此模板」**不弹确认**，点下去直接建问卷并进编辑器（见 `createFromTemplateAction`）。
 * - 分类胶囊**由页面算好传进来**（`categories`），两个 Tab 是两套口径：公开池列计划书
 *   定下的五个常量；「我的模板」列**该工作区实际用过的分类**（含用户自建的新分类）。
 *   之所以不在这里动态去重也不在这里写常量：胶囊必须与「另存为模板」里能选的分类一致，
 *   而那份清单要查库（见 `templates/page.tsx`）。
 * - 「我的模板」卡上的按钮常显，官方卡悬浮才出现（设计稿如此）—— 前者是用户要去改的，
 *   后者只是浏览。
 *
 * X2 的两处变化：
 * - 第一个 Tab 从「官方模板」改为「**公开模板**」（池子 = 官方 ∪ 各工作区已公开的）；
 * - 「我的模板」Tab 顶部多一个**已收藏**分组（收藏的是任意可见模板，含官方与别的
 *   工作区公开的）。
 */
export function TemplateGallery({
  items,
  scope,
  keyword,
  category,
  categories,
  mineCount,
  templates,
  canCreate,
  canPublish,
  favoriteItems,
}: {
  items: TemplateCardData[];
  scope: TemplateScope;
  keyword: string;
  category: string | null;
  /** 分类胶囊的清单（页面按 Tab 的口径算好传进来，见文件顶部说明） */
  categories: string[];
  /** 「我的模板」Tab 上的角标 */
  mineCount: number;
  /** 给「新建问卷」弹层用 */
  templates: TemplateSummary[];
  /** 「使用此模板」与「⋯」= 编辑者 */
  canCreate: boolean;
  /** 「设为公开 / 取消公开」= 管理员（权限矩阵「公开模板到公开池」一行） */
  canPublish: boolean;
  /** 「我的模板」Tab 顶部的已收藏分组（页面取好传进来） */
  favoriteItems: TemplateCardData[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usingId, setUsingId] = useState<string | null>(null);
  const [favoritePendingId, setFavoritePendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { toast } = useToast();
  // 断点显式写 1024：`useIsDesktop` 默认是 768，而这一页的底部导航/布局用的是 Tailwind 的
  // `lg`（1024）—— 两者不一致时，768~1023px 会出现「桌面顶栏 + 移动底栏」同时在场
  const isDesktop = useIsDesktop('(min-width: 1024px)');
  const basePath = '/app/templates';

  /** 搜索框要保留的其它参数（两个 Tab 与分类），两端共用同一份 */
  const preservedQuery = {
    ...(scope === 'MINE' ? { tab: 'mine' } : {}),
    ...(category ? { category } : {}),
  };

  const push = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }

    const queryString = params.toString();
    router.push(queryString ? `${basePath}?${queryString}` : basePath);
  };

  const use = (templateId: string) => {
    setUsingId(templateId);
    startTransition(async () => {
      // 成功后服务端会 redirect 到编辑器，这里不需要处理结果；
      // 失败（比如结构损坏 / 已被取消公开）会抛出，由下一帧的 error boundary 接住
      await createFromTemplateAction(templateId);
      setUsingId(null);
    });
  };

  const toggleFavorite = (template: TemplateCardData) => {
    setFavoritePendingId(template.id);
    startTransition(async () => {
      const result = await toggleTemplateFavoriteAction(template.id, !template.isFavorited);
      setFavoritePendingId(null);

      if (!result.ok) {
        toast({ title: '操作失败', description: result.message, variant: 'error' });
        return;
      }

      toast({
        title: template.isFavorited ? '已取消收藏' : '已收藏',
        description: `「${template.title}」`,
        variant: 'success',
      });
    });
  };

  const filtering = Boolean(keyword || category);
  const showFavorites = scope === 'MINE' && favoriteItems.length > 0;

  /**
   * 一处网格两处用（收藏分组与主列表），`showSource` 区分「公开池」与「我的」：
   * 前者显示「来自 X 工作区」，后者显示「公开」角标（卡片内部按这个开关切换）。
   */
  const renderGrid = (list: TemplateCardData[], showSource: boolean) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {list.map((item) => (
        <TemplateCard
          // 同一张模板可能同时出现在「已收藏」与「全部模板」两处，key 要带前缀区分
          key={`${showSource ? 'pool' : 'cards'}-${item.id}`}
          template={item}
          using={usingId === item.id}
          onUse={() => use(item.id)}
          // 「使用此模板」= 创建问卷、「⋯」= 改模板，两样都要求编辑者
          canManage={canCreate}
          canPublish={canPublish}
          onToggleFavorite={() => toggleFavorite(item)}
          favoritePending={favoritePendingId === item.id}
          showSource={showSource}
        />
      ))}
    </div>
  );

  return (
    <>
      {/*
        两端各一套顶栏 —— 用 `useIsDesktop` **只渲染其中一套**，而不是 CSS `hidden`
        （与 `ChannelsCard` 同一条理由：CSS 隐藏的元素还在 DOM 里，仍然会被
        读屏软件与自动化匹配到；搜索框是交互控件，不属于「纯版式」）。

        窄屏是 P07 的形态：标题 + **通栏搜索框**（桌面放在顶栏右侧）。
        R59 起**也放「新建问卷」**（所有者决定忽略 P07「新建走底部『问卷』格」的口径）：
        模板页本来就是「挑一个开始写」的地方，回工作台再点一次「＋」是白绕一圈。
      */}
      {isDesktop ? (
        <Topbar
          title="模板中心"
          actions={
            <div className="flex items-center gap-3">
              <SearchField
                basePath={basePath}
                initialKeyword={keyword}
                preserveQuery={preservedQuery}
                placeholder="搜索模板…"
                label="搜索模板"
              />
              {canCreate ? <CreateQuestionnaireDialog templates={templates} /> : null}
            </div>
          }
        />
      ) : (
        <>
          <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
            <h1 className="text-ink-900 text-[17px] font-semibold">模板中心</h1>
            {canCreate ? <CreateQuestionnaireDialog templates={templates} /> : null}
          </header>

          <div className="px-5 pb-3">
            <SearchField
              basePath={basePath}
              initialKeyword={keyword}
              preserveQuery={preservedQuery}
              placeholder="搜索模板…"
              label="搜索模板"
            />
          </div>
        </>
      )}

      <main className="flex-1 overflow-y-auto p-6 pt-6 pb-28 sm:p-7 lg:pb-7">
        <div className="mx-auto max-w-[1180px]">
          {/* ---- 两个 Tab ---- */}
          <div className="border-ink-200 mb-5 flex items-center gap-6 border-b">
            <TabButton
              active={scope === 'PUBLIC'}
              onClick={() => push({ tab: null, category: null })}
            >
              公开模板
            </TabButton>
            <TabButton
              active={scope === 'MINE'}
              onClick={() => push({ tab: 'mine', category: null })}
            >
              我的模板 <span className="text-ink-400 text-[12px] font-normal">{mineCount}</span>
            </TabButton>
          </div>

          {/* ---- 分类胶囊（窄屏横滑，桌面换行）---- */}
          <div className="mb-5 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
            <CategoryPill active={category === null} onClick={() => push({ category: null })}>
              全部
            </CategoryPill>
            {categories.map((item) => (
              <CategoryPill
                key={item}
                active={category === item}
                onClick={() => push({ category: item })}
              >
                {item}
              </CategoryPill>
            ))}
          </div>

          {/* ---- 已收藏（「我的模板」Tab 顶部；只收藏了官方模板时这里是唯一的内容）---- */}
          {showFavorites ? (
            <section className="mb-8">
              <h2 className="text-ink-700 mb-3 text-[13.5px] font-medium">
                已收藏
                <span className="text-ink-400 ml-1.5 text-[12px] font-normal">
                  {favoriteItems.length}
                </span>
              </h2>
              {renderGrid(favoriteItems, false)}

              <div className="border-ink-200 mt-8 mb-6 border-t" />
              <h2 className="text-ink-700 mb-3 text-[13.5px] font-medium">全部模板</h2>
            </section>
          ) : null}

          {items.length > 0 ? (
            renderGrid(items, scope === 'PUBLIC')
          ) : favoriteItems.length === 0 ? (
            <EmptyState
              icon={<TemplateEmptyIcon />}
              title={filtering ? '没有匹配的模板' : '这里还没有模板'}
              description={
                filtering
                  ? '换个关键词或分类试试，或者把筛选清掉。'
                  : scope === 'MINE'
                    ? '在问卷卡片的「⋯」里选「另存为模板」，它就会出现在这里。'
                    : '公开模板还没准备好，稍后再看。'
              }
              action={
                filtering ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={scope === 'MINE' ? `${basePath}?tab=mine` : basePath}>
                      清空筛选
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            // 只有收藏、还没有自己的模板：不当成一个「错误」来报，给一句指路即可
            <p className="text-ink-400 text-[12.5px] leading-5">
              还没有自己的模板 —— 在问卷卡片的「⋯」里选「另存为模板」，它就会出现在这里。
            </p>
          )}
        </div>
      </main>

      <MobileTabBar />
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        '-mb-px h-10 border-b-2 px-1 text-[14px] font-medium transition-colors duration-150',
        active
          ? 'border-brand-500 text-brand-500'
          : 'text-ink-500 hover:text-ink-800 border-transparent',
      )}
    >
      {children}
    </button>
  );
}

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-8 shrink-0 rounded-full px-3.5 text-[12.5px] transition-colors duration-150',
        active
          ? 'bg-brand-500 font-medium text-white'
          : 'border-ink-200 text-ink-600 hover:border-ink-300 border bg-white',
      )}
    >
      {children}
    </button>
  );
}

/** 空状态用的图标：一个「模板」的抽象样子（三个叠起来的方块） */
function TemplateEmptyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
