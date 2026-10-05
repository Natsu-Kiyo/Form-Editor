'use server';

import { revalidatePath } from 'next/cache';

import { setActiveWorkspace } from '@/lib/auth/active-workspace';
import { requireUser } from '@/lib/auth/dal';
import type { FormState } from '@/types/form-state';
import { toFieldErrors } from '@/utils/zod-errors';

import { createWorkspace } from '../api/workspaces';
import { createWorkspaceSchema } from '../schemas';

export async function createWorkspaceAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = createWorkspaceSchema.safeParse({ name: formData.get('name') });

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error),
      values: { name: String(formData.get('name') ?? '') },
    };
  }

  const workspace = await createWorkspace(user.id, parsed.data.name);

  // 新建完直接切过去：用户的意图就是「到新工作区里去」
  await setActiveWorkspace(workspace.id);
  revalidatePath('/app', 'layout');

  return { success: `工作区「${workspace.name}」已创建` };
}
