import { describe, expect, test } from "bun:test";
import {
  airlineSections,
  assignableRoles,
  can,
  canActOnRole,
  canRemoveMember,
  highestPosition,
  isActiveMember,
  membershipFor,
  nextRoleIds,
} from "./permissions";
import type { Member, MyMembership, Permission, Role } from "./va";

const SUMMARY = {
  id: 1,
  icao: "CCA",
  iata: "CA",
  name: "Cerulean Air",
  telephony: "CERULEAN",
  status: "active" as const,
  joinMode: "open" as const,
  hubs: ["ZBAA"],
  memberCount: 3,
};

function membership(over: Partial<MyMembership> = {}): MyMembership {
  return {
    airline: SUMMARY,
    status: "active",
    isPrimary: true,
    isOwner: false,
    roleIds: [],
    permissions: [],
    ...over,
  };
}

const ROLES: Role[] = [
  {
    id: 1,
    name: "Chief",
    position: 30,
    permissions: ["roles.manage", "members.manage"],
  },
  { id: 2, name: "Dispatcher", position: 20, permissions: ["members.manage"] },
  { id: 3, name: "Trainee", position: 10, permissions: [] },
];

function member(over: Partial<Member> = {}): Member {
  return {
    username: "100002",
    status: "active",
    isPrimary: false,
    isOwner: false,
    roleIds: [],
    joinedAt: "2026-10-24T00:00:00Z",
    ...over,
  };
}

describe("membershipFor / can", () => {
  test("finds the membership by airline ICAO", () => {
    const me = { memberships: [membership()] };
    expect(membershipFor(me, "CCA")?.airline.name).toBe("Cerulean Air");
    expect(membershipFor(me, "XXX")).toBeNull();
  });

  test("only active memberships carry permissions", () => {
    const perms: Permission[] = ["finance.view"];
    expect(can(membership({ permissions: perms }), "finance.view")).toBe(true);
    expect(
      can(
        membership({ status: "applied", permissions: perms }),
        "finance.view",
      ),
    ).toBe(false);
    expect(can(null, "finance.view")).toBe(false);
    expect(isActiveMember(membership({ status: "invited" }))).toBe(false);
  });

  test("the owner holds every permission", () => {
    expect(can(membership({ isOwner: true }), "ranks.manage")).toBe(true);
  });
});

describe("role ordering", () => {
  const chief = membership({
    roleIds: [1],
    permissions: ["roles.manage", "members.manage"],
  });

  test("highestPosition", () => {
    expect(highestPosition([2, 3], ROLES)).toBe(20);
    expect(highestPosition([], ROLES)).toBeNull();
    expect(highestPosition([99], ROLES)).toBeNull();
  });

  test("roles.manage acts only below its own highest role", () => {
    expect(canActOnRole(chief, ROLES, ROLES[0])).toBe(false);
    expect(canActOnRole(chief, ROLES, ROLES[1])).toBe(true);
    expect(assignableRoles(chief, ROLES).map((r) => r.id)).toEqual([2, 3]);
  });

  test("without roles.manage nothing is assignable; the owner is unrestricted", () => {
    expect(assignableRoles(membership({ roleIds: [1] }), ROLES)).toEqual([]);
    expect(assignableRoles(membership({ isOwner: true }), ROLES)).toHaveLength(
      3,
    );
  });

  test("nextRoleIds keeps roles the caller cannot touch", () => {
    const assignable = ROLES.filter((r) => r.id !== 1);
    expect(nextRoleIds([1, 3], [2], assignable)).toEqual([1, 2]);
    expect(nextRoleIds([1], [], assignable)).toEqual([1]);
    expect(nextRoleIds([], [3, 3, 1], assignable)).toEqual([3]);
  });
});

describe("canRemoveMember", () => {
  const dispatcher = membership({
    roleIds: [2],
    permissions: ["members.manage"],
  });

  test("never the owner, never yourself, never without members.manage", () => {
    expect(
      canRemoveMember(dispatcher, ROLES, member({ isOwner: true }), "100001"),
    ).toBe(false);
    expect(
      canRemoveMember(
        dispatcher,
        ROLES,
        member({ username: "100001" }),
        "100001",
      ),
    ).toBe(false);
    expect(canRemoveMember(membership(), ROLES, member(), "100001")).toBe(
      false,
    );
  });

  test("a role-holding target at or above the caller's rank stays", () => {
    expect(
      canRemoveMember(dispatcher, ROLES, member({ roleIds: [1] }), "100001"),
    ).toBe(false);
    expect(
      canRemoveMember(dispatcher, ROLES, member({ roleIds: [2] }), "100001"),
    ).toBe(false);
    expect(
      canRemoveMember(dispatcher, ROLES, member({ roleIds: [3] }), "100001"),
    ).toBe(true);
    expect(canRemoveMember(dispatcher, ROLES, member(), "100001")).toBe(true);
  });

  test("the owner removes anyone but themselves", () => {
    const owner = membership({ isOwner: true });
    expect(
      canRemoveMember(owner, ROLES, member({ roleIds: [1] }), "100001"),
    ).toBe(true);
  });
});

describe("airlineSections", () => {
  test("a visitor sees overview and ranks", () => {
    expect(airlineSections("CCA", null).map((s) => s.key)).toEqual([
      "overview",
      "ranks",
    ]);
  });

  test("an active member sees members and roles; permissions add manage and finance", () => {
    expect(airlineSections("CCA", membership()).map((s) => s.key)).toEqual([
      "overview",
      "members",
      "roles",
      "ranks",
    ]);
    const owner = airlineSections("CCA", membership({ isOwner: true }));
    expect(owner.map((s) => s.href)).toEqual([
      "/airlines/CCA",
      "/airlines/CCA/members",
      "/airlines/CCA/roles",
      "/airlines/CCA/ranks",
      "/airlines/CCA/manage",
      "/airlines/CCA/finance",
    ]);
  });
});
