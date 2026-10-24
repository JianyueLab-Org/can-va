import type { Airline, Me, MyMembership } from "@/lib/va";
import { airlineCode } from "@/lib/application";
import { membershipFor } from "@/lib/permissions";
import { getVa, type VaContext } from "@/server/canVa";

/**
 * `/airlines/[icao]/*` 的公共前半段：代码格式、航司本身、我在这家的成员身份。
 * 代码不对、航司不存在或已关闭（上游 404）都是 null，页面渲染 404。
 */
export interface AirlinePage {
  icao: string;
  airline: Airline;
  membership: MyMembership | null;
}

export async function loadAirlinePage(
  context: VaContext,
  raw: string | undefined,
  me: Me,
): Promise<AirlinePage | null> {
  const icao = airlineCode(raw);
  if (!icao) return null;
  const airline = await getVa<Airline>(context, `/api/v1/va/airlines/${icao}`);
  if (!airline) return null;
  return { icao, airline, membership: membershipFor(me, icao) };
}
