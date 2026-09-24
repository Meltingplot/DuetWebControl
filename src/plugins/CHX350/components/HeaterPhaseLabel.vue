<style scoped>
.phase {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	gap: 6px;
	margin-top: 2px;
	font: 600 11px/1.2 var(--mp-font-body, sans-serif);
	letter-spacing: 0.04em;
	text-transform: uppercase;
	color: var(--text-body);
}
/* Ink tones: the CI green and amber miss 4.5:1 as small text on the light surfaces */
.phase--reached {
	color: rgb(var(--v-theme-success));
}
.phase--heating {
	color: var(--text-warning);
}
</style>

<template>
	<div class="phase" :class="`phase--${phase}`">
		<v-icon v-if="phase !== 'off'" size="14">{{ ICONS[phase] }}</v-icon>
		{{ $t(`plugins.CHX350.heaterPhase.${phase}`) }}
	</div>
</template>

<script setup lang="ts">
import type { HeaterPhase } from "../composables/useTemps";

const ICONS: Record<HeaterPhase, string> = {
	off: "",
	heating: "mdi-thermometer-chevron-up",
	cooling: "mdi-thermometer-chevron-down",
	reached: "mdi-check"
};

defineProps<{
	phase: HeaterPhase;
}>();
</script>
