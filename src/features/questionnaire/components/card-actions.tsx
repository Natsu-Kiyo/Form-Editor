'use client';

import { useState, useTransition } from 'react';

import {
  ArchiveIcon,
  CopyIcon,
  DotsIcon,
  DownloadIcon,
  GridIcon,
  TrashIcon,
  UploadIcon,
  UsersIcon,
} from '@/components/icons/ui-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UPCOMING_BADGE } from '@/config/constants';
import { useIsDesktop } from '@/hooks/use-is-desktop';

import { archiveQuestionnaireAction } from '../actions/archive-questionnaire';
import { copyQuestionnaireAction } from '../actions/copy-questionnaire';
import type { QuestionnaireCard } from '../api/questionnaires';
import { DeleteQuestionnaireDialog } from './delete-questionnaire-dialog';
import { ImportJsonDialog } from './import-json-dialog';
import { SaveAsTemplateDialog } from './save-as-template-dialog';

type OpenDialog = 'delete' | 'template' | 'import' | null;

/**
 * 卡片右上角「⋯」菜单。
 *
 * 三处刻意处理：
 * - 「复制 / 导出 JSON / 导入 JSON」按设计稿是**移动端不做**，所以窄屏下**不渲染**
 *   （用视口判定真隐藏，而不是 CSS `hidden` 留一份不可见但可聚焦的 DOM）。
 * - 「问卷移交」是 2.0，按 B 级规范灰显：`disabled` + 角标，不留 hover 假反馈。
 * - 「导出 JSON」直接跳下载地址，而不是走 Server Action —— 下载需要
 *   `Content-Disposition`，而 action 的返回值只能是给 React 的数据。
 */
export function CardActions({ questionnaire }: { questionnaire: QuestionnaireCard }) {
  const isDesktop = useIsDesktop();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [pending, startTransition] = useTransition();

  const archived = questionnaire.status === 'ARCHIVED';

  const open = (next: OpenDialog) => {
    setMenuOpen(false);
    setDialog(next);
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`「${questionnaire.title}」更多操作`}
            className="text-ink-400 hover:bg-ink-100 flex size-6 shrink-0 items-center justify-center rounded-md transition-colors duration-150"
          >
            <DotsIcon className="size-4" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-[190px]">
          <DropdownMenuLabel>{questionnaire.title}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {isDesktop ? (
            <DropdownMenuItem
              icon={<CopyIcon />}
              disabled={pending}
              onSelect={() => {
                setMenuOpen(false);
                startTransition(async () => {
                  await copyQuestionnaireAction(questionnaire.id);
                });
              }}
            >
              复制问卷
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem icon={<GridIcon />} onSelect={() => open('template')}>
            另存为模板
          </DropdownMenuItem>

          {isDesktop ? (
            <>
              <DropdownMenuItem
                icon={<DownloadIcon />}
                onSelect={() => {
                  setMenuOpen(false);
                  // 造一个临时 <a download> 触发下载：导出接口带
                  // Content-Disposition: attachment，点一下就直接落盘、不会跳页
                  const anchor = document.createElement('a');
                  anchor.href = `/api/questionnaires/${questionnaire.id}/export`;
                  anchor.download = '';
                  anchor.click();
                }}
              >
                导出 JSON
              </DropdownMenuItem>
              <DropdownMenuItem icon={<UploadIcon />} onSelect={() => open('import')}>
                导入 JSON
              </DropdownMenuItem>
            </>
          ) : null}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            icon={<ArchiveIcon />}
            disabled={pending || archived}
            onSelect={() => {
              setMenuOpen(false);
              startTransition(async () => {
                await archiveQuestionnaireAction(questionnaire.id);
              });
            }}
          >
            归档
          </DropdownMenuItem>

          <DropdownMenuItem
            icon={<UsersIcon />}
            disabled
            badge={UPCOMING_BADGE.V20}
            title="问卷移交属 2.0 规划，本版本不开放"
          >
            问卷移交
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem tone="danger" icon={<TrashIcon />} onSelect={() => open('delete')}>
            删除问卷
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteQuestionnaireDialog
        open={dialog === 'delete'}
        onOpenChange={(next) => setDialog(next ? 'delete' : null)}
        questionnaireId={questionnaire.id}
        title={questionnaire.title}
        responseCount={questionnaire.responseCount}
      />

      <SaveAsTemplateDialog
        open={dialog === 'template'}
        onOpenChange={(next) => setDialog(next ? 'template' : null)}
        questionnaireId={questionnaire.id}
        defaultTitle={questionnaire.title}
      />

      <ImportJsonDialog
        open={dialog === 'import'}
        onOpenChange={(next) => setDialog(next ? 'import' : null)}
        questionnaireId={questionnaire.id}
      />
    </>
  );
}
