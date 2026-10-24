import type { APIRoute } from "astro";

export const prerender = false;

/**
 * 探活。不碰 can-va-api，也不碰 can-api：上游抖一下不该把这边的 Pod 滚掉。
 * 中间件对它放行（`src/middleware.ts` 的 `isUnguarded`）。
 */
export const GET: APIRoute = () =>
  new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
