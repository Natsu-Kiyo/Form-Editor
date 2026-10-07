import { ClockIcon, FileTextIcon, GridIcon, UsersIcon } from '@/components/icons/ui-icons';
import { AppShell } from '@/components/layout/app-shell';
import { SidebarNav, type SidebarNavItem } from '@/components/layout/sidebar-nav';
import { SidebarShell } from '@/components/layout/sidebar-shell';
import { ROLE_LABEL } from '@/config/constants';
import { AccountMenu } from '@/features/account/components/account-menu';
import { countActiveSessions } from '@/features/account/api/sessions';
import { getWorkspacesForUser } from '@/features/workspace/api/workspaces';
import { WorkspaceSwitcher } from '@/features/workspace/components/workspace-switcher';
import { resolveActiveWorkspace } from '@/features/workspace/lib/active-workspace';
import { requireUser } from '@/lib/auth/dal';
import { getAccountSecurityInfo } from '@/lib/auth/users';
import { formatDisplayDate } from '@/utils/format';

/**
 * 侧栏导航项。
 *
 * 只登记**已交付的页面**（「模板中心」「操作日志」分别在 M9 / M8-b 落地时再加进来）——
 * 在那之前画出来就是「点了 404」的假入口，宁可先少几项。
 */
const NAV_ITEMS: SidebarNavItem[] = [
  // `exact`：`/app` 是所有管理台页面的前缀，按前缀匹配会让它在下属页面上一直亮着
  { href: '/app', label: '问卷列表', icon: <FileTextIcon />, exact: true },
  // 模板中心两端都有（移动端是底部导航三格之一，见 P07），所以不加 desktopOnly
  { href: '/app/templates', label: '模板中心', icon: <GridIcon /> },
  // 设计稿标了移动端隐藏，窄屏抽屉里不出现这两项（见 `SidebarNavItem.desktopOnly`）
  { href: '/app/members', label: '成员与权限', icon: <UsersIcon />, desktopOnly: true },
  { href: '/app/logs', label: '操作日志', icon: <ClockIcon />, desktopOnly: true },
];

/**
 * 管理台外壳：侧栏 + 窄屏抽屉。
 *
 * ⚠️ 这里的 `requireUser` **不是安全边界**。Next 16 文档明确指出 layout 在导航时
 * 不会重渲染、也不阻止子段渲染，所以「layout 里 return null / redirect」拦不住任何人。
 * 它只是让未登录用户顺畅地跳去登录页；真正的访问控制在每个页面的数据函数内部
 * （页面自己也会调 `requireUser` / `requireMembership`）。
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // 四处都是独立读取，并行发起；DB 在别的区域时，串行 await 会白白叠加往返时间
  const workspaces = await getWorkspacesForUser(user.id);
  const [activeWorkspace, security, activeSessionCount] = await Promise.all([
    resolveActiveWorkspace(workspaces),
    getAccountSecurityInfo(user.id),
    countActiveSessions(user.id),
  ]);

  const sidebar = (
    <SidebarShell
      workspaceSwitcher={
        <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspace?.id ?? null} />
      }
      nav={<SidebarNav items={NAV_ITEMS} />}
      account={
        <AccountMenu
          userName={user.name}
          userEmail={user.email}
          roleLabel={activeWorkspace ? ROLE_LABEL[activeWorkspace.role] : '—'}
          passwordUpdatedAtLabel={
            security?.passwordUpdatedAt ? formatDisplayDate(security.passwordUpdatedAt) : null
          }
          activeSessionCount={activeSessionCount}
        />
      }
    />
  );

  return <AppShell sidebar={sidebar}>{children}</AppShell>;
}
