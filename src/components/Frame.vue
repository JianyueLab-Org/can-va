<script setup lang="ts">
/**
 * 本站的网络外壳：can-ui 的 `CanFrame`，`layout="tool"`，`current="va"`。
 *
 * 退出登录由 can-ui 的 AccountMenu 发同源 `POST /api/v1/auth/signout`，反代转给
 * can-api（`src/pages/api/[...path].ts` 的 `CAN_API_EXACT`）。`notifications` 插槽放
 * VA 铃，`notifications` 属性不开：全网通知铃的 `/api/v1/notifications/*` 不在反代上。
 */
import {
  CanFrame,
  originsFromEnv,
  type FrameUser,
  type NavItem,
  type SiteOrigins,
} from "@jianyuelab-org/can-ui";
import VaBell from "@/components/VaBell.vue";

const props = defineProps<{
  locale: string;
  pathname: string;
  nav: NavItem[];
  user: FrameUser | null;
  messages: Record<string, unknown>;
  origins?: SiteOrigins;
}>();

const origins: SiteOrigins = {
  ...originsFromEnv(import.meta.env),
  ...props.origins,
};
</script>

<template>
  <CanFrame
    layout="tool"
    current="va"
    :locale="locale"
    :pathname="pathname"
    :nav="nav"
    :user="user"
    :messages="messages"
    :origins="origins"
    after-sign-out="web"
  >
    <template v-if="user" #notifications>
      <VaBell :messages="messages" />
    </template>
    <slot />
  </CanFrame>
</template>
