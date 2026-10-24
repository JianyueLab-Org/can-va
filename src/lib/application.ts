import type { ApplicationInput } from "./va";

/** 代码格式，和 can-va-api 的校验一致。表单先挡一遍，最终以上游为准。 */
export const AIRLINE_ICAO = /^[A-Z]{3}$/;
export const AIRLINE_IATA = /^[A-Z0-9]{2}$/;
export const AIRPORT_ICAO = /^[A-Z]{4}$/;

export interface ApplicationDraft {
  name: string;
  icao: string;
  iata: string;
  telephony: string;
  description: string;
  hubIcao: string;
}

export type ApplicationField =
  "name" | "icao" | "iata" | "telephony" | "hubIcao";
export type FieldProblem = "required" | "format";

export function toApplicationInput(d: ApplicationDraft): ApplicationInput {
  const iata = d.iata.trim().toUpperCase();
  return {
    name: d.name.trim(),
    icao: d.icao.trim().toUpperCase(),
    ...(iata ? { iata } : {}),
    telephony: d.telephony.trim(),
    description: d.description.trim(),
    hubIcao: d.hubIcao.trim().toUpperCase(),
  };
}

export function validateApplication(
  input: ApplicationInput,
): Partial<Record<ApplicationField, FieldProblem>> {
  const problems: Partial<Record<ApplicationField, FieldProblem>> = {};
  if (!input.name) problems.name = "required";
  if (!input.icao) problems.icao = "required";
  else if (!AIRLINE_ICAO.test(input.icao)) problems.icao = "format";
  if (input.iata !== undefined && !AIRLINE_IATA.test(input.iata)) {
    problems.iata = "format";
  }
  if (!input.telephony) problems.telephony = "required";
  if (!input.hubIcao) problems.hubIcao = "required";
  else if (!AIRPORT_ICAO.test(input.hubIcao)) problems.hubIcao = "format";
  return problems;
}

/** 地址里的航司代码：大小写都收，格式不对就是 null（页面 404）。 */
export function airlineCode(raw: string | undefined): string | null {
  const code = (raw ?? "").toUpperCase();
  return AIRLINE_ICAO.test(code) ? code : null;
}
