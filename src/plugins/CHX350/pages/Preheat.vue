<style scoped>
.grid {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr) 360px;
	gap: 16px;
}
.card {
	padding: 18px 20px;
	display: flex;
	flex-direction: column;
	gap: 12px;
	overflow: auto;
}
.card p {
	font: 400 15px/1.5 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	margin: 0;
}
.row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 110px 150px;
	align-items: center;
	gap: 12px;
	padding: 10px 12px;
	border-radius: var(--mp-radius);
	background: var(--surface-page);
}
.row__name {
	font: 700 15px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
.row__mat {
	font: 400 12px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.row__cur {
	font: 700 18px/1.2 var(--mp-font-mono, monospace);
	color: var(--text-strong);
	text-align: right;
}
.side {
	display: flex;
	flex-direction: column;
	gap: 12px;
}
</style>

<template>
	<div class="chx-page">
		<ChxPageHeader :back="ROUTES.start" />
		<div class="grid">
			<div class="chx-card card">
				<p>{{ $t("plugins.CHX350.preheat.intro") }}</p>
				<div v-for="tool in temps.tools.value" :key="tool.number" class="row">
					<div style="min-width: 0">
						<div class="row__name">T{{ tool.number }} <span v-if="tool.nozzleDiameter !== null" class="text-body-2">· {{ $t("plugins.CHX350.start.nozzle", { d: tool.nozzleDiameter }) }}</span></div>
						<div class="row__mat">{{ tool.filament || $t("plugins.CHX350.start.noFilament") }}</div>
					</div>
					<div>
						<div class="row__cur">{{ formatTemp(tool.current) }}</div>
						<HeaterPhaseLabel :phase="heaterPhase(tool.heater)" />
					</div>
					<ControlInput type="tool" :index="tool.number" :tool-heater-index="0" standby :label="$t('plugins.CHX350.preheat.standby')" :disabled="uiFrozen" />
				</div>
				<!-- Bed and chamber readings are in the header; their rows only carry the setpoint -->
				<div class="row">
					<div class="row__name">{{ $t("plugins.CHX350.header.bed") }}</div>
					<HeaterPhaseLabel :phase="heaterPhase(temps.bedHeater.value)" />
					<ControlInput type="bed" :index="0" active :label="$t('plugins.CHX350.preheat.active')" :disabled="uiFrozen" />
				</div>
				<div v-if="temps.hasChamberHeater.value" class="row">
					<div class="row__name">{{ $t("plugins.CHX350.header.chamber") }}</div>
					<HeaterPhaseLabel :phase="heaterPhase(temps.chamberHeater.value)" />
					<ControlInput type="chamber" :index="0" active :label="$t('plugins.CHX350.preheat.active')" :disabled="uiFrozen" />
				</div>
			</div>

			<div class="side">
				<div class="chx-card card">
					<div class="chx-label">{{ $t("plugins.CHX350.preheat.target") }}</div>
					<p>{{ !runner.configured.value ? $t("plugins.CHX350.generic.notConfigured") : (anyLoaded ? $t("plugins.CHX350.preheat.macroHint") : $t("plugins.CHX350.preheat.noMaterial")) }}</p>
					<!-- The macro heats to the loaded filament profiles; without filament there is no target -->
					<v-btn v-if="!anyLoaded" color="secondary" size="x-large" class="chx-btn" block :disabled="state.printing.value && !state.paused.value" @click="router.push(ROUTES.filament)">
						<v-icon start>mdi-swap-horizontal</v-icon>
						{{ $t("plugins.CHX350.preheat.loadFirst") }}
					</v-btn>
					<v-btn v-else color="secondary" size="x-large" class="chx-btn" block :disabled="!runner.configured.value || uiFrozen || state.printing.value" :loading="runner.busy.value" @click="runner.run()">
						<v-icon start>mdi-thermometer-chevron-up</v-icon>
						{{ $t("plugins.CHX350.preheat.start") }}
					</v-btn>
					<v-btn variant="outlined" size="large" class="chx-btn" block :disabled="uiFrozen || state.printing.value" :loading="switchingOff" @click="allOff">
						<v-icon start>mdi-power</v-icon>
						{{ $t("plugins.CHX350.preheat.allOff") }}
					</v-btn>
					<v-alert v-if="error" type="error" variant="tonal" density="compact" :text="error" />
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import ControlInput from "@/components/inputs/ControlInput.vue";
import { useMachineStore } from "@/stores/machine";
import { useUiStore } from "@/stores/ui";
import { getErrorMessage } from "@/utils/errors";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import HeaterPhaseLabel from "../components/HeaterPhaseLabel.vue";
import { useMachineState } from "../composables/useMachineState";
import { sendChecked, useMacroRunner } from "../composables/useMacroRunner";
import { formatTemp, heaterPhase, useTemps } from "../composables/useTemps";
import { ROUTES } from "../routes";
import { useChxSettings } from "../settings";

const machineStore = useMachineStore();
const uiStore = useUiStore();
const router = useRouter();
const state = useMachineState();
const temps = useTemps();
const { macros } = useChxSettings();
const runner = useMacroRunner(computed(() => macros.value.preheat));
const uiFrozen = computed(() => uiStore.uiFrozen);
const anyLoaded = computed(() => temps.tools.value.some((t) => t.filament));

const switchError = ref<string | null>(null);
const error = computed(() => runner.error.value ?? switchError.value);

// Same codes ToolsPanel's "turn everything off" uses
const switchingOff = ref(false);
async function allOff() {
	switchingOff.value = true;
	switchError.value = null;
	try {
		const codes: Array<string> = [];
		for (const tool of temps.tools.value) {
			codes.push(`M568 P${tool.number} A0`);
		}
		machineStore.bedHeaterMapping.forEach((slot, i) => { if (slot.length > 0) codes.push(`M140 P${i} S-273.15`); });
		machineStore.chamberHeaterMapping.forEach((slot, i) => { if (slot.length > 0) codes.push(`M141 P${i} S-273.15`); });
		await sendChecked(codes.join("\n"), false);
	} catch (e) {
		switchError.value = getErrorMessage(e);
	} finally {
		switchingOff.value = false;
	}
}
</script>
