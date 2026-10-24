import type { Translator } from "@jianyuelab-org/can-ui/i18n";

/**
 * 错误码 → 当前语言的一句话。字典里没有的码原样显示上游的 `message`（英文），
 * 不吞掉：一个新加的 409 码在补上翻译之前也得让人看得懂。
 *
 * `t` 是 `common` 命名空间的翻译器；键是 `errors.<code>`。
 */
export function errorText(
  t: Translator,
  failure: { error: string; message: string },
): string {
  const key = `errors.${failure.error}`;
  const text = t(key);
  return text === key ? failure.message : text;
}
