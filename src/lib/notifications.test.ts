import { describe, expect, test } from "bun:test";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import {
  markReadUpTo,
  notificationLine,
  PHASE1_KINDS,
  safePath,
} from "./notifications";
import type { VaNotification } from "./va";

const t = createTranslator({
  generic: "你有一条新通知",
  kinds: {
    va: {
      application: {
        approved: "你的航司申请已批准：{airline}",
        rejected: "你的航司申请未通过：{reason}",
      },
    },
  },
});

describe("notificationLine", () => {
  test("a known kind renders its params", () => {
    expect(
      notificationLine(
        {
          kind: "va.application.approved",
          params: { airline: "CCA" },
          path: "/apply",
        },
        t,
      ),
    ).toEqual({ text: "你的航司申请已批准：CCA", href: "/apply", known: true });
  });

  test("an unknown kind renders the generic line with the link", () => {
    expect(
      notificationLine(
        { kind: "va.pirep.approved", params: { id: 7 }, path: "/pireps/7" },
        t,
      ),
    ).toEqual({ text: "你有一条新通知", href: "/pireps/7", known: false });
  });

  test("a kind that names a dictionary branch is unknown, not an object", () => {
    expect(
      notificationLine({ kind: "va.application", params: {}, path: "/" }, t)
        .known,
    ).toBe(false);
    expect(
      notificationLine({ kind: "toString", params: {}, path: "/" }, t).known,
    ).toBe(false);
  });
});

describe("safePath", () => {
  test("site-relative paths pass", () => {
    expect(safePath("/airlines/CCA")).toBe("/airlines/CCA");
  });
  test("anything that could leave the site falls back to /notifications", () => {
    for (const bad of [
      "https://evil.test/",
      "//evil.test/",
      "/\\evil.test",
      "/\t/evil.test",
      "/\n/evil.test",
      "javascript:alert(1)",
      "",
    ]) {
      expect(safePath(bad)).toBe("/notifications");
    }
  });
});

test("the five Phase 1 kinds", () => {
  expect([...PHASE1_KINDS]).toEqual([
    "va.application.approved",
    "va.application.rejected",
    "va.membership.accepted",
    "va.membership.declined",
    "va.membership.invited",
  ]);
});

describe("markReadUpTo", () => {
  const note = (id: number, read = false): VaNotification => ({
    id,
    kind: "va.membership.invited",
    params: {},
    path: "/",
    createdAt: "2026-10-24T00:00:00Z",
    read,
  });

  test("upTo is the newest loaded id; only id <= upTo flips to read", () => {
    const result = markReadUpTo([note(12), note(9, true), note(4)]);
    expect(result.upTo).toBe(12);
    expect(result.items.map((n) => [n.id, n.read])).toEqual([
      [12, true],
      [9, true],
      [4, true],
    ]);
  });

  test("leaves a newer row alone if one is present", () => {
    // 列表顺序被打乱时（不应发生）也只翻 <= upTo 的。
    const result = markReadUpTo([note(5), note(8)]);
    expect(result.upTo).toBe(5);
    expect(result.items.map((n) => n.read)).toEqual([true, false]);
  });

  test("empty list: no upTo, nothing to send", () => {
    expect(markReadUpTo([])).toEqual({ upTo: null, items: [] });
  });
});
