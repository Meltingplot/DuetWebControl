<style scoped>
.analysis {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr) 300px;
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
.channels {
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
	flex: 1;
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
		<ChxPageHeader :subtitle="jobName" :back="ROUTES.history" />

		<div v-if="analysis.layers.value.length > 0" class="analysis">
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
						<span>{{ $t("plugins.CHX350.job.layerN", { n: analysis.layers.value.length }) }}</span>
					</div>
					<div class="nav-btns">
						<v-btn variant="outlined" class="chx-btn" icon="mdi-chevron-left" :disabled="layer <= 0" @click="layer--" />
						<v-slider v-model="layer" :min="0" :max="analysis.layers.value.length - 1" :step="1" hide-details color="secondary" class="flex-grow-1" />
						<v-btn variant="outlined" class="chx-btn" icon="mdi-chevron-right" :disabled="layer >= analysis.layers.value.length - 1" @click="layer++" />
					</div>
				</div>

				<div class="kpis">
					<div class="kpi">
						<div class="chx-label">{{ $t("plugins.CHX350.job.layer") }}</div>
						<div class="chx-value">{{ layer + 1 }} / {{ analysis.layers.value.length }}</div>
					</div>
					<div class="kpi">
						<div class="chx-label">{{ $t("plugins.CHX350.analysis.heightZ") }}</div>
						<div class="chx-value">{{ display(analysis.heights.value[layer], 2, "mm") }}</div>
					</div>
					<div class="kpi">
						<div class="chx-label">{{ $t("plugins.CHX350.analysis.channelDuration") }}</div>
						<div class="chx-value">{{ displayTime(analysis.layers.value[layer]?.duration ?? 0, false) }}</div>
					</div>
					<div class="kpi">
						<div class="chx-label">{{ $t("plugins.CHX350.analysis.channelFlow") }}</div>
						<div class="chx-value">{{ valueOf("flow") }}</div>
					</div>
					<div class="kpi">
						<div class="chx-label">{{ channelLabel(kpiChannel) }}</div>
						<div class="chx-value">{{ valueOf(kpiChannel.key) }}</div>
					</div>
				</div>
			</div>

			<div class="side">
				<div class="chx-card channels">
					<div class="chx-label">{{ $t("plugins.CHX350.analysis.channel") }}</div>
					<button v-for="ch in analysis.channels.value" :key="ch.key" type="button" class="channel"
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
			<v-icon size="64">mdi-chart-box-outline</v-icon>
			<div>{{ $t("plugins.CHX350.analysis.noData") }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { display, displayTime } from "@/utils/display";
import { extractFileName } from "@/utils/path";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import LayerStrip from "../components/LayerStrip.vue";
import { channelRange, useJobAnalysis, type LayerChannel } from "../composables/useJobAnalysis";
import { ROUTES } from "../routes";

const machineStore = useMachineStore();
const analysis = useJobAnalysis();

const jobName = computed(() => {
	const name = machineStore.model.job.file?.fileName || machineStore.model.job.lastFileName;
	return name ? extractFileName(name) : i18n.global.t("plugins.CHX350.analysis.currentJob");
});

const activeKey = ref("flow");
const activeChannel = computed<LayerChannel>(() =>
	analysis.channels.value.find((c) => c.key === activeKey.value) ?? analysis.channels.value[0]);
const range = computed(() => channelRange(activeChannel.value));
// Fifth KPI: the active channel, or the first temperature channel while flow is selected
const kpiChannel = computed<LayerChannel>(() => activeChannel.value.key === "flow"
	? (analysis.channels.value.find((c) => c.key.startsWith("sensor")) ?? activeChannel.value)
	: activeChannel.value);

const layer = ref(analysis.currentIndex.value);
watch(() => analysis.layers.value.length, (len) => {
	if (layer.value >= len) {
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
	return "mdi-thermometer";
}
function formatValue(v: number): string {
	return `${v.toFixed(activeChannel.value.precision)} ${activeChannel.value.unit}`;
}
function valueOf(key: string): string {
	const ch = analysis.channels.value.find((c) => c.key === key);
	const v = ch?.values[layer.value];
	return ch && v !== null && v !== undefined ? `${v.toFixed(ch.precision)} ${ch.unit}` : "—";
}
</script>
