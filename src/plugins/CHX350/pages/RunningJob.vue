<style scoped>
/* Layout follows the prototype: camera + progress card on top (2.6 parts), the two per-layer
   charts below (1 part). Everything is sized by flex so the page never scrolls on 1280×800 */
.top {
	flex: 2.6 1 0;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr) 332px;
	gap: 14px;
	align-items: stretch;
}
.bottom {
	flex: 1 1 0;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1.18fr);
	gap: 14px;
	align-items: stretch;
}
.camera {
	min-height: 0;
}
.pill {
	position: absolute;
	top: 14px;
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px 13px;
	border-radius: var(--mp-radius-pill, 999px);
	background: rgba(0, 0, 0, 0.6);
	color: #fff;
	font: 700 12px/1 var(--mp-font-body, sans-serif);
	letter-spacing: 0.09em;
	max-width: 46%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.pill--live {
	left: 14px;
}
.pill--live::before {
	content: "";
	width: 9px;
	height: 9px;
	border-radius: 999px;
	background: var(--mp-error);
	flex: none;
}
.pill--tool {
	right: 14px;
	font-family: var(--mp-font-mono, monospace);
	letter-spacing: 0.06em;
}
.side {
	display: flex;
	flex-direction: column;
	gap: 12px;
	min-height: 0;
}
.progress {
	flex: 1 1 0;
	min-height: 0;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	padding: 16px 18px;
}
.progress__head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 10px;
}
.progress__pct {
	font: 800 52px/1 var(--mp-font-body, sans-serif);
	letter-spacing: -0.02em;
	color: var(--text-strong);
}
.progress__bar {
	margin-top: 10px;
	height: 12px;
	border-radius: var(--mp-radius-pill, 999px);
	background: var(--surface-sunken);
	overflow: hidden;
}
.progress__fill {
	height: 100%;
	border-radius: var(--mp-radius-pill, 999px);
	background: var(--mp-primary-dark);
	transition: width 0.6s ease;
}
.progress__fill--paused {
	background: var(--mp-accent);
}
.stats {
	margin-top: 12px;
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 10px;
}
.stats .chx-value {
	margin-top: 5px;
	font-size: 21px;
	line-height: 1;
	white-space: nowrap;
}
.stats .chx-value small {
	font-size: 13px;
	font-weight: 500;
	color: var(--text-body);
}
.part {
	margin-top: auto;
	padding-top: 12px;
	border-top: 1px solid var(--border-subtle);
	display: flex;
	align-items: center;
	gap: 12px;
	min-height: 0;
}
.part__thumb {
	width: 52px;
	height: 52px;
	border-radius: var(--mp-radius);
	background: var(--mp-neutral-900);
	flex: none;
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--mp-neutral-400);
	overflow: hidden;
}
.part__thumb img {
	width: 100%;
	height: 100%;
	object-fit: contain;
}
.controls {
	flex: none;
	min-height: 122px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.controls__row {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 10px;
}
.chart-card {
	padding: 12px 16px;
	display: flex;
	flex-direction: column;
	gap: 6px;
	min-height: 0;
	overflow: hidden;
}
.chart-card__head {
	flex: none;
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: 10px;
}
.chart-card__head .chx-value {
	font-size: 16px;
	white-space: nowrap;
}
.chart-card__body {
	flex: 1;
	min-height: 40px;
	position: relative;
}
.chart-card__empty {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	text-align: center;
	padding: 0 12px;
	font: 400 12px/1.4 var(--mp-font-body, sans-serif);
	color: var(--text-muted);
}
.legend {
	flex: none;
	display: flex;
	justify-content: space-between;
	font: 500 11px/1 var(--mp-font-mono, monospace);
	color: var(--text-body);
}
.filament-card {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 200px;
	gap: 14px;
	padding: 12px 14px;
	min-height: 0;
	overflow: hidden;
}
.filament-card__chart {
	min-width: 0;
	min-height: 0;
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.machine {
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-width: 0;
	overflow: hidden;
}
.machine__row {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 8px;
	font: 700 13px/1.2 var(--mp-font-mono, monospace);
	color: var(--text-strong);
}
.machine__key {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font: 500 11px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.machine__val {
	flex: none;
	font-size: 15px;
}
.machine__val small {
	font-size: 11px;
	font-weight: 500;
	color: var(--text-body);
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
		<ChxPageHeader :subtitle="job.fileName.value" :back="ROUTES.start">
			<template #actions>
				<v-btn variant="outlined" class="chx-btn" :disabled="job.layersDone.value === 0" @click="router.push(ROUTES.analysis)">
					<v-icon start>mdi-chart-box-outline</v-icon>
					{{ $t("plugins.CHX350.job.analysis") }}
				</v-btn>
			</template>
		</ChxPageHeader>

		<FaultBanner />

		<template v-if="job.active.value || hasJobData">
			<div class="top">
				<ChxCameraBox fill class="camera">
					<ChxCamera />
					<div v-if="webcamEnabled" class="pill pill--live">{{ $t("plugins.CHX350.job.live") }}</div>
					<div v-if="job.active.value && toolPill" class="pill pill--tool" :title="toolPill">{{ toolPill }}</div>
				</ChxCameraBox>

				<div class="side">
					<div class="chx-card progress">
						<div class="progress__head">
							<div class="progress__pct">{{ progressLabel }}</div>
							<!-- While a job runs the header plate shows its state; the chip only reports how the last job ended -->
							<v-chip v-if="!job.active.value && job.lastResult.value" size="small" label variant="tonal" :color="chipColor">{{ chipLabel }}</v-chip>
						</div>
						<div class="progress__bar">
							<div class="progress__fill" :class="{ 'progress__fill--paused': job.paused.value }" :style="{ width: `${(job.progress.value * 100).toFixed(1)}%` }" />
						</div>

						<div class="stats">
							<div v-if="job.active.value">
								<div class="chx-label">{{ $t("plugins.CHX350.job.timeLeft") }}</div>
								<div class="chx-value">{{ job.timeLeft.value !== null ? formatTimeLeft(job.timeLeft.value) : "—" }}</div>
							</div>
							<div v-else>
								<div class="chx-label">{{ $t("plugins.CHX350.job.duration") }}</div>
								<div class="chx-value">{{ job.lastDuration.value !== null ? displayTime(job.lastDuration.value) : "—" }}</div>
							</div>
							<div>
								<div class="chx-label">{{ $t("plugins.CHX350.job.layer") }}</div>
								<div class="chx-value">{{ layerLabel }}</div>
							</div>
							<div v-if="job.active.value">
								<div class="chx-label">{{ $t("plugins.CHX350.job.finishAt") }}</div>
								<div class="chx-value">{{ job.finishAt.value }}</div>
							</div>
							<div v-else>
								<div class="chx-label">{{ $t("plugins.CHX350.job.elapsed") }}</div>
								<div class="chx-value">{{ analysisDuration }}</div>
							</div>
							<div>
								<div class="chx-label">{{ $t("plugins.CHX350.job.height") }}</div>
								<div class="chx-value">{{ heightLabel.value }} <small v-if="heightLabel.total">/ {{ heightLabel.total }}</small></div>
							</div>
						</div>

						<!-- The file name is already the page header's context line, so the part row only shows the preview -->
						<div v-if="job.thumbnailUrl.value" class="part">
							<div class="part__thumb">
								<img :src="job.thumbnailUrl.value" alt="">
							</div>
							<div class="chx-label">{{ $t("plugins.CHX350.job.part") }}</div>
						</div>
					</div>

					<div v-if="job.active.value" class="controls">
						<CodeButton :code="job.paused.value ? 'M24' : 'M25'" :color="job.paused.value ? 'secondary' : 'accent'"
									size="x-large" class="chx-btn" :disabled="job.pausing.value || job.resuming.value || job.cancelling.value"
									:loading="job.pausing.value || job.resuming.value">
							<v-icon start>{{ job.paused.value ? "mdi-play" : "mdi-pause" }}</v-icon>
							{{ job.paused.value ? $t("plugins.CHX350.job.resume") : $t("plugins.CHX350.job.pause") }}
						</CodeButton>
						<div v-if="job.paused.value" class="controls__row">
							<v-btn variant="outlined" size="x-large" class="chx-btn" :disabled="job.cancelling.value" @click="router.push(ROUTES.filament)">
								<v-icon start>mdi-swap-horizontal</v-icon>
								{{ $t("plugins.CHX350.nav.filament") }}
							</v-btn>
							<v-btn color="error" variant="outlined" size="x-large" class="chx-btn" :disabled="job.cancelling.value" :loading="cancelling || job.cancelling.value" @click="cancelJob">
								<v-icon start>mdi-close</v-icon>
								{{ $t("plugins.CHX350.job.cancel") }}
							</v-btn>
						</div>
					</div>
					<div v-else class="controls">
						<v-btn color="secondary" size="x-large" class="chx-btn" :disabled="!job.lastFilePath.value" @click="repeat">
							<v-icon start>mdi-repeat</v-icon>
							{{ $t("plugins.CHX350.job.repeat") }}
						</v-btn>
						<v-btn variant="outlined" size="x-large" class="chx-btn" @click="router.push(ROUTES.jobs)">
							{{ $t("plugins.CHX350.start.printTitle") }}
						</v-btn>
					</div>
				</div>
			</div>

			<div class="bottom">
				<div class="chx-card chart-card">
					<div class="chart-card__head">
						<span class="chx-label">{{ tempTitle }}</span>
						<span class="chx-value">{{ tempNow }}</span>
					</div>
					<div class="chart-card__body">
						<LayerStrip v-if="tempChannel" :values="tempChannel.values" :total="totalLayers" :range="tempRange" :marker="analysis.currentIndex.value" />
						<div v-if="!tempChannel || job.layersDone.value === 0" class="chart-card__empty">
							{{ hasChamberSensor ? $t("plugins.CHX350.job.noLayerData") : $t("plugins.CHX350.job.noTempSensor") }}
						</div>
					</div>
					<div class="legend">
						<span>{{ $t("plugins.CHX350.job.layerN", { n: 1 }) }}</span>
						<span>{{ tempRangeLabel }}</span>
						<span>{{ $t("plugins.CHX350.job.layerN", { n: totalLayers || "?" }) }}</span>
					</div>
				</div>

				<div class="chx-card filament-card">
					<div class="filament-card__chart">
						<div class="chart-card__head">
							<span class="chx-label">{{ $t("plugins.CHX350.job.filamentUsage") }}</span>
							<span class="chx-value">{{ filamentUsedLabel }} <span class="text-body-2 text-medium-emphasis">{{ filamentTotalLabel }}</span></span>
						</div>
						<div class="chart-card__body">
							<FilamentUsageChart :cumulative="analysis.cumulativeFilament.value" :total="job.filamentTotal.value" :total-layers="totalLayers" :format="formatGrams" />
						</div>
					</div>

					<!-- Spool fill level / remaining filament per tool is a deferred feature; the slot
						 shows the live machine figures the operator watches during a print instead.
						 Bed and chamber readings are in the header, so the bed row only adds its setpoint -->
					<div class="machine">
						<div class="chx-label">{{ $t("plugins.CHX350.job.machine") }}</div>
						<div v-for="t in temps.tools.value" :key="t.number" class="machine__row">
							<span class="machine__key" :title="t.filament">T{{ t.number }} · {{ t.filament || $t("plugins.CHX350.start.noFilament") }}</span>
							<span class="machine__val">{{ formatTemp(t.current, 0) }} <small>/ {{ (t.active ?? 0) > 0 ? formatTemp(t.active, 0) : $t("plugins.CHX350.generic.off") }}</small></span>
						</div>
						<div class="machine__row">
							<span class="machine__key">{{ $t("plugins.CHX350.header.bed") }}</span>
							<span class="machine__val"><small>{{ $t("plugins.CHX350.preheat.target") }}</small> {{ (temps.bedActive.value ?? 0) > 0 ? formatTemp(temps.bedActive.value, 0) : $t("plugins.CHX350.generic.off") }}</span>
						</div>
						<div v-if="job.active.value" class="machine__row">
							<span class="machine__key">{{ $t("plugins.CHX350.job.speed") }} · {{ $t("plugins.CHX350.job.fan") }}</span>
							<span class="machine__val">{{ Math.round(job.speedFactor.value * 100) }} % <small>· {{ job.partFan.value !== null ? Math.round(job.partFan.value * 100) + " %" : "—" }}</small></span>
						</div>
					</div>
				</div>
			</div>
		</template>

		<div v-else class="idle">
			<v-icon size="64" class="chx-icon-muted">mdi-printer-3d-nozzle-outline</v-icon>
			<div class="text-h6">{{ $t("plugins.CHX350.job.noJob") }}</div>
			<v-btn color="secondary" size="x-large" class="chx-btn" @click="router.push(ROUTES.jobs)">
				<v-icon start>mdi-play</v-icon>
				{{ $t("plugins.CHX350.start.printTitle") }}
			</v-btn>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import CodeButton from "@/components/buttons/CodeButton.vue";
import { showConfirmDialog } from "@/composables/useConfirmDialog";
import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { useSettingsStore } from "@/stores/settings";
import { displayTime } from "@/utils/display";
import { escapeFilename, extractFileName } from "@/utils/path";

import ChxCamera from "../components/ChxCamera.vue";
import ChxCameraBox from "../components/ChxCameraBox.vue";
import ChxPageHeader from "../components/ChxPageHeader.vue";
import FaultBanner from "../components/FaultBanner.vue";
import FilamentUsageChart from "../components/FilamentUsageChart.vue";
import LayerStrip from "../components/LayerStrip.vue";
import { useJob } from "../composables/useJob";
import { channelRange, useJobAnalysis } from "../composables/useJobAnalysis";
import { formatTemp, useTemps } from "../composables/useTemps";
import { ROUTES } from "../routes";

const machineStore = useMachineStore();
const settingsStore = useSettingsStore();
const router = useRouter();
const temps = useTemps();
const analysis = useJobAnalysis();
const job = useJob();

const webcamEnabled = computed(() => settingsStore.webcam.enabled);
const hasJobData = computed(() => job.layersDone.value > 0 || job.lastFilePath.value !== null);

const progressLabel = computed(() => `${(job.progress.value * 100).toFixed(1)} %`);

// Chip: how the last job ended (a running job's state is on the header plate)
const chipLabel = computed(() => job.lastResult.value ? i18n.global.t(`plugins.CHX350.job.result.${job.lastResult.value}`) : "");
const chipColor = computed(() => job.lastResult.value === "finished" ? "success" : "warning");

const toolPill = computed(() => {
	const tool = temps.tools.value.find((t) => t.number === job.currentTool.value);
	return tool ? `T${tool.number} · ${tool.filament || i18n.global.t("plugins.CHX350.start.noFilament")}` : "";
});

const totalLayers = computed(() => job.numLayers.value || job.layersDone.value);
const layerLabel = computed(() => {
	if (!job.active.value) {
		return job.layersDone.value > 0 ? `${job.layersDone.value} / ${totalLayers.value}` : "—";
	}
	const layer = job.layer.value;
	return layer !== null ? `${layer} / ${totalLayers.value || "?"}` : "—";
});
const heightLabel = computed<{ value: string; total: string }>(() => {
	const total = job.height.value;
	if (job.active.value) {
		const h = job.currentHeight.value;
		return { value: h !== null ? h.toFixed(1) : "—", total: total !== null ? `${total.toFixed(1)} mm` : "" };
	}
	const printed = analysis.heights.value[analysis.heights.value.length - 1];
	return { value: printed !== undefined ? `${printed.toFixed(1)} mm` : "—", total: "" };
});
// Remaining time without seconds once it is measured in hours: they only flicker
function formatTimeLeft(seconds: number): string {
	if (seconds < 3600) {
		return displayTime(seconds);
	}
	const h = Math.floor(seconds / 3600);
	const m = Math.round((seconds % 3600) / 60);
	return m === 60 ? `${h + 1}h 0m` : `${h}h ${m}m`;
}
// Sum of the per-layer durations of the last job (job.duration is reset once it ends)
const analysisDuration = computed(() => {
	const sum = analysis.layers.value.reduce((a, l) => a + (l.duration ?? 0), 0);
	return sum > 0 ? displayTime(sum) : "—";
});

// Chamber temperature per layer: the chamber heater's sensor if any, else the SZP coil sensor
const szpChannel = analysis.temperatureChannel((s) => (s.name ?? "").trim().toLowerCase() === "szp coil");
const chamberSensorIndex = computed(() => temps.chamberHeater.value?.sensor ?? -1);
const chamberChannel = analysis.temperatureChannel((_s, i) => i === chamberSensorIndex.value);
const tempChannel = computed(() => chamberChannel.value ?? szpChannel.value);
// The channel only resolves once a completed layer carries temperatures, so sensor presence is
// taken from the live model rather than from the channel
const hasChamberSensor = computed(() => temps.chamberSource.value !== "none");
const tempTitle = computed(() => {
	if (!hasChamberSensor.value) {
		return i18n.global.t("plugins.CHX350.job.tempPerLayerNone");
	}
	const sensor = temps.chamberSource.value === "szp" ? i18n.global.t("plugins.CHX350.header.chamberSzp") : i18n.global.t("plugins.CHX350.header.chamber");
	return i18n.global.t("plugins.CHX350.job.tempPerLayer", { sensor });
});
const tempRange = computed<[number, number]>(() => tempChannel.value && job.layersDone.value > 0 ? channelRange(tempChannel.value) : [0, 1]);
const tempRangeLabel = computed(() => job.layersDone.value > 0 && tempChannel.value
	? `${tempRange.value[0].toFixed(0)} – ${tempRange.value[1].toFixed(0)} °C`
	: "—");
// Value of the marked (last completed) layer; the live reading is in the header
const tempNow = computed(() => {
	const v = tempChannel.value?.values[analysis.currentIndex.value];
	return v !== null && v !== undefined ? formatTemp(v) : "—";
});

const formatGrams = (mm: number) => `${Math.round(job.mmToGrams(mm))} g`;
const filamentUsed = computed(() => job.active.value
	? job.filamentUsed.value
	: (analysis.cumulativeFilament.value[analysis.cumulativeFilament.value.length - 1] ?? 0));
const filamentUsedLabel = computed(() => formatGrams(filamentUsed.value));
const filamentTotalLabel = computed(() => job.filamentTotal.value > 0
	? i18n.global.t("plugins.CHX350.job.ofTotal", { total: formatGrams(job.filamentTotal.value) })
	: "");

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
	const file = job.lastFilePath.value;
	if (!file) {
		return;
	}
	const name = extractFileName(file);
	if (await showConfirmDialog(i18n.global.t("dialog.startJob.title", [name]), i18n.global.t("dialog.startJob.prompt", [name]), "mdi-play")) {
		await machineStore.sendCode(`M32 "${escapeFilename(file)}"`);
	}
}
</script>
