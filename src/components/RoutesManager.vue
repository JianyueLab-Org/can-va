<script setup lang="ts">
import { reactive, ref } from "vue";
import { AlertBox, Button, Input } from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import AirportPicker from "./AirportPicker.vue";
import { va, type Route, type AircraftType } from "@/lib/va";
import { errorText } from "@/lib/errors";
import { changedRouteFields } from "@/lib/routePatch";
const props = defineProps<{
  icao: string;
  routes: Route[];
  types: AircraftType[];
  manage: boolean;
  messages: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const t = createTranslator(props.messages),
  tc = createTranslator(props.common),
  rows = ref(props.routes),
  busy = ref(false),
  error = ref("");
const editing = ref<Route | null>(null),
  form = reactive({
    flightNumber: "",
    depIcao: "",
    arrIcao: "",
    typeIcaos: [] as string[],
    active: true,
  });
function edit(route?: Route) {
  editing.value = route ? { ...route, typeIcaos: [...route.typeIcaos] } : null;
  Object.assign(form, {
    flightNumber: route?.flightNumber ?? "",
    depIcao: route?.depIcao ?? "",
    arrIcao: route?.arrIcao ?? "",
    typeIcaos: [...(route?.typeIcaos ?? [])],
    active: route?.active ?? true,
  });
}
async function save() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    const patch = editing.value
      ? changedRouteFields(editing.value, form)
      : form;
    if (editing.value && Object.keys(patch).length === 0) {
      edit();
      return;
    }
    const r =
      editing.value === null
        ? await va.createRoute(props.icao, form)
        : await va.updateRoute(props.icao, editing.value.id, patch);
    if (!r.ok) {
      error.value = errorText(tc, r);
      return;
    }
    const all = await va.routes(props.icao);
    if (all.ok) rows.value = all.data.items;
    else error.value = errorText(tc, all);
    edit();
  } finally {
    busy.value = false;
  }
}
async function remove(route: Route) {
  if (busy.value || !window.confirm(t("deactivateConfirm"))) return;
  busy.value = true;
  try {
    const r = await va.deleteRoute(props.icao, route.id);
    if (!r.ok) error.value = errorText(tc, r);
    else route.active = false;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="flex flex-col gap-6">
    <AlertBox v-if="error" variant="danger">{{ error }}</AlertBox>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr>
            <th>{{ t("flightNumber") }}</th>
            <th>{{ t("departure") }}</th>
            <th>{{ t("destination") }}</th>
            <th>{{ t("distance") }}</th>
            <th>{{ t("types") }}</th>
            <th>{{ t("status") }}</th>
            <th v-if="manage">{{ t("actions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="route in rows"
            :key="route.id"
            class="border-t border-subtle"
          >
            <td class="py-3">{{ icao }}{{ route.flightNumber }}</td>
            <td>{{ route.depIcao }}</td>
            <td>{{ route.arrIcao }}</td>
            <td>{{ route.distanceNm }} nm</td>
            <td>{{ route.typeIcaos.join(", ") }}</td>
            <td>{{ t(route.active ? "active" : "inactive") }}</td>
            <td v-if="manage">
              <Button variant="ghost" :disabled="busy" @click="edit(route)">{{
                tc("edit")
              }}</Button
              ><Button
                v-if="route.active"
                variant="ghost"
                :disabled="busy"
                @click="remove(route)"
                >{{ t("deactivate") }}</Button
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!rows.length" class="text-muted">{{ t("empty") }}</p>
    <form
      v-if="manage"
      class="grid gap-4 sm:grid-cols-2"
      @submit.prevent="save"
    >
      <h2 class="text-lg font-semibold sm:col-span-2">
        {{ editing === null ? t("createRoute") : tc("edit") }}
      </h2>
      <Input
        v-model="form.flightNumber"
        :label="t('flightNumber')"
        required
      /><AirportPicker
        v-model="form.depIcao"
        :label="t('departure')"
        :messages="common"
        required
      /><AirportPicker
        v-model="form.arrIcao"
        :label="t('destination')"
        :messages="common"
        required
      />
      <fieldset class="grid gap-2">
        <legend>{{ t("types") }}</legend>
        <label
          v-for="type in types"
          :key="type.icao"
          class="flex items-center gap-2 text-sm"
          ><input
            v-model="form.typeIcaos"
            type="checkbox"
            :value="type.icao"
          />{{ type.icao }} · {{ type.name }}</label
        >
      </fieldset>
      <label class="flex items-center gap-2 text-sm"
        ><input v-model="form.active" type="checkbox" />{{ t("active") }}</label
      >
      <div class="flex gap-2 sm:col-span-2">
        <Button type="submit" :disabled="busy || !form.typeIcaos.length">{{
          tc("save")
        }}</Button
        ><Button
          v-if="editing !== null"
          variant="ghost"
          :disabled="busy"
          @click="edit()"
          >{{ tc("cancel") }}</Button
        >
      </div>
    </form>
  </div>
</template>
