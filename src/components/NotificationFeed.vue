<script setup lang="ts">
/**
 * 全部 VA 通知，新的在前。文字由本站字典按 kind + params 拼（`notificationLine`），
 * 字典里没有的 kind 显示通用的一句，链接照旧。
 *
 * 「全部标为已读」发 `POST /api/v1/va/notifications/read-all`（body `{}`，即到现在为
 * 止的全部），成功后派发 `READ_EVENT`，外壳里的铃清零。
 */
import { computed, ref } from "vue";
import { AlertBox, Badge, Button, EmptyState } from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import { va, type Page, type VaNotification } from "@/lib/va";
import { notificationLine } from "@/lib/notifications";
import { READ_EVENT } from "@/lib/unreadPoller";
import { errorText } from "@/lib/errors";
import { formatUtc } from "@/lib/format";

const props = defineProps<{
  initial: Page<VaNotification>;
  messages: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const t = createTranslator(props.messages);
const tc = createTranslator(props.common);

const items = ref<VaNotification[]>(props.initial.items);
const next = ref<number | null>(props.initial.next);
const loading = ref(false);
const marking = ref(false);
const error = ref("");
const notice = ref("");

const lines = computed(() =>
  items.value.map((n) => ({ ...notificationLine(n, t), n })),
);
const hasUnread = computed(() => items.value.some((n) => !n.read));

async function loadMore(): Promise<void> {
  if (next.value === null) return;
  loading.value = true;
  const result = await va.notifications(next.value);
  loading.value = false;
  if (!result.ok) {
    error.value = errorText(tc, result);
    return;
  }
  error.value = "";
  items.value = [...items.value, ...result.data.items];
  next.value = result.data.next;
}

async function markAll(): Promise<void> {
  marking.value = true;
  notice.value = "";
  const result = await va.readAll();
  marking.value = false;
  if (!result.ok) {
    error.value = errorText(tc, result);
    return;
  }
  error.value = "";
  items.value = items.value.map((n) => ({ ...n, read: true }));
  notice.value = t("markedAll");
  window.dispatchEvent(new Event(READ_EVENT));
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex justify-end">
      <Button
        variant="secondary"
        :disabled="!hasUnread"
        :loading="marking"
        @click="markAll"
      >
        {{ t("markAll") }}
      </Button>
    </div>
    <AlertBox v-if="notice" variant="success">{{ notice }}</AlertBox>
    <AlertBox v-if="error" variant="danger">{{ error }}</AlertBox>

    <EmptyState v-if="lines.length === 0" :title="t('empty')" icon="bell" />
    <ul v-else class="card divide-y divide-subtle">
      <li
        v-for="line in lines"
        :key="line.n.id"
        class="flex items-baseline justify-between gap-4 px-5 py-3"
      >
        <a
          :href="line.href"
          :class="[
            'min-w-0 text-sm hover:underline',
            line.n.read ? 'text-muted' : 'font-medium text-ink',
          ]"
        >
          {{ line.text }}
        </a>
        <span class="flex shrink-0 items-center gap-2">
          <Badge v-if="!line.n.read" variant="info" size="sm">{{
            t("unread")
          }}</Badge>
          <span class="text-xs tabular-nums text-faint">{{
            formatUtc(line.n.createdAt)
          }}</span>
        </span>
      </li>
    </ul>

    <div v-if="next !== null">
      <Button variant="secondary" :loading="loading" @click="loadMore">
        {{ tc("loadMore") }}
      </Button>
    </div>
  </div>
</template>
