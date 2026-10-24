<script setup lang="ts">
/**
 * 航司余额和流水，新的在前。首屏是服务端给的第一页；「载入更多」按 `next` 游标往下取。
 * 余额为负时显示 `negativeSince`（spec「Restructuring」：仪表盘要显示期限）。
 */
import { computed, ref } from "vue";
import { AlertBox, Button, DataTable } from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import { va, type LedgerEntry, type LedgerPage } from "@/lib/va";
import { errorText } from "@/lib/errors";
import { formatCredits, formatDay, formatUtc } from "@/lib/format";

const props = defineProps<{
  icao: string;
  locale: string;
  initial: LedgerPage;
  negativeSince: string | null;
  messages: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const t = createTranslator(props.messages);
const tc = createTranslator(props.common);

const entries = ref<LedgerEntry[]>(props.initial.items);
const next = ref<number | null>(props.initial.next);
const balance = ref(props.initial.balance);
const loading = ref(false);
const error = ref("");

const columns = [
  { key: "createdAt", label: t("columns.time") },
  { key: "kind", label: t("columns.kind") },
  { key: "amount", label: t("columns.amount"), align: "right" as const },
  { key: "actor", label: t("columns.actor") },
  { key: "note", label: t("columns.note") },
];

const negative = computed(() => balance.value < 0);

function kindLabel(kind: string): string {
  const key = `kinds.${kind}`;
  const label = t(key);
  return label === key ? kind : label;
}

async function loadMore(): Promise<void> {
  if (next.value === null) return;
  loading.value = true;
  const result = await va.ledger(props.icao, next.value);
  loading.value = false;
  if (!result.ok) {
    error.value = errorText(tc, result);
    return;
  }
  error.value = "";
  entries.value = [...entries.value, ...result.data.items];
  next.value = result.data.next;
  balance.value = result.data.balance;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="card p-5">
      <p class="text-eyebrow text-faint">{{ t("balance") }}</p>
      <p
        :class="[
          'text-title-1 tabular-nums',
          negative ? 'text-danger-fg' : 'text-ink',
        ]"
      >
        {{ formatCredits(balance, locale) }}
      </p>
    </div>

    <AlertBox v-if="negative && negativeSince" variant="warning">
      {{ t("negativeSince", { date: formatDay(negativeSince) }) }}
    </AlertBox>
    <AlertBox v-if="error" variant="danger">{{ error }}</AlertBox>

    <DataTable
      :columns="columns"
      :rows="entries"
      row-key="id"
      :empty="t('empty')"
      dense
    >
      <template #cell-createdAt="{ row }">
        <span class="tabular-nums">{{ formatUtc(row.createdAt) }}</span>
      </template>
      <template #cell-kind="{ row }">{{ kindLabel(row.kind) }}</template>
      <template #cell-amount="{ row }">
        <span
          :class="[
            'tabular-nums',
            row.amount < 0 ? 'text-danger-fg' : 'text-success-fg',
          ]"
          >{{ formatCredits(row.amount, locale) }}</span
        >
      </template>
      <template #cell-actor="{ row }">
        <span class="font-mono text-xs">{{ row.actor ?? t("system") }}</span>
      </template>
      <template #cell-note="{ row }">
        <span class="text-muted">{{ row.note ?? tc("none") }}</span>
      </template>
    </DataTable>

    <div v-if="next !== null">
      <Button variant="secondary" :loading="loading" @click="loadMore">
        {{ tc("loadMore") }}
      </Button>
    </div>
  </div>
</template>
