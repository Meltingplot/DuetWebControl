<style scoped>
.control {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr) 300px;
	gap: 14px;
}
.main {
	position: relative;
	min-height: 0;
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
.side {
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-height: 0;
}
.side > * {
	flex: 0 0 auto;
}
.side > .z {
	flex: 1 1 auto;
}
.positions {
	padding: 12px 14px;
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px 12px;
}
.pos__val {
	font: 700 18px/1.2 var(--mp-font-mono, monospace);
	color: var(--text-strong);
}
.pos--sel .pos__val {
	color: var(--mp-primary-dark);
}
.tools {
	display: flex;
	gap: 8px;
}
.tools > * {
	flex: 1;
}
</style>

<template>
	<div class="chx-page">
		<ChxPageHeader :title="$t('plugins.CHX350.nav.control')" :subtitle="state.axesLocked.value ? lockReason : ''" />

		<div class="control">
			<div class="main">
				<template v-if="jogMode">
					<BedMap :size-x="bedMap.sizeX" :size-y="bedMap.sizeY" :heads="heads" :selected-tool="selectedTool"
							:head-spacing="bedMap.headSpacing" :tool1-axis="bedMap.tool1YAxis" :locked="state.axesLocked.value"
							:lock-reason="lockReason" :moving="moving" :target="target" @move="moveTo" @select="selectTool" />
				</template>
				<template v-else>
					<div class="camera__view">
						<WebcamView v-if="settingsStore.webcam.enabled" />
						<div v-else class="d-flex align-center justify-center fill-height text-grey">
							<v-icon size="64">mdi-camera-off-outline</v-icon>
						</div>
					</div>
					<div class="camera__tag">{{ $t("plugins.CHX350.start.camera") }}</div>
				</template>
			</div>

			<div class="side">
				<v-btn :color="jogMode ? 'secondary' : undefined" :variant="jogMode ? 'flat' : 'outlined'" size="x-large" class="chx-btn" block
					   :disabled="!jogMode && state.axesLocked.value" @click="jogMode = !jogMode">
					<v-icon start>{{ jogMode ? "mdi-camera-outline" : "mdi-axis-arrow" }}</v-icon>
					{{ jogMode ? $t("plugins.CHX350.control.stopJog") : (state.axesLocked.value ? $t("plugins.CHX350.control.jogLocked") : $t("plugins.CHX350.control.startJog")) }}
				</v-btn>

				<div v-if="heads.length > 1" class="tools">
					<v-btn v-for="h in heads" :key="h.tool" :color="h.tool === selectedTool ? 'secondary' : undefined"
						   :variant="h.tool === selectedTool ? 'flat' : 'outlined'" class="chx-btn" :disabled="state.axesLocked.value" @click="selectTool(h.tool)">
						T{{ h.tool }}
					</v-btn>
				</div>

				<div class="chx-card positions">
					<div v-for="axis in visibleAxes" :key="axis.letter" :class="{ 'pos--sel': isSelectedAxis(axis.letter) }">
						<div class="chx-label">{{ axisLabel(axis.letter) }}</div>
						<div class="pos__val">{{ axis.userPosition !== null ? axis.userPosition.toFixed(axis.letter === 'Z' ? 2 : 1) : "—" }}</div>
					</div>
					<div>
						<div class="chx-label">{{ $t("plugins.CHX350.control.selected") }}</div>
						<div class="pos__val">T{{ selectedTool }} · {{ selectedYAxis }}</div>
					</div>
				</div>

				<ZTower v-if="jogMode && zAxis" :current="zAxis.userPosition" :min="zAxis.min" :max="zAxis.max" :steps="bedMap.zSteps"
						:locked="state.axesLocked.value" @jog="jogZ" @goto="gotoZ" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import WebcamView from "@/components/panels/WebcamView.vue";
import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { useSettingsStore } from "@/stores/settings";
import { LogLevel, useUiStore } from "@/stores/ui";

import BedMap from "../components/BedMap.vue";
import ChxPageHeader from "../components/ChxPageHeader.vue";
import ZTower from "../components/ZTower.vue";
import { useMachineState } from "../composables/useMachineState";
import { useChxSettings } from "../settings";

const machineStore = useMachineStore();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();
const state = useMachineState();
const { bedMap: bedMapSetting } = useChxSettings();
const bedMap = computed(() => bedMapSetting.value);

const jogMode = ref(false);
const moving = ref(false);
const target = ref<{ x: number; y: number } | null>(null);

const axes = computed(() => machineStore.model.move.axes);
const visibleAxes = computed(() => axes.value.filter((a) => a.visible));
const axis = (letter: string) => axes.value.find((a) => a.letter === letter) ?? null;
const zAxis = computed(() => axis("Z"));

const tools = computed(() => machineStore.model.tools.filter((t) => t !== null));
const selectedTool = ref(Math.max(0, machineStore.model.state.currentTool));
const selectedYAxis = computed(() => selectedTool.value === 0 ? "Y" : bedMap.value.tool1YAxis);

// Head positions: T0 = (X, Y), T1 = (X, <tool1YAxis>) - both heads share the X carriage on the CHX 350
const heads = computed(() => tools.value.slice(0, 2).map((t) => {
	const yLetter = t.number === 0 ? "Y" : bedMap.value.tool1YAxis;
	return { tool: t.number, x: axis("X")?.userPosition ?? 0, y: axis(yLetter)?.userPosition ?? 0 };
}));

const lockReason = computed(() => {
	if (!state.connected.value) {
		return i18n.global.t("plugins.CHX350.status.offline");
	}
	if (state.doorOpen.value) {
		return i18n.global.t("plugins.CHX350.control.lockDoor");
	}
	if (!state.isAutomatic.value) {
		return i18n.global.t("plugins.CHX350.control.lockMode");
	}
	if (state.printing.value) {
		return i18n.global.t("plugins.CHX350.control.lockPrinting");
	}
	if (state.busy.value) {
		return i18n.global.t("plugins.CHX350.control.lockBusy");
	}
	return "";
});

function axisLabel(letter: string): string {
	if (letter === "Y") return "Y · T0";
	if (letter === bedMap.value.tool1YAxis && tools.value.length > 1) return `${letter} · T1`;
	return letter;
}
function isSelectedAxis(letter: string): boolean {
	return letter === "X" || letter === selectedYAxis.value;
}

async function send(code: string) {
	try {
		await machineStore.sendCode(code, false, false);
	} catch (e) {
		uiStore.log(LogLevel.error, i18n.global.t("plugins.CHX350.nav.control"), String(e));
	}
}

async function selectTool(tool: number) {
	if (tool === selectedTool.value) {
		return;
	}
	selectedTool.value = tool;
	if (!state.axesLocked.value && machineStore.model.state.currentTool !== tool) {
		await send(`T${tool}`);
	}
}

async function moveTo(point: { x: number; y: number }) {
	if (state.axesLocked.value) {
		return;
	}
	target.value = point;
	moving.value = true;
	try {
		await send(`M120\nG90\nG1 X${point.x} ${selectedYAxis.value}${point.y} F${bedMap.value.moveFeedrate}\nM121`);
	} finally {
		moving.value = false;
		target.value = null;
	}
}

async function jogZ(delta: number) {
	if (state.axesLocked.value) {
		return;
	}
	await send(`M120\nG91\nG1 Z${delta} F${bedMap.value.moveFeedrate}\nM121`);
}

async function gotoZ(z: number) {
	if (state.axesLocked.value) {
		return;
	}
	await send(`M120\nG90\nG1 Z${z} F${bedMap.value.moveFeedrate}\nM121`);
}
</script>
