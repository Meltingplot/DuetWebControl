<style scoped>
.header {
	display: grid;
	/* The status plate sits at about 5/12 of the width, in the middle of the free space between
	   the machine name and the temperature block rather than dead center */
	grid-template-columns: minmax(180px, 5fr) auto minmax(0, 7fr);
	align-items: center;
	gap: 14px;
	width: 100%;
	height: 100%;
	padding: 0 24px;
	background: var(--surface-card);
	border-bottom: 1px solid var(--border-default);
}
.header__name {
	font: 700 17px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
.header__host {
	font: 400 12px/1.3 var(--mp-font-mono, monospace);
	color: var(--text-body);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.header__right {
	justify-self: end;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 18px;
	min-width: 0;
}
.temp {
	text-align: right;
	white-space: nowrap;
}
.divider {
	width: 1px;
	height: 38px;
	background: var(--border-subtle);
}
.hot {
	display: flex;
	align-items: center;
	padding: 6px;
	border-radius: var(--mp-radius);
	background: var(--mp-neutral-200);
	border: 1px solid var(--border-default);
}
</style>

<template>
	<header class="header">
		<div class="min-width-0" style="min-width: 0">
			<div class="header__name">{{ machineName }}</div>
			<div class="header__host">{{ hostname }}</div>
		</div>

		<StatusPlate />

		<div class="header__right">
			<div v-if="state.machineIsHot.value" class="hot" :title="$t('plugins.CHX350.header.hot')">
				<svg width="30" height="30" viewBox="0 0 48 48" role="img" :aria-label="$t('plugins.CHX350.header.hot')">
					<path d="M24 4.5 L45.5 42.5 H2.5 Z" fill="#F9A500" stroke="#1A1F24" stroke-width="3.6" stroke-linejoin="round" />
					<rect x="13.4" y="34" width="21.2" height="3.4" fill="#1A1F24" />
					<path d="M17.6 31.4c-2-2.1-2-4.2 0-6.3s2-4.2 0-6.3" fill="none" stroke="#1A1F24" stroke-width="2.5" stroke-linecap="square" />
					<path d="M24 31.4c-2-2.1-2-4.2 0-6.3s2-4.2 0-6.3" fill="none" stroke="#1A1F24" stroke-width="2.5" stroke-linecap="square" />
					<path d="M30.4 31.4c-2-2.1-2-4.2 0-6.3s2-4.2 0-6.3" fill="none" stroke="#1A1F24" stroke-width="2.5" stroke-linecap="square" />
				</svg>
			</div>

			<div v-if="temps.chamberSource.value !== 'none'" class="temp">
				<div class="chx-label">{{ chamberLabel }}</div>
				<div class="chx-value">{{ formatTemp(temps.chamberCurrent.value) }}</div>
			</div>
			<div v-if="temps.chamberSource.value !== 'none'" class="divider" />
			<div class="temp">
				<div class="chx-label">{{ $t("plugins.CHX350.header.bed") }}</div>
				<div class="chx-value">{{ formatTemp(temps.bedCurrent.value) }}</div>
			</div>

			<HoldButton :label="$t('plugins.CHX350.header.estop')" :hint="$t('plugins.CHX350.header.estopHold')"
						:hold-ms="estopHoldMs" :disabled="state.uiFrozen.value" @held="emergencyStop" />
		</div>
	</header>
</template>

<script setup lang="ts">
import { computed } from "vue";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { LogLevel, useUiStore } from "@/stores/ui";

import { useMachineState } from "../composables/useMachineState";
import { formatTemp, useTemps } from "../composables/useTemps";
import { useChxSettings } from "../settings";
import HoldButton from "./HoldButton.vue";
import StatusPlate from "./StatusPlate.vue";

const machineStore = useMachineStore();
const uiStore = useUiStore();
const state = useMachineState();
const temps = useTemps();
const { estopHoldMs, support } = useChxSettings();

const machineName = computed(() => support.value.model || machineStore.model.network.name || "CHX 350");
const hostname = computed(() => machineStore.model.network.name || machineStore.model.network.hostname || "");

const chamberLabel = computed(() => temps.chamberSource.value === "szp"
	? i18n.global.t("plugins.CHX350.header.chamberSzp")
	: i18n.global.t("plugins.CHX350.header.chamber"));

async function emergencyStop() {
	try {
		await machineStore.sendCode("M112", false, false, true);
	} catch (e) {
		uiStore.log(LogLevel.error, i18n.global.t("plugins.CHX350.header.estop"), String(e));
	}
}
</script>
