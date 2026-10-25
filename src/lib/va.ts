/**
 * 岛屿怎么跟 can-va-api 说话：打本站同源的 `/api/v1/va/...`，由
 * `src/pages/api/[...path].ts` 转发（带 cookie、带校验过的 Origin）。
 *
 * 浏览器安全：不 import `src/server` 下的任何东西。
 *
 * **岛屿用到的每一条反代路径都写在这个文件里，而且写成字面量。**
 * `src/lib/allowList.test.ts` 扫这些字面量，逐条对白名单；动态段的变量名决定测试代入的
 * 样例值：名字带 `hub`/`airport` 代 `ZBAA`，带 `user` 代 `100001`，`id` 代 `1`，其余
 * （航司 ICAO）代 `CCA`。查询串一律写在 `?` 后面。
 *
 * 形状照 Phase 1 契约逐字手写；改一边要改两边。
 */

export type Permission =
  | "airline.edit"
  | "members.manage"
  | "roles.manage"
  | "fleet.manage"
  | "routes.manage"
  | "pireps.review"
  | "finance.view"
  | "ranks.manage";

export const PERMISSIONS: readonly Permission[] = [
  "airline.edit",
  "members.manage",
  "roles.manage",
  "fleet.manage",
  "routes.manage",
  "pireps.review",
  "finance.view",
  "ranks.manage",
];

export type JoinMode = "open" | "application" | "invite";
export type AirlineStatus = "active" | "suspended" | "closed";
export type MembershipStatus = "applied" | "invited" | "active";

export interface Airport {
  icao: string;
  iata: string | null;
  name: string;
  municipality: string | null;
  isoCountry: string;
  lat: number;
  lon: number;
  elevationFt: number | null;
  kind: "large_airport" | "medium_airport" | "small_airport";
  scheduledService: boolean;
  tier: 1 | 2 | 3 | 4 | 5;
  withdrawn: boolean;
}

export interface AirlineSummary {
  id: number;
  icao: string;
  iata: string | null;
  name: string;
  telephony: string;
  status: AirlineStatus;
  joinMode: JoinMode;
  hubs: string[];
  memberCount: number;
}

export interface Airline extends AirlineSummary {
  description: string;
  owner: string | null;
  allowOfflinePireps: boolean;
  allowFreeFlights: boolean;
  createdAt: string;
  /** Only with `finance.view` or platform staff. */
  balance?: number;
  negativeSince?: string | null;
}

export interface Application {
  id: number;
  applicant: string;
  name: string;
  icao: string;
  iata: string | null;
  telephony: string;
  description: string;
  hubIcao: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  reason: string | null;
  airlineId: number | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface ApplicationInput {
  name: string;
  icao: string;
  iata?: string;
  telephony: string;
  description: string;
  hubIcao: string;
}

export interface Role {
  id: number;
  name: string;
  position: number;
  permissions: Permission[];
}

export interface RoleInput {
  name: string;
  position: number;
  permissions: Permission[];
}

export interface Member {
  username: string;
  status: MembershipStatus;
  isPrimary: boolean;
  isOwner: boolean;
  roleIds: number[];
  joinedAt: string;
}

export interface Rank {
  id: number;
  name: string;
  position: number;
  minHours: number;
  minFlights: number;
  /** Minor units per block hour. */
  payPerHr: number;
}

export interface RankInput {
  name: string;
  position: number;
  minHours: number;
  minFlights: number;
  payPerHr: number;
}

export interface MyMembership {
  airline: AirlineSummary;
  status: MembershipStatus;
  isPrimary: boolean;
  isOwner: boolean;
  roleIds: number[];
  /** Effective permissions; the owner has all of them. */
  permissions: Permission[];
}

export interface Me {
  username: string;
  name: string;
  rating: number;
  isPlatformStaff: boolean;
  pilot: { locationIcao: string; wallet: number } | null;
  memberships: MyMembership[];
  pendingApplication: Application | null;
}

export interface LedgerEntry {
  id: number;
  amount: number;
  kind: string;
  actor: string | null;
  note: string | null;
  createdAt: string;
}

/** The contract's `Notification`; renamed so it does not shadow the DOM global. */
export interface VaNotification {
  id: number;
  kind: string;
  params: Record<string, string | number>;
  path: string;
  createdAt: string;
  read: boolean;
}

export interface Page<T> {
  items: T[];
  next: number | null;
}

export interface LedgerPage extends Page<LedgerEntry> {
  balance: number;
}

export interface AirlinePatch {
  name?: string;
  description?: string;
  joinMode?: JoinMode;
  allowOfflinePireps?: boolean;
  allowFreeFlights?: boolean;
}

export interface ApiFailure {
  ok: false;
  status: number;
  error: string;
  message: string;
}

export type ApiResult<T> = { ok: true; status: number; data: T } | ApiFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 调一条反代路径。**失败不抛异常**：403/409 那句话该出现在表单旁边，不是一个白屏。
 * 网络故障是 `status: 0`。204 的 `data` 是 null。
 */
export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    return {
      ok: false,
      status: 0,
      error: "network",
      message: "Network request failed.",
    };
  }

  const text = await response.text().catch(() => "");
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const record = isRecord(body) ? body : {};
    return {
      ok: false,
      status: response.status,
      error: typeof record.error === "string" ? record.error : "http_error",
      message:
        typeof record.message === "string"
          ? record.message
          : `HTTP ${response.status}`,
    };
  }
  return { ok: true, status: response.status, data: body as T };
}

function send(method: string, body?: unknown): RequestInit {
  return body === undefined
    ? { method }
    : { method, body: JSON.stringify(body) };
}

/** `before=…&limit=…` without the leading `?`. */
function pageQuery(before?: number | null, limit?: number): string {
  const params = new URLSearchParams();
  if (before != null) params.set("before", String(before));
  if (limit != null) params.set("limit", String(limit));
  return params.toString();
}

const enc = encodeURIComponent;

/** One method per proxied route. `airline` is the airline ICAO, upper case. */
export const va = {
  setPrimary: (airline: string) =>
    api<Me>("/api/v1/va/me/primary", send("PUT", { airlineIcao: airline })),

  searchAirports: (q: string, limit = 8) =>
    api<{ items: Airport[] }>(`/api/v1/va/airports?q=${enc(q)}&limit=${limit}`),
  airport: (airport: string) =>
    api<Airport>(`/api/v1/va/airports/${enc(airport)}`),

  apply: (input: ApplicationInput) =>
    api<Application>("/api/v1/va/applications", send("POST", input)),
  myApplications: () =>
    api<{ items: Application[] }>("/api/v1/va/applications/mine"),

  airlines: (q: string) =>
    api<{ items: AirlineSummary[] }>(`/api/v1/va/airlines?q=${enc(q)}`),
  updateAirline: (airline: string, patch: AirlinePatch) =>
    api<Airline>(`/api/v1/va/airlines/${enc(airline)}`, send("PATCH", patch)),
  addHub: (airline: string, hub: string) =>
    api<Airline>(
      `/api/v1/va/airlines/${enc(airline)}/hubs`,
      send("POST", { icao: hub }),
    ),
  removeHub: (airline: string, hub: string) =>
    api<Airline>(
      `/api/v1/va/airlines/${enc(airline)}/hubs/${enc(hub)}`,
      send("DELETE"),
    ),
  transferOwner: (airline: string, username: string) =>
    api<Airline>(
      `/api/v1/va/airlines/${enc(airline)}/owner`,
      send("POST", { username }),
    ),

  join: (airline: string) =>
    api<MyMembership>(`/api/v1/va/airlines/${enc(airline)}/join`, send("POST")),
  leave: (airline: string) =>
    api<null>(`/api/v1/va/airlines/${enc(airline)}/leave`, send("POST")),
  acceptInvite: (airline: string) =>
    api<MyMembership>(
      `/api/v1/va/airlines/${enc(airline)}/invite/accept`,
      send("POST"),
    ),
  declineInvite: (airline: string) =>
    api<null>(
      `/api/v1/va/airlines/${enc(airline)}/invite/decline`,
      send("POST"),
    ),

  members: (airline: string, status: MembershipStatus) =>
    api<{ items: Member[] }>(
      `/api/v1/va/airlines/${enc(airline)}/members?status=${status}`,
    ),
  acceptApplicant: (airline: string, username: string) =>
    api<Member>(
      `/api/v1/va/airlines/${enc(airline)}/members/${enc(username)}/accept`,
      send("POST"),
    ),
  declineApplicant: (airline: string, username: string) =>
    api<null>(
      `/api/v1/va/airlines/${enc(airline)}/members/${enc(username)}/decline`,
      send("POST"),
    ),
  invite: (airline: string, username: string) =>
    api<Member>(
      `/api/v1/va/airlines/${enc(airline)}/invites`,
      send("POST", { username }),
    ),
  removeMember: (airline: string, username: string) =>
    api<null>(
      `/api/v1/va/airlines/${enc(airline)}/members/${enc(username)}`,
      send("DELETE"),
    ),
  setMemberRoles: (airline: string, username: string, roleIds: number[]) =>
    api<Member>(
      `/api/v1/va/airlines/${enc(airline)}/members/${enc(username)}/roles`,
      send("PUT", { roleIds }),
    ),

  roles: (airline: string) =>
    api<{ items: Role[] }>(`/api/v1/va/airlines/${enc(airline)}/roles`),
  createRole: (airline: string, input: RoleInput) =>
    api<Role>(`/api/v1/va/airlines/${enc(airline)}/roles`, send("POST", input)),
  updateRole: (airline: string, id: number, input: Partial<RoleInput>) =>
    api<Role>(
      `/api/v1/va/airlines/${enc(airline)}/roles/${id}`,
      send("PATCH", input),
    ),
  deleteRole: (airline: string, id: number) =>
    api<null>(
      `/api/v1/va/airlines/${enc(airline)}/roles/${id}`,
      send("DELETE"),
    ),

  ranks: (airline: string) =>
    api<{ items: Rank[] }>(`/api/v1/va/airlines/${enc(airline)}/ranks`),
  createRank: (airline: string, input: RankInput) =>
    api<Rank>(`/api/v1/va/airlines/${enc(airline)}/ranks`, send("POST", input)),
  updateRank: (airline: string, id: number, input: Partial<RankInput>) =>
    api<Rank>(
      `/api/v1/va/airlines/${enc(airline)}/ranks/${id}`,
      send("PATCH", input),
    ),
  deleteRank: (airline: string, id: number) =>
    api<null>(
      `/api/v1/va/airlines/${enc(airline)}/ranks/${id}`,
      send("DELETE"),
    ),

  ledger: (airline: string, before: number | null) =>
    api<LedgerPage>(
      `/api/v1/va/airlines/${enc(airline)}/ledger?${pageQuery(before)}`,
    ),

  notifications: (before: number | null) =>
    api<Page<VaNotification>>(`/api/v1/va/notifications?${pageQuery(before)}`),
  unreadCount: () =>
    api<{ count: number }>("/api/v1/va/notifications/unread-count"),
  /** `upTo`：只标 `id <= upTo` 的；不给就是到现在为止的全部。 */
  readAll: (upTo?: number) =>
    api<null>(
      "/api/v1/va/notifications/read-all",
      send("POST", upTo === undefined ? {} : { upTo }),
    ),
};
