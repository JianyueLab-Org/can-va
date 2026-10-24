<script setup lang="ts">
/**
 * 机场输入框：边打边搜（`GET /api/v1/va/airports?q=`，250 ms 防抖），离开时把完整的四字
 * 代码核对一次（`GET /api/v1/va/airports/{icao}`）。机场名和坐标都来自 can-va-api。
 *
 * 搜索只返回未停用的机场；核对可能拿到一个已停用的，那时给一句提示，提交由上游的
 * `airport_unavailable` 决定。
 */
import { onBeforeUnmount, ref, watch } from "vue";
import { Input } from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import { va, type Airport } from "@/lib/va";
import { AIRPORT_ICAO } from "@/lib/application";

const props = defineProps<{
  modelValue: string;
  label: string;
  hint?: string;
  error?: string;
  messages: Record<string, unknown>;
}>();
const emit = defineEmits<{ "update:modelValue": [string] }>();
const t = createTranslator(props.messages);

const text = ref(props.modelValue);
const suggestions = ref<Airport[]>([]);
const chosen = ref<Airport | null>(null);
const note = ref("");
let timer: ReturnType<typeof setTimeout> | null = null;
let sequence = 0;

watch(
  () => props.modelValue,
  (value) => {
    if (value !== text.value.trim().toUpperCase()) {
      text.value = value;
      chosen.value = null;
    }
  },
);

function onInput(value: string | number): void {
  text.value = String(value);
  chosen.value = null;
  note.value = "";
  emit("update:modelValue", text.value.trim().toUpperCase());
  if (timer) clearTimeout(timer);
  const q = text.value.trim();
  if (q.length < 2) {
    suggestions.value = [];
    return;
  }
  timer = setTimeout(() => void search(q), 250);
}

async function search(q: string): Promise<void> {
  const mine = ++sequence;
  const result = await va.searchAirports(q);
  if (mine !== sequence) return;
  suggestions.value = result.ok ? result.data.items : [];
  note.value = result.ok && result.data.items.length === 0 ? t("noMatch") : "";
}

function choose(airport: Airport): void {
  chosen.value = airport;
  text.value = airport.icao;
  suggestions.value = [];
  note.value = "";
  emit("update:modelValue", airport.icao);
}

async function resolve(): Promise<void> {
  const code = text.value.trim().toUpperCase();
  if (chosen.value || !AIRPORT_ICAO.test(code)) return;
  const result = await va.airport(code);
  if (!result.ok) {
    note.value = t("unknown");
    return;
  }
  chosen.value = result.data;
  note.value = result.data.withdrawn ? t("withdrawn") : "";
}

function onFocusOut(): void {
  // 先让列表里的 mousedown 生效。
  setTimeout(() => {
    suggestions.value = [];
    void resolve();
  }, 150);
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div class="relative" @focusout="onFocusOut">
    <Input
      :model-value="text"
      :label="label"
      :hint="hint"
      :error="error"
      :placeholder="t('placeholder')"
      autocomplete="off"
      autocapitalize="characters"
      autocorrect="off"
      :spellcheck="false"
      @update:model-value="onInput"
    />
    <ul
      v-if="suggestions.length"
      class="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-card border border-subtle bg-surface-raised py-1 shadow-lg"
      role="listbox"
    >
      <li v-for="airport in suggestions" :key="airport.icao" role="option">
        <button
          type="button"
          class="flex w-full gap-3 px-3 py-2 text-left text-sm hover:bg-surface-sunken"
          @mousedown.prevent="choose(airport)"
        >
          <span class="font-mono text-ink">{{ airport.icao }}</span>
          <span class="truncate text-muted">
            {{ airport.name
            }}<template v-if="airport.municipality">
              · {{ airport.municipality }}</template
            >
          </span>
        </button>
      </li>
    </ul>
    <p v-if="chosen && !note" class="mt-1 text-xs text-muted">
      {{ chosen.name
      }}<template v-if="chosen.municipality">
        · {{ chosen.municipality }}</template
      >
    </p>
    <p v-if="note" class="mt-1 text-xs text-warning-fg">{{ note }}</p>
  </div>
</template>
