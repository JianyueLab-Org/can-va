import type { APIContext } from "astro";
import { CAN_VA_API_ORIGIN } from "@/lib/config";

/**
 * 服务端读 can-va-api：把进来的 `Cookie` 头原样转发，can-va-api 拿它去 can-api 认人。
 * 只读（GET）；写操作只走岛屿 → 反代。
 *
 * **服务端专用**，它读请求头，绝不能被岛屿 import。
 */

const TIMEOUT_MS = 8_000;

export type VaContext = Pick<APIContext, "request">;

/** 上游不可用。中间件把它变成 503（`src/middleware.ts`）。 */
export class UpstreamUnavailable extends Error {
  path: string;
  status: number;

  constructor(path: string, status: number) {
    super(`can-va-api ${path} answered ${status}`);
    this.name = "UpstreamUnavailable";
    this.path = path;
    this.status = status;
  }
}

export async function fetchVa(
  context: VaContext,
  path: string,
): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json" };
  const cookie = context.request.headers.get("cookie");
  if (cookie) headers.cookie = cookie;
  try {
    return await fetch(CAN_VA_API_ORIGIN + path, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.error(`can-va-api ${path} unreachable:`, error);
    throw new UpstreamUnavailable(path, 0);
  }
}

/**
 * 读一条，拿回 JSON。403 和 404 是 null（「你看不到」和「没有」在页面上都是 404 页）；
 * 其余失败抛 `UpstreamUnavailable`。
 */
export async function getVa<T>(
  context: VaContext,
  path: string,
): Promise<T | null> {
  const response = await fetchVa(context, path);
  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok) throw new UpstreamUnavailable(path, response.status);
  try {
    return (await response.json()) as T;
  } catch {
    throw new UpstreamUnavailable(path, response.status);
  }
}
