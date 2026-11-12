import { describe, expect, test } from "bun:test";
import { buildNavigation } from "./nav";
import type { MyMembership } from "./va";

const t = (key: string) => key;

function membership(
  icao: string,
  over: Partial<MyMembership> = {},
): MyMembership {
  return {
    airline: {
      id: 1,
      icao,
      iata: null,
      name: `${icao} Air`,
      telephony: icao,
      status: "active",
      joinMode: "open",
      hubs: ["ZBAA"],
      memberCount: 1,
    },
    status: "active",
    isPrimary: false,
    isOwner: false,
    roleIds: [],
    permissions: [],
    ...over,
  };
}

describe("buildNavigation", () => {
  test("operational pages remain available without an active membership", () => {
    const nav = buildNavigation(t, [membership("CCA", { status: "applied" })]);
    expect(nav.map((item) => [item.name, item.href])).toEqual([
      ["nav.home", "/"],
      ["nav.airlines", "/airlines"],
      ["nav.apply", "/apply"],
      ["nav.notifications", "/notifications"],
      ["nav.flights", "/flights"],
      ["nav.wallet", "/wallet"],
      ["nav.profile", "/profile"],
      ["nav.leaderboards", "/leaderboards"],
    ]);
  });

  test("active memberships form a group, primary first", () => {
    const nav = buildNavigation(t, [
      membership("AAA"),
      membership("BBB", { isPrimary: true }),
      membership("CCC", { status: "invited" }),
    ]);
    expect(nav).toHaveLength(9);
    expect(nav[8].name).toBe("nav.mine");
    expect(nav[8].children?.map((c) => [c.name, c.href])).toEqual([
      ["BBB · BBB Air", "/airlines/BBB"],
      ["AAA · AAA Air", "/airlines/AAA"],
    ]);
  });
});
