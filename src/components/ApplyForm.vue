<script setup lang="ts">
/**
 * 成立申请。一个人同时最多一份待审核的申请：有就只显示它，没有才给表单。
 * 批准与否由平台管理人员在 can-portal 决定；结果以通知送达。
 */
import { reactive, ref } from "vue";
import {
  AlertBox,
  Badge,
  Button,
  Card,
  DataTable,
  Input,
  Textarea,
} from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import AirportPicker from "@/components/AirportPicker.vue";
import { va, type Application } from "@/lib/va";
import {
  toApplicationInput,
  validateApplication,
  type ApplicationDraft,
  type ApplicationField,
  type FieldProblem,
} from "@/lib/application";
import { errorText } from "@/lib/errors";
import { formatUtc } from "@/lib/format";

const props = defineProps<{
  pending: Application | null;
  history: Application[];
  messages: Record<string, unknown>;
  picker: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const t = createTranslator(props.messages);
const tc = createTranslator(props.common);

const pending = ref<Application | null>(props.pending);
const history = ref<Application[]>(props.history);
const draft = reactive<ApplicationDraft>({
  name: "",
  icao: "",
  iata: "",
  telephony: "",
  description: "",
  hubIcao: "",
});
const problems = ref<Partial<Record<ApplicationField, FieldProblem>>>({});
const busy = ref(false);
const error = ref("");
const notice = ref("");

const STATUS_VARIANT = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
} as const;

const columns = [
  { key: "submitted", label: t("history.columns.submitted") },
  { key: "airline", label: t("history.columns.airline") },
  { key: "hub", label: t("history.columns.hub") },
  { key: "status", label: t("history.columns.status") },
  { key: "reason", label: t("history.columns.reason") },
];

function problem(field: ApplicationField): string | undefined {
  const p = problems.value[field];
  return p ? t(`validation.${p}`) : undefined;
}

async function submit(): Promise<void> {
  error.value = "";
  notice.value = "";
  const input = toApplicationInput(draft);
  problems.value = validateApplication(input);
  if (Object.keys(problems.value).length > 0) return;

  busy.value = true;
  const result = await va.apply(input);
  busy.value = false;
  if (!result.ok) {
    error.value = errorText(tc, result);
    return;
  }
  pending.value = result.data;
  notice.value = t("form.submitted");
  const mine = await va.myApplications();
  if (mine.ok) history.value = mine.data.items;
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <AlertBox v-if="notice" variant="success">{{ notice }}</AlertBox>
    <AlertBox v-if="error" variant="danger">{{ error }}</AlertBox>

    <Card v-if="pending" :title="t('pending.title')">
      <p class="text-sm text-ink">
        {{ t("pending.body", { name: pending.name, icao: pending.icao }) }}
      </p>
    </Card>

    <Card v-else :title="t('form.title')">
      <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="submit">
        <Input
          v-model="draft.name"
          :label="t('form.name')"
          :error="problem('name')"
          :maxlength="80"
          required
        />
        <Input
          v-model="draft.telephony"
          :label="t('form.telephony')"
          :hint="t('form.telephonyHelp')"
          :error="problem('telephony')"
          autocapitalize="characters"
          :maxlength="40"
          required
        />
        <Input
          v-model="draft.icao"
          :label="t('form.icao')"
          :hint="t('form.icaoHelp')"
          :error="problem('icao')"
          autocapitalize="characters"
          autocorrect="off"
          :spellcheck="false"
          :maxlength="3"
          required
        />
        <Input
          v-model="draft.iata"
          :label="t('form.iata')"
          :hint="t('form.iataHelp')"
          :error="problem('iata')"
          autocapitalize="characters"
          autocorrect="off"
          :spellcheck="false"
          :maxlength="2"
        />
        <AirportPicker
          v-model="draft.hubIcao"
          :label="t('form.hub')"
          :hint="t('form.hubHelp')"
          :error="problem('hubIcao')"
          :messages="picker"
        />
        <div class="sm:col-span-2">
          <Textarea
            v-model="draft.description"
            :label="t('form.description')"
            :rows="4"
            :maxlength="2000"
          />
        </div>
        <div class="sm:col-span-2">
          <Button type="submit" :loading="busy">{{ t("form.submit") }}</Button>
        </div>
      </form>
    </Card>

    <section>
      <h2 class="text-title-3 mb-3 text-ink">{{ t("history.title") }}</h2>
      <DataTable
        :columns="columns"
        :rows="history"
        row-key="id"
        :empty="t('history.empty')"
        dense
      >
        <template #cell-submitted="{ row }">
          <span class="tabular-nums">{{ formatUtc(row.createdAt) }}</span>
        </template>
        <template #cell-airline="{ row }">
          <span class="font-mono">{{ row.icao }}</span>
          <span class="ml-2">{{ row.name }}</span>
        </template>
        <template #cell-hub="{ row }">
          <span class="font-mono">{{ row.hubIcao }}</span>
        </template>
        <template #cell-status="{ row }">
          <Badge :variant="STATUS_VARIANT[row.status]">
            {{ tc(`applicationStatus.${row.status}`) }}
          </Badge>
        </template>
        <template #cell-reason="{ row }">
          <span class="text-muted">{{ row.reason ?? tc("none") }}</span>
        </template>
      </DataTable>
    </section>
  </div>
</template>
