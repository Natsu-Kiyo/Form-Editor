'use client';

import { useActionState, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, ModalContent } from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_NEW } from '@/config/constants';
import { EMPTY_FORM_STATE } from '@/types/form-state';

import { saveAsTemplateAction } from '../actions/save-as-template';
import { getTemplateCategoryOptionsAction } from '../actions/template-categories';

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  questionnaireId,
  defaultTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionnaireId: string;
  defaultTitle: string;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title="另存为模板"
        description="模板保存的是题目结构，不含答卷数据。"
        width="sm"
      >
        {/* 只在打开时挂载：关闭后表单状态随之重置，不会残留上一次的报错 */}
        {open ? (
          <SaveAsTemplateForm
            questionnaireId={questionnaireId}
            defaultTitle={defaultTitle}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </ModalContent>
    </Modal>
  );
}

function SaveAsTemplateForm({
  questionnaireId,
  defaultTitle,
  onDone,
}: {
  questionnaireId: string;
  defaultTitle: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveAsTemplateAction, EMPTY_FORM_STATE);

  /**
   * 分类下拉的选项。
   *
   * **常量先渲染**（计划书定下的五个永远在），自建分类由 action 取回后合并进来 ——
   * 「我的模板」里已有的分类不能因为一次请求还没回来就选不到。
   * 取失败也不影响提交：重名校验在服务端按真实清单做。
   */
  const [options, setOptions] = useState<string[]>([...TEMPLATE_CATEGORIES]);

  /**
   * 用户**当下选**的分类；`null` = 还没选过。
   *
   * 为什么不直接 `useState(state.values?.category)`：React 19 在 action 结束后会重置表单
   * （见 `types/form-state.ts`），Radix 的下拉随之被清空并回调一次空值 —— 选中项就丢了。
   * 所以这里存「用户的选择」，最终值**在渲染时派生**：用户选过就用他的，
   * 否则回落到服务端回填的值。派生而不是「在 effect 里补一次 setState」，
   * 既不会级联渲染，也符合 lint 的 set-state-in-effect 规则。
   */
  const [picked, setPicked] = useState<string | null>(null);
  const category = picked || state.values?.category || '';

  const isNewCategory = category === TEMPLATE_CATEGORY_NEW;

  /*
   * 有错误就**强制显示**这个字段。
   *
   * 起因是一个只看得到「保存中…」却不显示任何错误的怪现象：表单被重置后
   * `isNewCategory` 变 false，**连输入框带它的报错一起被卸载** ——
   * 服务端明明返回了「这个分类已经存在」，用户却什么都看不到。
   */
  const showNewCategory = isNewCategory || Boolean(state.fieldErrors?.newCategory);

  useEffect(() => {
    let cancelled = false;

    void getTemplateCategoryOptionsAction()
      .then((items) => {
        if (!cancelled) setOptions(items);
      })
      .catch(() => {
        // 只列常量即可，提交时服务端仍按真实清单校验
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="questionnaireId" value={questionnaireId} />

      <div>
        <Label htmlFor="template-title" required>
          模板名称
        </Label>
        <Input
          id="template-title"
          name="title"
          defaultValue={state.values?.title ?? defaultTitle}
          invalid={Boolean(state.fieldErrors?.title)}
          required
        />
        {state.fieldErrors?.title ? (
          <p className="text-caption mt-1.5 text-rose-500">{state.fieldErrors.title.join('，')}</p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="template-category" required>
          模板分类
        </Label>
        {/* `name` 交给 Radix 渲染的隐藏控件提交；选「新增分类」时提交的是下面那个输入框的值 */}
        <Select name="category" value={category} onValueChange={setPicked}>
          <SelectTrigger id="template-category" invalid={Boolean(state.fieldErrors?.category)}>
            <SelectValue placeholder="选择或新建一个分类" />
          </SelectTrigger>
          <SelectContent>
            {options.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
            <SelectItem value={TEMPLATE_CATEGORY_NEW}>+ 新增分类</SelectItem>
          </SelectContent>
        </Select>
        {state.fieldErrors?.category ? (
          <p className="text-caption mt-1.5 text-rose-500">
            {state.fieldErrors.category.join('，')}
          </p>
        ) : null}
      </div>

      {showNewCategory ? (
        <div>
          <Label htmlFor="template-new-category" required>
            新分类名称
          </Label>
          <Input
            id="template-new-category"
            name="newCategory"
            defaultValue={state.values?.newCategory}
            invalid={Boolean(state.fieldErrors?.newCategory)}
            placeholder="例如：面试评估"
            required
          />
          <p className="text-ink-400 mt-1.5 text-[11.5px]">
            不能与现有分类重名。建好后它会出现在「我的模板」的分类里，之后就能直接选。
          </p>
          {state.fieldErrors?.newCategory ? (
            <p className="text-caption mt-1.5 text-rose-500">
              {state.fieldErrors.newCategory.join('，')}
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <Label htmlFor="template-description">模板说明</Label>
        <Textarea
          id="template-description"
          name="description"
          rows={2}
          defaultValue={state.values?.description}
          placeholder="一句话说明这个模板适用什么场景"
        />
      </div>

      {state.message ? <p className="text-caption text-rose-500">{state.message}</p> : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          取消
        </Button>
        <Button loading={pending} type="submit" disabled={pending}>
          {pending ? '保存中…' : '保存模板'}
        </Button>
      </div>
    </form>
  );
}
