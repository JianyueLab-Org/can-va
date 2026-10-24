<script setup lang="ts">
/**
 * VA 通知铃：一个指向 `/notifications` 的图标链接加未读角标。
 *
 * 填在 `CanFrame` 的 `notifications` 插槽里，所以全网通知铃不在这个站上出现 —— VA 通知
 * 只属于 can-va（spec「Notifications」）。未读数每 60 秒取一次，只在页面可见时取
 * （`src/lib/unreadPoller.ts`）。`/notifications` 页全部标为已读后派发 `READ_EVENT`，
 * 这里清零。
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "@jianyuelab-org/can-ui/components/Icon.vue";
import NotificationBadge from "@jianyuelab-org/can-ui/components/NotificationBadge.vue";
import { notificationBadgeText } from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import { va } from "@/lib/va";
import {
  createUnreadPoller,
  documentVisibility,
  READ_EVENT,
  windowInterval,
  type UnreadPoller,
} from "@/lib/unreadPoller";

const props = defineProps<{ messages: Record<string, unknown> }>();
const t = createTranslator(props.messages);

const count = ref(0);
const badge = computed(() => notificationBadgeText(count.value));
const label = computed(() =>
  count.value > 0 ? t("bell.unread", { count: count.value }) : t("bell.label"),
);

let poller: UnreadPoller | null = null;

function onRead(): void {
  count.value = 0;
}

onMounted(() => {
  poller = createUnreadPoller({
    fetchCount: async () => {
      const result = await va.unreadCount();
      return result.ok && typeof result.data?.count === "number"
        ? result.data.count
        : null;
    },
    onCount: (n) => {
      count.value = n;
    },
    visibility: documentVisibility(),
    interval: windowInterval,
  });
  poller.start();
  window.addEventListener(READ_EVENT, onRead);
});

onBeforeUnmount(() => {
  poller?.stop();
  window.removeEventListener(READ_EVENT, onRead);
});
</script>

<template>
  <a
    href="/notifications"
    class="icon-button focus-ring relative"
    :aria-label="label"
    :title="label"
  >
    <Icon name="bell" class="size-5" />
    <NotificationBadge :text="badge" class="-right-0.5 -top-0.5" />
  </a>
</template>
