<style scoped>
.grid {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr) 340px;
	gap: 16px;
}
.routines {
	display: flex;
	flex-direction: column;
	gap: 12px;
}
.routine {
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 16px 20px;
}
.routine__icon {
	color: var(--text-brand);
}
.routine__title {
	font: 700 17px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
.routine__desc {
	font: 400 13px/1.35 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	margin-top: 4px;
}
/* The macro's own "Error: …" line (not homed, wrong mode, printer too warm) */
.routine__error {
	font: 600 13px/1.35 var(--mp-font-body, sans-serif);
	color: rgb(var(--v-theme-error));
	margin-top: 4px;
}
.info {
	padding: 16px 18px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.info__row {
	display: flex;
	justify-content: space-between;
	gap: 12px;
	font: 500 13px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.info__row b {
	font-family: var(--mp-font-mono, monospace);
	color: var(--text-strong);
}
</style>

<template>
	<div class="chx-page">
		<!-- Under LEERLAUF the header already says "keine Achsbewegung" -->
		<ChxPageHeader :subtitle="state.axesLocked.value && state.plate.value !== 'idle' ? $t('plugins.CHX350.generic.lockedAxes') : ''" :back="ROUTES.start" />
		<div class="grid">
			<div class="routines">
				<!-- Babystepping from the job page stays active until reset. Keeping it moves it into the
					 SZP touch offset (the configuration's apply-babystepping macro) -->
				<div v-if="babystep !== 0" class="chx-card routine">
					<v-icon size="32" class="routine__icon">mdi-arrow-expand-vertical</v-icon>
					<div class="flex-grow-1" style="min-width: 0">
						<div class="routine__title">{{ $t("plugins.CHX350.calibrate.babystepTitle", { value: babystepLabel }) }}</div>
						<div class="routine__desc">{{ hasZOffset ? t("babystepDesc") : t("babystepDescNoApply") }}</div>
						<div v-if="applyBabystep.error.value" class="routine__error">{{ applyBabystep.error.value }}</div>
					</div>
					<v-btn variant="outlined" size="large" class="chx-btn" :disabled="!canBabystep || applyBabystep.busy.value" :loading="discarding" @click="discardBabystep">
						{{ t("babystepDiscard") }}
					</v-btn>
					<v-btn v-if="hasZOffset" color="secondary" size="large" class="chx-btn" :disabled="!canBabystep || discarding" :loading="applyBabystep.busy.value" @click="applyBabystep.run()">
						<v-icon start>mdi-content-save-outline</v-icon>
						{{ t("babystepApply") }}
					</v-btn>
				</div>
				<!-- First step after a nozzle swap: the calibrations below are filed per nozzle -->
				<div v-if="hw.hasNozzle.value" class="chx-card routine">
					<v-icon size="32" class="routine__icon">mdi-printer-3d-nozzle-outline</v-icon>
					<div class="flex-grow-1" style="min-width: 0">
						<div class="routine__title">{{ t("nozzleTitle") }}</div>
						<div class="routine__desc">{{ nozzleDesc }}</div>
					</div>
					<v-btn color="secondary" size="large" class="chx-btn" :disabled="!hw.allowed.value" :loading="hw.nozzle.busy.value" @click="hw.nozzle.run()">
						<v-icon start>mdi-pencil-outline</v-icon>
						{{ t("record") }}
					</v-btn>
				</div>
				<!-- Calibration flows of the machine configuration (`page: calibrate` in the front matter) -->
				<div v-for="tile in flowTiles" :key="tile.path" class="chx-card routine">
					<v-icon size="32" class="routine__icon">{{ tile.icon }}</v-icon>
					<div class="flex-grow-1" style="min-width: 0">
						<div class="routine__title">
							{{ tile.title }}
							<v-icon v-if="tile.warn" size="18" color="warning">mdi-alert-outline</v-icon>
						</div>
						<div class="routine__desc">{{ tile.subtitle }}</div>
					</div>
					<!-- One flow at a time: a second one would queue behind the running macro -->
					<v-btn color="secondary" size="large" class="chx-btn" :disabled="tile.disabled || hw.nozzle.busy.value" @click="tile.run()">
						<v-icon start>mdi-play</v-icon>
						{{ $t("plugins.CHX350.calibrate.run") }}
					</v-btn>
				</div>
			</div>
			<div class="chx-card info">
				<div class="chx-label">{{ $t("plugins.CHX350.calibrate.meshInfo") }}</div>
				<div class="info__row"><span>{{ $t("plugins.CHX350.calibrate.meshFile") }}</span><b>{{ compensation.file ? extractFileName(compensation.file) : "—" }}</b></div>
				<div class="info__row"><span>{{ $t("plugins.CHX350.calibrate.meshType") }}</span><b>{{ compensation.type }}</b></div>
				<div class="info__row"><span>{{ $t("plugins.CHX350.calibrate.meshDeviation") }}</span><b>{{ compensation.meshDeviation ? `${compensation.meshDeviation.deviation.toFixed(3)} mm` : "—" }}</b></div>
				<div class="info__row"><span>{{ $t("plugins.CHX350.calibrate.meshMean") }}</span><b>{{ compensation.meshDeviation ? `${compensation.meshDeviation.mean.toFixed(3)} mm` : "—" }}</b></div>
				<div class="info__row"><span>{{ $t("plugins.CHX350.calibrate.probeTrigger") }}</span><b>{{ probe ? `${probe.triggerHeight} mm` : "—" }}</b></div>
				<div class="info__row"><span>{{ $t("plugins.CHX350.calibrate.probeValue") }}</span><b>{{ probe ? probe.value.join(" / ") : "—" }}</b></div>
				<v-btn v-if="hasHeightMapRoute" variant="outlined" class="chx-btn mt-2" @click="router.push('/Plugins/HeightMap')">
					<v-icon start>mdi-grid</v-icon>
					{{ $t("plugins.CHX350.service.heightmap") }}
				</v-btn>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { extractFileName } from "@/utils/path";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import { nozzleTypeLabel, useChxGlobals } from "../composables/useChxGlobals";
import { useHardwareMacros } from "../composables/useHardwareMacros";
import { useMachineState } from "../composables/useMachineState";
import { sendChecked, useMacroRunner } from "../composables/useMacroRunner";
import { useFlowTiles } from "../flows/useFlowTiles";
import { ROUTES } from "../routes";

const machineStore = useMachineStore();
const router = useRouter();
const state = useMachineState();

const flowTiles = useFlowTiles("calibrate");

const t = (key: string) => i18n.global.t(`plugins.CHX350.calibrate.${key}`);

// The HeightMap plugin registers its route when it is loaded
const hasHeightMapRoute = computed(() => router.getRoutes().some((r) => r.path === "/Plugins/HeightMap"));

// set-nozzle-diameter asks for diameter and type of the current tool
const globals = useChxGlobals();
const hw = useHardwareMacros();
const nozzleDesc = computed(() => {
	const tool = hw.nozzleTool.value;
	const diameter = globals.nozzleDiameter(tool);
	const type = globals.nozzleType(tool);
	const current = [diameter !== null ? `${diameter.toFixed(2)} mm` : null, type !== null ? nozzleTypeLabel(type) : null].filter((v) => v !== null).join(", ");
	return i18n.global.t("plugins.CHX350.calibrate.nozzleDesc", { tool: `T${tool}`, current: current || "—" });
});

// Babystep left over from a job (M290); applying needs the SZP offset global of config 3.7
const babystep = computed(() => machineStore.model.move.axes.find((a) => a.letter === "Z")?.babystep ?? 0);
const babystepLabel = computed(() => `${babystep.value > 0 ? "+" : "−"}${Math.abs(babystep.value).toFixed(2)} mm`);
const hasZOffset = computed(() => globals.get("szp_touch_z_offset") !== undefined);
const canBabystep = computed(() => !state.uiFrozen.value && !state.printing.value);
const applyBabystep = useMacroRunner(computed(() => 'M98 P"0:/macros/meltingplot/z-probe/offset/apply-babystepping"'));
const discarding = ref(false);
async function discardBabystep() {
	discarding.value = true;
	try {
		await sendChecked("M290 R0 S0");
	} catch {
		// sendCode reported it
	} finally {
		discarding.value = false;
	}
}

const compensation = computed(() => machineStore.model.move.compensation);
const probe = computed(() => machineStore.model.sensors.probes.find((p) => p !== null) ?? null);
</script>
