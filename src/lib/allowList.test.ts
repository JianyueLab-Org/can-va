import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  allowed,
  canApiEntry,
  VA_EXACT,
  VA_PATTERNS,
  vaEntry,
} from "../pages/api/[...path]";

/**
 * 岛屿里每一条打给反代的路径都必须在白名单上，白名单上的每一条也都必须有人用。
 *
 * 漏放行的症状是岛屿拿到 404 —— 表单上一句「接口不在白名单」，而不是上游的答案。
 * 多放行的是一条没人用的公网通路。
 *
 * 挡不住：整段来自变量的路径（不要这样写，见 `src/lib/va.ts` 抬头）；can-va-api 那边有
 * 没有这条路由。
 */

const ROOT = new URL("../", import.meta.url).pathname;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** 只扫浏览器里跑的代码：`src/server/` 和 `.astro` frontmatter 直连 can-va-api。 */
function sources(): Array<{ file: string; text: string }> {
  return ["components", "lib"]
    .flatMap((dir) => walk(join(ROOT, dir)))
    .filter((file) => /\.(vue|ts)$/.test(file) && !file.endsWith(".test.ts"))
    .map((file) => ({ file, text: readFileSync(file, "utf8") }));
}

/** `${…}` 按表达式名代样例值，规则写在 `src/lib/va.ts` 抬头。 */
function sample(expr: string): string {
  if (/hub|airport/i.test(expr)) return "ZBAA";
  if (/user/i.test(expr)) return "100001";
  if (/\bid\b/.test(expr)) return "1";
  return "CCA";
}

function normalise(raw: string): string {
  return raw
    .replace(/\$\{([^}]*)\}/g, (_, expr: string) => sample(expr))
    .replace(/[?#].*$/, "")
    .replace(/^\/api\//, "");
}

const found = new Map<string, string[]>();
for (const { file, text } of sources()) {
  const code = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const m of code.matchAll(/["'`](\/api\/v1\/[^"'`]*)["'`]/g)) {
    const path = normalise(m[1]);
    found.set(path, [...(found.get(path) ?? []), file]);
  }
}

describe("反代白名单 ↔ 岛屿", () => {
  test("扫到了路径", () => {
    expect(found.size).toBeGreaterThan(20);
  });

  test("岛屿用到的每一条都在白名单上", () => {
    const missing = [...found].filter(([path]) => !allowed(path));
    expect(missing.map(([p, files]) => `${p} ← ${files.join(", ")}`)).toEqual(
      [],
    );
  });

  test("白名单上的每一条 VA 路由都有人用", () => {
    const paths = [...found.keys()];
    const unusedExact = Object.keys(VA_EXACT).filter((k) => !paths.includes(k));
    const unusedPatterns = VA_PATTERNS.filter(
      (entry) => !paths.some((p) => entry.test.test(p)),
    ).map((entry) => entry.test.source);
    expect([...unusedExact, ...unusedPatterns]).toEqual([]);
  });
});

describe("白名单自己", () => {
  test("没有 staff、internal，也没有 /me 的 GET", () => {
    for (const path of [
      "v1/va/staff/applications",
      "v1/va/staff/airlines/1/suspend",
      "v1/va/staff/params",
      "v1/internal/va/pilots/100001",
      "v1/internal/va/pilots/100001/export",
      "v1/va/me",
    ]) {
      expect(allowed(path)).toBeUndefined();
    }
  });

  test("动态段收得紧", () => {
    for (const path of [
      "v1/va/airlines/cca",
      "v1/va/airlines/CCAX",
      "v1/va/airlines/CCA/hubs/zbaa",
      "v1/va/airlines/CCA/members/a.b",
      "v1/va/airlines/CCA/roles/abc",
      "v1/va/airlines/CCA/ranks/1/x",
      "v1/va/airlines/../staff/params",
      "v1/va/airports/../../internal",
    ]) {
      expect(allowed(path)).toBeUndefined();
    }
  });

  test("方法逐条", () => {
    expect(vaEntry("v1/va/airlines/CCA")?.methods).toEqual(["PATCH"]);
    expect(vaEntry("v1/va/airlines/CCA/roles")?.methods).toEqual([
      "GET",
      "POST",
    ]);
    expect(vaEntry("v1/va/airlines/CCA/roles/7")?.methods).toEqual([
      "PATCH",
      "DELETE",
    ]);
    expect(vaEntry("v1/va/notifications/read-all")?.methods).toEqual(["POST"]);
    expect(vaEntry("v1/va/me/primary")?.methods).toEqual(["PUT"]);
  });

  test("退出登录走 can-api，且只有这一条", () => {
    expect(canApiEntry("v1/auth/signout")?.methods).toEqual(["POST"]);
    expect(vaEntry("v1/auth/signout")).toBeUndefined();
    expect(canApiEntry("v1/notifications")).toBeUndefined();
  });

  test("继承来的键不算条目", () => {
    expect(allowed("toString")).toBeUndefined();
    expect(allowed("__proto__")).toBeUndefined();
  });
});
