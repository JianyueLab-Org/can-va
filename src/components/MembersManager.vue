<script setup lang="ts">
/**
 * 成员名单。活跃成员人人看得到；加入申请、邀请、移除要 `members.manage`；分配角色要
 * `roles.manage`，而且只能动排位低于自己最高角色的那些（所有者不受限）。
 * 按钮显不显示由 `src/lib/permissions.ts` 判；最终由 can-va-api 判，403 `role_outranks`
 * 原样显示。
 */
import { computed, reactive, ref } from "vue";
import {
  AlertBox,
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  Input,
} from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import {
  va,
  type Member,
  type MembershipStatus,
  type MyMembership,
  type Role,
} from "@/lib/va";
import {
  assignableRoles,
  canRemoveMember,
  nextRoleIds,
} from "@/lib/permissions";
import { errorText } from "@/lib/errors";
import { formatDay } from "@/lib/format";

const props = defineProps<{
  icao: string;
  self: string;
  membership: MyMembership;
  canManage: boolean;
  roles: Role[];
  active: Member[];
  applied: Member[];
  invited: Member[];
  messages: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const t = createTranslator(props.messages);
const tc = createTranslator(props.common);

const lists = reactive<Record<MembershipStatus, Member[]>>({
  active: props.active,
  applied: props.applied,
  invited: props.invited,
});
const assignable = assignableRoles(props.membership, props.roles);
const roleNames = new Map(props.roles.map((r) => [r.id, r.name]));

const busy = ref<string | null>(null);
const error = ref("");
const notice = ref("");
const inviteName = ref("");
const removing = ref<Member | null>(null);
const editing = ref<Member | null>(null);
const selected = ref<number[]>([]);

const removeOpen = computed({
  get: () => removing.value !== null,
  set: (open: boolean) => {
    if (!open) removing.value = null;
  },
});
const rolesOpen = computed({
  get: () => editing.value !== null,
  set: (open: boolean) => {
    if (!open) editing.value = null;
  },
});

const activeColumns = [
  { key: "username", label: t("columns.member") },
  { key: "roleIds", label: t("columns.roles") },
  { key: "joinedAt", label: t("columns.joined") },
  { key: "actions", label: t("columns.actions"), align: "right" as const },
];
const invitedColumns = [
  { key: "username", label: t("columns.member") },
  { key: "joinedAt", label: t("columns.joined") },
];
const appliedColumns = [
  ...invitedColumns,
  { key: "actions", label: t("columns.actions"), align: "right" as const },
];

async function refresh(status: MembershipStatus): Promise<void> {
  const result = await va.members(props.icao, status);
  if (result.ok) lists[status] = result.data.items;
}

function begin(key: string): void {
  busy.value = key;
  error.value = "";
  notice.value = "";
}

function fail(failure: { error: string; message: string }): void {
  busy.value = null;
  error.value = errorText(tc, failure);
}

async function accept(member: Member): Promise<void> {
  begin(`accept:${member.username}`);
  const result = await va.acceptApplicant(props.icao, member.username);
  if (!result.ok) return fail(result);
  busy.value = null;
  notice.value = t("done.accepted", { username: member.username });
  await Promise.all([refresh("applied"), refresh("active")]);
}

async function decline(member: Member): Promise<void> {
  begin(`decline:${member.username}`);
  const result = await va.declineApplicant(props.icao, member.username);
  if (!result.ok) return fail(result);
  busy.value = null;
  notice.value = t("done.declined", { username: member.username });
  await refresh("applied");
}

async function invite(): Promise<void> {
  const username = inviteName.value.trim();
  if (!username) return;
  begin("invite");
  const result = await va.invite(props.icao, username);
  if (!result.ok) return fail(result);
  busy.value = null;
  inviteName.value = "";
  notice.value = t("invite.sent", { username });
  await refresh("invited");
}

async function remove(): Promise<void> {
  const member = removing.value;
  if (!member) return;
  begin("remove");
  const result = await va.removeMember(props.icao, member.username);
  removing.value = null;
  if (!result.ok) return fail(result);
  busy.value = null;
  notice.value = t("done.removed", { username: member.username });
  await refresh("active");
}

function openRoles(member: Member): void {
  editing.value = member;
  selected.value = member.roleIds.filter((id) =>
    assignable.some((r) => r.id === id),
  );
}

async function saveRoles(): Promise<void> {
  const member = editing.value;
  if (!member) return;
  begin("roles");
  const roleIds = nextRoleIds(member.roleIds, selected.value, assignable);
  const result = await va.setMemberRoles(props.icao, member.username, roleIds);
  editing.value = null;
  if (!result.ok) return fail(result);
  busy.value = null;
  notice.value = t("done.rolesSaved", { username: member.username });
  await refresh("active");
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <AlertBox v-if="notice" variant="success">{{ notice }}</AlertBox>
    <AlertBox v-if="error" variant="danger">{{ error }}</AlertBox>

    <section>
      <h2 class="text-title-3 mb-3 text-ink">{{ t("active.title") }}</h2>
      <DataTable
        :columns="activeColumns"
        :rows="lists.active"
        row-key="username"
        :empty="t('active.empty')"
        dense
      >
        <template #cell-username="{ row }">
          <span class="font-mono text-ink">{{ row.username }}</span>
          <Badge v-if="row.isOwner" variant="success" size="sm" class="ml-2">
            {{ tc("owner") }}
          </Badge>
        </template>
        <template #cell-roleIds="{ row }">
          <span v-if="row.roleIds.length === 0" class="text-muted">{{
            tc("none")
          }}</span>
          <span v-else class="flex flex-wrap gap-1">
            <Badge v-for="id in row.roleIds" :key="id" size="sm">
              {{ roleNames.get(id) ?? `#${id}` }}
            </Badge>
          </span>
        </template>
        <template #cell-joinedAt="{ row }">
          <span class="tabular-nums">{{ formatDay(row.joinedAt) }}</span>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-2">
            <Button
              v-if="assignable.length > 0"
              size="sm"
              variant="secondary"
              :disabled="busy !== null"
              @click="openRoles(row)"
            >
              {{ t("actions.editRoles") }}
            </Button>
            <Button
              v-if="canRemoveMember(membership, roles, row, self)"
              size="sm"
              variant="danger"
              :disabled="busy !== null"
              @click="removing = row"
            >
              {{ t("actions.remove") }}
            </Button>
          </div>
        </template>
      </DataTable>
    </section>

    <template v-if="canManage">
      <section>
        <h2 class="text-title-3 mb-3 text-ink">{{ t("applied.title") }}</h2>
        <DataTable
          :columns="appliedColumns"
          :rows="lists.applied"
          row-key="username"
          :empty="t('applied.empty')"
          dense
        >
          <template #cell-username="{ row }">
            <span class="font-mono text-ink">{{ row.username }}</span>
          </template>
          <template #cell-joinedAt="{ row }">
            <span class="tabular-nums">{{ formatDay(row.joinedAt) }}</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end gap-2">
              <Button
                size="sm"
                :loading="busy === `accept:${row.username}`"
                :disabled="busy !== null"
                @click="accept(row)"
              >
                {{ t("actions.accept") }}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                :loading="busy === `decline:${row.username}`"
                :disabled="busy !== null"
                @click="decline(row)"
              >
                {{ t("actions.decline") }}
              </Button>
            </div>
          </template>
        </DataTable>
      </section>

      <section>
        <h2 class="text-title-3 mb-3 text-ink">{{ t("invited.title") }}</h2>
        <DataTable
          :columns="invitedColumns"
          :rows="lists.invited"
          row-key="username"
          :empty="t('invited.empty')"
          dense
        >
          <template #cell-username="{ row }">
            <span class="font-mono text-ink">{{ row.username }}</span>
          </template>
          <template #cell-joinedAt="{ row }">
            <span class="tabular-nums">{{ formatDay(row.joinedAt) }}</span>
          </template>
        </DataTable>
      </section>

      <Card :title="t('invite.title')" :subtitle="t('invite.help')">
        <form class="flex flex-wrap items-end gap-3" @submit.prevent="invite">
          <div class="w-full max-w-xs">
            <Input
              v-model="inviteName"
              :label="t('invite.username')"
              autocomplete="off"
              autocapitalize="none"
              autocorrect="off"
              :spellcheck="false"
            />
          </div>
          <Button
            type="submit"
            :loading="busy === 'invite'"
            :disabled="!inviteName.trim()"
          >
            {{ t("invite.action") }}
          </Button>
        </form>
      </Card>
    </template>

    <Dialog
      v-model:open="removeOpen"
      :title="t('removeTitle', { username: removing?.username ?? '' })"
      :description="t('removeBody')"
      :messages="common"
      size="sm"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button variant="secondary" @click="removing = null">
            {{ tc("cancel") }}
          </Button>
          <Button variant="danger" :loading="busy === 'remove'" @click="remove">
            {{ t("actions.remove") }}
          </Button>
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:open="rolesOpen"
      :title="t('rolesTitle', { username: editing?.username ?? '' })"
      :description="t('rolesHelp')"
      :messages="common"
    >
      <p v-if="assignable.length === 0" class="text-sm text-muted">
        {{ t("rolesNone") }}
      </p>
      <ul v-else class="flex flex-col gap-2">
        <li v-for="role in assignable" :key="role.id">
          <label class="flex items-center gap-3 text-sm text-ink">
            <input
              v-model="selected"
              type="checkbox"
              :value="role.id"
              class="size-4 accent-[var(--color-can)]"
            />
            <span>{{ role.name }}</span>
            <span class="text-xs text-muted tabular-nums">{{
              role.position
            }}</span>
          </label>
        </li>
      </ul>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button variant="secondary" @click="editing = null">
            {{ tc("cancel") }}
          </Button>
          <Button :loading="busy === 'roles'" @click="saveRoles">
            {{ tc("save") }}
          </Button>
        </div>
      </template>
    </Dialog>
  </div>
</template>
