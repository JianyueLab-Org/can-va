import { describe, expect, test } from "bun:test";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import { notificationLine, PHASE1_KINDS, safePath } from "./notifications";

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
