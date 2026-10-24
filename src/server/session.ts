import type { Me } from "@/lib/va";
import { fetchVa, type VaContext } from "@/server/canVa";

/**
 * 这个人是谁：问 can-va-api 的 `GET /api/v1/va/me`。
 *
 * 不另外问 can-api：can-va-api 本来就拿同一枚 cookie 去 can-api 的
 * `GET /api/v1/auth/session` 认人，`Me` 里已经有外壳要的 `username`、`name`、`rating`，
 * 每一页也都要 `memberships` 来决定显示什么。一次往返答完两件事。
 */

export type MeOutcome =
  | { kind: "authenticated"; me: Me }
  | { kind: "signed-out" }
  | { kind: "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMe(value: unknown): value is Me {
  return (
    isRecord(value) &&
    typeof value.username === "string" &&
    value.username.length > 0 &&
    typeof value.name === "string" &&
    typeof value.rating === "number" &&
    Number.isInteger(value.rating) &&
    typeof value.isPlatformStaff === "boolean" &&
    Array.isArray(value.memberships)
  );
}

export async function resolveMe(context: VaContext): Promise<MeOutcome> {
  if (!context.request.headers.get("cookie")) return { kind: "signed-out" };
  let response: Response;
  try {
    response = await fetchVa(context, "/api/v1/va/me");
  } catch {
    return { kind: "unavailable" };
  }
  if (response.status === 401) return { kind: "signed-out" };
  if (response.status !== 200) return { kind: "unavailable" };
  try {
    const body: unknown = await response.json();
    return isMe(body)
      ? { kind: "authenticated", me: body }
      : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** 页面里取当前成员。中间件对每个页面请求都解过；没有就是中间件被绕过了。 */
export function currentMe(locals: App.Locals): Me {
  if (!locals.me) throw new Error("middleware did not resolve the member");
  return locals.me;
}
