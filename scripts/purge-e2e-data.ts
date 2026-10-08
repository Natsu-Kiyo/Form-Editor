/**
 * 清掉历次 E2E 运行留下的数据 —— **每次跑用例之前自动执行**（见 `package.json` 的 `e2e` 脚本）。
 *
 * 为什么必须有这一步：用例都会写库，而它们的清理写在**用例末尾**。于是只要某一轮失败
 * （数据库抖动、断言写错、跑一半被 Ctrl-C），残留就留下来了；下一轮的同名卡片、同名邀请
 * 会让 `getByRole(...)` 命中多个元素，报的是 `strict mode violation` 或 `toHaveCount(0)` 不符 ——
 * **看起来像用例写错了，其实是上一轮的尸体**。这个连锁我们连着踩了好几轮：
 * 一次失败之后，那几条用例就再也跑不过，直到手工清库。
 *
 * 两条边界，刻意收紧：
 * - 只删**能确定属于 E2E** 的东西：标题以 `E2E ` 开头的问卷与模板、邮箱含 `e2e.` 的账号与邀请、
 *   正文含 `E2E ` 的通知。演示数据（`prisma/seed.ts` 的那批）一条都不碰。
 * - 「未命名问卷」是**唯一**靠标题认不出归属的一类（它就是空白新建的默认标题）。
 *   一开始写成「留最早的一份、其余删掉」，结果**留的那一份正好把它搞红**：
 *   `questionnaire-list.spec.ts` 的全链路用例要求这个名字在列表里**唯一**
 *   （它自己会新建一份再删掉，不需要任何预置）。所以这里**全部清掉**。
 *   代价说清楚：如果你手头正有一份没命名的草稿，它会被删掉 —— 请给它起个名字。
 *
 * 顺序不能换：账号持有工作区（`Workspace.ownerId` 是必填外键），
 * 先删账号会撞 `Workspace_ownerId_fkey`；邀请要赶在账号前面删，否则同样的外键问题。
 */

import { prisma } from '@/lib/db';

const E2E_EMAIL = { contains: 'e2e.', mode: 'insensitive' } as const;
const E2E_TITLE_OR = [{ title: { startsWith: 'E2E ' } }, { title: { startsWith: '「E2E ' } }];

async function main() {
  // 1) 通知：正文里出现 `E2E `（「E2E 通知成员 以「编辑者」身份加入了工作区。」这类）
  const notifications = await prisma.notification.deleteMany({
    where: { body: { contains: 'E2E ' } },
  });

  // 2) 邀请：邮箱含 `e2e.`
  const invitations = await prisma.invitation.deleteMany({ where: { email: E2E_EMAIL } });

  // 3) 工作区：由 E2E 账号自己拥有（注册时每人会拿到一个），必须先于账号删除
  const workspaces = await prisma.workspace.deleteMany({ where: { owner: { email: E2E_EMAIL } } });

  // 4) 账号：连带其成员关系、答卷、通知
  const users = await prisma.user.deleteMany({ where: { email: E2E_EMAIL } });

  // 5) 问卷：标题以 E2E 开头（连带题目 / 选项 / 版本 / 答卷 / 答案）
  const questionnaires = await prisma.questionnaire.deleteMany({ where: { OR: E2E_TITLE_OR } });

  // 6) 「未命名问卷」：全部清掉（见文件顶部说明 —— 留一份会让列表用例的同名断言必红）
  const unnamedRemoved = await prisma.questionnaire.deleteMany({
    where: { title: { startsWith: '未命名问卷' } },
  });

  // 7) 模板：与问卷同理 —— 「另存为模板」那条用例失败时，它造出来的模板会留在「我的模板」里
  const templates = await prisma.template.deleteMany({
    where: { OR: [{ title: { startsWith: 'E2E ' } }, { title: { startsWith: '「E2E ' } }] },
  });

  const summary: Array<[string, number]> = [
    ['通知', notifications.count],
    ['邀请', invitations.count],
    ['工作区', workspaces.count],
    ['账号', users.count],
    ['E2E 问卷', questionnaires.count],
    ['未命名问卷', unnamedRemoved.count],
    ['E2E 模板', templates.count],
  ];

  const touched = summary.filter(([, count]) => count > 0);
  if (touched.length === 0) {
    console.log('[e2e] 没有需要清理的残留数据');
    return;
  }

  console.log(
    `[e2e] 已清理残留：${touched.map(([name, count]) => `${name} ${count}`).join(' · ')}`,
  );
}

void main()
  .catch((error) => {
    // 清理失败**不该**让整轮用例跑不起来：残留顶多让个别用例变红，而跑不起来是全红
    console.error('[e2e] 残留清理失败（继续跑）：', error instanceof Error ? error.message : error);
  })
  .finally(() => process.exit(0));
