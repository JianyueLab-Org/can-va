/**
 * 金额和时间的显示。纯函数，服务端和岛屿都用。
 *
 * 金额在接口里是**整数的最小单位**（1/100 credit）。时间一律按 UTC 显示：服务端渲染
 * 和浏览器水合必须给出同一串字符，而容器的时区不是成员的时区。
 */

export function formatCredits(minor: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** 输入框里的 credit 数（最多两位小数）→ 最小单位。不合法返回 null。 */
export function parseCredits(input: string): number | null {
  const match = /^\s*(\d{1,13})(?:\.(\d{1,2}))?\s*$/.exec(input);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** `2026-10-24 08:05Z` */
export function formatUtc(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  return new Date(time).toISOString().slice(0, 16).replace("T", " ") + "Z";
}

/** `2026-10-24` */
export function formatDay(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  return new Date(time).toISOString().slice(0, 10);
}
