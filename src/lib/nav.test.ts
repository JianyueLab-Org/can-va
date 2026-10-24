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
  test("four pages, no airline group when the member has no active membership", () => {
    const nav = buildNavigation(t, [membership("CCA", { status: "applied" })]);
    expect(nav.map((item) => [item.name, item.href])).toEqual([
      ["nav.home", "/"],
      ["nav.airlines", "/airlines"],
      ["nav.apply", "/apply"],
      ["nav.notifications", "/notifications"],
    ]);
  });

  test("active memberships form a group, primary first", () => {
    const nav = buildNavigation(t, [
      membership("AAA"),
      membership("BBB", { isPrimary: true }),
      membership("CCC", { status: "invited" }),
    ]);
    expect(nav).toHaveLength(5);
    expect(nav[4].name).toBe("nav.mine");
    expect(nav[4].children?.map((c) => [c.name, c.href])).toEqual([
      ["BBB · BBB Air", "/airlines/BBB"],
      ["AAA · AAA Air", "/airlines/AAA"],
    ]);
  });
});
