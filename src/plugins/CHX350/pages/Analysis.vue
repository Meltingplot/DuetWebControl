<style scoped>
.analysis {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr) 300px;
	/* One row as high as the page leaves, so a long channel list scrolls instead of growing it */
	grid-template-rows: minmax(0, 1fr);
	gap: 14px;
}
.main {
	display: flex;
	flex-direction: column;
	gap: 12px;
	min-height: 0;
}
.strip-card {
	flex: 1;
	padding: 14px 16px;
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-height: 0;
}
.strip-card__body {
	flex: 1;
	min-height: 120px;
}
.axis {
	display: flex;
	justify-content: space-between;
	font: 500 11px/1 var(--mp-font-mono, monospace);
	color: var(--text-body);
}
.kpis {
	display: grid;
	grid-template-columns: repeat(5, minmax(0, 1fr));
	gap: 10px;
}
.kpi {
	padding: 10px 12px;
	border-radius: var(--mp-radius);
	background: var(--surface-card);
	border: 1px solid var(--border-subtle);
}
.kpi .chx-value {
	font-size: 17px;
}
.side {
	display: flex;
	flex-direction: column;
	gap: 12px;
	min-height: 0;
}
/* QA adds heater load and filament monitor channels per tool; the list scrolls rather than
   pushing the page */
.channels {
	flex: 0 1 auto;
	min-height: 0;
	overflow: auto;
	padding: 12px 14px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.channel {
	all: unset;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	gap: 10px;
	min-height: 44px;
	padding: 6px 12px;
	border-radius: var(--mp-radius);
	background: var(--surface-page);
	color: var(--text-strong);
	font: 600 13px/1.2 var(--mp-font-body, sans-serif);
	cursor: pointer;
}
.channel--active {
	background: var(--mp-primary-dark);
	color: #fff;
}
.legend {
	font: 400 12px/1.35 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.placeholder {
	padding: 12px 14px;
	/* Fills the space below the channels but never shrinks below its text; the channels scroll */
	flex: 1 0 auto;
	display: flex;
	flex-direction: column;
	gap: 6px;
	color: var(--text-muted);
	font: 400 12px/1.35 var(--mp-font-body, sans-serif);
}
.nav-btns {
	display: flex;
	gap: 8px;
}
.empty {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 12px;
	color: var(--text-muted);
	text-align: center;
}
</style>

<template>
	<div class="chx-page">
		<ChxPageHeader :subtitle="jobName" :back="ROUTES.history">
			<template #actions>
				<v-btn variant="outlined" class="chx-btn" :disabled="count === 0" @click="exportCsv">
					<v-icon start>mdi-download</v-icon>
					{{ $t("plugins.CHX350.analysis.export") }}
				</v-btn>
			</template>
		</ChxPageHeader>

		<div v-if="count > 0" class="analysis">
			<div class="main">
				<div class="chx-card strip-card">
					<div class="d-flex justify-space-between align-baseline">
						<span class="chx-label">{{ channelLabel(activeChannel) }}</span>
						<span class="chx-value" style="font-size: 15px">{{ $t("plugins.CHX350.analysis.layerHint") }}</span>
					</div>
					<div class="strip-card__body">
						<LayerStrip :values="activeChannel.values" :range="range" :marker="layer" interactive @pick="layer = $event" />
					</div>
					<div class="axis">
						<span>{{ $t("plugins.CHX350.job.layerN", { n: 1 }) }}</span>
						<span>{{ formatValue(range[0]) }} – {{ formatValue(range[1]) }}</span>
						<span>{{ $t("plugins.CHX350.job.layerN", { n: count }) }}</span>
					</div>
					<div class="nav-btns">
						<v-btn variant="outlined" class="chx-btn" icon="mdi-chevron-left" :disabled="layer <= 0" @click="layer--" />
						<v-slider v-model="layer" :min="0" :max="count - 1" :step="1" hide-details color="secondary" class="flex-grow-1" />
						<v-btn variant="outlined" class="chx-btn" icon="mdi-chevron-right" :disabled="layer >= count - 1" @click="layer++" />
					</div>
				</div>

				<div class="kpis">
					<div class="kpi">
						<div class="chx-label">{{ $t("plugins.CHX350.job.layer") }}</div>
						<div class="chx-value">{{ layer + 1 }} / {{ count }}</div>
					</div>
					<div class="kpi">
						<div class="chx-label">{{ $t("plugins.CHX350.analysis.heightZ") }}</div>
						<div class="chx-value">{{ display(heights[layer], 2, "mm") }}</div>
					</div>
					<div class="kpi">
						<div class="chx-label">{{ $t("plugins.CHX350.analysis.channelDuration") }}</div>
						<div class="chx-value">{{ displayTime(channelByKey("duration")?.values[layer] ?? 0, false) }}</div>
					</div>
					<div class="kpi">
						<div class="chx-label">{{ $t("plugins.CHX350.analysis.channelFlow") }}</div>
						<div class="chx-value">{{ valueOf(channelByKey("flow")) }}</div>
					</div>
					<div class="kpi">
						<div class="chx-label">{{ channelLabel(kpiChannel) }}</div>
						<div class="chx-value">{{ valueOf(kpiChannel) }}</div>
					</div>
				</div>
			</div>

			<div class="side">
				<div class="chx-card channels">
					<div class="chx-label">{{ $t("plugins.CHX350.analysis.channel") }}</div>
					<button v-for="ch in channels" :key="ch.key" type="button" class="channel"
							:class="{ 'channel--active': ch.key === activeKey }" @click="activeKey = ch.key">
						<v-icon size="18">{{ channelIcon(ch.key) }}</v-icon>
						{{ channelLabel(ch) }}
					</button>
					<div class="legend">{{ $t("plugins.CHX350.analysis.legend") }}</div>
				</div>
				<div class="chx-card placeholder">
					<div class="chx-label">{{ $t("plugins.CHX350.analysis.findings") }}</div>
					<div>{{ $t("plugins.CHX350.analysis.findingsSoon") }}</div>
				</div>
			</div>
		</div>

		<div v-else class="empty">
			<v-progress-circular v-if="loading" indeterminate color="primary" />
			<template v-else>
				<v-icon size="64">{{ loadError !== null ? "mdi-alert-circle-outline" : "mdi-chart-box-outline" }}</v-icon>
				<div>{{ emptyText }}</div>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { display, displayTime } from "@/utils/display";
import { saveBlob } from "@/utils/download";
import { extractFileName } from "@/utils/path";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import LayerStrip from "../components/LayerStrip.vue";
import { channelRange, useJobAnalysis, type JobLayers, type LayerChannel } from "../composables/useJobAnalysis";
import { useRecordedJobAnalysis } from "../composables/useRecordedJobAnalysis";
import { ROUTES } from "../routes";

const machineStore = useMachineStore();
const route = useRoute();

/** QA job id from the history; without one the page shows the running/last job from the object model */
const jobId = computed(() => typeof route.query.id === "string" && route.query.id !== "" ? route.query.id : null);
const live = useJobAnalysis();
const recorded = useRecordedJobAnalysis(jobId);
const analysis = computed<JobLayers>(() => (jobId.value !== null ? recorded : live));
const count = computed(() => analysis.value.count.value);
const heights = computed(() => analysis.value.heights.value);
const channels = computed(() => analysis.value.channels.value);

const loading = computed(() => jobId.value !== null && recorded.loading.value);
const loadError = computed(() => (jobId.value !== null ? recorded.error.value : null));
const emptyText = computed(() => {
	if (jobId.value === null) {
		return i18n.global.t("plugins.CHX350.analysis.noData");
	}
	return loadError.value !== null
		? i18n.global.t("plugins.CHX350.analysis.loadError", { error: loadError.value })
		: i18n.global.t("plugins.CHX350.analysis.noRecordedData");
});

const jobName = computed(() => {
	if (jobId.value !== null) {
		return recorded.job.value ? extractFileName(recorded.job.value.file) : jobId.value;
	}
	const name = machineStore.model.job.file?.fileName || machineStore.model.job.lastFileName;
	return name ? extractFileName(name) : i18n.global.t("plugins.CHX350.analysis.currentJob");
});

function channelByKey(key: string): LayerChannel | undefined {
	return channels.value.find((c) => c.key === key);
}

const activeKey = ref("flow");
const activeChannel = computed<LayerChannel>(() => channelByKey(activeKey.value) ?? channels.value[0]);
const range = computed(() => channelRange(activeChannel.value));
// Fifth KPI: the active channel, or the chamber (SZP) temperature while flow is selected, as on
// the job page
const kpiChannel = computed<LayerChannel>(() => activeChannel.value.key === "flow"
	? (analysis.value.chamberChannel.value ?? channels.value.find((c) => c.key.startsWith("sensor")) ?? activeChannel.value)
	: activeChannel.value);

const layer = ref(analysis.value.currentIndex.value);
watch(count, (len, previous) => {
	if (previous === 0 && len > 0) {
		// The data arrived after the page opened (a recorded job, or the first layer): start on
		// the current layer
		layer.value = analysis.value.currentIndex.value;
	} else if (layer.value >= len) {
		layer.value = Math.max(0, len - 1);
	}
});

function channelLabel(ch: LayerChannel): string {
	return ch.translated ? ch.label : i18n.global.t(ch.label);
}
function channelIcon(key: string): string {
	if (key === "flow") return "mdi-water";
	if (key === "duration") return "mdi-timer-outline";
	if (key === "filament") return "mdi-ruler";
	if (key.startsWith("loadHigh")) return "mdi-fire-alert";
	if (key.startsWith("load")) return "mdi-fire";
	if (key.startsWith("monitor")) return "mdi-rotate-right";
	return "mdi-thermometer";
}
function formatValue(v: number): string {
	return `${v.toFixed(activeChannel.value.precision)} ${activeChannel.value.unit}`;
}
/**
 * Per-layer record of the job as CSV (one row per layer, every channel), for the quality file of
 * the part. QA's own export (job/export) holds the full record
 */
function exportCsv() {
	const job = machineStore.model.job;
	const list = channels.value;
	const cell = (v: number | null | undefined, digits: number) => v === null || v === undefined || !Number.isFinite(v) ? "" : v.toFixed(digits);
	const quote = (text: string) => `"${text.replace(/"/g, '""')}"`;
	let outcome = "";
	if (jobId.value !== null) {
		const entry = recorded.job.value;
		outcome = ` · QA ${jobId.value}` + (entry ? ` · ${entry.result}` + (entry.printTimeS !== null ? ` · ${entry.printTimeS} s` : "") : "");
	} else if (job.lastDuration && !job.file?.fileName) {
		outcome = ` · ${job.lastFileCancelled ? "cancelled" : (job.lastFileAborted ? "aborted" : "finished")} · ${job.lastDuration} s`;
	}
	const lines = [
		`# ${quote(jobName.value)}`,
		`# ${machineStore.model.network.name} · ${new Date().toISOString()}${outcome}`,
		["layer", "z_mm", ...list.map((c) => quote(`${channelLabel(c)} [${c.unit}]`))].join(","),
		...heights.value.map((z, i) => [i + 1, cell(z, 3), ...list.map((c) => cell(c.values[i], c.precision + 1))].join(","))
	];
	const base = jobName.value.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_");
	saveBlob(`${base}-layers.csv`, new Blob([lines.join("\n") + "\n"], { type: "text/csv" }));
}

function valueOf(ch: LayerChannel | undefined): string {
	const v = ch?.values[layer.value];
	return ch && v !== null && v !== undefined ? `${v.toFixed(ch.precision)} ${ch.unit}` : "—";
}
</script>
