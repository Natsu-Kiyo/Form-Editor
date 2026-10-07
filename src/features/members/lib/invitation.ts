/**
 * 「这份邀请是不是发给这个人的」。
 *
 * 三处共用同一个判断：接受页（决定 404 还是渲染）、接受 action（真正的闸门）、以及日后
 * 可能的管理端展示。**只写一次**的理由和别处一样 —— 各写一遍必然出现「页面放行了、
 * action 拒了」这种自相矛盾的组合（R36 修完 action 之后，页面还留着「仍然可以接受」
 * 的旧文案，正是这么来的）。
 *
 * 邮箱**大小写不敏感**：实践中 `Foo@x.com` 与 `foo@x.com` 是同一个人，不该被拒。
 */
export function isInvitationFor(loginEmail: string, invitedEmail: string) {
  return loginEmail.trim().toLowerCase() === invitedEmail.trim().toLowerCase();
}
