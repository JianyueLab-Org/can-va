<script setup lang="ts">
/**
 * 航司设置（`airline.edit`）：名称、简介、加入方式、两个开关；枢纽增删；所有者转让
 * （只有所有者看得到）。暂停的航司上游一律回 409 `airline_suspended`，原样显示。
 */
import { reactive, ref } from "vue";
import {
  AlertBox,
  Button,
  Card,
  Dialog,
  Input,
  Select,
  Textarea,
  Toggle,
} from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import AirportPicker from "@/components/AirportPicker.vue";
import { va, type Airline, type JoinMode } from "@/lib/va";
import { errorText } from "@/lib/errors";

const props = defineProps<{
  airline: Airline;
  isOwner: boolean;
  /** 可以接手的活跃成员（不含自己）。 */
  candidates: string[];
  messages: Record<string, unknown>;
  picker: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const t = createTranslator(props.messages);
const tc = createTranslator(props.common);

const icao = props.airline.icao;
const form = reactive({
  name: props.airline.name,
  description: props.airline.description,
  joinMode: props.airline.joinMode as JoinMode,
  allowOfflinePireps: props.airline.allowOfflinePireps,
  allowFreeFlights: props.airline.allowFreeFlights,
});
const hubs = ref<string[]>([...props.airline.hubs]);
const newHub = ref("");
const newOwner = ref(props.candidates[0] ?? "");
const confirmTransfer = ref(false);
const busy = ref<string | null>(null);
const error = ref("");
const notice = ref("");

const joinModes: JoinMode[] = ["open", "application", "invite"];
const joinModeOptions = joinModes.map((mode) => ({
  value: mode,
  label: tc(`joinMode.${mode}`),
}));
const ownerOptions = props.candidates.map((u) => ({ value: u, label: u }));

function begin(key: string): void {
  busy.value = key;
  error.value = "";
  notice.value = "";
}

async function save(): Promise<void> {
  begin("save");
  const result = await va.updateAirline(icao, {
    name: form.name.trim(),
    description: form.description.trim(),
    joinMode: form.joinMode,
    allowOfflinePireps: form.allowOfflinePireps,
    allowFreeFlights: form.allowFreeFlights,
  });
  busy.value = null;
  if (!result.ok) {
    error.value = errorText(tc, result);
    return;
  }
  form.name = result.data.name;
  form.description = result.data.description;
  notice.value = t("settings.saved");
}

async function addHub(): Promise<void> {
  const hub = newHub.value.trim().toUpperCase();
  if (!hub) return;
  begin("hub");
  const result = await va.addHub(icao, hub);
  busy.value = null;
  if (!result.ok) {
    error.value = errorText(tc, result);
    return;
  }
  hubs.value = result.data.hubs;
  newHub.value = "";
  notice.value = t("hubs.added", { icao: hub });
}

async function removeHub(hub: string): Promise<void> {
  begin(`hub:${hub}`);
  const result = await va.removeHub(icao, hub);
  busy.value = null;
  if (!result.ok) {
    error.value = errorText(tc, result);
    return;
  }
  hubs.value = result.data.hubs;
  notice.value = t("hubs.removed", { icao: hub });
}

async function transfer(): Promise<void> {
  begin("owner");
  const result = await va.transferOwner(icao, newOwner.value);
  busy.value = null;
  if (!result.ok) {
    confirmTransfer.value = false;
    error.value = errorText(tc, result);
    return;
  }
  // 转让后自己的权限变了，回概况页重新渲染。
  window.location.assign(`/airlines/${icao}`);
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <AlertBox v-if="notice" variant="success">{{ notice }}</AlertBox>
    <AlertBox v-if="error" variant="danger">{{ error }}</AlertBox>

    <Card :title="t('settings.title')">
      <form class="grid gap-4" @submit.prevent="save">
        <div class="grid gap-4 sm:grid-cols-2">
          <Input
            v-model="form.name"
            :label="t('settings.name')"
            :maxlength="80"
            required
          />
          <Select
            :model-value="form.joinMode"
            :options="joinModeOptions"
            :label="t('settings.joinMode')"
            @update:model-value="(v) => (form.joinMode = v as JoinMode)"
          />
        </div>
        <Textarea
          v-model="form.description"
          :label="t('settings.description')"
          :rows="5"
          :maxlength="2000"
        />
        <Toggle
          v-model="form.allowOfflinePireps"
          :label="t('settings.offline')"
          :description="t('settings.offlineHint')"
        />
        <Toggle
          v-model="form.allowFreeFlights"
          :label="t('settings.free')"
          :description="t('settings.freeHint')"
        />
        <div>
          <Button type="submit" :loading="busy === 'save'">
            {{ tc("save") }}
          </Button>
        </div>
      </form>
    </Card>

    <Card :title="t('hubs.title')" :subtitle="t('hubs.help')">
      <ul class="mb-4 flex flex-wrap gap-2">
        <li
          v-for="hub in hubs"
          :key="hub"
          class="flex items-center gap-2 rounded-control bg-surface-sunken py-1 pl-3 pr-1"
        >
          <span class="font-mono text-sm text-ink">{{ hub }}</span>
          <Button
            size="sm"
            variant="ghost"
            :loading="busy === `hub:${hub}`"
            :disabled="hubs.length === 1 || busy !== null"
            :label="`${t('hubs.remove')} ${hub}`"
            :title="hubs.length === 1 ? t('hubs.lastHub') : undefined"
            @click="removeHub(hub)"
          >
            {{ t("hubs.remove") }}
          </Button>
        </li>
      </ul>
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="addHub">
        <div class="w-full max-w-xs">
          <AirportPicker
            v-model="newHub"
            :label="t('hubs.add')"
            :messages="picker"
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          :loading="busy === 'hub'"
          :disabled="!newHub"
        >
          {{ t("hubs.add") }}
        </Button>
      </form>
    </Card>

    <Card v-if="isOwner" :title="t('owner.title')" :subtitle="t('owner.help')">
      <p v-if="candidates.length === 0" class="text-sm text-muted">
        {{ t("owner.noCandidates") }}
      </p>
      <div v-else class="flex flex-wrap items-end gap-3">
        <div class="w-full max-w-xs">
          <Select
            :model-value="newOwner"
            :options="ownerOptions"
            :label="t('owner.select')"
            @update:model-value="(v) => (newOwner = String(v))"
          />
        </div>
        <Button variant="danger" @click="confirmTransfer = true">
          {{ t("owner.transfer") }}
        </Button>
      </div>
    </Card>

    <Dialog
      v-model:open="confirmTransfer"
      :title="t('owner.confirmTitle')"
      :description="
        t('owner.confirmBody', { name: airline.name, username: newOwner })
      "
      :messages="common"
      size="sm"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button variant="secondary" @click="confirmTransfer = false">
            {{ tc("cancel") }}
          </Button>
          <Button
            variant="danger"
            :loading="busy === 'owner'"
            @click="transfer"
          >
            {{ t("owner.transfer") }}
          </Button>
        </div>
      </template>
    </Dialog>
  </div>
</template>
