<script setup lang="ts">
import { reactive, ref } from "vue";
import { AlertBox, Button, Input } from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import AirportPicker from "./AirportPicker.vue";
import { va, type Aircraft, type AircraftType, type ApiResult } from "@/lib/va";
import { errorText } from "@/lib/errors";
import { formatCredits } from "@/lib/format";
const props = defineProps<{
  icao: string;
  hubs: string[];
  fleet: Aircraft[];
  types: AircraftType[];
  manage: boolean;
  locale: string;
  messages: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const t = createTranslator(props.messages),
  tc = createTranslator(props.common);
const tails = ref(props.fleet),
  busy = ref(false),
  error = ref("");
const form = reactive({
  registration: "",
  typeIcao: props.types[0]?.icao ?? "",
  tenure: "owned",
  hubIcao: props.hubs[0] ?? "",
  livery: "",
});
const selected = ref<Aircraft | null>(null),
  destination = ref(""),
  livery = ref("");
async function run(action: () => Promise<ApiResult<unknown>>, confirm = false) {
  if (busy.value) return;
  if (confirm && !window.confirm(t("financialConfirm"))) return;
  busy.value = true;
  error.value = "";
  try {
    const result = await action();
    if (!result.ok) {
      error.value = errorText(tc, result);
      return;
    }
    const fresh = await va.fleet(props.icao);
    if (fresh.ok) {
      tails.value = fresh.data.items;
      if (selected.value)
        selected.value =
          tails.value.find(
            (tail) => tail.id === selected.value?.id && tail.status !== "gone",
          ) ?? null;
    } else error.value = errorText(tc, fresh);
  } finally {
    busy.value = false;
  }
}
function choose(tail: Aircraft) {
  selected.value = tail;
  livery.value = tail.livery;
  destination.value = "";
}
function acquireAircraft() {
  return run(() => va.acquire(props.icao, form), true);
}
function saveLivery() {
  const tail = selected.value;
  if (!tail) return;
  return run(() => va.livery(props.icao, tail.id, livery.value));
}
function repositionAircraft() {
  const tail = selected.value;
  if (!tail) return;
  return run(() => va.reposition(props.icao, tail.id, destination.value), true);
}
function sellAircraft() {
  const tail = selected.value;
  if (!tail) return;
  return run(() => va.sell(props.icao, tail.id), true);
}
function returnAircraft() {
  const tail = selected.value;
  if (!tail) return;
  return run(() => va.returnLease(props.icao, tail.id), true);
}
</script>
<template>
  <div class="flex flex-col gap-6">
    <AlertBox v-if="error" variant="danger">{{ error }}</AlertBox>
    <p class="text-sm text-muted">{{ t("fleetHelp") }}</p>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr>
            <th>{{ t("registration") }}</th>
            <th>{{ t("type") }}</th>
            <th>{{ t("location") }}</th>
            <th>{{ t("status") }}</th>
            <th>{{ t("tenure") }}</th>
            <th>{{ t("hours") }}</th>
            <th v-if="manage">{{ t("actions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="tail in tails"
            :key="tail.id"
            class="border-t border-subtle"
          >
            <td class="py-3">{{ tail.registration }}</td>
            <td>{{ tail.typeIcao }}</td>
            <td>{{ tail.locationIcao }}</td>
            <td>{{ t("states." + tail.status) }}</td>
            <td>{{ t(tail.tenure) }}</td>
            <td>{{ (tail.hoursMs / 3600000).toFixed(1) }}</td>
            <td v-if="manage">
              <Button
                variant="ghost"
                :disabled="busy || tail.status === 'gone'"
                @click="choose(tail)"
                >{{ tc("edit") }}</Button
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!tails.length" class="text-muted">{{ t("empty") }}</p>
    <form
      v-if="manage"
      class="grid gap-4 sm:grid-cols-2"
      @submit.prevent="acquireAircraft"
    >
      <h2 class="text-lg font-semibold sm:col-span-2">{{ t("acquire") }}</h2>
      <Input
        v-model="form.registration"
        :label="t('registration')"
        required
      /><label class="grid gap-2 text-sm"
        >{{ t("type")
        }}<select
          v-model="form.typeIcao"
          class="rounded border border-subtle bg-surface p-2"
          required
        >
          <option v-for="type in types" :key="type.icao" :value="type.icao">
            {{ type.icao }} · {{ type.name }} ·
            {{ formatCredits(type.price, locale) }} /
            {{ formatCredits(type.leasePerDay, locale) }} {{ t("daily") }}
          </option>
        </select></label
      ><label class="grid gap-2 text-sm"
        >{{ t("tenure")
        }}<select
          v-model="form.tenure"
          class="rounded border border-subtle bg-surface p-2"
        >
          <option value="owned">{{ t("owned") }}</option>
          <option value="leased">{{ t("leased") }}</option>
        </select></label
      ><label class="grid gap-2 text-sm"
        >{{ t("hub")
        }}<select
          v-model="form.hubIcao"
          class="rounded border border-subtle bg-surface p-2"
          required
        >
          <option v-for="hub in hubs" :key="hub">{{ hub }}</option>
        </select></label
      ><Input v-model="form.livery" :label="t('livery')" />
      <div class="sm:col-span-2">
        <Button type="submit" :disabled="busy || !types.length">{{
          t("acquire")
        }}</Button>
      </div>
    </form>
    <section
      v-if="selected && manage"
      class="grid gap-4 border-t border-subtle pt-6 sm:grid-cols-2"
    >
      <h2 class="text-lg font-semibold sm:col-span-2">
        {{ selected.registration }}
      </h2>
      <form class="grid gap-3" @submit.prevent="saveLivery">
        <Input v-model="livery" :label="t('livery')" /><Button
          type="submit"
          :disabled="busy"
          >{{ tc("save") }}</Button
        >
      </form>
      <form class="grid gap-3" @submit.prevent="repositionAircraft">
        <AirportPicker
          v-model="destination"
          :label="t('destination')"
          :messages="common"
          required
        /><Button
          type="submit"
          :disabled="busy || selected.status !== 'available'"
          >{{ t("reposition") }}</Button
        >
      </form>
      <Button
        v-if="selected.tenure === 'owned'"
        :disabled="busy || selected.status !== 'available'"
        @click="sellAircraft"
        >{{ t("sell") }}</Button
      ><Button
        v-else
        :disabled="busy || selected.status !== 'available'"
        @click="returnAircraft"
        >{{ t("returnLease") }}</Button
      >
    </section>
  </div>
</template>
