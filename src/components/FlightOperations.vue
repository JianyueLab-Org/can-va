<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { AlertBox, Button, Input } from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import AirportPicker from "./AirportPicker.vue";
import RecordingEvidence from "./RecordingEvidence.vue";
import {
  va,
  type Aircraft,
  type Route,
  type Booking,
  type BookingInput,
  type Pirep,
  type Page,
  type PilotProfile,
  type Rank,
  type Operations,
  type ApiResult,
} from "@/lib/va";
import { errorText } from "@/lib/errors";
import { formatUtc } from "@/lib/format";
import { availableAircraft, entitledTypes } from "@/lib/flightEligibility";
const props = defineProps<{
  icao?: string;
  username: string;
  location: string | null;
  fleet?: Aircraft[];
  routes?: Route[];
  ranks?: Rank[];
  profile?: PilotProfile | null;
  current: Booking | null;
  history: Page<Booking>;
  reports: Page<Pirep>;
  review?: boolean;
  manageFleet?: boolean;
  allowFree?: boolean;
  allowOffline?: boolean;
  detail?: Pirep | null;
  bookingDetail?: Booking | null;
  operations?: Operations | null;
  locale: string;
  messages: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const t = createTranslator(props.messages),
  tc = createTranslator(props.common),
  busy = ref(false),
  error = ref(""),
  notice = ref("");
const detailPage = computed(() => !!props.detail || !!props.bookingDetail);
const operations = ref(props.operations ?? null);
const current = ref(
    props.review ||
      props.detail ||
      (props.bookingDetail && props.current?.id !== props.bookingDetail.id)
      ? null
      : props.current,
  ),
  history = ref(props.history),
  reports = ref(props.reports),
  detail = ref(props.detail ?? null),
  bookingDetail = ref(props.bookingDetail ?? null);
const booking = reactive({
  aircraftId: "",
  routeId: "",
  kind: "scheduled" as Booking["kind"],
  arrIcao: "",
  callsign: "",
  username: "",
});
const report = reactive({
    blockOff: "",
    blockOn: "",
    fuelKg: "",
    remarks: "",
    declaredOnline: true,
    evidence: "",
  }),
  comment = ref("");
const pilot = ref(props.profile ?? null),
  tails = ref(props.fleet ?? []);
const pilotLocation = computed(
  () => pilot.value?.locationIcao ?? props.location,
);
let assignmentRequest = 0;
watch(
  () => [booking.kind, booking.username],
  async () => {
    const request = ++assignmentRequest;
    booking.aircraftId = "";
    error.value = "";
    if (booking.kind !== "ferry" || !booking.username.trim()) {
      pilot.value = props.profile ?? null;
      return;
    }
    pilot.value = null;
    const result = await va.profile(booking.username.trim());
    if (request !== assignmentRequest) return;
    if (result.ok) {
      pilot.value = result.data;
      error.value = "";
    } else error.value = errorText(tc, result);
  },
);
watch(
  () => booking.routeId,
  () => {
    booking.aircraftId = "";
  },
);
const membership = computed(() =>
  pilot.value?.memberships.find((m) => m.airline.icao === props.icao),
);
const eligibleTypes = computed(() =>
  entitledTypes(props.ranks ?? [], membership.value?.rank ?? null),
);
const eligible = computed(() =>
  availableAircraft(
    tails.value,
    pilotLocation.value,
    eligibleTypes.value,
    booking.kind === "scheduled"
      ? ((props.routes ?? []).find(
          (route) => route.id === Number(booking.routeId),
        ) ?? null)
      : undefined,
  ),
);
async function run(action: () => Promise<ApiResult<unknown>>, confirm = false) {
  if (busy.value) return;
  if (confirm && !window.confirm(t("financialConfirm"))) return;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    const result = await action();
    if (!result.ok) {
      error.value = errorText(tc, result);
      return;
    }
    notice.value = t("saved");
    const [active, all, own, summary] = await Promise.all([
      va.currentBooking(),
      va.bookings(),
      props.review && props.icao ? va.pireps(props.icao) : va.myPireps(),
      props.review && props.icao ? va.operations(props.icao) : null,
    ]);
    if (active.ok)
      current.value =
        props.review ||
        props.detail ||
        (props.bookingDetail && active.data?.id !== props.bookingDetail.id)
          ? null
          : active.data;
    else error.value = errorText(tc, active);
    if (all.ok) history.value = all.data;
    else error.value = errorText(tc, all);
    if (own.ok) reports.value = own.data;
    else error.value = errorText(tc, own);
    if (summary) {
      if (summary.ok) operations.value = summary.data;
      else {
        operations.value = null;
        error.value = errorText(tc, summary);
      }
    }
    if (bookingDetail.value) {
      const fresh = await va.booking(bookingDetail.value.id);
      if (fresh.ok) bookingDetail.value = fresh.data;
      else error.value = errorText(tc, fresh);
    }
    if (props.icao) {
      const [updatedFleet, updatedPilot] = await Promise.all([
        va.fleet(props.icao),
        va.profile(
          booking.kind === "ferry" && booking.username.trim()
            ? booking.username.trim()
            : props.username,
        ),
      ]);
      if (updatedFleet.ok) tails.value = updatedFleet.data.items;
      else error.value = errorText(tc, updatedFleet);
      if (updatedPilot.ok) pilot.value = updatedPilot.data;
      else error.value = errorText(tc, updatedPilot);
    }
    booking.aircraftId = "";
  } finally {
    busy.value = false;
  }
}
async function book() {
  if (!props.icao || busy.value) return;
  if (!eligible.value.some((tail) => tail.id === Number(booking.aircraftId))) {
    error.value = t("noEligible");
    return;
  }
  const input: BookingInput = {
    aircraftId: Number(booking.aircraftId),
    kind: booking.kind,
  };
  if (booking.kind === "scheduled") input.routeId = Number(booking.routeId);
  else {
    input.arrIcao = booking.arrIcao;
    input.callsign = booking.callsign;
  }
  if (booking.kind === "ferry" && booking.username.trim())
    input.username = booking.username.trim();
  await run(async () => {
    const result = await va.book(props.icao!, input);
    if (result.ok && result.data.username !== props.username)
      bookingDetail.value = result.data;
    return result;
  });
}
async function file() {
  if (!current.value || busy.value) return;
  const off = new Date(report.blockOff + "Z"),
    on = new Date(report.blockOn + "Z");
  if (
    !Number.isFinite(off.getTime()) ||
    !Number.isFinite(on.getTime()) ||
    on <= off ||
    !Number.isFinite(Number(report.fuelKg)) ||
    Number(report.fuelKg) < 0
  ) {
    error.value = t("invalidReport");
    return;
  }
  await run(
    () =>
      va.filePirep(current.value!.id, {
        ...report,
        blockOff: off.toISOString(),
        blockOn: on.toISOString(),
        fuelKg: Number(report.fuelKg),
      }),
    true,
  );
}
async function openReport(id: number) {
  if (busy.value) return;
  comment.value = "";
  error.value = "";
  detail.value = null;
  busy.value = true;
  try {
    const r = await va.pirep(id);
    if (r.ok) detail.value = r.data;
    else error.value = errorText(tc, r);
  } finally {
    busy.value = false;
  }
}
async function submitReview(approve: boolean) {
  if (
    !detail.value ||
    detail.value.username === props.username ||
    (!approve && !comment.value.trim())
  )
    return;
  const id = detail.value.id;
  await run(async () => {
    const result = approve
      ? await va.approvePirep(id)
      : await va.rejectPirep(id, comment.value);
    if (result.ok) comment.value = "";
    return result;
  }, true);
  const refreshed = await va.pirep(id);
  if (refreshed.ok) detail.value = refreshed.data;
  else {
    detail.value = null;
    error.value = errorText(tc, refreshed);
  }
}
async function more(kind: "bookings" | "reports") {
  if (busy.value) return;
  const target = kind === "bookings" ? history : reports;
  if (target.value.next === null) return;
  busy.value = true;
  try {
    if (kind === "bookings") {
      const r = await va.bookings(history.value.next);
      if (r.ok)
        history.value = {
          items: [...history.value.items, ...r.data.items],
          next: r.data.next,
        };
      else error.value = errorText(tc, r);
    } else {
      const r =
        props.review && props.icao
          ? await va.pireps(props.icao, reports.value.next)
          : await va.myPireps(reports.value.next);
      if (r.ok)
        reports.value = {
          items: [...reports.value.items, ...r.data.items],
          next: r.data.next,
        };
      else error.value = errorText(tc, r);
    }
  } finally {
    busy.value = false;
  }
}
function cancelBooking(id: number) {
  return run(() => va.cancelBooking(id), true);
}
</script>
<template>
  <div class="flex flex-col gap-6">
    <AlertBox v-if="error" variant="danger">{{ error }}</AlertBox
    ><AlertBox v-if="notice" variant="success">{{ notice }}</AlertBox>
    <section v-if="operations" class="grid gap-2">
      <p v-if="review">
        {{ t("pendingCount") }}: {{ operations.pendingCount }} ·
        {{ t("oldest") }}:
        {{
          operations.oldestPendingAt
            ? formatUtc(operations.oldestPendingAt)
            : tc("none")
        }}
      </p>
      <AlertBox v-if="operations.restructureDeadline" variant="warning"
        >{{ t("restructureDeadline") }}:
        {{ formatUtc(operations.restructureDeadline) }}</AlertBox
      >
    </section>
    <section v-if="bookingDetail" class="grid gap-2">
      <h2 class="text-lg font-semibold">{{ bookingDetail.callsign }}</h2>
      <p>
        {{ bookingDetail.username }} · {{ bookingDetail.registration }} ·
        {{ bookingDetail.depIcao }} → {{ bookingDetail.arrIcao }}
      </p>
      <p>
        {{ t("states." + bookingDetail.status) }} ·
        {{ formatUtc(bookingDetail.expiresAt) }}
      </p>
      <Button
        v-if="
          bookingDetail.status === 'active' &&
          (bookingDetail.username === username || manageFleet)
        "
        :disabled="busy"
        @click="cancelBooking(bookingDetail.id)"
        >{{ t("cancelBooking") }}</Button
      >
    </section>
    <section v-if="current" class="grid gap-3">
      <h2 class="text-lg font-semibold">
        {{ t("currentFlight") }} · {{ current.callsign }}
      </h2>
      <p>
        {{ current.registration }} · {{ current.depIcao }} →
        {{ current.arrIcao }} · {{ current.distanceNm }} nm · {{ current.pax }}
        {{ t("pax") }} · {{ current.cargoKg }} kg
      </p>
      <p>{{ t("expires") }}: {{ formatUtc(current.expiresAt) }}</p>
      <Button :disabled="busy" @click="cancelBooking(current.id)">{{
        t("cancelBooking")
      }}</Button>
      <form
        class="grid gap-4 border-t border-subtle pt-4 sm:grid-cols-2"
        @submit.prevent="file"
      >
        <h3 class="font-semibold sm:col-span-2">{{ t("fileReport") }}</h3>
        <Input
          v-model="report.blockOff"
          type="datetime-local"
          :label="t('blockOff')"
          required
        /><Input
          v-model="report.blockOn"
          type="datetime-local"
          :label="t('blockOn')"
          required
        /><Input
          v-model="report.fuelKg"
          type="number"
          :label="t('fuel')"
          required
        /><Input v-model="report.remarks" :label="t('remarks')" /><label
          class="flex gap-2 text-sm"
          ><input
            v-model="report.declaredOnline"
            type="checkbox"
            :disabled="allowOffline === false"
          />{{ t("online") }}</label
        ><Input
          v-model="report.evidence"
          :label="t('evidence')"
          :required="!report.declaredOnline"
        />
        <p class="text-sm text-muted sm:col-span-2">{{ t("filingHelp") }}</p>
        <Button type="submit" :disabled="busy">{{ t("fileReport") }}</Button>
      </form>
    </section>
    <form
      v-if="icao && fleet && !review && (!current || manageFleet)"
      class="grid gap-4 sm:grid-cols-2"
      @submit.prevent="book"
    >
      <h2 class="text-lg font-semibold sm:col-span-2">{{ t("bookFlight") }}</h2>
      <p class="text-sm text-muted sm:col-span-2">
        {{ t("rankHelp") }} {{ membership?.rank?.name ?? tc("none") }} ·
        {{ eligibleTypes.join(", ") || tc("none") }} · {{ t("location") }}:
        {{ pilotLocation ?? tc("none") }}
      </p>
      <label class="grid gap-2 text-sm"
        >{{ t("kind")
        }}<select
          v-model="booking.kind"
          class="rounded border border-subtle bg-surface p-2"
        >
          <option value="scheduled">{{ t("scheduled") }}</option>
          <option v-if="allowFree" value="free">{{ t("free") }}</option>
          <option v-if="manageFleet" value="ferry">{{ t("ferry") }}</option>
        </select></label
      ><label v-if="booking.kind === 'scheduled'" class="grid gap-2 text-sm"
        >{{ t("route")
        }}<select
          v-model="booking.routeId"
          class="rounded border border-subtle bg-surface p-2"
          required
        >
          <option value="" disabled>{{ t("select") }}</option>
          <option
            v-for="route in (routes ?? []).filter(
              (r) => r.active && r.depIcao === pilotLocation,
            )"
            :key="route.id"
            :value="String(route.id)"
          >
            {{ icao }}{{ route.flightNumber }} · {{ route.depIcao }} →
            {{ route.arrIcao }} · {{ route.typeIcaos.join(", ") }}
          </option>
        </select></label
      ><label class="grid gap-2 text-sm"
        >{{ t("aircraft")
        }}<select
          v-model="booking.aircraftId"
          class="rounded border border-subtle bg-surface p-2"
          required
        >
          <option value="" disabled>{{ t("select") }}</option>
          <option
            v-for="tail in eligible"
            :key="tail.id"
            :value="String(tail.id)"
          >
            {{ tail.registration }} · {{ tail.typeIcao }} ·
            {{ tail.locationIcao }}
          </option>
        </select></label
      ><template v-if="booking.kind !== 'scheduled'"
        ><AirportPicker
          v-model="booking.arrIcao"
          :label="t('destination')"
          :messages="common"
          required /><Input
          v-model="booking.callsign"
          :label="t('callsign')"
          :hint="t('callsignHelp')"
          required /></template
      ><Input
        v-if="booking.kind === 'ferry' && manageFleet"
        v-model="booking.username"
        :label="t('assignedPilot')"
        :hint="t('assignmentHelp')"
      />
      <p v-if="!eligible.length" class="text-sm text-muted sm:col-span-2">
        {{ t("noEligible") }}
      </p>
      <Button
        type="submit"
        :disabled="
          busy ||
          !eligible.length ||
          (!!current &&
            !(
              booking.kind === 'ferry' &&
              booking.username.trim() &&
              booking.username.trim() !== username
            ))
        "
        >{{ t("bookFlight") }}</Button
      >
    </form>
    <section v-if="!detailPage" class="grid gap-3">
      <h2 class="text-lg font-semibold">
        {{ review ? t("reviewQueue") : t("reports") }}
      </h2>
      <p v-if="!reports.items.length" class="text-muted">{{ t("empty") }}</p>
      <div
        v-for="item in reports.items"
        :key="item.id"
        class="flex flex-wrap items-center justify-between gap-3 border-b border-subtle py-3"
      >
        <div>
          <a
            :href="'/pilots/' + encodeURIComponent(item.username)"
            class="underline"
            >{{ item.username }}</a
          >
          · {{ item.callsign }} · {{ item.depIcao }} → {{ item.arrIcao }} ·
          {{ t("states." + item.status) }}
          <p class="text-sm text-muted">{{ formatUtc(item.createdAt) }}</p>
        </div>
        <Button variant="ghost" :disabled="busy" @click="openReport(item.id)">{{
          t("viewReport")
        }}</Button>
      </div>
      <Button
        v-if="reports.next !== null"
        :disabled="busy"
        @click="more('reports')"
        >{{ tc("loadMore") }}</Button
      >
    </section>
    <section v-if="detail" class="grid gap-3 border border-subtle p-4">
      <h2 class="text-lg font-semibold">
        {{ detail.callsign }} · {{ t("states." + detail.status) }}
      </h2>
      <p>
        {{ detail.username }} · {{ detail.registration }} ·
        {{ detail.depIcao }} → {{ detail.arrIcao }}
      </p>
      <p>
        {{ t("blockOff") }}: {{ formatUtc(detail.blockOff) }} ·
        {{ t("blockOn") }}: {{ formatUtc(detail.blockOn) }}
      </p>
      <p>
        {{ t("fuel") }}: {{ detail.fuelKg }} kg ·
        {{ t(detail.declaredOnline ? "online" : "offline") }}
      </p>
      <p class="whitespace-pre-wrap">
        {{ t("remarks") }}: {{ detail.remarks }}
      </p>
      <p class="whitespace-pre-wrap break-words">
        {{ t("evidence") }}: {{ detail.evidence }}
      </p>
      <ul v-if="detail.flags.length" class="list-inside list-disc">
        <li v-for="flag in detail.flags" :key="flag">
          {{ t("flags." + flag) }}
        </li>
      </ul>
      <RecordingEvidence
        v-if="detail.recordingId"
        :key="detail.recordingId"
        :recording-id="detail.recordingId"
        :messages="messages"
        :common="common"
        @denied="
          detail = null;
          error = t('recording.noAccess');
        "
      />
      <p v-if="detail.reviewedBy">
        {{ t("reviewedBy") }}: {{ detail.reviewedBy }} ·
        {{ detail.reviewComment }}
      </p>
      <details>
        <summary>{{ t("settlement") }}</summary>
        <dl class="grid grid-cols-2 gap-2 text-sm">
          <template v-for="(value, key) in detail.params" :key="key"
            ><dt>{{ key }}</dt>
            <dd>{{ value }}</dd></template
          >
        </dl>
      </details>
      <template v-if="review && detail.status === 'pending'"
        ><AlertBox v-if="detail.username === username" variant="warning">{{
          t("selfReview")
        }}</AlertBox
        ><template v-else
          ><Input v-model="comment" :label="t('reviewComment')" />
          <div class="flex flex-wrap gap-2">
            <Button :disabled="busy" @click="submitReview(true)">{{
              t("approve")
            }}</Button
            ><Button
              :disabled="busy || !comment.trim()"
              @click="submitReview(false)"
              >{{ t("reject") }}</Button
            >
          </div></template
        ></template
      >
    </section>
    <section v-if="!review && !detailPage" class="grid gap-3">
      <h2 class="text-lg font-semibold">{{ t("bookingHistory") }}</h2>
      <p v-if="!history.items.length" class="text-muted">{{ t("empty") }}</p>
      <div
        v-for="item in history.items"
        :key="item.id"
        class="flex flex-wrap justify-between gap-2 border-b border-subtle py-3"
      >
        <a :href="'/bookings/' + item.id" class="underline"
          >{{ item.callsign }} · {{ item.registration }} · {{ item.depIcao }} →
          {{ item.arrIcao }}</a
        ><span
          >{{ t("states." + item.status) }} ·
          {{ formatUtc(item.createdAt) }}</span
        ><Button
          v-if="item.status === 'active'"
          :disabled="busy"
          @click="cancelBooking(item.id)"
          >{{ t("cancelBooking") }}</Button
        >
      </div>
      <Button
        v-if="history.next !== null"
        :disabled="busy"
        @click="more('bookings')"
        >{{ tc("loadMore") }}</Button
      >
    </section>
  </div>
</template>
