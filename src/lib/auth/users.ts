import 'server-only';

import { prisma } from '@/lib/db';

import { hashPassword } from './password';
import { randomWorkspaceSlug } from './workspace-lifecycle';

/**
 * User 记录的读写。
 *
 * 为什么放在 `lib/` 而不是某个 feature 的 `api/`：**auth 与 account 两个 feature 都要用它**，
 * 而 features 之间禁止互相导入。凡是「身份数据」这种被多个 feature 共享的读写，
 * 一律上提到 shared 层；只服务于单一业务的实体数据仍留在各自 feature 的 `api/`。
 */

/**
 * 账号的公开信息（**不含口令哈希**）。
 *
 * 返回值会经 action 流进页面与 props，所以字段在这里就收窄 ——
 * 免得某天顺手把它塞进了传给客户端组件的 props（R91 · N8）。
 */
export function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
}

/**
 * 登录校验专用：**只**取 id 与口令哈希。
 *
 * 单独一个函数而不是让 `getUserByEmail` 带上哈希 —— 与下面 `getUserPasswordHash`
 * 同一个理由：**别把 passwordHash 带进任何会外传的对象**。
 */
export function getUserCredentials(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
}

/**
 * 只取密码哈希用于校验（按 id）。
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
    /*
     * `select` 只取 id：这道「别把口令哈希带进任何会外传的对象」的规矩
     * 与 `getUserByEmail` / `getUserCredentials` 是同一条 —— 调用方（register action）
     * 要的只有 id，而返回值会顺着 action 的调用栈走（R92）。
     */
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        passwordUpdatedAt: now,
      },
      select: { id: true },
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

/** 改密码。**不返回整行** —— 调用方只用它的副作用，返回值没理由带着新的口令哈希（R92） */
export async function updateUserPassword(userId: string, password: string) {
  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id: userId },
    // 一并记录修改时间：账号与安全页要如实展示「上次修改」
    data: { passwordHash, passwordUpdatedAt: new Date() },
    select: { id: true },
  });
}

/** 改昵称。理由同上，只做写入、不返回整行 */
export async function updateUserName(userId: string, name: string) {
  await prisma.user.update({ where: { id: userId }, data: { name }, select: { id: true } });
}

/** 账号与安全页要展示的信息 */
export function getAccountSecurityInfo(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, passwordUpdatedAt: true },
  });
}
