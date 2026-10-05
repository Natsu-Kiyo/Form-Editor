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

export const IDENTITY_MODE_LABEL: Record<IdentityMode, { title: string; description: string }> = {
  ANONYMOUS: { title: '匿名作答', description: '任何拿到链接的人都可以填写，不做身份识别' },
  LOGIN_REQUIRED: { title: '需登录', description: '只有登录用户能填写，每人限一份' },
  PASSWORD: { title: '口令访问', description: '需要输入口令才能进入作答页' },
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
