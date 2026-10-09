'use client';

import { useState } from 'react';

import { QUESTION_TYPE_ICON } from '@/components/icons/question-type-icons';
import {
  AlertCircleIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  DotsIcon,
  EyeIcon,
  GripIcon,
  HelpIcon,
  LinkIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { EmptyState } from '@/components/ui/empty-state';
import { Fab } from '@/components/ui/fab';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, ModalContent, ModalTrigger } from '@/components/ui/modal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { RadioCard, RadioCardBadge, RadioGroup } from '@/components/ui/radio-card';
import { RoleBadge } from '@/components/ui/role-badge';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { StatusBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  IDENTITY_MODE_LABEL,
  QUESTION_TYPE_LABEL,
  type QuestionType,
  UPCOMING_BADGE,
} from '@/config/constants';

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border-ink-200 shadow-card border bg-white p-6">
      <h3 className="text-title-m text-ink-900 font-semibold">{title}</h3>
      {note ? <p className="text-label text-ink-400 mt-1">{note}</p> : null}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-ink-400 mb-2.5 text-[11px] font-medium">{label}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

type Granularity = 'day' | 'week' | 'month';

const GRANULARITY_OPTIONS: SegmentedOption<Granularity>[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
];

const ROLE_ORDER = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'] as const;
const STATUS_ORDER = [
  'DRAFT',
  'PUBLISHED',
  'PAUSED',
  'CLOSED',
  'ARCHIVED',
  'LIMIT_REACHED',
] as const;

export function ComponentGallery() {
  const { toast } = useToast();
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [identity, setIdentity] = useState('ANONYMOUS');
  const [required, setRequired] = useState(true);
  const [shuffle, setShuffle] = useState(false);
  const [questionType, setQuestionType] = useState('SINGLE');
  const [tab, setTab] = useState('edit');
  const [done, setDone] = useState(3);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Panel
        title="Button"
        note="5 个变体 × 3 个尺寸。一个页面只允许一个 Primary —— 按钮不加投影。"
      >
        <Row label="Primary / Secondary / Outline / Ghost / Danger">
          <Button>发布问卷</Button>
          <Button variant="secondary">保存草稿</Button>
          <Button variant="outline">预览</Button>
          <Button variant="ghost">取消</Button>
          <Button variant="danger">删除</Button>
          <Button disabled>发布问卷</Button>
        </Row>
        <Row label="尺寸 32 / 40 / 44（移动端与主操作）">
          <Button size="sm">紧凑 32</Button>
          <Button size="md">标准 40</Button>
          <Button size="lg">移动 44</Button>
        </Row>
        <Row label="带图标">
          <Button variant="outline">
            <EyeIcon className="size-4" />
            预览
          </Button>
          <Button variant="ghost">
            <ClockIcon className="size-4" />
            历史版本
          </Button>
          <Button variant="ghost">
            <UsersIcon className="size-4" />
            协作
          </Button>
        </Row>
      </Panel>

      <Panel
        title="Input / Textarea / Label"
        note="聚焦为 2px 品牌色描边 + 3px 淡色外环；错误态必须配一行说明原因的文案。"
      >
        <div>
          <Label htmlFor="g-title" required>
            问卷名称
          </Label>
          <Input id="g-title" placeholder="例如：2026 社团活动报名表" />
        </div>
        <div>
          <Label htmlFor="g-limit">回收上限</Label>
          <Input id="g-limit" defaultValue="200" />
          <p className="text-caption text-ink-400 mt-1.5">达到上限后自动截止回收</p>
        </div>
        <div>
          <Label htmlFor="g-date">开始时间</Label>
          <Input id="g-date" invalid defaultValue="2026-09-31 10:00" />
          <p className="text-caption mt-1.5 flex items-center gap-1 text-rose-500">
            <AlertCircleIcon className="size-3" />
            日期不存在，请重新选择
          </p>
        </div>
        <div>
          <Label htmlFor="g-disabled" disabled>
            工作区 ID（不可修改）
          </Label>
          <Input id="g-disabled" disabled defaultValue="ws_8f3a92c1" />
        </div>
        <div>
          <Label htmlFor="g-desc" required>
            卷首说明
          </Label>
          <Textarea id="g-desc" rows={2} placeholder="请为本次活动的组织安排打分" />
        </div>
      </Panel>

      <Panel title="Select / Switch / Checkbox" note="Select 触发器外观与 Input 完全一致。">
        <div>
          <Label>题目类型</Label>
          <Select value={questionType} onValueChange={setQuestionType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {QUESTION_TYPE_LABEL[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border-ink-100 space-y-3.5 border-t pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-body-s text-ink-700">必填</div>
              <div className="text-caption text-ink-400">未作答不允许提交</div>
            </div>
            <Switch checked={required} onCheckedChange={setRequired} aria-label="必填" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-body-s text-ink-700">选项随机排序</div>
              <div className="text-caption text-ink-400">仅选择题可用</div>
            </div>
            <Switch checked={shuffle} onCheckedChange={setShuffle} aria-label="选项随机排序" />
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox id="g-example" />
            <label htmlFor="g-example" className="text-body-s text-ink-700">
              主题沙龙
            </label>
          </div>
        </div>
      </Panel>

      <Panel
        title="RadioCard（作答身份三选一）"
        note="发布时的必选项，两端都不能省；字段与顺序必须逐项一致。"
      >
        <RadioGroup
          value={identity}
          onValueChange={setIdentity}
          className="space-y-2.5"
          aria-label="作答身份"
        >
          {(['ANONYMOUS', 'LOGIN_REQUIRED', 'PASSWORD'] as const).map((mode) => (
            <RadioCard
              key={mode}
              value={mode}
              title={IDENTITY_MODE_LABEL[mode].title}
              description={IDENTITY_MODE_LABEL[mode].description}
              badge={mode === 'ANONYMOUS' ? <RadioCardBadge>推荐</RadioCardBadge> : undefined}
            />
          ))}
        </RadioGroup>
      </Panel>

      <Panel
        title="StatusBadge / RoleBadge"
        note="状态一律「圆点 + 文字」双通道；角色用同色系深浅表达权限高低。"
      >
        <Row label="问卷状态">
          {STATUS_ORDER.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </Row>
        <Row label="成员角色">
          {ROLE_ORDER.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </Row>
      </Panel>

      <Panel title="EmptyState" note="必须包含「为什么空 + 下一步做什么」；出口按钮要有真落点。">
        <EmptyState
          icon={<DownloadIcon />}
          title="还没有问卷"
          description="从空白创建，或挑一个模板开始"
          action={
            <Button size="sm">
              <PlusIcon className="size-3.5" />
              新建问卷
            </Button>
          }
        />
      </Panel>

      <Panel
        title="Tabs（问卷内一级导航）"
        note="五个页面里必须逐字一致、位置一致；缺一个用户就会以为那功能不存在。"
      >
        <div className="rounded-card border-ink-200 overflow-hidden border">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="border-ink-200 border-b">
              <TabsTrigger value="edit">编辑</TabsTrigger>
              <TabsTrigger value="publish">发布设置</TabsTrigger>
              <TabsTrigger value="share">分享</TabsTrigger>
              <TabsTrigger value="stats">数据</TabsTrigger>
              <TabsTrigger value="responses">答卷</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Panel>

      <Panel
        title="SegmentedControl / Progress / Fab"
        note="选中块用 shadow-sm 交代「被抬起来」；FAB 是唯一允许带投影的按钮。"
      >
        <Row label="统计粒度">
          <SegmentedControl
            value={granularity}
            onValueChange={setGranularity}
            options={GRANULARITY_OPTIONS}
            aria-label="统计粒度"
          />
          <SegmentedControl
            value={granularity}
            onValueChange={setGranularity}
            options={GRANULARITY_OPTIONS}
            size="sm"
            aria-label="统计粒度（小）"
          />
        </Row>
        <div>
          <div className="text-label text-ink-500 mb-2 flex items-center justify-between">
            <span>回收进度</span>
            <span className="tnum">{done * 32} / 200</span>
          </div>
          <Progress value={done * 16} />
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDone((v) => (v >= 5 ? 1 : v + 1))}
            >
              调整进度
            </Button>
          </div>
        </div>
        <Row label="移动端 FAB">
          <Fab aria-label="新建问卷">
            <PlusIcon className="size-5" />
          </Fab>
        </Row>
      </Panel>

      <Panel
        title="Modal / Drawer / Sheet"
        note="L4 浮层：圆角 16 + shadow-pop。弹层出现 200ms，抽屉 250ms。"
      >
        <Row label="触发">
          <Modal>
            <ModalTrigger asChild>
              <Button variant="secondary">新建问卷</Button>
            </ModalTrigger>
            <ModalContent
              title="新建问卷"
              description="选一条路开始。两条路的终点是同一个编辑器。"
              footer={
                <>
                  <Button variant="ghost">取消</Button>
                  <Button>进入编辑器</Button>
                </>
              }
            >
              <div className="rounded-card border-ink-200 text-body-s text-ink-500 border border-dashed p-4 text-center">
                空白创建 / 从模板创建
              </div>
            </ModalContent>
          </Modal>

          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline">
                <ClockIcon className="size-4" />
                历史版本
              </Button>
            </DrawerTrigger>
            <DrawerContent
              title="历史版本"
              description="移动端不做 —— 翻长列表与逐版本比对需要大面积视野。"
            >
              <ul className="space-y-2">
                {['v3 · 发布会前定稿', 'v2 · 加了第 3 题评分题', 'v1 · 从模板创建'].map((item) => (
                  <li
                    key={item}
                    className="rounded-card border-ink-200 flex items-center justify-between border px-4 py-3"
                  >
                    <span className="text-body-s text-ink-700">{item}</span>
                    <Button size="sm" variant="ghost">
                      回滚
                    </Button>
                  </li>
                ))}
              </ul>
            </DrawerContent>
          </Drawer>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">打开底部弹层（P08 形态）</Button>
            </SheetTrigger>
            <SheetContent
              title="题目属性"
              description="与 Web 右栏字段逐个对等，只换容器。"
              footer={<Button className="w-full">完成</Button>}
            >
              <div className="space-y-4">
                <div>
                  <Label>题目</Label>
                  <Textarea defaultValue="请为本次活动的组织安排打分" rows={2} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-body-s text-ink-700">必填</span>
                  <Switch defaultChecked aria-label="必填" />
                </div>
                <div className="border-ink-200 bg-ink-50 text-ink-400 rounded-[10px] border border-dashed p-3 text-[11.5px] leading-5">
                  条件跳转 · {UPCOMING_BADGE.V11} 上线
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </Row>
      </Panel>

      <Panel
        title="DropdownMenu / Popover / Tooltip"
        note="灰显项必须 disabled + 角标，不给 hover 假反馈。"
      >
        <Row label="列表项「⋯」菜单">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="更多操作">
                <DotsIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>问卷操作</DropdownMenuLabel>
              <DropdownMenuItem icon={<CopyIcon />}>复制问卷</DropdownMenuItem>
              <DropdownMenuItem icon={<DownloadIcon />}>导出 JSON</DropdownMenuItem>
              <DropdownMenuItem icon={<LinkIcon />}>另存为模板</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" icon={<TrashIcon />}>
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="指标口径">
                <HelpIcon className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px]">
              <div className="text-body-s text-ink-900 font-medium">回收率</div>
              <p className="text-label text-ink-500 mt-2 leading-5">
                有效答卷 ÷ 回收份数。有效答卷 = 回收份数 − 已标记无效，分母同样是有效作答人数。
              </p>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="拖拽排序">
                <GripIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>长按拖拽排序</TooltipContent>
          </Tooltip>
        </Row>
      </Panel>

      <Panel title="Toast" note="瞬时反馈走全局通知中心；服务端数据不进这里。">
        <Row label="触发">
          <Button
            variant="secondary"
            onClick={() =>
              toast({ title: '短链已复制', description: 'qingwj.cn/s/8f3a92', variant: 'success' })
            }
          >
            成功通知
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast({
                title: '达到回收上限',
                description: '该问卷已自动转为已截止',
                variant: 'error',
              })
            }
          >
            错误通知
          </Button>
        </Row>
      </Panel>

      <Panel
        title="题型图标（8 个）"
        note="Web 左栏与移动端题型弹层共用同一套 —— 图标是两端对齐的锚点。R62 起 8 个题型全开放。"
      >
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((type) => {
            const Icon = QUESTION_TYPE_ICON[type];

            return (
              <div
                key={type}
                className="border-ink-200 flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-[10px] border"
              >
                <Icon className="text-ink-400 size-4" />
                <span className="text-ink-600 text-[11.5px]">{QUESTION_TYPE_LABEL[type]}</span>
              </div>
            );
          })}
        </div>
        <Row label="功能图标">
          <span className="text-ink-500 flex items-center gap-3">
            <SearchIcon className="size-4" />
            <CalendarIcon className="size-4" />
            <ChevronDownIcon className="size-4" />
            <CheckIcon className="size-4" />
            <EyeIcon className="size-4" />
            <DownloadIcon className="size-4" />
          </span>
        </Row>
      </Panel>
    </div>
  );
}
