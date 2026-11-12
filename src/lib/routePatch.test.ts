import { expect, test } from "bun:test";
import { changedRouteFields } from "./routePatch";

const existing = {
  flightNumber: "101",
  depIcao: "ZBAA",
  arrIcao: "ZSPD",
  typeIcaos: ["A20N", "B738"],
  active: true,
};

test("non-endpoint edits preserve historical airport endpoints", () => {
  expect(
    changedRouteFields(existing, {
      ...existing,
      flightNumber: "102",
      typeIcaos: ["A20N"],
    }),
  ).toEqual({ flightNumber: "102", typeIcaos: ["A20N"] });
});

test("changing one endpoint does not resubmit the other endpoint", () => {
  expect(
    changedRouteFields(existing, { ...existing, arrIcao: "ZGGG" }),
  ).toEqual({
    arrIcao: "ZGGG",
  });
});

test("type order does not change entitlements and unchanged forms are no-ops", () => {
  expect(changedRouteFields(existing, existing)).toEqual({});
  expect(
    changedRouteFields(existing, {
      ...existing,
      typeIcaos: ["B738", "A20N"],
    }),
  ).toEqual({});
});

test("activation-only edits do not revalidate existing endpoints", () => {
  expect(changedRouteFields(existing, { ...existing, active: false })).toEqual({
    active: false,
  });
});
