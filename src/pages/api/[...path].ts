import type { APIRoute } from "astro";
import { CAN_API_ORIGIN, CAN_VA_API_ORIGIN, origin } from "@/lib/config";

export const prerender = false;

/**
 * 走白名单的同源反代。岛屿只打这里；这里把 cookie 原样转给 can-va-api。
 *
 * 白名单只收**岛屿真的在用**的 `/api/v1/va/*` 成员路由（`src/lib/allowList.test.ts`
 * 双向核对）。`/api/v1/va/staff/*`（平台管理，在 can-portal）和 `/api/v1/internal/*`
 * 一条都不收。
 *
 * 鉴权不在这一层：中间件对 `/api/` 放行，权限由 can-va-api 每条路由自己判。这一层管
 * 的是「路径给不给转」和「写操作的 Origin 对不对」。
 */

export interface Allowed {
  methods: string[];
  /** 谁在用它。没有这一句，以后没人敢删任何一条。 */
  who: string;
}

const AIRLINE = "[A-Z]{3}";
const AIRPORT = "[A-Z]{4}";
const USER = "[A-Za-z0-9_-]{1,32}";
const ID = "[0-9]{1,10}";

function airline(rest: string): RegExp {
  return new RegExp(`^v1/va/airlines/${AIRLINE}${rest}$`);
}

export const VA_EXACT: Record<string, Allowed> = {
  "v1/va/me/primary": {
    methods: ["PUT"],
    who: "MembershipActions.vue —— 设为主要航司",
  },
  "v1/va/airports": {
    methods: ["GET"],
    who: "AirportPicker.vue —— 按 ICAO 前缀或名称搜机场",
  },
  "v1/va/applications": {
    methods: ["POST"],
    who: "ApplyForm.vue —— 提交成立申请",
  },
  "v1/va/applications/mine": {
    methods: ["GET"],
    who: "ApplyForm.vue —— 提交后刷新申请记录",
  },
  "v1/va/airlines": {
    methods: ["GET"],
    who: "AirlineDirectory.vue —— 搜索航司",
  },
  "v1/va/notifications": {
    methods: ["GET"],
    who: "NotificationFeed.vue —— 载入更早的通知",
  },
  "v1/va/notifications/unread-count": {
    methods: ["GET"],
    who: "VaBell.vue —— 每 60 秒（可见时）取未读数",
  },
  "v1/va/notifications/read-all": {
    methods: ["POST"],
    who: "NotificationFeed.vue —— 全部标为已读",
  },
};

export const VA_PATTERNS: Array<Allowed & { test: RegExp }> = [
  {
    test: new RegExp(`^v1/va/airports/${AIRPORT}$`),
    methods: ["GET"],
    who: "AirportPicker.vue —— 核对输入的完整代码",
  },
  {
    test: airline(""),
    methods: ["PATCH"],
    who: "AirlineSettings.vue —— 航司设置",
  },
  {
    test: airline("/hubs"),
    methods: ["POST"],
    who: "AirlineSettings.vue —— 添加枢纽",
  },
  {
    test: airline(`/hubs/${AIRPORT}`),
    methods: ["DELETE"],
    who: "AirlineSettings.vue —— 移除枢纽",
  },
  {
    test: airline("/owner"),
    methods: ["POST"],
    who: "AirlineSettings.vue —— 转让所有权",
  },
  {
    test: airline("/join"),
    methods: ["POST"],
    who: "MembershipActions.vue —— 加入或申请加入",
  },
  {
    test: airline("/leave"),
    methods: ["POST"],
    who: "MembershipActions.vue —— 退出",
  },
  {
    test: airline("/invite/(accept|decline)"),
    methods: ["POST"],
    who: "MembershipActions.vue —— 接受或拒绝邀请",
  },
  {
    test: airline("/members"),
    methods: ["GET"],
    who: "MembersManager.vue —— 操作后刷新某一状态的名单",
  },
  {
    test: airline(`/members/${USER}`),
    methods: ["DELETE"],
    who: "MembersManager.vue —— 移除成员",
  },
  {
    test: airline(`/members/${USER}/(accept|decline)`),
    methods: ["POST"],
    who: "MembersManager.vue —— 处理加入申请",
  },
  {
    test: airline(`/members/${USER}/roles`),
    methods: ["PUT"],
    who: "MembersManager.vue —— 分配角色",
  },
  {
    test: airline("/invites"),
    methods: ["POST"],
    who: "MembersManager.vue —— 邀请飞行员",
  },
  {
    test: airline("/roles"),
    methods: ["GET", "POST"],
    who: "RolesManager.vue —— 刷新 / 新建角色",
  },
  {
    test: airline(`/roles/${ID}`),
    methods: ["PATCH", "DELETE"],
    who: "RolesManager.vue —— 修改 / 删除角色",
  },
  {
    test: airline("/ranks"),
    methods: ["GET", "POST"],
    who: "RanksManager.vue —— 刷新 / 新建等级",
  },
  {
    test: airline(`/ranks/${ID}`),
    methods: ["PATCH", "DELETE"],
    who: "RanksManager.vue —— 修改 / 删除等级",
  },
  {
    test: airline("/ledger"),
    methods: ["GET"],
    who: "LedgerTable.vue —— 载入更早的流水",
  },
];

/** 转给 can-api 的那一条：会话是它签的，清 cookie 也只能是它。 */
export const CAN_API_EXACT: Record<string, Allowed> = {
  "v1/auth/signout": {
    methods: ["POST"],
    who: "CanFrame 账户菜单 —— 退出登录",
  },
};

export function canApiEntry(path: string): Allowed | undefined {
  return Object.hasOwn(CAN_API_EXACT, path) ? CAN_API_EXACT[path] : undefined;
}

export function vaEntry(path: string): Allowed | undefined {
  const exact = Object.hasOwn(VA_EXACT, path) ? VA_EXACT[path] : undefined;
  return exact ?? VA_PATTERNS.find((entry) => entry.test.test(path));
}

/** handler 和测试用同一个判断。 */
export function allowed(path: string): Allowed | undefined {
  return canApiEntry(path) ?? vaEntry(path);
}

const UNSAFE = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/** `set-cookie` 必须在：退出登录靠 can-api 的 Set-Cookie 清会话。 */
const PASS_THROUGH = ["content-type", "cache-control", "set-cookie"];

const TIMEOUT_MS = 15_000;

const handler: APIRoute = async (context) => {
  const rest = context.params.path ?? "";
  const toCanApi = canApiEntry(rest) !== undefined;
  const entry = allowed(rest);

  if (!entry) {
    return Response.json(
      { error: "not_allowed", message: "该接口不在此站的转发白名单内。" },
      { status: 404 },
    );
  }

  const method = context.request.method.toUpperCase();
  if (!entry.methods.includes(method)) {
    return Response.json(
      { error: "method_not_allowed", message: "方法不被允许。" },
      { status: 405, headers: { allow: entry.methods.join(", ") } },
    );
  }

  // 写操作：Origin 必须等于 PUBLIC_ORIGIN。头不在就是不通过。浏览器对非 GET/HEAD
  // 一律带 Origin（同源也带），所以这不会挡住正常的写。
  if (UNSAFE.has(method)) {
    if (context.request.headers.get("origin") !== origin()) {
      return Response.json(
        { error: "bad_origin", message: "跨站请求被拒绝。" },
        { status: 403 },
      );
    }
  }

  const upstream = toCanApi ? CAN_API_ORIGIN : CAN_VA_API_ORIGIN;
  const target = `${upstream}/api/${rest}${context.url.search}`;

  const headers = new Headers({ accept: "application/json" });
  const cookie = context.request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const contentType = context.request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  // can-va-api 对写操作查 Origin（`ALLOWED_ORIGINS`）。服务端 fetch 不会自己带，
  // 所以把上面刚验过的那一个带过去。can-api 那条不带。
  if (UNSAFE.has(method) && !toCanApi) headers.set("origin", origin());

  const hasBody = method !== "GET" && method !== "HEAD";
  let response: Response;
  try {
    response = await fetch(target, {
      method,
      headers,
      body: hasBody ? context.request.body : undefined,
      ...(hasBody ? { duplex: "half" } : {}),
      signal: AbortSignal.any([
        context.request.signal,
        AbortSignal.timeout(TIMEOUT_MS),
      ]),
    } as RequestInit);
  } catch (error) {
    console.error(
      `${toCanApi ? "can-api" : "can-va-api"} ${rest} unreachable:`,
      error,
    );
    return Response.json(
      { error: "unreachable", message: "无法连接到航空公司服务，请稍后再试。" },
      { status: 502 },
    );
  }

  const out = new Headers();
  for (const name of PASS_THROUGH) {
    const value = response.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers: out });
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
