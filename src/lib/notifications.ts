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

/** 只放行站内路径。`//host` 和带反斜杠的会被浏览器当成跨站。 */
export function safePath(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")
    ? path
    : "/notifications";
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
