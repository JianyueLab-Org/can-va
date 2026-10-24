/// <reference types="astro/client" />

import type { Me } from "@/lib/va";

declare global {
  namespace App {
    interface Locals {
      /** 中间件从 can-va-api 解出来的成员；`/api/*` 和 `/healthz` 上是 null。 */
      me: Me | null;
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_CAN_API_ORIGIN?: string;
  readonly PUBLIC_CAN_WEB_ORIGIN?: string;
  readonly PUBLIC_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
