<script setup lang="ts">
import {
  computed,
  onMounted,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from "vue";
import { AlertBox, Button } from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import { va, type Recording } from "@/lib/va";
import { evidenceFailure, trackHttpFailure } from "@/lib/recordingEvidence";
import { formatUtc } from "@/lib/format";
import {
  readTrack,
  projectTrack,
  type TrackPreview,
  TrackError,
} from "@/lib/recordingTrack";

const props = defineProps<{
  recordingId: string;
  messages: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const emit = defineEmits<{ denied: [] }>();
const t = createTranslator(props.messages),
  tc = createTranslator(props.common);
const recording = ref<Recording | null>(null),
  preview = shallowRef<TrackPreview | null>(null);
const busy = ref(false),
  error = ref("");
const plot = computed(() => projectTrack(preview.value?.points ?? []));
let controller: AbortController | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let revision = 0;

function clear() {
  ++revision;
  controller?.abort();
  controller = null;
  recording.value = null;
  preview.value = null;
  busy.value = false;
}
function failure(status: number, code: string, message = "") {
  const outcome = evidenceFailure(
    recording.value,
    { status, error: code, message },
    t,
    tc,
  );
  recording.value = outcome.recording;
  preview.value = null;
  error.value = outcome.message;
  if (outcome.denied) emit("denied");
}
async function refresh() {
  if (document.hidden || busy.value) return;
  const version = revision;
  const result = await va.recording(props.recordingId);
  if (version !== revision || document.hidden) return;
  if (result.ok) {
    recording.value = result.data;
    if (!result.data.rawAvailable) preview.value = null;
    error.value = "";
  } else failure(result.status, result.error, result.message);
}
async function loadTrack() {
  if (busy.value || !recording.value?.rawAvailable) return;
  busy.value = true;
  error.value = "";
  preview.value = null;
  const version = ++revision;
  controller?.abort();
  const request = (controller = new AbortController());
  try {
    // Reauthorize both before the stream and before revealing the resulting plot.
    const current = await va.recording(props.recordingId, request.signal);
    if (version !== revision) return;
    if (!current.ok)
      return failure(current.status, current.error, current.message);
    recording.value = current.data;
    if (!current.data.rawAvailable) return;
    const response = await fetch(va.recordingTrackUrl(props.recordingId), {
      credentials: "same-origin",
      cache: "no-store",
      signal: request.signal,
      headers: { Accept: "application/x-ndjson" },
    });
    if (version !== revision) {
      await response.body?.cancel();
      return;
    }
    if (!response.ok) {
      const result = await trackHttpFailure(response);
      if (version !== revision || document.hidden) return;
      return failure(result.status, result.error, result.message);
    }
    if (!response.body) throw new TrackError("track_invalid");
    const result = await readTrack(response.body);
    const authorized = await va.recording(props.recordingId, request.signal);
    if (version !== revision || document.hidden) return;
    if (!authorized.ok)
      return failure(authorized.status, authorized.error, authorized.message);
    recording.value = authorized.data;
    if (authorized.data.rawAvailable) preview.value = result;
  } catch (cause) {
    if (version !== revision || request.signal.aborted) return;
    error.value =
      cause instanceof TrackError
        ? tc("errors." + cause.message)
        : tc("errors.network");
  } finally {
    if (version === revision) busy.value = false;
  }
}
function visibility() {
  if (document.hidden) clear();
  else void refresh();
}
watch(
  () => props.recordingId,
  () => {
    clear();
    error.value = "";
    void refresh();
  },
);
onMounted(() => {
  void refresh();
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", clear);
  timer = setInterval(() => void refresh(), 30000);
});
onBeforeUnmount(() => {
  clear();
  clearInterval(timer);
  document.removeEventListener("visibilitychange", visibility);
  window.removeEventListener("pagehide", clear);
});
</script>

<template>
  <section
    class="grid min-w-0 gap-3"
    :aria-label="t('recording.title')"
    :aria-busy="busy"
  >
    <h3 class="font-semibold">{{ t("recording.title") }}</h3>
    <p class="text-sm text-muted">{{ t("recording.trust") }}</p>
    <AlertBox v-if="error" variant="danger">{{ error }}</AlertBox>
    <template v-if="recording">
      <dl class="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-muted">{{ t("recording.simulator") }}</dt>
          <dd>
            {{ recording.simulator }} ·
            {{ recording.aircraftIdentity || t("recording.unknown") }}
          </dd>
        </div>
        <div>
          <dt class="text-muted">{{ t("status") }}</dt>
          <dd>{{ t("recording.states." + recording.status) }}</dd>
        </div>
        <div>
          <dt class="text-muted">{{ t("blockOff") }}</dt>
          <dd>
            {{
              recording.blockOff
                ? formatUtc(recording.blockOff)
                : t("recording.unknown")
            }}<span v-if="recording.blockOff">
              ·
              {{
                t(
                  recording.manualBlockOff
                    ? "recording.manual"
                    : "recording.measured",
                )
              }}</span
            >
          </dd>
        </div>
        <div>
          <dt class="text-muted">{{ t("blockOn") }}</dt>
          <dd>
            {{
              recording.blockOn
                ? formatUtc(recording.blockOn)
                : t("recording.unknown")
            }}<span v-if="recording.blockOn">
              ·
              {{
                t(
                  recording.manualBlockOn
                    ? "recording.manual"
                    : "recording.measured",
                )
              }}</span
            >
          </dd>
        </div>
        <div>
          <dt class="text-muted">{{ t("fuel") }}</dt>
          <dd>
            {{ recording.fuelKg ?? t("recording.unknown")
            }}<span v-if="recording.fuelKg !== null">
              ·
              {{
                t(
                  recording.manualFuel
                    ? "recording.manual"
                    : "recording.measured",
                )
              }}</span
            >
          </dd>
        </div>
        <div>
          <dt class="text-muted">{{ t("recording.samples") }}</dt>
          <dd>
            {{ recording.sampleCount }} · {{ recording.chunkCount }}
            {{ t("recording.chunks") }}
          </dd>
        </div>
      </dl>
      <ul v-if="recording.flags.length" class="list-inside list-disc text-sm">
        <li v-for="flag in recording.flags" :key="flag">
          {{ t("flags." + flag) }}
        </li>
      </ul>
      <p class="text-sm text-muted">{{ t("recording.retention") }}</p>
      <p v-if="recording.rawExpiresAt" class="text-sm">
        {{ t("recording.expires") }}: {{ formatUtc(recording.rawExpiresAt) }}
      </p>
      <AlertBox v-if="!recording.rawAvailable" variant="warning">{{
        t("recording.unavailable")
      }}</AlertBox>
      <div v-else class="flex flex-wrap items-center gap-4">
        <Button :disabled="busy" @click="loadTrack">{{
          busy ? t("recording.loading") : t("recording.plot")
        }}</Button>
        <a
          :href="va.recordingTrackUrl(recording.id)"
          download
          class="underline"
          referrerpolicy="no-referrer"
          >{{ t("recording.download") }}</a
        >
      </div>
      <template v-if="preview">
        <p class="text-sm text-muted">{{ t("recording.plotHelp") }}</p>
        <p v-if="preview.sampled" class="text-sm text-muted">
          {{ t("recording.sampled") }}
        </p>
        <figure v-if="plot.start && plot.end" class="min-w-0">
          <svg
            viewBox="0 0 800 400"
            role="img"
            :aria-label="t('recording.plotLabel')"
            class="w-full rounded border border-subtle bg-surface text-ink"
          >
            <title>{{ t("recording.plotLabel") }}</title>
            <path
              :d="plot.path"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              vector-effect="non-scaling-stroke"
            />
            <circle
              :cx="plot.start.x"
              :cy="plot.start.y"
              r="5"
              fill="currentColor"
            />
            <circle
              :cx="plot.end.x"
              :cy="plot.end.y"
              r="7"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            />
          </svg>
          <figcaption class="mt-2 text-sm text-muted">
            {{ t("recording.legend") }}
          </figcaption>
        </figure>
        <p v-else class="text-muted">{{ t("recording.noPositions") }}</p>
      </template>
    </template>
    <Button v-else variant="ghost" @click="refresh">{{
      t("recording.reload")
    }}</Button>
  </section>
</template>
