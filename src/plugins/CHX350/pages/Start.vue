<style scoped>
.start {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 352px;
	gap: 16px;
	align-items: stretch;
}
.tiles {
	min-width: 0;
	min-height: 0;
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	grid-auto-rows: minmax(0, 1fr);
	gap: 12px;
}
.tiles > .span-2 {
	grid-column: span 2;
}
.aside {
	display: flex;
	flex-direction: column;
	gap: 12px;
	min-height: 0;
}
.camera {
	all: unset;
	box-sizing: border-box;
	display: block;
	flex: 0 0 auto;
	cursor: pointer;
}
.camera__bar {
	position: absolute;
	left: 12px;
	right: 12px;
	top: 10px;
	display: flex;
	justify-content: space-between;
	align-items: center;
	color: #fff;
	font: 600 12px/1 var(--mp-font-body, sans-serif);
	letter-spacing: 0.06em;
}
/* Dark scrim pills as on the job and control pages: white text stays readable on any frame */
.camera__bar > span {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 4px 8px;
	border-radius: 999px;
	background: rgba(0, 0, 0, 0.6);
}
.camera__live {
	font-size: 10px;
}
.camera__live::before {
	content: "";
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--mp-error);
}
.machine {
	flex: 1;
	min-height: 0;
	padding: 14px 16px;
	display: flex;
	flex-direction: column;
	gap: 10px;
	overflow: auto;
}
.row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 12px;
	padding: 8px 0;
	border-bottom: 1px solid var(--border-subtle);
}
.row:last-child {
	border-bottom: 0;
}
.row__key {
	font: 500 13px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.row__val {
	font: 600 14px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
	text-align: right;
}
.tool__name {
	font: 700 14px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
.tool__mat {
	display: flex;
	gap: 4px;
	font: 400 12px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	max-width: 190px;
	white-space: nowrap;
}
.tool__matname {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
}
/* Filament left on the mounted spool; stays visible when a long material name is cut */
.tool__spool {
	flex: none;
	font-family: var(--mp-font-mono, monospace);
}
.tool__temp {
	font: 700 16px/1.2 var(--mp-font-mono, monospace);
	color: var(--text-strong);
}
.tool__target {
	font: 500 11px/1.2 var(--mp-font-mono, monospace);
	color: var(--text-body);
}
</style>

<template>
	<main class="chx-page start">
		<section class="tiles">
			<ChxTile v-if="state.printing.value" class="span-2" primary icon="mdi-play" :to="ROUTES.job"
					 :title="$t('plugins.CHX350.start.jobTitle')"
					 :subtitle="$t('plugins.CHX350.start.jobSub', { progress: (job.progress.value * 100).toFixed(1), name: job.fileName.value })">
				<template #trail><v-icon size="28">mdi-chevron-right</v-icon></template>
			</ChxTile>
			<ChxTile v-else class="span-2" primary icon="mdi-play" :to="ROUTES.jobs"
					 :title="$t('plugins.CHX350.start.printTitle')"
					 :subtitle="jobCount === null ? $t('plugins.CHX350.start.printSubLoading') : $t('plugins.CHX350.start.printSub', { count: jobCount })" />

			<!-- Machine actions are unavailable while a job is being processed; a paused job keeps
				 them (e.g. filament change during a pause) -->
			<ChxTile icon="mdi-swap-horizontal" :to="ROUTES.filament" :disabled="jobRunning"
					 :title="$t('plugins.CHX350.start.filamentTitle')" :subtitle="jobRunning ? lockedSub : filamentSub" />
			<!-- Flow macros with `page: start` (e.g. Bett vorbereiten); their front matter decides when
				 they may start -->
			<ChxTile v-for="tile in flowTiles" :key="tile.path" :icon="tile.icon" :title="tile.title" :subtitle="tile.subtitle"
					 :disabled="tile.disabled" @click="tile.run()">
				<template v-if="tile.warn" #trail><v-icon color="warning">mdi-alert-outline</v-icon></template>
			</ChxTile>
			<ChxTile icon="mdi-thermometer-chevron-up" :to="ROUTES.preheat" :disabled="jobRunning"
					 :title="$t('plugins.CHX350.start.preheatTitle')" :subtitle="jobRunning ? lockedSub : $t('plugins.CHX350.start.preheatSub')" />
			<!-- Repeating goes through the job check like any other start -->
			<ChxTile icon="mdi-repeat" :disabled="lastJob === null || state.printing.value" @click="repeatLast"
					 :title="$t('plugins.CHX350.start.repeatTitle')"
					 :subtitle="state.printing.value ? lockedSub : (lastJob ? lastJobSub : $t('plugins.CHX350.start.repeatNone'))" />
			<ChxTile icon="mdi-home-import-outline" :to="ROUTES.home" :disabled="jobRunning"
					 :title="$t('plugins.CHX350.start.homeTitle')"
					 :subtitle="jobRunning ? lockedSub : $t('plugins.CHX350.start.homeSub', { axes: axisLetters, state: allHomed ? $t('plugins.CHX350.start.homed') : $t('plugins.CHX350.start.notHomed') })" />
			<ChxTile icon="mdi-target" :to="ROUTES.calibrate" :disabled="jobRunning"
					 :title="$t('plugins.CHX350.start.calibrateTitle')" :subtitle="jobRunning ? lockedSub : $t('plugins.CHX350.start.calibrateSub')" />
		</section>

		<aside class="aside">
			<button type="button" class="camera" @click="router.push(ROUTES.control)">
				<ChxCameraBox>
					<ChxCamera />
					<div class="camera__bar">
						<span>{{ $t("plugins.CHX350.start.camera") }}</span>
						<span v-if="webcamEnabled && cameraLive" class="camera__live">{{ $t("plugins.CHX350.start.live") }}</span>
					</div>
				</ChxCameraBox>
			</button>

			<div class="chx-card machine">
				<div class="chx-label">{{ $t("plugins.CHX350.start.machine") }}</div>
				<div class="row" v-for="t in temps.tools.value" :key="t.number">
					<div style="min-width: 0">
						<div class="tool__name">
							{{ $t("plugins.CHX350.start.tool", { n: t.number }) }}
							<span v-if="t.nozzleDiameter !== null" class="text-body-2"> · {{ $t("plugins.CHX350.start.nozzle", { d: t.nozzleDiameter }) }}</span>
						</div>
						<div class="tool__mat">
							<span class="tool__matname">{{ t.filament || $t("plugins.CHX350.start.noFilament") }}</span>
							<span v-if="t.spool" class="tool__spool">· {{ display(t.spool.remaining / 1000, 2, "kg") }}</span>
						</div>
					</div>
					<div class="text-right">
						<div class="tool__temp">{{ formatTemp(t.current) }}</div>
						<div class="tool__target">{{ $t("plugins.CHX350.start.target", { t: (t.active ?? 0) > 0 ? formatTemp(t.active, 0) : $t("plugins.CHX350.generic.off") }) }}</div>
					</div>
				</div>
				<div v-for="m in monitorRows" :key="m.key" class="row">
					<span class="row__key">{{ m.label }}</span>
					<v-chip size="small" :color="m.color" variant="tonal" label>{{ m.text }}</v-chip>
				</div>
			</div>
		</aside>
	</main>
</template>

<script setup lang="ts">
import { FilamentMonitorEnableMode, FilamentMonitorStatus } from "@duet3d/objectmodel";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { useSettingsStore } from "@/stores/settings";
import { display, displayTime } from "@/utils/display";
import Events from "@/utils/events";
import Path, { extractFileName } from "@/utils/path";

import ChxCamera from "../components/ChxCamera.vue";
import ChxCameraBox from "../components/ChxCameraBox.vue";
import ChxTile from "../components/ChxTile.vue";
import { useJob } from "../composables/useJob";
import { useMachineState } from "../composables/useMachineState";
import { formatTemp, useTemps } from "../composables/useTemps";
import { useFlowTiles } from "../flows/useFlowTiles";
import { ROUTES } from "../routes";
import { cameraLive } from "../webcam";

const machineStore = useMachineStore();
const settingsStore = useSettingsStore();
const router = useRouter();
const state = useMachineState();
const temps = useTemps();
// Same progress figure as the job page
const job = useJob();
const flowTiles = useFlowTiles("start");

const webcamEnabled = computed(() => settingsStore.webcam.enabled);

/** A job is being processed right now (not paused): machine actions are locked */
const jobRunning = computed(() => state.printing.value && !state.paused.value);
const lockedSub = computed(() => i18n.global.t("plugins.CHX350.start.lockedPrinting"));

const lastJob = computed(() => {
	const name = machineStore.model.job.lastFileName;
	return name ? extractFileName(name) : null;
});

const axisLetters = computed(() => machineStore.model.move.axes.filter((a) => a.visible).map((a) => a.letter).join(", "));
const allHomed = computed(() => {
	const axes = machineStore.model.move.axes.filter((a) => a.visible);
	return axes.length > 0 && axes.every((a) => a.homed);
});

const filamentSub = computed(() => temps.tools.value
	.map((t) => `T${t.number} ${t.filament || i18n.global.t("plugins.CHX350.start.noFilament")}`)
	.join(" · "));

/** Last job's name with its outcome: duration when it finished, else how it ended */
const lastJobSub = computed(() => {
	const model = machineStore.model.job;
	const outcome = model.lastFileSimulated ? "simulated" : (model.lastFileCancelled ? "cancelled" : (model.lastFileAborted ? "aborted" : null));
	const tail = outcome !== null
		? i18n.global.t(`plugins.CHX350.start.lastOutcome.${outcome}`)
		: (model.lastDuration ? displayTime(model.lastDuration) : null);
	return tail ? `${lastJob.value} · ${tail}` : (lastJob.value ?? "");
});

/**
 * Filament monitor per extruder of the tools. A monitor in mode 1 (M591 S1) only checks while a job
 * prints, so its idle status is not a finding; mode 0 is switched off
 */
const filamentMonitors = computed(() => temps.tools.value
	.filter((t) => t.extruderIndex >= 0)
	.map((t) => ({ tool: `T${t.number}`, extruder: t.extruderIndex, monitor: machineStore.model.sensors.filamentMonitors[t.extruderIndex] ?? null }))
	.filter((entry, index, list) => entry.monitor !== null && list.findIndex((e) => e.extruder === entry.extruder) === index)
	.map(({ tool, extruder, monitor }) => {
		const status = monitor!.status;
		const off = monitor!.enableMode === FilamentMonitorEnableMode.disabled || status === FilamentMonitorStatus.noMonitor;
		const ok = status === FilamentMonitorStatus.ok;
		let text = i18n.global.t(`plugins.CHX350.start.monitor.${off ? "disabled" : status}`);
		if (!off && ok && monitor!.enableMode === FilamentMonitorEnableMode.enabled) {
			text = i18n.global.t("plugins.CHX350.start.monitor.okPrinting");
		}
		return { tool, extruder, text, color: off ? undefined : (ok ? "success" : "warning") };
	}));

/** One row per monitor up to two; more (16-nozzle machine) are grouped by status with a count */
const monitorRows = computed(() => {
	const list = filamentMonitors.value;
	if (list.length <= 2) {
		return list.map((m) => ({
			key: String(m.extruder),
			label: list.length > 1 ? i18n.global.t("plugins.CHX350.start.filamentMonitorTool", { tool: m.tool }) : i18n.global.t("plugins.CHX350.start.filamentMonitor"),
			text: m.text,
			color: m.color
		}));
	}
	const groups = new Map<string, { key: string; tools: Array<string>; text: string; color?: string }>();
	for (const m of list) {
		const group = groups.get(m.text) ?? { key: m.text, tools: [], text: m.text, color: m.color };
		group.tools.push(m.tool);
		groups.set(m.text, group);
	}
	return [...groups.values()].map((g) => ({
		key: g.key,
		label: g.tools.length > 2 ? i18n.global.t("plugins.CHX350.start.filamentMonitors", { count: g.tools.length }) : i18n.global.t("plugins.CHX350.start.filamentMonitorTool", { tool: g.tools.join(", ") }),
		text: g.text,
		color: g.color
	}));
});

// Number of job files on the machine (for the start tile subtitle). Fetched lazily and refreshed
// when files change; failures just hide the count
const jobCount = ref<number | null>(null);
async function loadJobCount() {
	try {
		const dir = machineStore.model.directories.gCodes || Path.gCodes;
		const files = await machineStore.getFileList(dir);
		jobCount.value = files.filter((f) => !f.isDirectory && Path.isGCodePath(f.name, dir)).length;
	} catch {
		jobCount.value = null;
	}
}
onMounted(() => {
	if (machineStore.isConnected) {
		loadJobCount();
	}
	Events.on("connected", loadJobCount);
	Events.on("filesOrDirectoriesChanged", loadJobCount);
});
onBeforeUnmount(() => {
	Events.off("connected", loadJobCount);
	Events.off("filesOrDirectoriesChanged", loadJobCount);
});

function repeatLast() {
	const file = machineStore.model.job.lastFileName;
	if (file) {
		router.push({ path: ROUTES.check, query: { file } });
	}
}
</script>
