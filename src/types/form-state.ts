/**
 * Server Action 的表单状态（全站共用）。
 *
 * 为什么需要 `values`：React 19 在 `<form action={fn}>` 的 action 结束后会
 * **重置非受控表单**（默认行为是给成功提交清场的）。若不把提交值回传、
 * 界面不拿它做 `defaultValue` 回填，用户会因为拼错一个字段而丢掉整张表单。
 *
 * 字段错误按**表单控件的 name** 索引，界面层直接取用、不需要再映射一次。
 */
export type FormState = {
  fieldErrors?: Record<string, string[] | undefined>;
  /** 整体性错误，例如「邮箱或密码不正确」 */
  message?: string;
  /** 成功提示（保存完成、反馈提交这类不跳转的流程） */
  success?: string;
  /** 失败时原样回传的提交值，界面用它做 defaultValue */
  values?: Record<string, string | undefined>;
};

export const EMPTY_FORM_STATE: FormState = {};
