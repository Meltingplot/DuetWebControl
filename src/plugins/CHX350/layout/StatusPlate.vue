<style scoped>
.plate {
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
.plate--heating { background: var(--mp-primary); color: #fff; }
.plate--idle, .plate--paused { background: var(--mp-accent); color: var(--mp-neutral-900); }
.plate--estop { background: var(--mp-error); color: #fff; }
.plate--offline { background: var(--mp-neutral-400); color: var(--mp-neutral-900); }
.plate__sub {
	font: 500 11px/1 var(--mp-font-body, sans-serif);
	letter-spacing: 0.06em;
	color: var(--text-body);
	margin-top: 4px;
	text-align: center;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 320px;
}
</style>

<template>
	<div class="d-flex flex-column align-center" style="min-width: 0">
		<button type="button" class="plate" :class="[`plate--${state.plate.value}`, { 'plate--link': jobActive }]" @click="onClick">
			<v-icon size="26">{{ icon }}</v-icon>
			<span>{{ $t(`plugins.CHX350.status.${state.plate.value}`) }}</span>
			<v-icon v-if="jobActive" size="22">mdi-chevron-right</v-icon>
		</button>
		<div v-if="subtitle" class="plate__sub">{{ subtitle }}</div>
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
		case "printing": return "mdi-play";
		case "paused": return "mdi-pause";
		case "estop": return "mdi-alert-octagon";
		default: return "mdi-lan-disconnect";
	}
});

const subtitle = computed(() => {
	if (state.plate.value === "idle") {
		return state.doorOpen.value
			? i18n.global.t("plugins.CHX350.status.subDoorOpen")
			: i18n.global.t("plugins.CHX350.status.subDefaultMode");
	}
	return "";
});

function onClick() {
	if (jobActive.value) {
		router.push("/Job/Status");
	}
}
</script>
