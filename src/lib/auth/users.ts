import 'server-only';

import { randomBytes } from 'node:crypto';

import { prisma } from '@/lib/db';

import { hashPassword } from './password';

/**
 * User 记录的读写。
 *
 * 为什么放在 `lib/` 而不是某个 feature 的 `api/`：**auth 与 account 两个 feature 都要用它**，
 * 而 features 之间禁止互相导入。凡是「身份数据」这种被多个 feature 共享的读写，
 * 一律上提到 shared 层；只服务于单一业务的实体数据仍留在各自 feature 的 `api/`。
 */

export function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/**
 * 只取密码哈希用于校验。
 * 单独开一个函数而不是复用 getUserByEmail：**别把 passwordHash 带进任何会外传的对象**，
 * 免得某天顺手把它塞进了传给客户端组件的 props。
 */
export async function getUserPasswordHash(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  return user?.passwordHash ?? null;
}

/** 工作区 slug。目前只用于唯一标识，不进 URL（切换工作区靠 Cookie），所以随机即可 */
function randomWorkspaceSlug() {
  return `ws-${randomBytes(4).toString('hex')}`;
}

/**
 * 注册：建账号的同时开一个默认工作区。
 *
 * 必须一起建 —— 否则新用户进来没有任何工作区，侧栏切换器是空的，
 * 而切换器又不是「可以之后再建」的东西（问卷、成员、日志全部挂在工作区下）。
 * 三张表放在同一个事务里，避免留下「有账号没工作区」的半成品。
 */
export async function createUserWithDefaultWorkspace(input: {
  name: string;
  email: string;
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        passwordUpdatedAt: now,
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        name: `${input.name} 的工作区`,
        slug: randomWorkspaceSlug(),
        ownerId: user.id,
      },
    });

    await tx.membership.create({
      data: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' },
    });

    return user;
  });
}

export async function updateUserPassword(userId: string, password: string) {
  const passwordHash = await hashPassword(password);

  return prisma.user.update({
    where: { id: userId },
    // 一并记录修改时间：账号与安全页要如实展示「上次修改」
    data: { passwordHash, passwordUpdatedAt: new Date() },
  });
}

export function updateUserName(userId: string, name: string) {
  return prisma.user.update({ where: { id: userId }, data: { name } });
}

/** 账号与安全页要展示的信息 */
export function getAccountSecurityInfo(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, passwordUpdatedAt: true },
  });
}
