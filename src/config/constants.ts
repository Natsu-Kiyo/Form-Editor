/**
 * 全站中文文案与枚举映射的唯一出处。
 *
 * 规则（见 AGENTS.md）：不要在组件里散写中文字符串字面量 ——
 * 枚举、状态、角色的展示文案一律从这里取。
 */

/** 问卷状态机：草稿 → 回收中 ⇄ 已暂停 → 已截止 → 已归档 */
export const QUESTIONNAIRE_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  PAUSED: 'PAUSED',
  CLOSED: 'CLOSED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type QuestionnaireStatus = (typeof QUESTIONNAIRE_STATUS)[keyof typeof QUESTIONNAIRE_STATUS];

/** 状态标签文案。`已达上限` 不是独立状态，而是 `CLOSED` 的截止原因，故单列 */
export const QUESTIONNAIRE_STATUS_LABEL: Record<QuestionnaireStatus | 'LIMIT_REACHED', string> = {
  DRAFT: '草稿',
  PUBLISHED: '回收中',
  PAUSED: '已暂停',
  CLOSED: '已截止',
  ARCHIVED: '已归档',
  LIMIT_REACHED: '已达上限',
};

/** 工作区角色，权限由深到浅 */
export const ROLE = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: '所有者',
  ADMIN: '管理员',
  EDITOR: '编辑者',
  VIEWER: '查看者',
};

/** 作答身份：发布时的必选项，两端都不能省 */
export const IDENTITY_MODE = {
  ANONYMOUS: 'ANONYMOUS',
  LOGIN_REQUIRED: 'LOGIN_REQUIRED',
  PASSWORD: 'PASSWORD',
} as const;

export type IdentityMode = (typeof IDENTITY_MODE)[keyof typeof IDENTITY_MODE];

/**
 * 分享页链接下方的说明。**取决于作答身份** ——
 * 写死「任何人打开即可填写」而问卷其实要求登录，就是在骗人。
 */
export const SHARE_LINK_HINT: Record<IdentityMode, string> = {
  ANONYMOUS: '任何人打开此链接即可填写，无需登录。',
  LOGIN_REQUIRED: '作答者需要登录账号后才能填写，每人限一份。',
  PASSWORD: '作答者需要输入访问口令后才能进入。',
};

/** 文案逐字取自设计稿 W04 的「作答身份」三张卡 */
export const IDENTITY_MODE_LABEL: Record<IdentityMode, { title: string; description: string }> = {
  ANONYMOUS: { title: '匿名作答', description: '任何人点开链接即可填写，不记录身份，回收率最高。' },
  LOGIN_REQUIRED: {
    title: '需登录作答',
    description: '作答者需登录账号，可识别身份并防止重复提交。',
  },
  PASSWORD: { title: '口令访问', description: '输入正确口令才能进入，适合内部调研。' },
};

/**
 * 演示账号。
 *
 * 邮箱与密码来自设计稿 W01 的「演示账号」提示框（lin.yu@example.com / demo1234）——
 * 设计稿是唯一出处，所以不另造一套。
 *
 * 密码写在前端可见的常量里是**刻意**的：这是公开的演示账号，
 * 登录页会把它直接印在页面上。真实用户密码当然是用户自己设的。
 */
export const DEMO_ACCOUNTS = {
  owner: { name: '林予', role: 'OWNER', email: 'lin.yu@example.com', password: 'demo1234' },
  viewer: { name: '陈默', role: 'VIEWER', email: 'chen.mo@example.com', password: 'demo1234' },
} as const;

/** 供 E2E 与 seed 复用的主演示账号 */
export const PRIMARY_DEMO_ACCOUNT = DEMO_ACCOUNTS.owner;

/**
 * 统计口径的说明（设计稿 W06 每张指标卡右上角的「?」）。
 *
 * **把算法本身写出来**，而不是「本指标统计回收的问卷数」这种废话：
 * 口径说明的唯一价值是让人能拿它去核对数字。
 */
export const METRIC_HINT = {
  RECEIVED: '回收份数 = 收到的全部答卷，含已标记无效的。',
  VALID: '有效答卷 = 回收份数 − 已标记无效的。所有图表只统计有效答卷。',
  COMPLETION: '完成率 = 提交数 ÷ 打开数。打开数是公开页被访问的次数，同一人多次打开会重复计。',
  DURATION:
    '平均用时 = 全部已提交答卷的作答时长平均值（从打开作答页到点提交）。中位数比平均数更抗极端值 —— 有人开着页面去吃饭时，只有中位数还接近真实感受。',
} as const;

/** 趋势图按什么粒度聚合 */
export const TREND_GRANULARITY = {
  DAY: 'DAY',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
} as const;

export type TrendGranularity = (typeof TREND_GRANULARITY)[keyof typeof TREND_GRANULARITY];

export const TREND_GRANULARITY_LABEL: Record<TrendGranularity, string> = {
  DAY: '日',
  WEEK: '周',
  MONTH: '月',
};

/** 统计页的时间范围筛选 */
export const ANALYTICS_RANGE = { D7: 7, D30: 30, ALL: 0 } as const;

/** 1.1 / 2.0 规划功能的灰显角标文案 */
export const UPCOMING_BADGE = {
  V11: '1.1',
  V20: '2.0',
} as const;

/**
 * 题型。取值与数据库枚举一致（docs/PLAN.md §5）。
 * 8 个题型位里，`MATRIX` 属 1.1 —— 入口保留但灰显，两端都不开放。
 */
export type QuestionType =
  'SINGLE' | 'MULTI' | 'SHORT_TEXT' | 'LONG_TEXT' | 'RATING' | 'DROPDOWN' | 'DATE' | 'MATRIX';

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE: '单选',
  MULTI: '多选',
  SHORT_TEXT: '单行填空',
  LONG_TEXT: '多行填空',
  RATING: '评分',
  DROPDOWN: '下拉选择',
  DATE: '日期',
  MATRIX: '矩阵',
};

/** 1.0 不开放、仅灰显占位的题型 */
export const GREYED_QUESTION_TYPES: readonly QuestionType[] = ['MATRIX'];

/** 只有选择题才有「选项随机排序」 */
export const CHOICE_QUESTION_TYPES: readonly QuestionType[] = ['SINGLE', 'MULTI'];

/**
 * 评分题的刻度上限与每行个数。
 *
 * 上限 10：再多就会在画布上挤成一排被压扁的窄框（实测 17 个 40px 方块直接溢出卡片）。
 * 每行 5 个：6–10 分排成两行，仍然一眼看得完。
 */
export const RATING_SCALE = { MIN: 1, MAX: 10, PER_ROW: 5 } as const;

/**
 * 评分题的分值范围，**已按上限收敛**。
 *
 * 界面、题目摘要都从这里取，避免出现「摘要写 1–17、刻度只画 10 个」这种自相矛盾。
 * 库里可能残留过大的历史值（上限规则是后加的），这里统一收敛而**不做数据迁移**：
 * 数据只在下次保存时按新规则落库，展示层任何时候都是对的。
 */
export function ratingBounds(config: Record<string, unknown>) {
  const rawMin = typeof config.min === 'number' ? config.min : RATING_SCALE.MIN;
  const rawMax = typeof config.max === 'number' ? config.max : 5;

  const min = Math.min(Math.max(rawMin, RATING_SCALE.MIN), RATING_SCALE.MAX - 1);
  const max = Math.min(Math.max(rawMax, min + 1), RATING_SCALE.MAX);

  return { min, max };
}

/** 截止原因。列表与详情据此给出不同提示，「恢复回收」只对 PAUSED 有意义 */
export const CLOSE_REASON = {
  MANUAL: 'MANUAL',
  SCHEDULED: 'SCHEDULED',
  LIMIT_REACHED: 'LIMIT_REACHED',
  ADMIN: 'ADMIN',
} as const;

export type CloseReason = (typeof CLOSE_REASON)[keyof typeof CLOSE_REASON];

export const CLOSE_REASON_LABEL: Record<CloseReason, string> = {
  MANUAL: '手动截止',
  SCHEDULED: '到期自动截止',
  LIMIT_REACHED: '达到回收上限',
  ADMIN: '管理员关闭',
};

/**
 * 回收开关。**三态而不是两态**：
 * 回收中 → 已暂停（可恢复）→ 已截止（**不可重开**，只能复制为新问卷）。
 * 截止不可逆是刻意的：链接一旦对外发出，重新打开会让「什么时候能填」变得无法解释。
 */
export const COLLECTION_STATE_LABEL = {
  PUBLISHED: '回收中',
  PAUSED: '已暂停',
  CLOSED: '已截止',
} as const;

/** 操作日志类型。库里存字符串（类型会随里程碑增长），文案在这里映射 */
export const OPERATION_TYPE = {
  PUBLISH: 'PUBLISH',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  CLOSE: 'CLOSE',
  ROLLBACK: 'ROLLBACK',
  ARCHIVE: 'ARCHIVE',
  RESTORE: 'RESTORE',
  COPY: 'COPY',
  IMPORT: 'IMPORT',
  SETTINGS: 'SETTINGS',
  /** 删除问卷。与「归档」是两件事：归档是折叠保留，删除是不可逆的 */
  DELETE: 'DELETE',
  // M9 的模板管理（模板库也是工作区的内容，改它要留痕）
  TEMPLATE_RENAME: 'TEMPLATE_RENAME',
  TEMPLATE_DELETE: 'TEMPLATE_DELETE',
  // X2：模板公开与收藏 —— 公开/取消公开是对外动作（效果超出工作区），必须留痕
  TEMPLATE_PUBLISH: 'TEMPLATE_PUBLISH',
  TEMPLATE_UNPUBLISH: 'TEMPLATE_UNPUBLISH',
  // M8 起：成员管理
  INVITE: 'INVITE',
  INVITE_REVOKE: 'INVITE_REVOKE',
  MEMBER_JOIN: 'MEMBER_JOIN',
  MEMBER_ROLE: 'MEMBER_ROLE',
  MEMBER_REMOVE: 'MEMBER_REMOVE',
  // 设计稿 W10 的日志里还有这三类（渠道 / 答卷状态 / 导出），一并记上
  CHANNEL_CREATE: 'CHANNEL_CREATE',
  RESPONSE_INVALIDATE: 'RESPONSE_INVALIDATE',
  RESPONSE_RESTORE: 'RESPONSE_RESTORE',
  EXPORT: 'EXPORT',
} as const;

export type OperationType = (typeof OPERATION_TYPE)[keyof typeof OPERATION_TYPE];

export const OPERATION_TYPE_LABEL: Record<OperationType, string> = {
  PUBLISH: '发布问卷',
  PAUSE: '暂停回收',
  RESUME: '恢复回收',
  CLOSE: '截止回收',
  ROLLBACK: '回滚版本',
  ARCHIVE: '归档问卷',
  RESTORE: '恢复归档',
  COPY: '复制问卷',
  IMPORT: '导入 JSON',
  SETTINGS: '修改发布设置',
  DELETE: '删除问卷',
  TEMPLATE_RENAME: '重命名模板',
  TEMPLATE_DELETE: '删除模板',
  TEMPLATE_PUBLISH: '公开模板',
  TEMPLATE_UNPUBLISH: '取消公开模板',
  INVITE: '邀请成员',
  INVITE_REVOKE: '撤回邀请',
  MEMBER_JOIN: '成员加入',
  MEMBER_ROLE: '调整成员角色',
  MEMBER_REMOVE: '移除成员',
  CHANNEL_CREATE: '新建渠道',
  RESPONSE_INVALIDATE: '标记答卷无效',
  RESPONSE_RESTORE: '恢复答卷有效',
  EXPORT: '导出答卷',
};

/** 日志类型的分组。W10 的「全部操作类型」下拉与每条日志的第二行都用它 */
export const OPERATION_TYPE_GROUP = {
  QUESTIONNAIRE: '问卷',
  STATUS: '状态变更',
  DATA: '数据',
  MEMBER: '成员管理',
  DISTRIBUTION: '分发',
} as const;

export type OperationTypeGroup = (typeof OPERATION_TYPE_GROUP)[keyof typeof OPERATION_TYPE_GROUP];

export const OPERATION_TYPE_GROUP_OF: Record<OperationType, OperationTypeGroup> = {
  PUBLISH: OPERATION_TYPE_GROUP.STATUS,
  PAUSE: OPERATION_TYPE_GROUP.STATUS,
  RESUME: OPERATION_TYPE_GROUP.STATUS,
  CLOSE: OPERATION_TYPE_GROUP.STATUS,
  ARCHIVE: OPERATION_TYPE_GROUP.STATUS,
  RESTORE: OPERATION_TYPE_GROUP.STATUS,
  ROLLBACK: OPERATION_TYPE_GROUP.QUESTIONNAIRE,
  COPY: OPERATION_TYPE_GROUP.QUESTIONNAIRE,
  IMPORT: OPERATION_TYPE_GROUP.QUESTIONNAIRE,
  SETTINGS: OPERATION_TYPE_GROUP.QUESTIONNAIRE,
  DELETE: OPERATION_TYPE_GROUP.QUESTIONNAIRE,
  TEMPLATE_RENAME: OPERATION_TYPE_GROUP.QUESTIONNAIRE,
  TEMPLATE_DELETE: OPERATION_TYPE_GROUP.QUESTIONNAIRE,
  TEMPLATE_PUBLISH: OPERATION_TYPE_GROUP.QUESTIONNAIRE,
  TEMPLATE_UNPUBLISH: OPERATION_TYPE_GROUP.QUESTIONNAIRE,
  INVITE: OPERATION_TYPE_GROUP.MEMBER,
  INVITE_REVOKE: OPERATION_TYPE_GROUP.MEMBER,
  MEMBER_JOIN: OPERATION_TYPE_GROUP.MEMBER,
  MEMBER_ROLE: OPERATION_TYPE_GROUP.MEMBER,
  MEMBER_REMOVE: OPERATION_TYPE_GROUP.MEMBER,
  CHANNEL_CREATE: OPERATION_TYPE_GROUP.DISTRIBUTION,
  RESPONSE_INVALIDATE: OPERATION_TYPE_GROUP.DATA,
  RESPONSE_RESTORE: OPERATION_TYPE_GROUP.DATA,
  EXPORT: OPERATION_TYPE_GROUP.DATA,
};

/**
 * 操作日志的时间范围选项（天）。
 *
 * 放在 `constants.ts` 而不是 `features/logs/api/`：后者有 `import 'server-only'`，
 * 而筛选下拉是客户端组件 —— 它需要这份选项，却不该也不能把 Prisma 拉进浏览器包。
 */
export const LOG_RANGE_DAYS = [7, 30, 180] as const;

/**
 * 操作日志的**保留期**（天）。
 *
 * 它同时是筛选上限，但**筛选不等于清理** —— 更早的数据以前一直躺在库里（页面上看不见而已）。
 * `pnpm db:prune-logs` 按这个值真删（见 `features/logs/api/logs.ts` 的 `pruneOperationLogs`）。
 */
export const LOG_RETENTION_DAYS = 180;

/** 邀请链接的有效期（天）。设计稿 W09 原话：「邀请链接 7 天后失效」 */
export const INVITATION_EXPIRES_DAYS = 7;

/**
 * 已经**结束**的邀请（已过期 / 已撤回 / 已接受）在库里保留多少天。
 *
 * 与链接本身的有效期一样是 7 天，理由是一条链：链接活 7 天 → 结束后再留 7 天可追溯
 * → 之后就没有任何消费方了（页面上根本不显示已结束的邀请，事件本身另在操作日志里）。
 *
 * 定这个数的起因是用户实测：**过期的链接在库里越攒越多，而页面上看不见、也没有入口能删**
 * （「标成 EXPIRED」只让列表不再显示它，不会让它消失）。保留期太长等于没解决问题 ——
 * 演示库里那些测试建出来的邀请，一个星期内就该自己消失了。
 *
 * 两个清理入口：成员页读取时顺手清（`features/members/api/members.ts`），
 * 以及 `pnpm db:prune-invitations`（给没人打开过那个页面的部署兜底）。
 */
export const INVITATION_RETENTION_DAYS = 7;

export const INVITATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const;

export type InvitationStatus = (typeof INVITATION_STATUS)[keyof typeof INVITATION_STATUS];

export const INVITATION_STATUS_LABEL: Record<InvitationStatus, string> = {
  PENDING: '等待接受',
  ACCEPTED: '已接受',
  REVOKED: '已撤回',
  EXPIRED: '已过期',
};

/** 权限深浅：数值越大权限越高 */
const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
  OWNER: 3,
};

/**
 * 角色够不够用。
 *
 * 放在 `constants.ts` 而不是 `lib/auth/permissions.ts`：**权限矩阵要在客户端渲染**
 * （W09 的「权限说明」表），而后者有 `import 'server-only'`，客户端组件碰不得。
 * 两边各写一份等级表必然漂移，所以服务端那个模块反过来复用它。
 */
export function hasAtLeastRole(role: Role, min: Role) {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** 邀请弹层里每种角色的一句话说明（与权限矩阵同源，见 `members/lib/permissions-matrix.ts`） */
export const ROLE_INVITE_HINT: Record<Role, string> = {
  OWNER: '所有者：工作区的唯一拥有者，不可邀请 —— 转让属 2.0',
  ADMIN: '管理员：可管理成员与全部问卷，但不能解散工作区',
  EDITOR: '编辑者：可创建与编辑问卷、发布回收、导出数据',
  VIEWER: '查看者：只能看问卷、数据与日志，不能修改任何东西',
};

/**
 * 模板分类（W08 的分类胶囊）。
 *
 * **顺序就是界面上胶囊的顺序**，而它同时是「seed 里 8 张官方模板要覆盖的分类」——
 * 两处对不上会出现一个点进去空无一物的胶囊。
 */
export const TEMPLATE_CATEGORIES = [
  '满意度调研',
  '报名登记',
  '评估互评',
  '考试测验',
  '信息收集',
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

/**
 * 「公开」角标（设计稿 W08：emerald-50 底 + emerald-600 字，贴在模板标题旁）。
 * 文案收在这里，「我的模板」卡片与公开弹层共用同一份。
 */
export const TEMPLATE_PUBLIC_BADGE = '公开';

/**
 * 公开池的**兜底分类**（X2 上线后由所有者追加）。
 *
 * 官方那五类之外的自建分类不能直接进公共池（防污染的一部分），但用户的模板
 * 不该因此公开不了 —— 公开弹层里选「其他」即可，落库后分类就是它。
 *
 * **刻意不属于 `TEMPLATE_CATEGORIES`**：那个常量是「官方五分类」的口径
 * （seed 的 8 张官方模板、我的模板胶囊的排序基准），加进来会多出一颗点开是空的胶囊。
 */
export const TEMPLATE_CATEGORY_OTHER = '其他';

/** 公开（弹层）里可选的分类：官方五类 + 「其他」兜底 */
export const TEMPLATE_PUBLIC_CATEGORIES = [
  ...TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_OTHER,
] as const;

/**
 * 「另存为模板」里选中**新增分类**时，分类下拉提交的哨兵值。
 *
 * 用哨兵而不是「下拉留空 + 另一个字段」：`formData` 里始终只有 `category` 一个来源，
 * 服务端判断分支就一处。前后端认同一个常量，和口令那个掩码同一套做法。
 */
export const TEMPLATE_CATEGORY_NEW = '__NEW_CATEGORY__';

/**
 * **早期**的自建模板分类。
 *
 * 分类选择器出现之前，「另存为模板」把自建模板一律写成这个值。它不再出现在下拉里，
 * 也不作为分类胶囊 —— 那些老模板只在「全部」里可见，重新另存一次即可归入正式分类。
 */
export const LEGACY_TEMPLATE_CATEGORY = '我的模板';

/** 操作对象的类型。操作日志页按它过滤 */
export const OPERATION_TARGET_LABEL = {
  QUESTIONNAIRE: '问卷',
  TEMPLATE: '模板',
  WORKSPACE: '工作区',
  MEMBER: '成员',
} as const;

/** 版本号的展示文案。全站只有这一处拼 `v1` / `v12` */
export function formatVersion(version: number) {
  return `v${version}`;
}
