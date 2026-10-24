import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import { notificationLine, PHASE1_KINDS } from "./notifications";
import { PERMISSIONS } from "./va";

const LOCALES = ["zh-cn", "zh-tw", "en-us", "ja-jp"] as const;

function dict(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      new URL(`../../language/${locale}.json`, import.meta.url),
      "utf8",
    ),
  );
}

function flatten(value: unknown, prefix = ""): string[] {
  return value !== null && typeof value === "object"
    ? Object.entries(value).flatMap(([k, v]) =>
        flatten(v, prefix ? `${prefix}.${k}` : k),
      )
    : [prefix];
}

describe("dictionaries", () => {
  test("every locale has exactly the zh-cn keys", () => {
    const keys = (locale: string) => flatten(dict(locale)).sort();
    for (const locale of LOCALES.slice(1)) {
      expect(keys(locale)).toEqual(keys("zh-cn"));
    }
  });

  test("every Phase 1 notification kind renders in every locale", () => {
    for (const locale of LOCALES) {
      const t = createTranslator(
        dict(locale).notifications as Record<string, unknown>,
      );
      for (const kind of PHASE1_KINDS) {
        const line = notificationLine(
          { kind, params: { airline: "CCA", reason: "x" }, path: "/apply" },
          t,
        );
        expect(line.known).toBe(true);
        expect(line.text).not.toContain("{");
      }
    }
  });

  test("every permission has a label in every locale", () => {
    for (const locale of LOCALES) {
      const t = createTranslator(
        dict(locale).permissions as Record<string, unknown>,
      );
      for (const permission of PERMISSIONS) {
        expect(t(permission)).not.toBe(permission);
      }
    }
  });

  test("en-us has no CJK", () => {
    expect(JSON.stringify(dict("en-us"))).not.toMatch(/[぀-ヿ一-鿿]/);
  });

  test("zh-tw and ja-jp are not copies of zh-cn", () => {
    for (const locale of ["zh-tw", "ja-jp"]) {
      const nav = dict(locale).nav as Record<string, string>;
      const cn = dict("zh-cn").nav as Record<string, string>;
      expect(nav.airlines).not.toBe(cn.airlines);
    }
  });
});
