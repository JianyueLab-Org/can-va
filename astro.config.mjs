// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";

/**
 * 虚拟航空公司站点。形状和 can-database 一样：Astro SSR（standalone Node 适配器）
 * + Vue 岛屿 + Tailwind v4 + can-ui。
 *
 * 不持有任何凭据。成员的 cookie 原样转发给 can-va-api。
 *
 * `security.checkOrigin: false`：站点在 TLS 终止的反代后面，Astro 从 `Host` 推出的
 * origin 是 `http://…`，浏览器发的是 `https://…`。写操作在
 * `src/pages/api/[...path].ts` 里比对显式的 `PUBLIC_ORIGIN`。
 */
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [vue()],
  security: { checkOrigin: false },
  vite: {
    plugins: [tailwindcss()],
    // can-ui 发的是源码；不加这行 SSR 会去 require 一个 .vue。
    ssr: { noExternal: ["@jianyuelab-org/can-ui"] },
  },
});
