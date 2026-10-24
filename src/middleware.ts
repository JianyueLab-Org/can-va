import { defineMiddleware } from "astro:middleware";
import { signInUrl } from "@/lib/config";
import { UpstreamUnavailable } from "@/server/canVa";
import { resolveMe } from "@/server/session";

/**
 * 整站要登录：每一条 VA 路由都要登录，没有一页对匿名访客有内容。
 *
 * 这是便利，不是边界。can-va-api 每条路由自己认人、自己判权限。
 */

/**
 * 不问会话的两条：`/api/` 是反代（调用方要状态码，不要 302 到一页 HTML），
 * `/healthz` 是探活（上游挂了也要回 200）。
 */
function isUnguarded(pathname: string): boolean {
  return pathname.startsWith("/api/") || pathname === "/healthz";
}

function unavailable(): Response {
  return new Response("The airline service is unavailable. Please try again.", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (isUnguarded(context.url.pathname)) {
    context.locals.me = null;
    return withSecurityHeaders(await next());
  }

  const outcome = await resolveMe(context);
  if (outcome.kind === "unavailable") {
    return withSecurityHeaders(unavailable());
  }
  if (outcome.kind === "signed-out") {
    return withSecurityHeaders(context.redirect(signInUrl(context.url)));
  }
  context.locals.me = outcome.me;

  try {
    return withSecurityHeaders(await next());
  } catch (error) {
    // 页面 frontmatter 里 `getVa` 抛的：上游 5xx 或连不上。
    if (error instanceof UpstreamUnavailable) {
      console.error(error.message);
      return withSecurityHeaders(unavailable());
    }
    throw error;
  }
});

function withSecurityHeaders(response: Response): Response {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "origin-when-cross-origin");
  return response;
}
