<style scoped>
.main {
	flex: 1;
	min-height: 0;
}
.jog {
	position: absolute;
	inset: 0;
	display: flex;
}
.jog__map {
	flex: 1;
	min-width: 0;
	border-radius: 0;
}
.badge {
	position: absolute;
	top: 16px;
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 7px 14px;
	border-radius: 999px;
	background: rgba(0, 0, 0, 0.6);
	color: #fff;
	font: 700 13px/1 var(--mp-font-body, sans-serif);
	letter-spacing: 0.09em;
	white-space: nowrap;
	max-width: calc(100% - 32px);
	overflow: hidden;
	text-overflow: ellipsis;
}
.badge--live {
	left: 16px;
}
.badge--live::before {
	content: "";
	width: 9px;
	height: 9px;
	border-radius: 999px;
	background: var(--mp-error);
}
.badge--lock {
	right: 16px;
	background: var(--mp-accent);
	color: var(--mp-neutral-900);
	letter-spacing: 0.06em;
}
.row {
	display: flex;
	align-items: stretch;
	gap: 14px;
	flex-wrap: wrap;
}
.jogbtn {
	all: unset;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	gap: 12px;
	min-height: 66px;
	padding: 0 26px;
	border-radius: var(--mp-radius);
	border: 1px solid var(--border-default);
	background: var(--surface-card);
	color: var(--text-strong);
	font: 700 18px/1 var(--mp-font-body, sans-serif);
	cursor: pointer;
	transition: background var(--mp-dur, 200ms) var(--mp-ease, ease);
}
.jogbtn--on {
	background: var(--mp-primary-dark);
	border-color: var(--mp-primary-dark);
	color: #fff;
}
.jogbtn--locked {
	background: var(--surface-sunken);
	color: var(--text-body);
	cursor: not-allowed;
}
.tools {
	display: flex;
	gap: 8px;
}
.tools > * {
	min-width: 76px;
	height: auto;
}
.positions {
	flex: 1;
	min-width: 280px;
	display: flex;
	align-items: center;
	gap: 22px;
	padding: 12px 22px;
	flex-wrap: wrap;
}
.pos__label {
	font: 500 11px/1 var(--mp-font-body, sans-serif);
	letter-spacing: 0.07em;
	color: var(--text-body);
	white-space: nowrap;
}
.pos__val {
	margin-top: 5px;
	font: 700 21px/1 var(--mp-font-mono, monospace);
	color: var(--text-strong);
	white-space: nowrap;
}
.pos--sel .pos__val {
	color: var(--text-brand);
}
/* Icon-only home button shown in place of the coordinate of an unhomed axis. Its height matches
   the value line (margin + 21px) so the row does not jump once the axis is homed */
.pos__home {
	all: unset;
	box-sizing: border-box;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	margin-top: 5px;
	width: 44px;
	height: 21px;
	border-radius: 999px;
	border: 1.5px solid var(--mp-warning);
	background: color-mix(in srgb, var(--mp-warning) 14%, var(--surface-card));
	cursor: pointer;
	transition: background var(--mp-dur, 200ms) var(--mp-ease, ease);
}
.pos__home .v-icon {
	color: var(--text-warning);
}
.pos__home:not(:disabled):hover,
.pos__home:not(:disabled):focus-visible {
	background: color-mix(in srgb, var(--mp-warning) 28%, var(--surface-card));
}
.pos__home:not(:disabled):active {
	background: var(--mp-warning);
	color: #fff;
}
.pos__home:not(:disabled):active .v-icon {
	color: #fff;
}
.pos__home:disabled {
	border-style: dashed;
	border-color: var(--border-default);
	background: var(--surface-page);
	color: var(--text-muted);
	cursor: not-allowed;
}
.pos__home:disabled .v-icon {
	color: var(--text-muted);
}
.pos__home--busy {
	cursor: progress;
}
</style>

<template>
	<div class="chx-page">
		<ChxCameraBox fill class="main">
			<template v-if="jogMode">
				<div class="jog">
					<BedMap class="jog__map" :size-x="bedMap.sizeX" :size-y="bedMap.sizeY" :heads="heads" :selected-tool="selectedTool"
							:head-spacing="bedMap.headSpacing" :tool1-axis="bedMap.tool1YAxis" :locked="mapLocked" :busy="busy"
							:lock-reason="mapLockReason" :moving="moving" :target="target" @move="moveTo" @select="selectTool" />
					<ZTower v-if="zAxis" :current="zAxis.userPosition" :min="zAxis.min" :max="zAxis.max" :locked="locked || !zAxis.homed" :busy="busy"
							:lock-hint="!locked && !zAxis.homed ? $t('plugins.CHX350.control.notHomed') : ''" @goto="gotoZ" />
				</div>
			</template>
			<template v-else>
				<ChxCamera />
				<div v-if="settingsStore.webcam.enabled && cameraLive" class="badge badge--live">{{ $t("plugins.CHX350.start.live") }}</div>
				<div v-if="lockBadge" class="badge badge--lock">
					<v-icon size="18">mdi-lock-outline</v-icon>
					{{ lockBadge }}
				</div>
			</template>
		</ChxCameraBox>

		<div class="row">
			<button type="button" class="jogbtn" :class="{ 'jogbtn--on': jogMode, 'jogbtn--locked': !jogMode && locked }"
					:disabled="!jogMode && locked" @click="toggleJog">
				<v-icon size="24">{{ jogMode ? "mdi-camera-outline" : (locked ? "mdi-lock-outline" : "mdi-axis-arrow") }}</v-icon>
				<span>{{ jogMode ? $t("plugins.CHX350.control.stopJog") : (locked ? $t("plugins.CHX350.control.jogLocked") : $t("plugins.CHX350.control.startJog")) }}</span>
			</button>

			<div v-if="heads.length > 1" class="tools">
				<v-btn v-for="h in heads" :key="h.tool" :color="h.tool === selectedTool ? 'secondary' : undefined"
					   :variant="h.tool === selectedTool ? 'flat' : 'outlined'" class="chx-btn" :disabled="locked" @click="selectTool(h.tool)">
					T{{ h.tool }}
				</v-btn>
			</div>

			<div class="chx-card positions">
				<div v-for="axis in visibleAxes" :key="axis.letter" :class="{ 'pos--sel': isSelectedAxis(axis.letter) }">
					<div class="pos__label">{{ axisLabel(axis.letter) }}</div>
					<div v-if="axis.homed" class="pos__val">{{ axis.userPosition !== null ? axis.userPosition.toFixed(axis.letter === 'Z' ? 2 : 1) : "—" }}</div>
					<!-- An unhomed axis shows an icon-only home button in place of its (meaningless) coordinate -->
					<button v-else type="button" class="pos__home" :class="{ 'pos__home--busy': homingAxis === axis.letter }"
							:disabled="locked || homingAxis !== null" :title="locked ? lockReason : $t('plugins.CHX350.control.homeAxis', { axis: axis.letter })"
							:aria-label="$t('plugins.CHX350.control.homeAxis', { axis: axis.letter })" @click="homeAxis(axis.letter)">
						<v-progress-circular v-if="homingAxis === axis.letter" indeterminate size="16" width="2" />
						<v-icon v-else size="20">{{ locked ? "mdi-lock-outline" : "mdi-home-import-outline" }}</v-icon>
					</button>
				</div>
				<div class="flex-grow-1" />
				<div>
					<div class="pos__label">{{ $t("plugins.CHX350.control.selected") }}</div>
					<div class="pos__val">{{ $t("plugins.CHX350.control.selectedAxis", { tool: selectedTool, axis: selectedYAxis }) }}</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { useSettingsStore } from "@/stores/settings";
import { LogLevel, useUiStore } from "@/stores/ui";
import { getErrorMessage } from "@/utils/errors";
import { axisGCodeLetter } from "@/utils/gcode";

import BedMap from "../components/BedMap.vue";
import ChxCamera from "../components/ChxCamera.vue";
import ChxCameraBox from "../components/ChxCameraBox.vue";
import ZTower from "../components/ZTower.vue";
import { useMachineState } from "../composables/useMachineState";
import { sendChecked } from "../composables/useMacroRunner";
import { useChxSettings } from "../settings";
import { cameraLive } from "../webcam";

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

// Locked while a job runs or outside automatic mode (see useMachineState.axesLocked); a plain
// busy status is what our own moves look like and does not lock
const locked = computed(() => !state.connected.value || state.axesLocked.value);

// Leave jog mode as soon as the lock engages, e.g. when a print starts from another client
watch(locked, (isLocked) => {
	if (isLocked) {
		jogMode.value = false;
	}
});

// Transient: while the firmware runs a macro (or one of our own moves) it accepts no new motion
// commands, so inputs are dropped during that time. The view keeps its normal look on purpose:
// busy toggles with every status poll and a visible lock would flicker
const busy = computed(() => moving.value || state.busy.value);

const lockReason = computed(() => {
	if (!state.connected.value) {
		return i18n.global.t("plugins.CHX350.status.offline");
	}
	if (state.printing.value) {
		return i18n.global.t("plugins.CHX350.control.lockPrinting");
	}
	if (!state.isAutomatic.value) {
		if (state.doorOpen.value) {
			return i18n.global.t("plugins.CHX350.control.lockDoor");
		}
		return i18n.global.t(state.doorCheckPending.value ? "plugins.CHX350.control.lockDoorCheck" : "plugins.CHX350.control.lockMode");
	}
	return "";
});

/**
 * Tap-to-move drives X and the selected tool's Y axis; while one of them is not homed the firmware
 * rejects the move, so the map says so and points to the home buttons in the positions row
 */
const unhomedXY = computed(() => ["X", selectedYAxis.value].filter((letter) => axis(letter)?.homed === false));
const mapLocked = computed(() => locked.value || unhomedXY.value.length > 0);
const mapLockReason = computed(() => locked.value
	? lockReason.value
	: i18n.global.t("plugins.CHX350.control.lockNotHomed", { axes: unhomedXY.value.join(", ") }));

// The header plate already names the cause (DRUCKT/PAUSIERT, OFFLINE, or the mode and door line
// under LEERLAUF). Only HEIZT AUF and ARBEITET hide it, e.g. while heating in default mode
const lockBadge = computed(() => locked.value && (state.plate.value === "heating" || state.plate.value === "busy") ? lockReason.value : "");

function toggleJog() {
	if (jogMode.value) {
		jogMode.value = false;
	} else if (!locked.value) {
		jogMode.value = true;
	}
}

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
		// Replies stay quiet, but a rejected move (e.g. an axis lost its homing) is reported
		await sendChecked(code, false);
	} catch (e) {
		uiStore.log(LogLevel.error, i18n.global.t("plugins.CHX350.nav.control"), getErrorMessage(e));
	}
}

/**
 * Select a tool on the machine. The CHX 350 tools sit on their own print heads for good (T0 and T1
 * on the IDEX heads), so there is nothing to change and the tool change macros are skipped (P0);
 * tpost would also wait for the nozzle temperature. A tool changer (Bondtech INDX) will need the
 * macros for tools parked beside the bed
 */
async function selectTool(tool: number) {
	if (tool === selectedTool.value) {
		return;
	}
	selectedTool.value = tool;
	if (!locked.value && !busy.value && machineStore.model.state.currentTool !== tool) {
		await send(`T${tool} P0`);
	}
}

async function moveTo(point: { x: number; y: number }) {
	if (locked.value || busy.value) {
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

/** Letter of the axis currently being homed from the positions row, null when none */
const homingAxis = ref<string | null>(null);

async function homeAxis(letter: string) {
	if (locked.value || busy.value || homingAxis.value !== null) {
		return;
	}
	homingAxis.value = letter;
	moving.value = true;
	try {
		await send(`G28 ${axisGCodeLetter(letter)}`);
	} finally {
		homingAxis.value = null;
		moving.value = false;
	}
}

async function gotoZ(z: number) {
	if (locked.value || busy.value) {
		return;
	}
	moving.value = true;
	try {
		await send(`M120\nG90\nG1 Z${z} F${bedMap.value.moveFeedrate}\nM121`);
	} finally {
		moving.value = false;
	}
}
</script>
