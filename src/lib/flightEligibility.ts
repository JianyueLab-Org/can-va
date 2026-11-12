import type { Aircraft, Rank, Route } from "./va";

/** Approved airline rank determines cumulative aircraft entitlements. */
export function entitledTypes(
  ranks: readonly Rank[],
  achieved: Rank | null,
): string[] {
  if (!achieved) return [];
  return [
    ...new Set(
      ranks
        .filter((rank) => rank.position <= achieved.position)
        .flatMap((rank) => rank.typeIcaos),
    ),
  ];
}

/** UI filtering only. The API rechecks all eligibility in its transaction. */
export function availableAircraft(
  fleet: readonly Aircraft[],
  location: string | null,
  types: readonly string[],
  route?: Route | null,
): Aircraft[] {
  if (
    !location ||
    route === null ||
    (route && (!route.active || route.depIcao !== location))
  )
    return [];
  return fleet.filter(
    (tail) =>
      tail.status === "available" &&
      tail.locationIcao === location &&
      types.includes(tail.typeIcao) &&
      (!route || route.typeIcaos.includes(tail.typeIcao)),
  );
}
