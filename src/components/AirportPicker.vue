<script setup lang="ts">
/**
 * 机场输入框：边打边搜（`GET /api/v1/va/airports?q=`，250 ms 防抖），离开时把完整的四字
 * 代码核对一次（`GET /api/v1/va/airports/{icao}`）。机场名和坐标都来自 can-va-api。
 *
 * 搜索只返回未停用的机场；核对可能拿到一个已停用的，那时给一句提示，提交由上游的
 * `airport_unavailable` 决定。
 *
 * 键盘：焦点一直在输入框里（ARIA combobox），↑↓ 移动候选，Enter 选中，Esc 收起。
 * can-ui 的 `Input` 不把属性落到 `<input>` 上，combobox 的几个属性由这里直接写。
 */
import {
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
  watchEffect,
} from "vue";
import { Input } from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import { va, type Airport } from "@/lib/va";
import { AIRPORT_ICAO } from "@/lib/application";

const props = defineProps<{
  modelValue: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  messages: Record<string, unknown>;
}>();
const emit = defineEmits<{ "update:modelValue": [string] }>();
const t = createTranslator(props.messages);

const listId = useId();
const root = ref<HTMLElement | null>(null);
const field = ref<HTMLInputElement | null>(null);
const text = ref(props.modelValue);
const suggestions = ref<Airport[]>([]);
const active = ref(-1);
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

onMounted(() => {
  field.value = root.value?.querySelector("input") ?? null;
  field.value?.setAttribute("role", "combobox");
  field.value?.setAttribute("aria-autocomplete", "list");
  field.value?.setAttribute("aria-controls", listId);
});

watchEffect(() => {
  const input = field.value;
  if (!input) return;
  input.setAttribute("aria-expanded", String(suggestions.value.length > 0));
  if (active.value >= 0) {
    input.setAttribute("aria-activedescendant", `${listId}-${active.value}`);
  } else {
    input.removeAttribute("aria-activedescendant");
  }
});

/** 收起列表。还没发出的搜索取消，已经发出的作废，免得结果回来又弹出。 */
function close(): void {
  if (timer) clearTimeout(timer);
  sequence++;
  suggestions.value = [];
  active.value = -1;
}

function onInput(value: string | number): void {
  text.value = String(value);
  chosen.value = null;
  note.value = "";
  emit("update:modelValue", text.value.trim().toUpperCase());
  const q = text.value.trim();
  if (q.length < 2) {
    close();
    return;
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void search(q), 250);
}

async function search(q: string): Promise<void> {
  const mine = ++sequence;
  const result = await va.searchAirports(q);
  if (mine !== sequence) return;
  suggestions.value = result.ok ? result.data.items : [];
  active.value = -1;
  note.value = result.ok && result.data.items.length === 0 ? t("noMatch") : "";
}

function choose(airport: Airport): void {
  chosen.value = airport;
  text.value = airport.icao;
  close();
  note.value = "";
  emit("update:modelValue", airport.icao);
}

function onKeydown(event: KeyboardEvent): void {
  const count = suggestions.value.length;
  if (count === 0) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    active.value = (active.value + 1) % count;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    active.value = active.value <= 0 ? count - 1 : active.value - 1;
  } else if (event.key === "Enter" && active.value >= 0) {
    event.preventDefault();
    choose(suggestions.value[active.value]);
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    close();
  }
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

function onFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget;
  if (next instanceof Node && root.value?.contains(next)) return;
  close();
  void resolve();
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div ref="root" class="relative" @focusout="onFocusOut" @keydown="onKeydown">
    <Input
      :model-value="text"
      :label="label"
      :hint="hint"
      :error="error"
      :required="required"
      :placeholder="t('placeholder')"
      autocomplete="off"
      autocapitalize="characters"
      autocorrect="off"
      :spellcheck="false"
      @update:model-value="onInput"
    />
    <!-- mousedown 不让输入框失焦：焦点留在输入框，点选由 click 完成。 -->
    <ul
      v-show="suggestions.length"
      :id="listId"
      role="listbox"
      :aria-label="label"
      class="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-card border border-subtle bg-surface-raised py-1 shadow-lg"
      @mousedown.prevent
    >
      <li
        v-for="(airport, index) in suggestions"
        :id="`${listId}-${index}`"
        :key="airport.icao"
        role="option"
        :aria-selected="index === active"
        :class="[
          'flex cursor-pointer gap-3 px-3 py-2 text-sm hover:bg-surface-sunken',
          index === active ? 'bg-surface-sunken' : '',
        ]"
        @click="choose(airport)"
      >
        <span class="font-mono text-ink">{{ airport.icao }}</span>
        <span class="truncate text-muted">
          {{ airport.name
          }}<template v-if="airport.municipality">
            · {{ airport.municipality }}</template
          >
        </span>
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
