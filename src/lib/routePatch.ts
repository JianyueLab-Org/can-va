import type { Route } from "./va";

type RouteFields = Pick<
  Route,
  "flightNumber" | "depIcao" | "arrIcao" | "typeIcaos" | "active"
>;

/** Omit unchanged endpoints so withdrawn historical airports remain editable. */
export function changedRouteFields(
  original: RouteFields,
  edited: RouteFields,
): Partial<RouteFields> {
  const patch: Partial<RouteFields> = {};
  if (edited.flightNumber !== original.flightNumber)
    patch.flightNumber = edited.flightNumber;
  if (edited.depIcao !== original.depIcao) patch.depIcao = edited.depIcao;
  if (edited.arrIcao !== original.arrIcao) patch.arrIcao = edited.arrIcao;
  if (edited.active !== original.active) patch.active = edited.active;
  if (
    edited.typeIcaos.length !== original.typeIcaos.length ||
    edited.typeIcaos.some((type) => !original.typeIcaos.includes(type))
  )
    patch.typeIcaos = [...edited.typeIcaos];
  return patch;
}
