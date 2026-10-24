# AGENTS.md

给在这个仓库里工作的人和模型看的。`CLAUDE.md` 是指向本文件的软链接；改这个文件。

## 这是什么

**虚拟航司** —— `va.ceruleanavi.net`，Cerulean Aviation Network 的虚拟航空公司站点，
can-va-api 的成员前端。平台管理（审批成立申请、暂停、调整、参数）在 can-portal 的
`/super/airlines`，不在这里。

设计文档：monorepo 根的 `docs/superpowers/specs/2026-10-24-virtual-airline-design.md`。

形状和 can-database 一样：Astro SSR（standalone Node 适配器）+ Vue 岛屿 + Tailwind v4

- can-ui，跑在 jyl-tyo 上，由 CI 部署，Ingress 走 `cloudflare-tunnel`。开发端口 4330。

## 不变量

- 没有数据库，没有凭据，没有 Secret。会话是 can-api 签在 `.ceruleanavi.net` 上的
  cookie，这个站原样转发给 can-va-api。
- 整站要登录。中间件问 can-va-api 的 `GET /api/v1/va/me`：401 送去主站登录，其余失败
  503。`Me` 放进 `locals.me`，侧栏和每一页都用它。
- 这里的权限判断只决定显示什么（`src/lib/permissions.ts`）。can-va-api 每条路由自己判。
  没有权限的人打开设置、成员、角色、财务页拿到的是 404 页。
- 这个仓库必须公开：组织 secret 到不了私有仓库，私有 = 不能部署。

## 数据怎么走

- 页面 frontmatter 用 `src/server/canVa.ts` 的 `getVa()` 直接读 can-va-api（带
  cookie）。403/404 是 null，其余失败抛 `UpstreamUnavailable`，中间件答 503。
- 岛屿只打本站的 `src/pages/api/[...path].ts`。白名单只收岛屿在用的 `/api/v1/va/*`
  成员路由，加一条转给 can-api 的 `POST /api/v1/auth/signout`（外壳的退出登录）。
  **不收** `/api/v1/va/staff/*` 和 `/api/v1/internal/*`。
- 写操作：`Origin` 必须等于 `PUBLIC_ORIGIN`（403 `bad_origin`），再把这个 Origin 转给
  can-va-api（它查 `ALLOWED_ORIGINS`）。`astro.config.mjs` 里 `checkOrigin` 是关的。
- 岛屿用到的每一条路径都写在 `src/lib/va.ts`，写成字面量。`src/lib/allowList.test.ts`
  双向核对：用到的都放行，放行的都有人用。加路由 = `va.ts` 加方法 + 白名单加条目
  （带 `who`）。动态段的变量名决定测试的样例值，规则在 `va.ts` 抬头。
- 接口形状在 `src/lib/va.ts` 里手写，照 can-va-api 的契约逐字对应；改一边要改两边。

## 通知

- VA 通知只在这个站上出现。铃是 `src/components/VaBell.vue`，填在 `CanFrame` 的
  `notifications` 插槽里；`CanFrame` 的 `notifications` 属性不开，全网铃不在这里。
- 未读数每 60 秒取一次，只在页面可见时取（`src/lib/unreadPoller.ts`）。
- 文字按 `kind` + `params` 用本站字典拼（`notifications.kinds.<kind>`，kind 的点就是
  层级）。字典里没有的 kind 显示 `notifications.generic`，链接照旧。新 kind 上线前在
  四个语言文件里都加上；`src/lib/language.test.ts` 核对 Phase 1 的五个。
- 通知的 `path` 只放行站内路径（`safePath`）。

## 语言

zh-cn（默认）、zh-tw、en-us、ja-jp。四个文件键完全一致（`language.test.ts`）。
错误码的文字在 `common.errors.<code>`，没有的显示上游的英文 `message`。
侧栏四页的名字和 can-ui ⌘K 页面表里 `va` 的标题一致。

## 金额和时间

金额是最小单位（1/100 credit），显示用 `formatCredits`，输入用 `parseCredits`。
时间一律按 UTC 显示（`formatUtc`、`formatDay`），服务端渲染和水合必须一致。

## 和 can-ui 的接缝

- 依赖 can-ui 里的站点键 `va`（`CanFrame current="va"`、`siteLabel`、
  `can-ui-check-pages va`）。
- 页面先上线，再往 can-ui 的页面表加条目；删页面前先从页面表删。否则
  `bun run check:pages` 红。

## 本地开发

```bash
GITHUB_TOKEN="$(gh auth token)" bun install
CAN_VA_API_ORIGIN=http://127.0.0.1:8090 PUBLIC_ORIGIN=http://localhost:4330 bun run dev
bun run lint      # format:check + astro check + vue-tsc + bun test —— CI 跑这一条
bun run build
bun run check:pages
```

部署顺序：can-va-api 先（并且 `ALLOWED_ORIGINS` 里有 `https://va.ceruleanavi.net`），
再 can-va。
