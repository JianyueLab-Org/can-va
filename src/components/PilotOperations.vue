<script setup lang="ts">
import { ref } from "vue";
import { AlertBox, Button } from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import AirportPicker from "./AirportPicker.vue";
import {
  va,
  type PilotProfile,
  type LedgerPage,
  type LeaderboardEntry,
} from "@/lib/va";
import { errorText } from "@/lib/errors";
import { formatCredits, formatUtc } from "@/lib/format";
const props = defineProps<{
  mode: "wallet" | "profile" | "leaderboards";
  profile?: PilotProfile | null;
  wallet?: LedgerPage | null;
  entries?: LeaderboardEntry[];
  username: string;
  locale: string;
  messages: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const t = createTranslator(props.messages),
  tc = createTranslator(props.common),
  profile = ref(props.profile),
  wallet = ref(props.wallet),
  entries = ref(props.entries ?? []),
  busy = ref(false),
  error = ref(""),
  destination = ref(""),
  metric = ref<"hours" | "flights">("hours"),
  period = ref<"month" | "all">("month");
async function move(free: boolean) {
  if (busy.value || !window.confirm(t("financialConfirm"))) return;
  busy.value = true;
  error.value = "";
  try {
    const r = free
      ? await va.freeReturn()
      : await va.jumpseat(destination.value);
    if (!r.ok) {
      error.value = errorText(tc, r);
      return;
    }
    const [p, w] = await Promise.all([va.profile(props.username), va.wallet()]);
    if (p.ok) profile.value = p.data;
    else error.value = errorText(tc, p);
    if (w.ok) wallet.value = w.data;
    else error.value = errorText(tc, w);
  } finally {
    busy.value = false;
  }
}
async function more() {
  if (busy.value || !wallet.value || wallet.value.next === null) return;
  busy.value = true;
  try {
    const r = await va.wallet(wallet.value.next);
    if (r.ok)
      wallet.value = {
        ...r.data,
        items: [...wallet.value.items, ...r.data.items],
      };
    else error.value = errorText(tc, r);
  } finally {
    busy.value = false;
  }
}
async function load() {
  if (busy.value) return;
  busy.value = true;
  try {
    const r = await va.leaderboards(metric.value, period.value);
    if (r.ok) entries.value = r.data.items;
    else error.value = errorText(tc, r);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="flex flex-col gap-6">
    <AlertBox v-if="error" variant="danger">{{ error }}</AlertBox>
    <template v-if="mode === 'wallet'"
      ><p>
        {{ t("location") }}: {{ profile?.locationIcao ?? tc("none") }} ·
        {{ t("balance") }}: {{ formatCredits(wallet?.balance ?? 0, locale) }}
      </p>
      <p class="max-w-2xl text-sm text-muted">{{ t("movementHelp") }}</p>
      <form class="grid max-w-lg gap-3" @submit.prevent="move(false)">
        <AirportPicker
          v-model="destination"
          :label="t('destination')"
          :messages="common"
          required
        />
        <div class="flex flex-wrap gap-3">
          <Button type="submit" :disabled="busy">{{ t("jumpseat") }}</Button
          ><Button :disabled="busy" @click="move(true)">{{
            t("freeReturn")
          }}</Button>
        </div>
      </form>
      <h2 class="text-lg font-semibold">{{ t("wallet") }}</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr>
              <th>{{ t("date") }}</th>
              <th>{{ t("kind") }}</th>
              <th>{{ t("amount") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in wallet?.items ?? []"
              :key="entry.id"
              class="border-t border-subtle"
            >
              <td class="py-3">{{ formatUtc(entry.createdAt) }}</td>
              <td>{{ t("ledger." + entry.kind) }}</td>
              <td class="tabular-nums">
                {{ formatCredits(entry.amount, locale) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!wallet?.items.length" class="text-muted">{{ t("empty") }}</p>
      <Button v-if="wallet?.next != null" :disabled="busy" @click="more">{{
        tc("loadMore")
      }}</Button></template
    >
    <section v-if="mode === 'profile' && profile" class="grid gap-5">
      <h2 class="text-xl font-semibold">{{ profile.username }}</h2>
      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <dt>{{ t("location") }}</dt>
        <dd>{{ profile.locationIcao }}</dd>
        <dt>{{ t("hours") }}</dt>
        <dd>{{ (profile.hoursMs / 3600000).toFixed(1) }}</dd>
        <dt>{{ t("flights") }}</dt>
        <dd>{{ profile.flights }}</dd>
        <dt>{{ t("distance") }}</dt>
        <dd>{{ profile.distanceNm }} nm</dd>
        <dt>{{ t("airports") }}</dt>
        <dd>{{ profile.airportsVisited }}</dd>
        <dt>{{ t("airlinesFlown") }}</dt>
        <dd>{{ profile.airlinesFlown }}</dd>
        <dt>{{ t("primaryAirline") }}</dt>
        <dd>
          <a
            v-if="profile.primaryAirline"
            :href="'/airlines/' + profile.primaryAirline.icao"
            class="underline"
            >{{ profile.primaryAirline.name }}</a
          ><span v-else>{{ tc("none") }}</span>
        </dd>
      </dl>
      <h3 class="font-semibold">{{ t("memberships") }}</h3>
      <ul class="grid gap-2">
        <li
          v-for="membership in profile.memberships"
          :key="membership.airline.id"
        >
          <a :href="'/airlines/' + membership.airline.icao" class="underline">{{
            membership.airline.name
          }}</a>
          · {{ membership.rank?.name ?? tc("none") }}
        </li>
      </ul>
      <h3 class="font-semibold">{{ t("achievements") }}</h3>
      <p v-if="!profile.achievements.length" class="text-muted">
        {{ t("empty") }}
      </p>
      <ul class="grid gap-2">
        <li v-for="achievement in profile.achievements" :key="achievement.code">
          {{ t("achievementsList." + achievement.code) }} ·
          {{ formatUtc(achievement.awardedAt) }}
        </li>
      </ul>
    </section>
    <template v-if="mode === 'leaderboards'"
      ><form class="flex flex-wrap items-end gap-4" @submit.prevent="load">
        <label class="grid gap-2 text-sm"
          >{{ t("metric")
          }}<select
            v-model="metric"
            class="rounded border border-subtle bg-surface p-2"
          >
            <option value="hours">{{ t("hours") }}</option>
            <option value="flights">{{ t("flights") }}</option>
          </select></label
        ><label class="grid gap-2 text-sm"
          >{{ t("period")
          }}<select
            v-model="period"
            class="rounded border border-subtle bg-surface p-2"
          >
            <option value="month">{{ t("month") }}</option>
            <option value="all">{{ t("allTime") }}</option>
          </select></label
        ><Button type="submit" :disabled="busy">{{ t("show") }}</Button>
      </form>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr>
              <th>{{ t("pilot") }}</th>
              <th>{{ t("hours") }}</th>
              <th>{{ t("flights") }}</th>
              <th>{{ t("distance") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in entries"
              :key="entry.username"
              class="border-t border-subtle"
            >
              <td class="py-3">
                <a
                  :href="'/pilots/' + encodeURIComponent(entry.username)"
                  class="underline"
                  >{{ entry.username }}</a
                >
              </td>
              <td>{{ (entry.hoursMs / 3600000).toFixed(1) }}</td>
              <td>{{ entry.flights }}</td>
              <td>{{ entry.distanceNm }} nm</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!entries.length" class="text-muted">
        {{ t("empty") }}
      </p></template
    >
  </div>
</template>
