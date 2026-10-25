import type { Translator } from "@jianyuelab-org/can-ui/i18n";
import type { VaNotification } from "./va";

/**
 * 通知的文字由本站按 `kind` + `params` 用自己的字典拼，不是 can-va-api 给的。
 *
 * 字典里没有的 kind（后面几期加的，或者本站还没跟上的）显示一句通用的话，链接照旧 ——
 * 一条通知不该因为本站没翻译它就消失。
 *
 * 键在 `notifications.kinds.<kind>`；kind 里的点就是字典的层级
 * （`va.application.approved` → `kinds.va.application.approved`）。
 */

export const PHASE1_KINDS = [
  "va.application.approved",
  "va.application.rejected",
  "va.membership.accepted",
  "va.membership.declined",
  "va.membership.invited",
] as const;

export interface NotificationLine {
  text: string;
  href: string;
  /** false：字典里没有这个 kind，`text` 是通用的那一句。 */
  known: boolean;
}

const PROBE_ORIGIN = "https://va.invalid";
const CONTROL = /[\u0000-\u001F\u007F]/;

/**
 * 只放行站内路径。`//host`、带反斜杠或控制字符的（浏览器会剥掉 `\t` `\n`）会被当成跨站；
 * 最后按固定 origin 解析一遍，origin 变了也不放行。
 */
export function safePath(path: string): string {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    CONTROL.test(path)
  ) {
    return "/notifications";
  }
  try {
    return new URL(path, PROBE_ORIGIN).origin === PROBE_ORIGIN
      ? path
      : "/notifications";
  } catch {
    return "/notifications";
  }
}

const KIND = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

export function notificationLine(
  n: Pick<VaNotification, "kind" | "params" | "path">,
  t: Translator,
): NotificationLine {
  const href = safePath(n.path);
  const key = `kinds.${n.kind}`;
  // 翻译器找不到字符串时原样返回键 —— 那就是「字典里没有」。
  const text = KIND.test(n.kind) ? t(key, n.params) : key;
  if (text !== key) return { text, href, known: true };
  return { text: t("generic"), href, known: false };
}

/**
 * 「全部标为已读」只标会员看到的：列表新的在前，`upTo` 是第一条的 id，没有就是 null
 * （不发请求）。`items` 是标完之后的列表，只翻 `id <= upTo` 的。
 */
export function markReadUpTo(items: VaNotification[]): {
  upTo: number | null;
  items: VaNotification[];
} {
  const upTo = items[0]?.id ?? null;
  if (upTo === null) return { upTo, items };
  return {
    upTo,
    items: items.map((n) => (n.id <= upTo ? { ...n, read: true } : n)),
  };
}
