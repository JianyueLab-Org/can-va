<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { AlertBox, Button } from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import { va, type RecordingPage } from "@/lib/va";
import { errorText } from "@/lib/errors";
import { formatUtc } from "@/lib/format";
import RecordingEvidence from "./RecordingEvidence.vue";
const props = defineProps<{
  messages: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const t = createTranslator(props.messages),
  tc = createTranslator(props.common);
const page = ref<RecordingPage | null>(null),
  selected = ref<string | null>(null);
const busy = ref(false),
  error = ref("");
const cursors = ref<(string | null)[]>([]);
let cursor: string | null = null,
  controller: AbortController | null = null;
async function load(
  next: string | null = null,
  direction: "next" | "back" | "reset" = "reset",
) {
  controller?.abort();
  const request = (controller = new AbortController());
  busy.value = true;
  selected.value = null;
  page.value = null;
  error.value = "";
  const result = await va.myRecordings(next, request.signal);
  if (request.signal.aborted) return;
  if (result.ok) {
    if (direction === "next") cursors.value.push(cursor);
    if (direction === "back") cursors.value.pop();
    if (direction === "reset") cursors.value = [];
    cursor = next;
    page.value = result.data;
  } else error.value = errorText(tc, result);
  busy.value = false;
}
function clear() {
  controller?.abort();
  page.value = null;
  selected.value = null;
  busy.value = false;
}
function visibility() {
  clear();
  if (!document.hidden) void load();
}
onMounted(() => {
  void load();
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", clear);
});
onBeforeUnmount(() => {
  controller?.abort();
  document.removeEventListener("visibilitychange", visibility);
  window.removeEventListener("pagehide", clear);
});
</script>
<template>
  <section class="grid min-w-0 gap-4" :aria-busy="busy">
    <h2 class="text-lg font-semibold">{{ t("recording.indexTitle") }}</h2>
    <p class="text-sm text-muted">{{ t("recording.indexHelp") }}</p>
    <AlertBox v-if="error" variant="danger">{{ error }}</AlertBox>
    <p v-if="busy" role="status">{{ t("recording.loading") }}</p>
    <p v-if="page && !page.items.length" class="text-muted">{{ t("empty") }}</p>
    <div
      v-for="item in page?.items ?? []"
      :key="item.id"
      class="flex flex-wrap items-center justify-between gap-3 border-b border-subtle py-3"
    >
      <div class="min-w-0 text-sm">
        <p>
          {{ item.simulator }} · {{ t("recording.states." + item.status) }} ·
          {{ formatUtc(item.createdAt) }}
        </p>
        <p v-if="item.rawExpiresAt" class="text-muted">
          {{ t("recording.expires") }}: {{ formatUtc(item.rawExpiresAt) }}
        </p>
        <a
          v-if="item.pirepId"
          :href="'/pireps/' + item.pirepId"
          class="underline"
          >{{ t("viewReport") }} #{{ item.pirepId }}</a
        >
      </div>
      <div class="flex flex-wrap items-center gap-4">
        <Button
          variant="ghost"
          @click="selected = selected === item.id ? null : item.id"
          >{{ t("recording.details") }}</Button
        >
        <a
          v-if="item.rawAvailable"
          :href="va.recordingTrackUrl(item.id)"
          download
          class="underline"
          referrerpolicy="no-referrer"
          >{{ t("recording.download") }}</a
        >
        <span v-else class="text-sm text-muted">{{
          t("recording.unavailable")
        }}</span>
      </div>
    </div>
    <div class="flex flex-wrap gap-3">
      <Button
        v-if="cursors.length"
        :disabled="busy"
        variant="ghost"
        @click="load(cursors.at(-1) ?? null, 'back')"
        >{{ t("recording.previous") }}</Button
      >
      <Button
        v-if="page?.next"
        :disabled="busy"
        variant="ghost"
        @click="load(page.next, 'next')"
        >{{ t("recording.next") }}</Button
      >
      <Button v-if="error" :disabled="busy" variant="ghost" @click="load()">{{
        t("recording.reload")
      }}</Button>
    </div>
    <RecordingEvidence
      v-if="selected"
      :key="selected"
      :recording-id="selected"
      :messages="messages"
      :common="common"
    />
  </section>
</template>
