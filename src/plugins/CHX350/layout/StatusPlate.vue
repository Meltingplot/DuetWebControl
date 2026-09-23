<style scoped>
/* The plate keeps a fixed position right after the machine name; the hint fills the free space
   next to it instead of hanging below, where the 72 px header has no room for it */
.status {
	display: flex;
	align-items: center;
	gap: 16px;
}
.plate {
	flex: none;
	display: inline-flex;
	align-items: center;
	gap: 10px;
	height: 46px;
	padding: 0 18px 0 14px;
	border: 0;
	border-radius: var(--mp-radius, 8px);
	font: 700 22px/1 var(--mp-font-body, sans-serif);
	letter-spacing: 0.06em;
	cursor: default;
	white-space: nowrap;
}
.plate--link {
	cursor: pointer;
}
.plate--automatic, .plate--printing { background: var(--mp-primary-dark); color: #fff; }
.plate--heating, .plate--busy { background: var(--mp-primary); color: #fff; }
.plate--idle, .plate--paused { background: var(--mp-accent); color: var(--mp-neutral-900); }
.plate--estop { background: var(--mp-error); color: #fff; }
.plate--offline { background: var(--mp-neutral-400); color: var(--mp-neutral-900); }
.hint {
	min-width: 0;
	overflow: hidden;
}
.hint__label {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.hint__text {
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	overflow: hidden;
	margin-top: 4px;
	font: 500 14px/1.25 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
	text-wrap: balance;
}
</style>

<template>
	<div class="status">
		<button type="button" class="plate" :class="[`plate--${state.plate.value}`, { 'plate--link': jobActive }]" @click="onClick">
			<v-icon size="26">{{ icon }}</v-icon>
			<span>{{ $t(`plugins.CHX350.status.${state.plate.value}`) }}</span>
			<v-icon v-if="jobActive" size="22">mdi-chevron-right</v-icon>
		</button>
		<div v-if="hint" class="hint" :title="`${hintLabel} · ${hint}`">
			<div class="chx-label hint__label">{{ hintLabel }}</div>
			<div class="hint__text">{{ hint }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import i18n from "@/i18n";

import { useMachineState } from "../composables/useMachineState";

const state = useMachineState();
const router = useRouter();

const jobActive = computed(() => state.printing.value);

const icon = computed(() => {
	switch (state.plate.value) {
		case "automatic": return "mdi-check";
		case "idle": return "mdi-lock-outline";
		case "heating": return "mdi-thermometer";
		case "busy": return "mdi-timer-sand";
		case "printing": return "mdi-play";
		case "paused": return "mdi-pause";
		case "estop": return "mdi-alert-octagon";
		default: return "mdi-lan-disconnect";
	}
});

// Idle means default mode: the label names the mode, the text says why axes stay locked or what
// the operator has to do to reach automatic mode
const hintLabel = computed(() => i18n.global.t("plugins.CHX350.status.hintMode"));

const hint = computed(() => {
	if (state.plate.value !== "idle") {
		return "";
	}
	if (state.doorOpen.value) {
		return i18n.global.t("plugins.CHX350.status.hintDoorOpen");
	}
	return i18n.global.t(state.doorCheckPending.value ? "plugins.CHX350.status.hintDoorCheck" : "plugins.CHX350.status.hintNoAxes");
});

function onClick() {
	if (jobActive.value) {
		router.push("/Job/Status");
	}
}
</script>
