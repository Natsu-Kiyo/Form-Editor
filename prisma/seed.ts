/**
 * 演示数据种子脚本。
 *
 * 用法：pnpm db:seed
 *
 * **幂等**：用户 / 工作区 / 成员走 upsert；问卷按固定 slug upsert，
 * 题目与答卷先删后建，所以反复执行的结果完全一致（改密码后需要重新 seed 也没问题）。
 *
 * 注意运行方式：`src/lib/db.ts` 与 `src/lib/auth/password.ts` 首行都是 `import 'server-only'`，
 * 纯 Node 下会直接抛错，所以必须带 `--conditions=react-server`；
 * 同时纯 Node 不会自动读 `.env`，要显式 `--env-file-if-exists=.env`。
 * 这两个开关已写在 prisma.config.ts 的 `migrations.seed` 里。
 */
import { DEMO_ACCOUNTS, type QuestionnaireStatus } from '@/config/constants';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/db';
import { toJsonColumn } from '@/lib/json';

const WORKSPACE_SLUG = 'qingwj-demo';

/** 演示用的邀请 token（手工打开 `/invite/demo-invite-li-meng` 即可验接受流程） */
const DEMO_INVITE_TOKEN = 'demo-invite-li-meng';

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY);
}

type SeededQuestion = {
  type: 'SINGLE' | 'MULTI' | 'SHORT_TEXT' | 'LONG_TEXT' | 'RATING' | 'DROPDOWN' | 'DATE';
  title: string;
  description?: string;
  required?: boolean;
  options?: string[];
  /** 题型差异项：评分范围、文本长度上限等 */
  config?: Record<string, unknown>;
};

type SeededQuestionnaire = {
  /** 稳定的业务标识，问卷没有可读 slug 之外的唯一键，靠它做 upsert */
  seedKey: string;
  title: string;
  intro: string;
  status: QuestionnaireStatus;
  responseLimit?: number;
  /** 要生成多少份答卷。0 表示这份问卷还没有人答过 */
  responseCount: number;
  createdDaysAgo: number;
  updatedDaysAgo: number;
  questions: SeededQuestion[];
};

/**
 * 演示问卷。
 *
 * 数量与状态刻意铺开覆盖全部筛选胶囊，否则「状态筛选」没有可验证的对象；
 * 标题沿用设计稿 W02 的卡片文案，保持与设计稿一一对应。
 */
const QUESTIONNAIRES: SeededQuestionnaire[] = [
  {
    seedKey: 'demo-club-recruit',
    title: '2026 秋季社团招新报名',
    intro: '收集新成员基本信息、意向部门与可参与时间，用于招新面试排期。',
    status: 'PUBLISHED',
    responseLimit: 200,
    responseCount: 128,
    createdDaysAgo: 24,
    updatedDaysAgo: 1,
    questions: [
      {
        type: 'SHORT_TEXT',
        title: '你的姓名',
        required: true,
      },
      {
        type: 'SINGLE',
        title: '你的意向部门是？',
        required: true,
        options: ['策划部', '宣传部', '外联部', '技术部'],
      },
      {
        type: 'MULTI',
        title: '你希望在社团参与哪些活动？',
        options: ['主题沙龙', '户外拓展', '公益实践', '技能工作坊'],
      },
      {
        type: 'DROPDOWN',
        title: '你能投入的时间是？',
        options: ['每周 2 小时以内', '每周 2–5 小时', '每周 5 小时以上'],
      },
      {
        type: 'RATING',
        title: '你对自己组织能力的评价',
        config: { min: 1, max: 5 },
      },
      {
        type: 'LONG_TEXT',
        title: '还有什么想让我们知道的？',
      },
    ],
  },
  {
    seedKey: 'demo-product-nps',
    title: '产品满意度调研（Q3）',
    intro: '面向内测用户的满意度与 NPS 调研，含功能评分与开放建议。',
    status: 'PUBLISHED',
    responseLimit: 500,
    responseCount: 342,
    createdDaysAgo: 18,
    updatedDaysAgo: 2,
    questions: [
      {
        type: 'RATING',
        title: '总体来说，你对产品的满意度',
        required: true,
        config: { min: 1, max: 10 },
      },
      {
        type: 'SINGLE',
        title: '你最常使用的功能是？',
        required: true,
        options: ['问卷编辑', '数据统计', '团队协作', '模板中心'],
      },
      {
        type: 'MULTI',
        title: '你希望优先改进哪些方面？',
        options: ['作答体验', '统计图表', '导出格式', '权限管理'],
      },
      {
        type: 'LONG_TEXT',
        title: '如果只能提一条建议，你会说什么？',
      },
    ],
  },
  {
    seedKey: 'demo-peer-review',
    title: '课程作业互评 · 用户体验设计',
    intro: '小组间匿名互评，评分维度含完整度、创新性与表达清晰度。',
    status: 'PAUSED',
    responseLimit: 60,
    responseCount: 41,
    createdDaysAgo: 12,
    updatedDaysAgo: 4,
    questions: [
      { type: 'RATING', title: '方案完整度', required: true, config: { min: 1, max: 5 } },
      { type: 'RATING', title: '创新性', required: true, config: { min: 1, max: 5 } },
      { type: 'RATING', title: '表达清晰度', required: true, config: { min: 1, max: 5 } },
      { type: 'LONG_TEXT', title: '给这组的改进建议' },
    ],
  },
  {
    seedKey: 'demo-teambuilding',
    title: '团建活动时间意愿投票',
    intro: '统计团队成员可选时间段，用于确定团建日期与地点。',
    status: 'CLOSED',
    responseCount: 96,
    createdDaysAgo: 30,
    updatedDaysAgo: 9,
    questions: [
      {
        type: 'MULTI',
        title: '你的可选时间段',
        required: true,
        options: ['周五晚上', '周六上午', '周六下午', '周日全天'],
      },
      {
        type: 'SINGLE',
        title: '你更倾向的活动形式',
        options: ['户外拓展', '城市漫步', '桌游聚会', '手工工作坊'],
      },
      { type: 'DATE', title: '如果只能选一天，你希望是？' },
    ],
  },
  {
    seedKey: 'demo-interview-recruit',
    title: '用户访谈招募（草稿）',
    intro: '招募 8 位深度用户做 30 分钟访谈，用于下一版的信息架构改版。',
    status: 'DRAFT',
    responseCount: 0,
    createdDaysAgo: 3,
    updatedDaysAgo: 3,
    questions: [
      { type: 'SHORT_TEXT', title: '你的称呼与常用邮箱', required: true },
      {
        type: 'SINGLE',
        title: '你使用本产品的频率',
        options: ['每天', '每周几次', '每月几次', '更少'],
      },
      { type: 'LONG_TEXT', title: '你遇到过的最大困扰是什么？' },
    ],
  },
  {
    seedKey: 'demo-onboarding-feedback',
    title: '新用户上手体验回访',
    intro: '第一次使用后 3 天的回访，关注上手阶段卡在哪一步。',
    status: 'DRAFT',
    responseCount: 0,
    createdDaysAgo: 5,
    updatedDaysAgo: 2,
    questions: [
      { type: 'RATING', title: '上手难度（越高越好）', required: true, config: { min: 1, max: 5 } },
      { type: 'SINGLE', title: '你最先尝试的功能', options: ['新建问卷', '模板中心', '加入团队'] },
    ],
  },
  {
    seedKey: 'demo-course-eval',
    title: '期末课程质量评估',
    intro: '面向结课学生的教学质量评估，结果用于下一学年课程调整。',
    status: 'CLOSED',
    responseLimit: 80,
    responseCount: 80,
    createdDaysAgo: 45,
    updatedDaysAgo: 20,
    questions: [
      { type: 'RATING', title: '课程内容充实度', required: true, config: { min: 1, max: 5 } },
      { type: 'RATING', title: '作业负荷是否合理', required: true, config: { min: 1, max: 5 } },
      { type: 'LONG_TEXT', title: '对课程的建议' },
    ],
  },
  {
    seedKey: 'demo-archive-legacy',
    title: '旧版功能使用情况摸底（已停用）',
    intro: '旧版功能下线前的使用情况统计，数据只读保留。',
    status: 'ARCHIVED',
    responseCount: 20,
    createdDaysAgo: 120,
    updatedDaysAgo: 60,
    questions: [
      {
        type: 'MULTI',
        title: '你还在使用哪些旧功能？',
        options: ['批量导入', '邮件通知', '自定义域名'],
      },
    ],
  },
];

/** 官方模板。与「新建问卷 → 从模板创建」共用同一套 payload 结构 */
const OFFICIAL_TEMPLATES: {
  title: string;
  description: string;
  category: string;
  questions: SeededQuestion[];
}[] = [
  {
    title: '活动报名',
    description: '姓名、联系方式与场次选择，适合讲座、社团、比赛报名。',
    category: '活动',
    questions: [
      { type: 'SHORT_TEXT', title: '你的姓名', required: true },
      { type: 'SHORT_TEXT', title: '手机号或邮箱', required: true },
      { type: 'SINGLE', title: '你要报名哪一场？', required: true, options: ['上午场', '下午场'] },
      { type: 'MULTI', title: '需要主办方提供什么？', options: ['餐饮', '停车位', '资料打印'] },
      { type: 'LONG_TEXT', title: '备注' },
    ],
  },
  {
    title: '满意度调研',
    description: '整体评分 + 分项评分 + 开放建议，标准 NPS 结构。',
    category: '调研',
    questions: [
      { type: 'RATING', title: '总体满意度', required: true, config: { min: 1, max: 10 } },
      { type: 'RATING', title: '产品易用性', config: { min: 1, max: 5 } },
      { type: 'RATING', title: '功能满足度', config: { min: 1, max: 5 } },
      { type: 'LONG_TEXT', title: '还有哪里可以做得更好？' },
    ],
  },
  {
    title: '会议时间投票',
    description: '收集可参与时段，快速找出全员都能到场的时间。',
    category: '协作',
    questions: [
      {
        type: 'MULTI',
        title: '你能参加的时段',
        required: true,
        options: ['周一上午', '周一下午', '周二上午', '周二下午'],
      },
      { type: 'SINGLE', title: '你更倾向线上还是线下', options: ['线下', '线上', '都可以'] },
      { type: 'DATE', title: '如果只能选一天，你希望是？' },
    ],
  },
  {
    title: '课程作业互评',
    description: '多维度评分为主，适合小组互评与教学反馈。',
    category: '教育',
    questions: [
      { type: 'SHORT_TEXT', title: '你评价的小组', required: true },
      { type: 'RATING', title: '完整度', required: true, config: { min: 1, max: 5 } },
      { type: 'RATING', title: '创新性', required: true, config: { min: 1, max: 5 } },
      { type: 'RATING', title: '表达清晰度', required: true, config: { min: 1, max: 5 } },
      { type: 'LONG_TEXT', title: '改进建议' },
    ],
  },
  {
    title: '用户访谈招募',
    description: '筛选愿意深度交流的用户，含背景问题与联系方式。',
    category: '调研',
    questions: [
      { type: 'SHORT_TEXT', title: '你的称呼', required: true },
      { type: 'SHORT_TEXT', title: '联系方式（邮箱或微信）', required: true },
      {
        type: 'DROPDOWN',
        title: '你使用产品的频率',
        options: ['每天', '每周几次', '每月几次', '更少'],
      },
      { type: 'LONG_TEXT', title: '你希望聊哪些问题？' },
    ],
  },
  {
    title: '活动签到',
    description: '现场扫码签到，字段极少，填写最快。',
    category: '活动',
    questions: [
      { type: 'SHORT_TEXT', title: '你的姓名', required: true },
      { type: 'DROPDOWN', title: '你的身份', options: ['嘉宾', '工作人员', '观众'] },
    ],
  },
];

async function upsertUser(input: { name: string; email: string; password: string }) {
  const passwordHash = await hashPassword(input.password);

  return prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name, passwordHash },
    create: { name: input.name, email: input.email, passwordHash },
  });
}

/** 按题目与序号造一条能自洽的作答值（选项下标错开，避免每份答卷都一样） */
function buildAnswerValue(question: SeededQuestion, index: number): string | number | string[] {
  switch (question.type) {
    case 'SINGLE':
    case 'DROPDOWN': {
      const options = question.options ?? [];
      return options[index % options.length] ?? '未选择';
    }
    case 'MULTI': {
      const options = question.options ?? [];
      const picked = options.filter((_, optionIndex) => (index + optionIndex) % 3 !== 0);
      return picked.length > 0 ? picked : [options[0] ?? '未选择'];
    }
    case 'RATING': {
      const config = question.config as { min?: number; max?: number } | undefined;
      const max = config?.max ?? 5;
      return 1 + (index % max);
    }
    case 'DATE':
      return daysAgo(index % 30)
        .toISOString()
        .slice(0, 10);
    default:
      return `演示作答 ${index + 1}`;
  }
}

async function seedQuestionnaires(workspaceId: string, ownerId: string) {
  let totalResponses = 0;

  for (const item of QUESTIONNAIRES) {
    const questionnaire = await prisma.questionnaire.upsert({
      where: { slug: item.seedKey },
      update: {
        title: item.title,
        intro: item.intro,
        status: item.status,
        responseLimit: item.responseLimit ?? null,
      },
      create: {
        workspaceId,
        ownerId,
        slug: item.seedKey,
        title: item.title,
        intro: item.intro,
        status: item.status,
        responseLimit: item.responseLimit ?? null,
        publishedAt: item.status === 'DRAFT' ? null : daysAgo(item.createdDaysAgo),
        closedAt: item.status === 'CLOSED' ? daysAgo(item.updatedDaysAgo) : null,
        archivedAt: item.status === 'ARCHIVED' ? daysAgo(item.updatedDaysAgo) : null,
        createdAt: daysAgo(item.createdDaysAgo),
        updatedAt: daysAgo(item.updatedDaysAgo),
      },
    });

    // 题目与答卷都先删后建 —— 保证「反复 seed 的结果一模一样」。
    // 删题目会级联删掉选项，删答卷会级联删掉作答值（见 schema 的 onDelete: Cascade）
    await prisma.question.deleteMany({ where: { questionnaireId: questionnaire.id } });
    await prisma.response.deleteMany({ where: { questionnaireId: questionnaire.id } });

    const createdQuestions: { id: string; seed: SeededQuestion }[] = [];

    for (const [index, seed] of item.questions.entries()) {
      const created = await prisma.question.create({
        data: {
          questionnaireId: questionnaire.id,
          type: seed.type,
          title: seed.title,
          description: seed.description ?? null,
          required: seed.required ?? false,
          order: index,
          config: toJsonColumn(seed.config),
          options: seed.options?.length
            ? { create: seed.options.map((label, optionIndex) => ({ label, order: optionIndex })) }
            : undefined,
        },
        select: { id: true },
      });

      createdQuestions.push({ id: created.id, seed });
    }

    if (item.responseCount === 0) continue;

    await prisma.response.createMany({
      data: Array.from({ length: item.responseCount }, (_, index) => ({
        questionnaireId: questionnaire.id,
        // 指纹必须逐份不同，否则撞上 @@unique([questionnaireId, fingerprint])
        fingerprint: `demo-${item.seedKey}-${index}`,
        status: 'VALID' as const,
        submittedAt: daysAgo(index % Math.max(1, item.updatedDaysAgo + 1)),
        userAgent: 'seed/1.0',
      })),
    });

    const responses = await prisma.response.findMany({
      where: { questionnaireId: questionnaire.id },
      select: { id: true },
      orderBy: { submittedAt: 'desc' },
    });

    const answers = responses.flatMap((response, index) =>
      createdQuestions.map((question) => ({
        responseId: response.id,
        questionId: question.id,
        value: buildAnswerValue(question.seed, index),
      })),
    );

    // 分批写：Postgres 单条 INSERT 的参数上限是 65535，几百份答卷一次写完会顶到上限
    const BATCH = 500;
    for (let offset = 0; offset < answers.length; offset += BATCH) {
      await prisma.answer.createMany({ data: answers.slice(offset, offset + BATCH) });
    }

    totalResponses += item.responseCount;
  }

  return totalResponses;
}

async function seedTemplates() {
  // 官方模板由种子完全拥有：先清掉再重建，避免改了题目结构却留下旧版本
  await prisma.template.deleteMany({ where: { isOfficial: true } });

  for (const template of OFFICIAL_TEMPLATES) {
    await prisma.template.create({
      data: {
        title: template.title,
        description: template.description,
        category: template.category,
        questionCount: template.questions.length,
        isOfficial: true,
        payload: toJsonColumn({
          formatVersion: 1,
          title: template.title,
          intro: template.description,
          questions: template.questions.map((question) => ({
            type: question.type,
            title: question.title,
            description: question.description ?? null,
            required: question.required ?? false,
            shuffleOptions: false,
            pageIndex: 0,
            config: question.config ?? null,
            options: question.options ?? [],
          })),
        }),
      },
    });
  }

  return OFFICIAL_TEMPLATES.length;
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

  // 第二个账号是「查看者」：M8 用它做写操作的越权走查
  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: viewer.id } },
    update: { role: 'VIEWER' },
    create: { workspaceId: workspace.id, userId: viewer.id, role: 'VIEWER' },
  });

  // 另外两位成员：让「成员列表 / 行内角色切换」有真实内容可看（设计稿 W09 是 4 个人）
  const admin = await upsertUser({
    name: '陈思远',
    email: 'chen.sy@example.com',
    password: 'demo1234',
  });
  const editor = await upsertUser({
    name: '王嘉禾',
    email: 'wang.jh@example.com',
    password: 'demo1234',
  });

  for (const member of [
    { user: admin, role: 'ADMIN' as const },
    { user: editor, role: 'EDITOR' as const },
  ]) {
    await prisma.membership.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: member.user.id } },
      update: { role: member.role },
      create: { workspaceId: workspace.id, userId: member.user.id, role: member.role },
    });
  }

  /**
   * 一条待接受的邀请。**token 写死**：`/invite/<这个 token>` 因此可以手工打开验证接受流程
   * （否则演示数据里那条邀请谁也点不开 —— 而「能复制的链接必须真的能用」是本项目的一条硬规矩）。
   * 用 upsert 保证幂等：它可能已经被人接受或撤回过，那就别动它。
   */
  await prisma.invitation.upsert({
    where: { token: DEMO_INVITE_TOKEN },
    update: {},
    create: {
      workspaceId: workspace.id,
      email: 'li.meng@example.com',
      role: 'EDITOR',
      token: DEMO_INVITE_TOKEN,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedById: owner.id,
    },
  });

  const responseTotal = await seedQuestionnaires(workspace.id, owner.id);
  const templateTotal = await seedTemplates();

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
          type: 'RESPONSE_MILESTONE',
          title: '「2026 秋季社团招新报名」回收量达到 100 份',
          body: '当前 128 份，上限 200 份。',
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
    `[seed] 完成：工作区「${workspace.name}」 · ${QUESTIONNAIRES.length} 份问卷 · ${responseTotal} 份答卷 · ${templateTotal} 套官方模板 · 账号 ${DEMO_ACCOUNTS.owner.email} / ${DEMO_ACCOUNTS.viewer.email}`,
  );
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error('[seed] 执行失败：', error);
  await prisma.$disconnect();
  process.exit(1);
});
