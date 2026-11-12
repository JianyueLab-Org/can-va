import { expect, test } from "bun:test";
import { availableAircraft, entitledTypes } from "./flightEligibility";
import type { Aircraft, Rank, Route } from "./va";
const rank = (position: number, typeIcaos: string[]): Rank => ({
  id: position,
  name: String(position),
  position,
  minHours: 0,
  minFlights: 0,
  payPerHr: 0,
  typeIcaos,
});
const tail = (id: number, overrides: Partial<Aircraft> = {}): Aircraft => ({
  id,
  airlineId: 1,
  registration: `B-${id}`,
  typeIcao: "A20N",
  livery: "",
  tenure: "owned",
  locationIcao: "ZBAA",
  status: "available",
  hoursMs: 0,
  acquiredAt: "2026-11-10T00:00:00Z",
  purchasePrice: 100,
  ...overrides,
});
const route: Route = {
  id: 1,
  airlineId: 1,
  flightNumber: "1",
  depIcao: "ZBAA",
  arrIcao: "ZSPD",
  distanceNm: 600,
  typeIcaos: ["A20N"],
  active: true,
};
test("rank types accumulate by position rather than input ordering", () => {
  const ranks = [
    rank(30, ["B77W"]),
    rank(10, ["A20N"]),
    rank(20, ["A20N", "B738"]),
  ];
  expect(entitledTypes(ranks, ranks[2])).toEqual(["A20N", "B738"]);
  expect(entitledTypes(ranks, null)).toEqual([]);
});
test("booking choices exclude busy, removed, displaced and unentitled tails", () => {
  const fleet = [
    tail(1),
    tail(2, { status: "booked" }),
    tail(3, { status: "gone" }),
    tail(4, { locationIcao: "ZSPD" }),
    tail(5, { typeIcao: "B77W" }),
  ];
  expect(
    availableAircraft(fleet, "ZBAA", ["A20N"], route).map((item) => item.id),
  ).toEqual([1]);
  expect(availableAircraft(fleet, null, ["A20N"], route)).toEqual([]);
  expect(availableAircraft(fleet, "ZBAA", [], route)).toEqual([]);
});
test("scheduled booking requires an active route at the pilot airport", () => {
  const fleet = [tail(1)];
  expect(availableAircraft(fleet, "ZBAA", ["A20N"], null)).toEqual([]);
  expect(
    availableAircraft(fleet, "ZBAA", ["A20N"], { ...route, active: false }),
  ).toEqual([]);
  expect(availableAircraft(fleet, "ZSPD", ["A20N"], route)).toEqual([]);
  expect(
    availableAircraft(fleet, "ZBAA", ["A20N"], {
      ...route,
      typeIcaos: ["B738"],
    }),
  ).toEqual([]);
  expect(
    availableAircraft(fleet, "ZBAA", ["A20N"]).map((item) => item.id),
  ).toEqual([1]);
});
