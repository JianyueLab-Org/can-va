import type { Me, Member, MyMembership, Permission, Role } from "./va";

/**
 * 界面按权限显示什么。**判断在 can-va-api**；这里只决定画不画一个按钮、渲不渲一页。
 *
 * 角色排序照契约：持 `roles.manage` 的人只能动 `position` 低于自己最高角色的那些角色；
 * 所有者不受限。持角色且排位不低于操作者的成员，操作者移除不了。
 */

export function membershipFor(
  me: Pick<Me, "memberships">,
  airline: string,
): MyMembership | null {
  return me.memberships.find((m) => m.airline.icao === airline) ?? null;
}

export function isActiveMember(m: MyMembership | null): boolean {
  return m?.status === "active";
}

export function can(m: MyMembership | null, permission: Permission): boolean {
  if (!m || m.status !== "active") return false;
  return m.isOwner || m.permissions.includes(permission);
}

export function highestPosition(
  roleIds: readonly number[],
  roles: readonly Role[],
): number | null {
  let top: number | null = null;
  for (const role of roles) {
    if (roleIds.includes(role.id) && (top === null || role.position > top)) {
      top = role.position;
    }
  }
  return top;
}

export function canActOnRole(
  m: MyMembership | null,
  roles: readonly Role[],
  role: Role,
): boolean {
  if (!m || m.status !== "active") return false;
  if (m.isOwner) return true;
  if (!m.permissions.includes("roles.manage")) return false;
  const top = highestPosition(m.roleIds, roles);
  return top !== null && role.position < top;
}

export function assignableRoles(
  m: MyMembership | null,
  roles: readonly Role[],
): Role[] {
  return roles.filter((role) => canActOnRole(m, roles, role));
}

/**
 * 给一个成员保存角色时提交的 `roleIds`：操作者动不了的角色原样保留，动得了的按勾选。
 */
export function nextRoleIds(
  current: readonly number[],
  selected: readonly number[],
  assignable: readonly Role[],
): number[] {
  const managed = new Set(assignable.map((role) => role.id));
  const kept = current.filter((id) => !managed.has(id));
  const chosen = selected.filter((id) => managed.has(id));
  return [...new Set([...kept, ...chosen])].sort((a, b) => a - b);
}

export function canRemoveMember(
  m: MyMembership | null,
  roles: readonly Role[],
  target: Member,
  self: string,
): boolean {
  if (!m || target.isOwner || target.username === self) return false;
  if (!can(m, "members.manage")) return false;
  if (m.isOwner) return true;
  const targetTop = highestPosition(target.roleIds, roles);
  if (targetTop === null) return true;
  const myTop = highestPosition(m.roleIds, roles);
  return myTop !== null && targetTop < myTop;
}

export type AirlineSection =
  "overview" | "members" | "roles" | "ranks" | "manage" | "finance";

/** 航司页顶上的分页标签：成员和角色要是活跃成员，设置和财务看权限。 */
export function airlineSections(
  airline: string,
  m: MyMembership | null,
): Array<{ key: AirlineSection; href: string }> {
  const base = `/airlines/${airline}`;
  const out: Array<{ key: AirlineSection; href: string }> = [
    { key: "overview", href: base },
  ];
  if (isActiveMember(m)) {
    out.push(
      { key: "members", href: `${base}/members` },
      { key: "roles", href: `${base}/roles` },
    );
  }
  out.push({ key: "ranks", href: `${base}/ranks` });
  if (can(m, "airline.edit"))
    out.push({ key: "manage", href: `${base}/manage` });
  if (can(m, "finance.view")) {
    out.push({ key: "finance", href: `${base}/finance` });
  }
  return out;
}
