# can-va

Cerulean Aviation Network 的虚拟航司站点，`va.ceruleanavi.net`。

成员在这里浏览和加入航司、申请成立航司、管理自己航司的设置、枢纽、成员、角色、等级，
查看财务流水和航司通知。数据全部来自 can-va-api；本站不持有任何凭据。

```bash
GITHUB_TOKEN="$(gh auth token)" bun install
cp .env.example .env
bun run dev          # http://localhost:4330
bun run lint && bun run build && bun run check:pages
```

维护说明见 `AGENTS.md`。
