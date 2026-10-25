<script setup lang="ts">
/**
 * 等级：名称、排位、最少小时、最少航段、时薪。人人看得到；`ranks.manage` 才能改。
 * 时薪在接口里是最小单位（1/100 credit），输入框里是 credit。最后一个等级删不掉
 * （上游 409 `last_rank`）。Phase 1 的等级还没有机型。
 */
import { computed, reactive, ref } from "vue";
import {
  AlertBox,
  Button,
  DataTable,
  Dialog,
  Input,
} from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import { va, type Rank, type RankInput } from "@/lib/va";
import { errorText } from "@/lib/errors";
import { formatCredits, parseCredits, wholeNumber } from "@/lib/format";

const props = defineProps<{
  icao: string;
  locale: string;
  canManage: boolean;
  ranks: Rank[];
  messages: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const t = createTranslator(props.messages);
const tc = createTranslator(props.common);

const ranks = ref<Rank[]>(props.ranks);
const sorted = computed(() =>
  [...ranks.value].sort((a, b) => a.position - b.position),
);

const busy = ref(false);
const error = ref("");
const notice = ref("");
const editorOpen = ref(false);
const editor = reactive({
  id: null as number | null,
  name: "",
  position: "",
  minHours: "",
  minFlights: "",
  payPerHr: "",
});
const deleting = ref<Rank | null>(null);
const deleteOpen = computed({
  get: () => deleting.value !== null,
  set: (open: boolean) => {
    if (!open) deleting.value = null;
  },
});

const columns = [
  { key: "name", label: t("columns.name") },
  { key: "position", label: t("columns.position"), align: "right" as const },
  { key: "minHours", label: t("columns.minHours"), align: "right" as const },
  {
    key: "minFlights",
    label: t("columns.minFlights"),
    align: "right" as const,
  },
  { key: "payPerHr", label: t("columns.payPerHr"), align: "right" as const },
  ...(props.canManage ? [{ key: "actions", label: "" }] : []),
];

function openCreate(): void {
  Object.assign(editor, {
    id: null,
    name: "",
    position: String(
      ranks.value.reduce((top, r) => Math.max(top, r.position), 0) + 1,
    ),
    minHours: "0",
    minFlights: "0",
    payPerHr: "",
  });
  editorOpen.value = true;
}

function openEdit(rank: Rank): void {
  Object.assign(editor, {
    id: rank.id,
    name: rank.name,
    position: String(rank.position),
    minHours: String(rank.minHours),
    minFlights: String(rank.minFlights),
    payPerHr: (rank.payPerHr / 100).toFixed(2),
  });
  editorOpen.value = true;
}

function readEditor(): RankInput | null {
  const position = wholeNumber(editor.position);
  const minHours = wholeNumber(editor.minHours);
  const minFlights = wholeNumber(editor.minFlights);
  const payPerHr = parseCredits(editor.payPerHr);
  const name = editor.name.trim();
  if (
    !name ||
    position === null ||
    minHours === null ||
    minFlights === null ||
    payPerHr === null
  ) {
    return null;
  }
  return { name, position, minHours, minFlights, payPerHr };
}

async function reload(): Promise<void> {
  const result = await va.ranks(props.icao);
  if (result.ok) ranks.value = result.data.items;
}

async function saveRank(): Promise<void> {
  error.value = "";
  notice.value = "";
  const input = readEditor();
  if (!input) {
    error.value = t("form.invalid");
    return;
  }
  busy.value = true;
  const result =
    editor.id === null
      ? await va.createRank(props.icao, input)
      : await va.updateRank(props.icao, editor.id, input);
  busy.value = false;
  if (!result.ok) {
    error.value = errorText(tc, result);
    return;
  }
  editorOpen.value = false;
  notice.value = t(editor.id === null ? "created" : "saved", {
    name: result.data.name,
  });
  await reload();
}

async function removeRank(): Promise<void> {
  const rank = deleting.value;
  if (!rank) return;
  error.value = "";
  notice.value = "";
  busy.value = true;
  const result = await va.deleteRank(props.icao, rank.id);
  busy.value = false;
  deleting.value = null;
  if (!result.ok) {
    error.value = errorText(tc, result);
    return;
  }
  notice.value = t("deleted", { name: rank.name });
  await reload();
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <AlertBox v-if="notice" variant="success">{{ notice }}</AlertBox>
    <AlertBox v-if="error" variant="danger">{{ error }}</AlertBox>

    <div v-if="canManage">
      <Button @click="openCreate">{{ t("form.createTitle") }}</Button>
    </div>

    <DataTable
      :columns="columns"
      :rows="sorted"
      row-key="id"
      :empty="t('empty')"
      dense
    >
      <template #cell-name="{ row }">
        <span class="font-medium text-ink">{{ row.name }}</span>
      </template>
      <template #cell-position="{ row }">
        <span class="tabular-nums">{{ row.position }}</span>
      </template>
      <template #cell-minHours="{ row }">
        <span class="tabular-nums">{{ row.minHours }}</span>
      </template>
      <template #cell-minFlights="{ row }">
        <span class="tabular-nums">{{ row.minFlights }}</span>
      </template>
      <template #cell-payPerHr="{ row }">
        <span class="tabular-nums">{{
          formatCredits(row.payPerHr, locale)
        }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-2">
          <Button size="sm" variant="secondary" @click="openEdit(row)">
            {{ tc("edit") }}
          </Button>
          <Button size="sm" variant="danger" @click="deleting = row">
            {{ tc("delete") }}
          </Button>
        </div>
      </template>
    </DataTable>

    <Dialog
      v-model:open="editorOpen"
      :title="editor.id === null ? t('form.createTitle') : t('form.editTitle')"
    >
      <form
        id="rank-editor"
        class="grid gap-4 sm:grid-cols-2"
        @submit.prevent="saveRank"
      >
        <div class="sm:col-span-2">
          <Input
            v-model="editor.name"
            :label="t('form.name')"
            :maxlength="40"
            required
          />
        </div>
        <Input
          v-model="editor.position"
          :label="t('form.position')"
          inputmode="numeric"
          required
        />
        <Input
          v-model="editor.payPerHr"
          :label="t('form.payPerHr')"
          :hint="t('form.payHelp')"
          inputmode="decimal"
          required
        />
        <Input
          v-model="editor.minHours"
          :label="t('form.minHours')"
          inputmode="numeric"
          required
        />
        <Input
          v-model="editor.minFlights"
          :label="t('form.minFlights')"
          inputmode="numeric"
          required
        />
      </form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button variant="secondary" @click="editorOpen = false">
            {{ tc("cancel") }}
          </Button>
          <Button type="submit" form="rank-editor" :loading="busy">
            {{ editor.id === null ? t("form.create") : t("form.save") }}
          </Button>
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:open="deleteOpen"
      :title="t('deleteTitle', { name: deleting?.name ?? '' })"
      :description="t('deleteBody')"
      size="sm"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button variant="secondary" @click="deleting = null">
            {{ tc("cancel") }}
          </Button>
          <Button variant="danger" :loading="busy" @click="removeRank">
            {{ tc("delete") }}
          </Button>
        </div>
      </template>
    </Dialog>
  </div>
</template>
