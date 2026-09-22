<style scoped>
.job {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
	gap: 14px;
}
.col {
	display: flex;
	flex-direction: column;
	gap: 12px;
	min-height: 0;
}
.camera {
	position: relative;
	flex: 1;
	min-height: 160px;
	border-radius: var(--mp-radius-lg);
	overflow: hidden;
	background: #0B0F13;
}
.camera__view {
	position: absolute;
	inset: 0;
}
.camera__tag {
	position: absolute;
	top: 10px;
	left: 12px;
	color: #fff;
	font: 600 12px/1 var(--mp-font-body, sans-serif);
	letter-spacing: 0.06em;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.progress {
	padding: 14px 18px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.progress__pct {
	font: 800 44px/1 var(--mp-font-mono, monospace);
	color: var(--text-strong);
}
.stats {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 10px;
}
.stats .chx-value {
	font-size: 18px;
}
.name {
	font: 500 12px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.controls {
	display: flex;
	gap: 10px;
}
.controls > * {
	flex: 1;
}
.chart-card {
	padding: 12px 16px;
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-height: 0;
}
.chart-card__head {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
}
.chart-card__body {
	flex: 1;
	min-height: 60px;
}
.legend {
	display: flex;
	justify-content: space-between;
	font: 500 11px/1 var(--mp-font-mono, monospace);
	color: var(--text-body);
}
.tools {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
	gap: 10px;
}
.tool {
	padding: 10px 12px;
	border-radius: var(--mp-radius);
	background: var(--surface-page);
}
.idle {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 14px;
	color: var(--text-body);
	text-align: center;
}
</style>

<template>
	<div class="chx-page">
		<ChxPageHeader :title="$t('plugins.CHX350.job.title')" :subtitle="jobName" :back="ROUTES.start">
			<template #actions>
				<v-btn variant="outlined" class="chx-btn" @click="router.push(ROUTES.analysis)">
					<v-icon start>mdi-chart-box-outline</v-icon>
					{{ $t("plugins.CHX350.job.analysis") }}
				</v-btn>
			</template>
		</ChxPageHeader>

		<FaultBanner />

		<div v-if="state.printing.value || hasJobData" class="job">
			<div class="col">
				<div class="camera">
					<div class="camera__view">
						<WebcamView v-if="settingsStore.webcam.enabled" />
						<div v-else class="d-flex align-center justify-center fill-height text-grey">
							<v-icon size="48">mdi-camera-off-outline</v-icon>
						</div>
					</div>
					<div class="camera__tag">{{ $t("plugins.CHX350.start.camera") }}</div>
				</div>

				<div class="chx-card progress">
					<div class="d-flex align-center justify-space-between">
						<div class="progress__pct">{{ (progress * 100).toFixed(1) }} %</div>
						<v-chip size="small" label variant="tonal" :color="state.paused.value ? 'warning' : 'primary'">
							{{ $t(`plugins.CHX350.status.${state.plate.value}`) }}
						</v-chip>
					</div>
					<v-progress-linear :model-value="progress * 100" height="8" rounded color="secondary" />
					<div class="stats">
						<div>
							<div class="chx-label">{{ $t("plugins.CHX350.job.timeLeft") }}</div>
							<div class="chx-value">{{ timeLeft !== null ? displayTime(timeLeft) : "—" }}</div>
						</div>
						<div>
							<div class="chx-label">{{ $t("plugins.CHX350.job.layer") }}</div>
							<div class="chx-value">{{ layerLabel }}</div>
						</div>
						<div>
							<div class="chx-label">{{ $t("plugins.CHX350.job.finishAt") }}</div>
							<div class="chx-value">{{ finishAt }}</div>
						</div>
					</div>
					<div class="name" :title="jobName">{{ $t("plugins.CHX350.job.part") }} · {{ jobName }}</div>

					<div v-if="state.printing.value" class="controls">
						<CodeButton :code="state.paused.value ? 'M24' : 'M25'" :color="state.paused.value ? 'secondary' : 'accent'"
									size="x-large" class="chx-btn" :disabled="isPausing || isCancelling">
							<v-icon start>{{ state.paused.value ? "mdi-play" : "mdi-pause" }}</v-icon>
							{{ state.paused.value ? $t("plugins.CHX350.job.resume") : $t("plugins.CHX350.job.pause") }}
						</CodeButton>
						<template v-if="state.paused.value">
							<v-btn variant="outlined" size="x-large" class="chx-btn" :disabled="isCancelling" @click="router.push(ROUTES.filament)">
								<v-icon start>mdi-swap-horizontal</v-icon>
								{{ $t("plugins.CHX350.nav.filament") }}
							</v-btn>
							<v-btn color="error" variant="flat" size="x-large" class="chx-btn" :disabled="isCancelling" :loading="cancelling" @click="cancelJob">
								<v-icon start>mdi-stop</v-icon>
								{{ $t("plugins.CHX350.job.cancel") }}
							</v-btn>
						</template>
					</div>
					<div v-else class="controls">
						<v-btn color="secondary" size="x-large" class="chx-btn" :disabled="!lastFile" @click="repeat">
							<v-icon start>mdi-repeat</v-icon>
							{{ $t("plugins.CHX350.job.repeat") }}
						</v-btn>
						<v-btn variant="outlined" size="x-large" class="chx-btn" @click="router.push(ROUTES.jobs)">
							{{ $t("plugins.CHX350.start.printTitle") }}
						</v-btn>
					</div>
				</div>
			</div>

			<div class="col">
				<div class="chx-card chart-card">
					<div class="chart-card__head">
						<span class="chx-label">{{ tempChannel ? $t("plugins.CHX350.job.tempPerLayer", { sensor: tempChannel.label }) : $t("plugins.CHX350.job.tempPerLayerNone") }}</span>
						<span class="chx-value" style="font-size: 16px">{{ tempNow }}</span>
					</div>
					<div class="chart-card__body">
						<LayerStrip v-if="tempChannel" :values="tempChannel.values" :total="totalLayers" :range="tempRange" :marker="analysis.currentIndex.value" />
					</div>
					<div class="legend">
						<span>{{ $t("plugins.CHX350.job.layerN", { n: 1 }) }}</span>
						<span>{{ tempRange[0].toFixed(0) }} – {{ tempRange[1].toFixed(0) }} °C</span>
						<span>{{ layerLabel }}</span>
					</div>
				</div>

				<div class="chx-card chart-card">
					<div class="chart-card__head">
						<span class="chx-label">{{ $t("plugins.CHX350.job.filamentUsage") }}</span>
						<span class="chx-value" style="font-size: 16px">{{ filamentUsedLabel }} <span class="text-body-2 text-medium-emphasis">{{ filamentTotalLabel }}</span></span>
					</div>
					<div class="chart-card__body">
						<FilamentUsageChart :cumulative="analysis.cumulativeFilament.value" :total="filamentTotal" :total-layers="totalLayers" :format="formatGrams" />
					</div>
				</div>

				<div class="tools">
					<div v-for="t in temps.tools.value" :key="t.number" class="tool">
						<div class="chx-label">T{{ t.number }} · {{ t.filament || $t("plugins.CHX350.start.noFilament") }}</div>
						<div class="chx-value">{{ formatTemp(t.current) }} <span class="text-body-2 text-medium-emphasis">/ {{ (t.active ?? 0) > 0 ? formatTemp(t.active, 0) : $t("plugins.CHX350.generic.off") }}</span></div>
					</div>
					<div class="tool">
						<div class="chx-label">{{ $t("plugins.CHX350.header.bed") }}</div>
						<div class="chx-value">{{ formatTemp(temps.bedCurrent.value) }} <span class="text-body-2 text-medium-emphasis">/ {{ (temps.bedActive.value ?? 0) > 0 ? formatTemp(temps.bedActive.value, 0) : $t("plugins.CHX350.generic.off") }}</span></div>
					</div>
				</div>
			</div>
		</div>

		<div v-else class="idle">
			<v-icon size="64" color="grey">mdi-printer-3d-nozzle-outline</v-icon>
			<div class="text-h6">{{ $t("plugins.CHX350.job.noJob") }}</div>
			<v-btn color="secondary" size="x-large" class="chx-btn" @click="router.push(ROUTES.jobs)">
				<v-icon start>mdi-play</v-icon>
				{{ $t("plugins.CHX350.start.printTitle") }}
			</v-btn>
		</div>
	</div>
</template>

<script setup lang="ts">
import { MachineStatus } from "@duet3d/objectmodel";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import CodeButton from "@/components/buttons/CodeButton.vue";
import WebcamView from "@/components/panels/WebcamView.vue";
import { showConfirmDialog } from "@/composables/useConfirmDialog";
import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { useSettingsStore } from "@/stores/settings";
import { displayTime } from "@/utils/display";
import { escapeFilename, extractFileName } from "@/utils/path";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import FaultBanner from "../components/FaultBanner.vue";
import FilamentUsageChart from "../components/FilamentUsageChart.vue";
import LayerStrip from "../components/LayerStrip.vue";
import { channelRange, useJobAnalysis } from "../composables/useJobAnalysis";
import { useMachineState } from "../composables/useMachineState";
import { formatTemp, useTemps } from "../composables/useTemps";
import { ROUTES } from "../routes";

const machineStore = useMachineStore();
const settingsStore = useSettingsStore();
const router = useRouter();
const state = useMachineState();
const temps = useTemps();
const analysis = useJobAnalysis();

const job = computed(() => machineStore.model.job);
const status = computed(() => machineStore.model.state.status);
const isPausing = computed(() => status.value === MachineStatus.pausing);
const isCancelling = computed(() => status.value === MachineStatus.cancelling);

const lastFile = computed(() => job.value.lastFileName);
const jobName = computed(() => {
	const name = job.value.file?.fileName || lastFile.value;
	return name ? extractFileName(name) : "";
});
const hasJobData = computed(() => analysis.layers.value.length > 0 || lastFile.value !== null);

const progress = computed(() => machineStore.jobProgress);
const totalLayers = computed(() => job.value.file?.numLayers || analysis.layers.value.length);
const layerLabel = computed(() => {
	const layer = job.value.layer;
	const total = totalLayers.value;
	if (!state.printing.value) {
		return total > 0 ? `${analysis.layers.value.length} / ${total}` : "—";
	}
	return layer !== null ? `${layer} / ${total || "?"}` : "—";
});

// Same priority as JobTimesPanel: slicer estimate first, then filament, then file position
const timeLeft = computed<number | null>(() => {
	if (!state.printing.value) {
		return null;
	}
	const t = job.value.timesLeft;
	return t.slicer ?? t.filament ?? t.file ?? null;
});
const finishAt = computed(() => {
	if (timeLeft.value === null) {
		return "—";
	}
	const eta = new Date(Date.now() + timeLeft.value * 1000);
	const sameDay = eta.toDateString() === new Date().toDateString();
	const time = eta.toLocaleTimeString(settingsStore.locale, { hour: "2-digit", minute: "2-digit" });
	return sameDay ? time : `${eta.toLocaleDateString(settingsStore.locale, { weekday: "short" })} ${time}`;
});

// Chamber temperature per layer: the chamber heater's sensor if any, else the SZP coil sensor
const szpChannel = analysis.temperatureChannel((s) => (s.name ?? "").trim().toLowerCase() === "szp coil");
const chamberSensorIndex = computed(() => temps.chamberHeater.value?.sensor ?? -1);
const chamberChannel = analysis.temperatureChannel((_s, i) => i === chamberSensorIndex.value);
const tempChannel = computed(() => chamberChannel.value ?? szpChannel.value);
const tempRange = computed<[number, number]>(() => tempChannel.value ? channelRange(tempChannel.value) : [0, 1]);
const tempNow = computed(() => {
	const ch = tempChannel.value;
	if (!ch) {
		return "—";
	}
	const v = ch.values[analysis.currentIndex.value];
	return v !== null && v !== undefined ? `${v.toFixed(1)} °C` : "—";
});

// Filament: mm → g using the extruder's filament diameter and an assumed density of 1.24 g/cm³
// (the object model carries no material density; grams are an orientation value only)
const DENSITY = 1.24;
function mmToGrams(mm: number): number {
	const d = machineStore.model.move.extruders[0]?.filamentDiameter ?? 1.75;
	return (Math.PI * (d / 2) ** 2 * mm) / 1000 * DENSITY;
}
const formatGrams = (mm: number) => `${Math.round(mmToGrams(mm))} g`;
const filamentTotal = computed(() => (job.value.file?.filament ?? []).reduce((a, b) => a + b, 0));
const filamentUsed = computed(() => job.value.rawExtrusion ?? analysis.cumulativeFilament.value[analysis.cumulativeFilament.value.length - 1] ?? 0);
const filamentUsedLabel = computed(() => formatGrams(filamentUsed.value));
const filamentTotalLabel = computed(() => filamentTotal.value > 0 ? i18n.global.t("plugins.CHX350.job.ofTotal", { total: formatGrams(filamentTotal.value) }) : "");

const cancelling = ref(false);
async function cancelJob() {
	if (!(await showConfirmDialog(i18n.global.t("plugins.CHX350.job.cancelTitle"), i18n.global.t("plugins.CHX350.job.cancelPrompt"), "mdi-stop"))) {
		return;
	}
	cancelling.value = true;
	try {
		await machineStore.sendCode("M0");
	} finally {
		cancelling.value = false;
	}
}

async function repeat() {
	const file = lastFile.value;
	if (!file) {
		return;
	}
	const name = extractFileName(file);
	if (await showConfirmDialog(i18n.global.t("dialog.startJob.title", [name]), i18n.global.t("dialog.startJob.prompt", [name]), "mdi-play")) {
		await machineStore.sendCode(`M32 "${escapeFilename(file)}"`);
	}
}
</script>
