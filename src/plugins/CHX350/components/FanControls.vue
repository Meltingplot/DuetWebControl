<style scoped>
.fan {
	padding: 12px 14px;
	border-radius: var(--mp-radius);
	background: var(--surface-page);
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.fan__head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
}
.fan__value {
	font: 700 22px/1 var(--mp-font-mono, monospace);
	color: var(--text-strong);
	white-space: nowrap;
}
.fan__rpm {
	font: 400 13px/1 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.fan__hint {
	font: 400 12px/1.35 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.fan__hint--warn {
	font-weight: 600;
	color: var(--text-warning);
}
.fan__buttons {
	display: flex;
	gap: 8px;
}
.fan__buttons > .v-btn {
	flex: 1;
	min-height: var(--chx-touch, 56px);
	font-family: var(--mp-font-mono, monospace);
}
</style>

<!-- One tile per fan the operator may set; the parent lays them out (a grid in both dialogs) -->
<template>
	<div v-for="fan in fans.adjustable.value" :key="fan.index" class="fan">
		<div class="fan__head">
			<span class="chx-label">{{ fan.label }}</span>
			<span class="fan__value">
				{{ formatPercent(fan.value) }}
				<small v-if="fan.rpm !== null" class="fan__rpm">· {{ $t("plugins.CHX350.fans.rpm", { rpm: fan.rpm }) }}</small>
			</span>
		</div>
		<div class="fan__buttons">
			<v-btn variant="outlined" :disabled="locked || fan.value <= 0" :loading="sending === fan.index" @click="set(fan, -STEP)">−{{ STEP }}</v-btn>
			<v-btn variant="outlined" :disabled="locked || fan.value >= 1" :loading="sending === fan.index" @click="set(fan, STEP)">+{{ STEP }}</v-btn>
			<v-btn variant="outlined" :disabled="locked || fan.value >= 1" @click="set(fan, 100, true)">100 %</v-btn>
			<v-btn variant="outlined" :disabled="locked || fan.value <= 0" @click="set(fan, 0, true)">{{ $t("plugins.CHX350.generic.off") }}</v-btn>
		</div>
		<div v-if="fans.stalled.value.includes(fan)" class="fan__hint fan__hint--warn">{{ $t("plugins.CHX350.fans.stalledHint") }}</div>
		<div v-if="resumeHint(fan)" class="fan__hint">{{ resumeHint(fan) }}</div>
		<div v-else-if="jobRunning" class="fan__hint">{{ $t("plugins.CHX350.fans.jobHint") }}</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import i18n from "@/i18n";
import { getErrorMessage } from "@/utils/errors";

import { formatPercent, type FanInfo, useFans } from "../composables/useFans";
import { useMachineState } from "../composables/useMachineState";

const STEP = 10;

const props = defineProps<{
	disabled?: boolean;
}>();
const emit = defineEmits<{
	(e: "error", message: string | null): void;
}>();

const fans = useFans();
const state = useMachineState();

/** Fan whose code is on its way; one at a time, so two taps never race */
const sending = ref<number | null>(null);
// Fans are no motion and no heat: they stay available in default mode, during a job and in a pause
const locked = computed(() => props.disabled || !state.connected.value || state.uiFrozen.value || sending.value !== null);
const jobRunning = computed(() => state.printing.value && !state.jobPaused.value);

function resumeHint(fan: FanInfo): string {
	const value = fans.resumeValue(fan.index);
	return value !== null ? i18n.global.t("plugins.CHX350.fans.resumeHint", { value: formatPercent(value) }) : "";
}

/** `percent` is a step from the current value, or the new value when `absolute` is set */
async function set(fan: FanInfo, percent: number, absolute = false) {
	emit("error", null);
	sending.value = fan.index;
	try {
		await fans.setFan(fan.index, absolute ? percent : Math.round(fan.value * 100) + percent);
	} catch (e) {
		emit("error", getErrorMessage(e));
	} finally {
		sending.value = null;
	}
}
</script>
