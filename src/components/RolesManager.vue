<script setup lang="ts">
/**
 * 角色：名称、排位、权限集合。活跃成员都看得到；`roles.manage` 才能改，而且只能改排位
 * 低于自己最高角色的那些（所有者不受限）。新建或改到一个不低于自己的排位，上游回
 * 403 `role_outranks`，原样显示。
 */
import { computed, reactive, ref } from "vue";
import {
  AlertBox,
  Badge,
  Button,
  DataTable,
  Dialog,
  Input,
} from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import {
  PERMISSIONS,
  va,
  type MyMembership,
  type Permission,
  type Role,
} from "@/lib/va";
import { can, canActOnRole } from "@/lib/permissions";
import { errorText } from "@/lib/errors";
import { wholeNumber } from "@/lib/format";

const props = defineProps<{
  icao: string;
  membership: MyMembership;
  roles: Role[];
  messages: Record<string, unknown>;
  permissionLabels: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const t = createTranslator(props.messages);
const tp = createTranslator(props.permissionLabels);
const tc = createTranslator(props.common);

const roles = ref<Role[]>(props.roles);
const sorted = computed(() =>
  [...roles.value].sort((a, b) => b.position - a.position),
);
const canManage = can(props.membership, "roles.manage");

const busy = ref(false);
const error = ref("");
const notice = ref("");
const editorOpen = ref(false);
/** 编辑框开着时的错误显示在编辑框里，页面上的那条被遮住。 */
const editorError = ref("");
const editor = reactive<{
  id: number | null;
  name: string;
  position: string;
  permissions: Permission[];
}>({ id: null, name: "", position: "", permissions: [] });
const deleting = ref<Role | null>(null);
const deleteOpen = computed({
  get: () => deleting.value !== null,
  set: (open: boolean) => {
    if (!open) deleting.value = null;
  },
});

const columns = [
  { key: "name", label: t("columns.name") },
  { key: "position", label: t("columns.position"), align: "right" as const },
  { key: "permissions", label: t("columns.permissions") },
  ...(canManage
    ? [{ key: "actions", label: t("columns.actions"), align: "right" as const }]
    : []),
];

function openCreate(): void {
  Object.assign(editor, { id: null, name: "", position: "", permissions: [] });
  editorError.value = "";
  editorOpen.value = true;
}

function openEdit(role: Role): void {
  Object.assign(editor, {
    id: role.id,
    name: role.name,
    position: String(role.position),
    permissions: [...role.permissions],
  });
  editorError.value = "";
  editorOpen.value = true;
}

async function reload(): Promise<void> {
  const result = await va.roles(props.icao);
  if (result.ok) roles.value = result.data.items;
}

async function saveRole(): Promise<void> {
  error.value = "";
  notice.value = "";
  editorError.value = "";
  const position = wholeNumber(editor.position);
  if (!editor.name.trim() || position === null) {
    editorError.value = tc("errors.bad_request");
    return;
  }
  const input = {
    name: editor.name.trim(),
    position,
    permissions: PERMISSIONS.filter((p) => editor.permissions.includes(p)),
  };
  busy.value = true;
  const result =
    editor.id === null
      ? await va.createRole(props.icao, input)
      : await va.updateRole(props.icao, editor.id, input);
  busy.value = false;
  if (!result.ok) {
    editorError.value = errorText(tc, result);
    return;
  }
  editorOpen.value = false;
  notice.value = t(editor.id === null ? "created" : "saved", {
    name: result.data.name,
  });
  await reload();
}

async function removeRole(): Promise<void> {
  const role = deleting.value;
  if (!role) return;
  error.value = "";
  notice.value = "";
  busy.value = true;
  const result = await va.deleteRole(props.icao, role.id);
  busy.value = false;
  deleting.value = null;
  if (!result.ok) {
    error.value = errorText(tc, result);
    return;
  }
  notice.value = t("deleted", { name: role.name });
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
      <template #cell-permissions="{ row }">
        <span v-if="row.permissions.length === 0" class="text-muted">{{
          tc("none")
        }}</span>
        <span v-else class="flex flex-wrap gap-1">
          <Badge v-for="p in row.permissions" :key="p" size="sm">
            {{ tp(p) }}
          </Badge>
        </span>
      </template>
      <template #cell-actions="{ row }">
        <div
          v-if="canActOnRole(membership, roles, row)"
          class="flex justify-end gap-2"
        >
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
      :messages="common"
    >
      <form
        id="role-editor"
        class="flex flex-col gap-4"
        @submit.prevent="saveRole"
      >
        <AlertBox v-if="editorError" variant="danger">{{
          editorError
        }}</AlertBox>
        <Input
          v-model="editor.name"
          :label="t('form.name')"
          :maxlength="40"
          required
        />
        <Input
          v-model="editor.position"
          :label="t('form.position')"
          :hint="t('form.positionHelp')"
          inputmode="numeric"
          required
        />
        <fieldset>
          <legend class="mb-2 text-sm font-medium text-ink">
            {{ t("form.permissions") }}
          </legend>
          <div class="grid gap-2 sm:grid-cols-2">
            <label
              v-for="p in PERMISSIONS"
              :key="p"
              class="flex items-center gap-3 text-sm text-ink"
            >
              <input
                v-model="editor.permissions"
                type="checkbox"
                :value="p"
                class="size-4 accent-[var(--color-can)]"
              />
              {{ tp(p) }}
            </label>
          </div>
        </fieldset>
      </form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button variant="secondary" @click="editorOpen = false">
            {{ tc("cancel") }}
          </Button>
          <Button type="submit" form="role-editor" :loading="busy">
            {{ editor.id === null ? t("form.create") : t("form.save") }}
          </Button>
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:open="deleteOpen"
      :title="t('deleteTitle', { name: deleting?.name ?? '' })"
      :description="t('deleteBody')"
      :messages="common"
      size="sm"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button variant="secondary" @click="deleting = null">
            {{ tc("cancel") }}
          </Button>
          <Button variant="danger" :loading="busy" @click="removeRole">
            {{ tc("delete") }}
          </Button>
        </div>
      </template>
    </Dialog>
  </div>
</template>
