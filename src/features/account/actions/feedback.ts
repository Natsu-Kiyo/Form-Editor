'use server';

import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/dal';
import type { FormState } from '@/types/form-state';
import { toFieldErrors } from '@/utils/zod-errors';

import { feedbackSchema } from '../schemas';

/** 目前没有让用户选分类的界面，统一记为 GENERAL；字段留着是为了以后能分类统计 */
const DEFAULT_CATEGORY = 'GENERAL';

export async function submitFeedbackAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = feedbackSchema.safeParse({ content: formData.get('content') });

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error),
      values: { content: String(formData.get('content') ?? '') },
    };
  }

  await prisma.feedback.create({
    data: { userId: user.id, category: DEFAULT_CATEGORY, content: parsed.data.content },
  });

  return { success: '反馈已提交，谢谢！' };
}
