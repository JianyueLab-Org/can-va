<script setup lang="ts">
/**
 * 航司目录。首屏是服务端给的全量（只有运营中的航司）；搜索框交给 can-va-api 的
 * `?q=`，300 ms 防抖。
 */
import { onBeforeUnmount, ref } from "vue";
import { AlertBox, Badge, DataTable, Input } from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import { va, type AirlineSummary } from "@/lib/va";
import { errorText } from "@/lib/errors";

const props = defineProps<{
  initial: AirlineSummary[];
  messages: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const t = createTranslator(props.messages);
const tc = createTranslator(props.common);

const rows = ref<AirlineSummary[]>(props.initial);
const query = ref("");
const loading = ref(false);
const error = ref("");
let timer: ReturnType<typeof setTimeout> | null = null;
let sequence = 0;

const columns = [
  { key: "icao", label: t("columns.icao") },
  { key: "iata", label: t("columns.iata") },
  { key: "name", label: t("columns.name") },
  { key: "telephony", label: t("columns.telephony") },
  { key: "joinMode", label: t("columns.joinMode") },
  { key: "hubs", label: t("columns.hubs") },
  { key: "memberCount", label: t("columns.members"), align: "right" as const },
];

function onQuery(value: string | number): void {
  query.value = String(value);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void search(), 300);
}

async function search(): Promise<void> {
  const mine = ++sequence;
  loading.value = true;
  const result = await va.airlines(query.value.trim());
  if (mine !== sequence) return;
  loading.value = false;
  if (!result.ok) {
    error.value = errorText(tc, result);
    return;
  }
  error.value = "";
  rows.value = result.data.items;
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="max-w-md">
      <Input
        :model-value="query"
        type="search"
        :label="t('searchLabel')"
        :placeholder="t('searchPlaceholder')"
        autocomplete="off"
        @update:model-value="onQuery"
      />
    </div>
    <AlertBox v-if="error" variant="danger">{{ error }}</AlertBox>
    <DataTable
      :columns="columns"
      :rows="rows"
      row-key="id"
      :loading="loading"
      :loading-label="tc('loading')"
      :empty="t('empty')"
    >
      <template #cell-icao="{ row }">
        <a
          :href="`/airlines/${row.icao}`"
          class="font-mono font-medium text-can hover:underline"
          >{{ row.icao }}</a
        >
      </template>
      <template #cell-iata="{ row }">
        <span class="font-mono">{{ row.iata ?? tc("none") }}</span>
      </template>
      <template #cell-name="{ row }">
        <a :href="`/airlines/${row.icao}`" class="text-ink hover:underline">{{
          row.name
        }}</a>
      </template>
      <template #cell-joinMode="{ row }">
        <Badge>{{ tc(`joinMode.${row.joinMode}`) }}</Badge>
      </template>
      <template #cell-hubs="{ row }">
        <span class="font-mono text-xs">{{ row.hubs.join(" ") }}</span>
      </template>
      <template #cell-memberCount="{ row }">
        <span class="tabular-nums">{{ row.memberCount }}</span>
      </template>
    </DataTable>
  </div>
</template>
