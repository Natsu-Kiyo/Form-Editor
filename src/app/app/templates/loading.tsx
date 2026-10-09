import { TemplatePageSkeleton } from '@/features/questionnaire/components/template-gallery-skeleton';

/**
 * 模板中心的等待态（Next 的 `loading.tsx`）。
 *
 * 它在**外壳之内**渲染：侧栏（layout）不动，只有内容区换成骨架 ——
 * 与成员 / 日志页的 loading 同款。
 *
 * 注意它覆盖的是**从别的页面进模板中心**这一段。**同页切 Tab / 分类**不走这里：
 * Next 对同路由的 searchParams 变化不会重新挂载 loading 边界（页面不会重挂，
 * 只是收到新的 props），那一段由 `template-gallery.tsx` 的 `isPending` 负责 ——
 * 两处共用同一套骨架（`template-gallery-skeleton.tsx`）。
 */
export default function TemplatesLoading() {
  return <TemplatePageSkeleton />;
}
