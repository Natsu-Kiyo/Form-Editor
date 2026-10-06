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
};

/** 操作对象的类型。M10 的操作日志页按它过滤 */
export const OPERATION_TARGET_LABEL = {
  QUESTIONNAIRE: '问卷',
  TEMPLATE: '模板',
} as const;

/** 版本号的展示文案。全站只有这一处拼 `v1` / `v12` */
export function formatVersion(version: number) {
  return `v${version}`;
}
