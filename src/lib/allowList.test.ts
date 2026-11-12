import { describe, expect, test } from "bun:test";
import { allowed, canApiEntry, vaEntry } from "../pages/api/[...path]";

describe("member proxy boundary", () => {
  test("staff, internal and session introspection remain inaccessible", () => {
    for (const path of [
      "v1/va/staff/applications",
      "v1/va/staff/aircraft-types",
      "v1/va/staff/airports/ZBAA/tier",
      "v1/va/staff/airlines/1/suspend",
      "v1/va/staff/params",
      "v1/internal/va/pilots/100001",
      "v1/internal/va/pilots/100001/export",
      "v1/va/me",
      "v1/va/client/recordings",
      "v1/va/client/recordings/12345678-1234-1234-1234-123456789abc/track",
    ])
      expect(allowed(path)).toBeUndefined();
  });
  test("dynamic segments reject traversal and malformed identifiers", () => {
    for (const path of [
      "v1/va/airlines/cca",
      "v1/va/airlines/CCAX",
      "v1/va/airlines/CCA/hubs/zbaa",
      "v1/va/airlines/CCA/members/a.b",
      "v1/va/airlines/CCA/roles/abc",
      "v1/va/airlines/CCA/ranks/1/x",
      "v1/va/airlines/../staff/params",
      "v1/va/airports/../../internal",
      "v1/va/bookings/1/cancel/extra",
      "v1/va/bookings/-1",
      "v1/va/pireps/abc/approve",
      "v1/va/pilots/closed:123",
      "v1/va/airlines/CCA/fleet/1/delete",
    ])
      expect(allowed(path)).toBeUndefined();
  });
  test("recording evidence is cookie-only and read-only with exact UUID paths", () => {
    const base = "v1/va/recordings/12345678-1234-1234-1234-123456789abc";
    for (const path of [base, `${base}/track`, "v1/va/me/recordings"])
      expect(vaEntry(path)?.methods).toEqual(["GET"]);
    for (const path of [
      `${base}/chunks/0`,
      `${base}/complete`,
      `${base}/submit`,
      `${base}/abort`,
      `${base}/track/extra`,
      "v1/va/recordings/1",
      "v1/va/recordings/../staff",
    ])
      expect(allowed(path)).toBeUndefined();
  });
  test("fleet commands and route edits have narrow methods", () => {
    expect(vaEntry("v1/va/airlines/CCA/fleet")?.methods).toEqual([
      "GET",
      "POST",
    ]);
    expect(vaEntry("v1/va/airlines/CCA/fleet/1")?.methods).toEqual(["PATCH"]);
    for (const action of ["sell", "return", "reposition"])
      expect(vaEntry(`v1/va/airlines/CCA/fleet/1/${action}`)?.methods).toEqual([
        "POST",
      ]);
    expect(vaEntry("v1/va/airlines/CCA/routes/1")?.methods).toEqual([
      "PATCH",
      "DELETE",
    ]);
    expect(vaEntry("v1/va/airlines/CCA/roles/7")?.methods).toEqual([
      "PATCH",
      "DELETE",
    ]);
    expect(vaEntry("v1/va/airlines/CCA")?.methods).toEqual(["PATCH"]);
  });
  test("booking, independent review and movement commands are explicit", () => {
    for (const path of [
      "v1/va/airlines/CCA/bookings",
      "v1/va/bookings/1/cancel",
      "v1/va/bookings/1/pirep",
      "v1/va/pireps/1/approve",
      "v1/va/pireps/1/reject",
      "v1/va/me/jumpseat",
      "v1/va/me/free-return",
    ])
      expect(vaEntry(path)?.methods).toEqual(["POST"]);
    for (const path of [
      "v1/va/me/booking",
      "v1/va/me/bookings",
      "v1/va/me/pireps",
      "v1/va/me/wallet",
      "v1/va/pilots/100001",
      "v1/va/leaderboards",
      "v1/va/airlines/CCA/operations",
    ])
      expect(vaEntry(path)?.methods).toEqual(["GET"]);
    expect(vaEntry("v1/va/me/primary")?.methods).toEqual(["PUT"]);
    expect(vaEntry("v1/va/notifications/read-all")?.methods).toEqual(["POST"]);
  });
  test("signout is the only can-api path", () => {
    expect(canApiEntry("v1/auth/signout")?.methods).toEqual(["POST"]);
    expect(vaEntry("v1/auth/signout")).toBeUndefined();
    expect(canApiEntry("v1/notifications")).toBeUndefined();
  });
  test("inherited keys are not entries", () => {
    expect(allowed("toString")).toBeUndefined();
    expect(allowed("__proto__")).toBeUndefined();
  });
});
