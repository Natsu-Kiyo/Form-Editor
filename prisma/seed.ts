/**
 * 演示数据种子脚本。
 *
 * 用法：pnpm db:seed
 *
 * **幂等**：全部走 upsert，重复执行不会产生重复数据（改密码后需要重新 seed 也没问题）。
 *
 * 注意运行方式：`src/lib/db.ts` 与 `src/lib/auth/password.ts` 首行都是 `import 'server-only'`，
 * 纯 Node 下会直接抛错，所以必须带 `--conditions=react-server`；
 * 同时纯 Node 不会自动读 `.env`，要显式 `--env-file-if-exists=.env`。
 * 这两个开关已写在 prisma.config.ts 的 `migrations.seed` 里。
 */
import { DEMO_ACCOUNTS } from '@/config/constants';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/db';

const WORKSPACE_SLUG = 'qingwj-demo';

async function upsertUser(input: { name: string; email: string; password: string }) {
  const passwordHash = await hashPassword(input.password);

  return prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name, passwordHash },
    create: { name: input.name, email: input.email, passwordHash },
  });
}

async function main() {
  const owner = await upsertUser(DEMO_ACCOUNTS.owner);
  const viewer = await upsertUser(DEMO_ACCOUNTS.viewer);

  // 用固定 slug 保证幂等
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: '轻问卷演示团队', ownerId: owner.id },
    create: { name: '轻问卷演示团队', slug: WORKSPACE_SLUG, ownerId: owner.id },
  });

  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: owner.id } },
    update: { role: 'OWNER' },
    create: { workspaceId: workspace.id, userId: owner.id, role: 'OWNER' },
  });

  // 第二个账号是「查看者」：M8 会用它对写操作做越权走查
  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: viewer.id } },
    update: { role: 'VIEWER' },
    create: { workspaceId: workspace.id, userId: viewer.id, role: 'VIEWER' },
  });

  // 顶栏铃铛必须有真实内容 —— 否则「点了没反应」的假入口就出在这里
  const existingNotifications = await prisma.notification.count({ where: { userId: owner.id } });

  if (existingNotifications === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: owner.id,
          type: 'WELCOME',
          title: '欢迎使用轻问卷',
          body: `工作区「${workspace.name}」已就绪，可以开始创建问卷了。`,
        },
        {
          userId: owner.id,
          type: 'MEMBER_JOINED',
          title: '新成员加入',
          body: `${DEMO_ACCOUNTS.viewer.name} 以「查看者」身份加入了工作区。`,
        },
        {
          userId: owner.id,
          type: 'DEMO_NOTICE',
          title: '关于演示数据',
          body: '这是公开演示环境，请勿填写真实的敏感信息。',
        },
      ],
    });
  }

  console.log(
    `[seed] 完成：${DEMO_ACCOUNTS.owner.email}（所有者）、${DEMO_ACCOUNTS.viewer.email}（查看者）、工作区「${workspace.name}」`,
  );

  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error('[seed] 执行失败：', error);
  await prisma.$disconnect();
  process.exit(1);
});
