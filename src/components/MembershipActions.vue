<script setup lang="ts">
/**
 * 航司详情页上我和这家航司的关系：加入 / 申请加入 / 接受或拒绝邀请 / 设为主要 / 退出。
 *
 * 成功后整页刷新：侧栏、标签、通知铃都跟着成员身份变，刷新是让每一处都按新状态重新
 * 渲染的唯一办法。
 */
import { ref } from "vue";
import { AlertBox, Button, Dialog } from "@jianyuelab-org/can-ui";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import {
  va,
  type ApiResult,
  type AirlineStatus,
  type JoinMode,
  type MyMembership,
} from "@/lib/va";
import { errorText } from "@/lib/errors";

const props = defineProps<{
  airline: {
    icao: string;
    name: string;
    joinMode: JoinMode;
    status: AirlineStatus;
  };
  membership: MyMembership | null;
  messages: Record<string, unknown>;
  common: Record<string, unknown>;
}>();
const t = createTranslator(props.messages);
const tc = createTranslator(props.common);

const busy = ref(false);
const error = ref("");
const confirmLeave = ref(false);

async function run(action: () => Promise<ApiResult<unknown>>): Promise<void> {
  busy.value = true;
  error.value = "";
  const result = await action();
  busy.value = false;
  if (!result.ok) {
    confirmLeave.value = false;
    error.value = errorText(tc, result);
    return;
  }
  window.location.reload();
}

const icao = props.airline.icao;
// 模板里不直接引用 `va`：vue-tsc 把它当成 ref 解包，类型对不上。
const actions = {
  join: () => va.join(icao),
  acceptInvite: () => va.acceptInvite(icao),
  declineInvite: () => va.declineInvite(icao),
  setPrimary: () => va.setPrimary(icao),
  leave: () => va.leave(icao),
};
</script>

<template>
  <div class="flex flex-col gap-3">
    <AlertBox v-if="error" variant="danger">{{ error }}</AlertBox>

    <template v-if="!membership">
      <p v-if="airline.joinMode === 'invite'" class="text-sm text-muted">
        {{ t("actions.inviteOnly") }}
      </p>
      <div v-else>
        <Button
          :loading="busy"
          :disabled="airline.status !== 'active'"
          @click="run(actions.join)"
        >
          {{
            airline.joinMode === "open"
              ? t("actions.join")
              : t("actions.applyJoin")
          }}
        </Button>
      </div>
    </template>

    <p v-else-if="membership.status === 'applied'" class="text-sm text-muted">
      {{ t("actions.appliedNotice") }}
    </p>

    <template v-else-if="membership.status === 'invited'">
      <p class="text-sm text-ink">{{ t("actions.invitedNotice") }}</p>
      <div class="flex flex-wrap gap-2">
        <Button :loading="busy" @click="run(actions.acceptInvite)">
          {{ t("actions.acceptInvite") }}
        </Button>
        <Button
          variant="secondary"
          :disabled="busy"
          @click="run(actions.declineInvite)"
        >
          {{ t("actions.declineInvite") }}
        </Button>
      </div>
    </template>

    <template v-else>
      <p v-if="membership.isPrimary" class="text-sm text-muted">
        {{ t("actions.isPrimary") }}
      </p>
      <p v-if="membership.isOwner" class="text-sm text-muted">
        {{ t("actions.ownerCannotLeave") }}
      </p>
      <div class="flex flex-wrap gap-2">
        <Button
          v-if="!membership.isPrimary"
          variant="secondary"
          :loading="busy"
          @click="run(actions.setPrimary)"
        >
          {{ t("actions.setPrimary") }}
        </Button>
        <Button
          v-if="!membership.isOwner"
          variant="danger"
          :disabled="busy"
          @click="confirmLeave = true"
        >
          {{ t("actions.leave") }}
        </Button>
      </div>
    </template>

    <Dialog
      v-model:open="confirmLeave"
      :title="t('actions.leaveTitle', { name: airline.name })"
      :description="t('actions.leaveBody')"
      size="sm"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button variant="secondary" @click="confirmLeave = false">
            {{ tc("cancel") }}
          </Button>
          <Button variant="danger" :loading="busy" @click="run(actions.leave)">
            {{ t("actions.leave") }}
          </Button>
        </div>
      </template>
    </Dialog>
  </div>
</template>
