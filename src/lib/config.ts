/**
 * 这个站要知道的地址，集中在一处。抄 can-database 的同名文件，不共享。
 */

function clean(value: string | undefined): string {
  return (value || "").replace(/\/+$/, "");
}

/**
 * can-va-api。线上是集群内地址（`http://app.can-va-api.svc.cluster.local`），由部署清
 * 单注入。兜底是本地的 `127.0.0.1:8090`：忘了配不该悄悄打到线上。
 */
export const CAN_VA_API_ORIGIN =
  clean(process.env.CAN_VA_API_ORIGIN) || "http://127.0.0.1:8090";

/** can-api。只有退出登录走它（`POST /api/v1/auth/signout`，清的是它签的 cookie）。 */
export const CAN_API_ORIGIN =
  clean(process.env.CAN_API_ORIGIN) ||
  clean(import.meta.env.PUBLIC_CAN_API_ORIGIN) ||
  "https://api.ceruleanavi.net";

/** can-web。没登录的人送去它的 `/signin`。 */
export const CAN_WEB_ORIGIN =
  clean(process.env.CAN_WEB_ORIGIN) ||
  clean(import.meta.env.PUBLIC_CAN_WEB_ORIGIN) ||
  "https://ceruleanavi.net";

/**
 * 本站自己的 origin，写操作的 Origin 头和它比对。必须显式配置：反代后面从 `Host`
 * 推出来的是 `http://`。兜底是本地开发端口。
 */
export function origin(): string {
  return (
    clean(process.env.PUBLIC_ORIGIN) ||
    clean(import.meta.env.PUBLIC_ORIGIN) ||
    "http://localhost:4330"
  );
}

/**
 * 登录去哪儿。callbackUrl 用 `origin()` 拼，不用请求 URL 的 origin（反代后面是
 * `http://`，配不上 can-web 白名单）。片段不带。
 */
export function signInUrl(returnTo?: URL): string {
  const base = `${CAN_WEB_ORIGIN}/signin`;
  if (!returnTo) return base;
  const target = `${origin()}${returnTo.pathname}${returnTo.search}`;
  return `${base}?callbackUrl=${encodeURIComponent(target)}`;
}
