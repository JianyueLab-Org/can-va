/**
 * 侧栏：四页，加上「已加入的航司」一组（只列活跃成员身份，主要航司在前）。
 * 在 Astro 侧拼好，作为 props 进外壳岛屿。
 */
import type { Translator } from "@jianyuelab-org/can-ui/i18n";
import type { NavItem } from "@jianyuelab-org/can-ui";
// 深路径而不是 barrel：这个文件被 bun:test 引用，barrel 会把整棵组件树拉进来。
import type { SiteOrigins } from "@jianyuelab-org/can-ui/sites";
import { CAN_WEB_ORIGIN } from "@/lib/config";
import type { MyMembership } from "@/lib/va";

/** 主站的运行期覆盖：本地和 staging 上 404 页列出的主站落在本环境。 */
export const SITE_ORIGINS: SiteOrigins = { web: CAN_WEB_ORIGIN };

/** `/` 精确匹配，否则「我的航司」在每一页都亮着。 */
const PAGES = [
  { key: "nav.home", href: "/", icon: "home" },
  { key: "nav.airlines", href: "/airlines", icon: "buildingOffice" },
  { key: "nav.apply", href: "/apply", icon: "documentText" },
  { key: "nav.notifications", href: "/notifications", icon: "bell" },
] as const;

export function buildNavigation(
  t: Translator,
  memberships: readonly MyMembership[],
): NavItem[] {
  const items: NavItem[] = PAGES.map((page) => ({
    name: t(page.key),
    href: page.href,
    icon: page.icon,
  }));
  const mine = memberships
    .filter((m) => m.status === "active")
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  if (mine.length > 0) {
    items.push({
      name: t("nav.mine"),
      icon: "paperAirplane",
      children: mine.map((m) => ({
        name: `${m.airline.icao} · ${m.airline.name}`,
        href: `/airlines/${m.airline.icao}`,
        icon: "paperAirplane",
      })),
    });
  }
  return items;
}
