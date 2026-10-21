<style scoped>
.heater {
	padding: 20px 22px;
	display: flex;
	flex-direction: column;
	gap: 16px;
	max-height: calc(100dvh - 48px);
	overflow: auto;
}
.heater__head {
	display: flex;
	align-items: center;
	gap: 12px;
}
.heater__head h2 {
	flex: 1;
	margin: 0;
	font: 700 22px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
.heater__body {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	gap: 20px;
}
.info {
	display: flex;
	flex-direction: column;
	gap: 14px;
}
.reading {
	padding: 12px 14px;
	border-radius: var(--mp-radius);
	background: var(--surface-page);
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.reading__current {
	font: 700 40px/1.1 var(--mp-font-mono, monospace);
	color: var(--text-strong);
}
.reading__line {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
	font: 400 14px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.reading__line .chx-phase {
	margin-top: 0;
}
.presets {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
}
.presets .v-btn {
	font-family: var(--mp-font-mono, monospace);
}
.entry {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.entry__row {
	display: flex;
	gap: 8px;
}
.entry__value {
	flex: 1;
	font: 700 32px/1.2 var(--mp-font-mono, monospace);
	color: var(--text-strong);
	padding: 10px 14px;
	border-radius: var(--mp-radius);
	background: var(--surface-sunken);
	min-height: 60px;
	text-align: right;
}
.entry__value--invalid {
	color: rgb(var(--v-theme-error));
}
.entry__range,
.hint {
	font: 400 13px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.keypad {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
}
.keypad .v-btn,
.entry__row .v-btn {
	font: 700 20px/1 var(--mp-font-mono, monospace);
}
.actions {
	display: flex;
	gap: 10px;
	justify-content: space-between;
}
.actions .v-btn {
	min-width: 180px;
}
</style>

<template>
	<!-- Attached to the shell so the CHX tokens (surfaces, ink tones) apply inside the dialog -->
	<v-dialog :model-value="target !== null" attach=".chx-shell" max-width="760" scrollable @update:model-value="!$event && close()">
		<div class="chx-card heater">
			<div class="heater__head">
				<h2>{{ title }}</h2>
				<v-btn variant="text" icon="mdi-close" size="large" :aria-label="$t('plugins.CHX350.generic.close')" @click="close" />
			</div>

			<v-alert v-if="heater === null" type="warning" variant="tonal" density="compact" :text="$t('plugins.CHX350.heater.missing')" />
			<v-alert v-else-if="faulted" type="error" variant="tonal" density="compact" :text="$t('plugins.CHX350.job.heaterFaultBody')" />

			<div v-if="heater !== null" class="heater__body">
				<div class="info">
					<div class="reading">
						<span class="chx-label">{{ $t("plugins.CHX350.heater.current") }}</span>
						<span class="reading__current">{{ formatTemp(heater.current) }}</span>
						<div class="reading__line">
							<span>{{ setpointText }}</span>
							<HeaterPhaseLabel class="chx-phase" :phase="phase" />
						</div>
						<div v-if="heater.state === HeaterState.active" class="reading__line">
							<span>{{ $t("plugins.CHX350.heater.power", { power: formatLoad(heaterLoad(heater)) }) }}</span>
						</div>
					</div>

					<template v-if="presets.length > 0">
						<span class="chx-label">{{ $t("plugins.CHX350.heater.presets") }}</span>
						<div class="presets">
							<v-btn v-for="preset in presets" :key="preset" variant="outlined" class="chx-btn" :disabled="disabled" @click="entry = String(preset)">
								{{ preset }} °C
							</v-btn>
						</div>
					</template>
				</div>

				<!-- On-screen keypad: the HMI touch panel has no keyboard -->
				<div class="entry">
					<span class="chx-label">{{ $t("plugins.CHX350.heater.target") }}</span>
					<div class="entry__row">
						<v-btn size="x-large" variant="tonal" class="chx-btn" :disabled="disabled" :aria-label="$t('plugins.CHX350.heater.minus', { step: STEP })" @click="nudge(-STEP)">−{{ STEP }}</v-btn>
						<div class="entry__value" :class="{ 'entry__value--invalid': entry !== '' && !valid }">{{ entry || "—" }} °C</div>
						<v-btn size="x-large" variant="tonal" class="chx-btn" :disabled="disabled" :aria-label="$t('plugins.CHX350.heater.plus', { step: STEP })" @click="nudge(STEP)">+{{ STEP }}</v-btn>
					</div>
					<div class="entry__range">{{ $t("plugins.CHX350.heater.range", { max: formatTemp(maxTemp, 0) }) }}</div>
					<div class="keypad">
						<v-btn v-for="key in KEYPAD" :key="key" size="x-large" variant="tonal" class="chx-btn" :disabled="disabled"
							   :aria-label="key === 'back' ? $t('plugins.CHX350.heater.backspace') : undefined" @click="press(key)">
							<v-icon v-if="key === 'back'">mdi-backspace-outline</v-icon>
							<template v-else>{{ key }}</template>
						</v-btn>
					</div>
				</div>
			</div>

			<v-alert v-if="error" type="error" variant="tonal" density="compact" :text="error" />

			<div v-if="heater !== null" class="actions">
				<!-- Same reset as the fault banner of the running-job page -->
				<v-btn v-if="faulted" size="x-large" color="error" variant="flat" class="chx-btn" prepend-icon="mdi-alert-octagon-outline"
					   :disabled="state.uiFrozen.value || sending !== null" :loading="sending === 'reset'" @click="send('reset', `M562 P${heaterIndex}`, false)">
					{{ $t("plugins.CHX350.job.acknowledge") }}
				</v-btn>
				<v-btn v-else size="x-large" variant="outlined" class="chx-btn" prepend-icon="mdi-power" :disabled="disabled || offLocked || heater.state === HeaterState.off"
					   :loading="sending === 'off'" @click="switchOff">
					{{ $t("plugins.CHX350.heater.off") }}
				</v-btn>
				<v-btn size="x-large" color="primary" variant="flat" class="chx-btn" prepend-icon="mdi-fire" :disabled="disabled || !valid"
					   :loading="sending === 'set'" @click="apply">
					{{ $t("plugins.CHX350.heater.apply") }}
				</v-btn>
			</div>
			<div v-if="heater !== null && offLocked" class="hint">{{ $t("plugins.CHX350.heater.offLocked") }}</div>
		</div>
	</v-dialog>
</template>

<script setup lang="ts">
import { HeaterState, type Heater } from "@duet3d/objectmodel";
import { computed, ref, watch } from "vue";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { useSettingsStore } from "@/stores/settings";
import { getErrorMessage } from "@/utils/errors";

import { useMachineState } from "../composables/useMachineState";
import { sendChecked } from "../composables/useMacroRunner";
import { formatTemp, heaterPhase, type HeaterTarget, useTemps } from "../composables/useTemps";
import { formatLoad, heaterLoad } from "../stores/heaterLoad";
import HeaterPhaseLabel from "./HeaterPhaseLabel.vue";

const STEP = 5;
const KEYPAD = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "C", "0", "back"];

const props = defineProps<{
	target: HeaterTarget | null;
}>();
const emit = defineEmits<{
	(e: "close"): void;
}>();

const machineStore = useMachineStore();
const settingsStore = useSettingsStore();
const state = useMachineState();
const temps = useTemps();

const heaterIndex = computed(() => {
	switch (props.target?.kind) {
		case "nozzle": return props.target.heater;
		case "bed": return machineStore.bedHeaterMapping[0]?.[0] ?? -1;
		case "chamber": return machineStore.chamberHeaterMapping[0]?.[0] ?? -1;
		default: return -1;
	}
});
const heater = computed<Heater | null>(() => heaterIndex.value >= 0 ? (machineStore.model.heat.heaters[heaterIndex.value] ?? null) : null);
const tool = computed(() => props.target?.kind === "nozzle" ? (machineStore.model.tools[props.target.tool] ?? null) : null);

const title = computed(() => {
	switch (props.target?.kind) {
		case "nozzle": return temps.nozzles.value.length > 1
			? i18n.global.t("plugins.CHX350.header.nozzleTool", { n: props.target.tool })
			: i18n.global.t("plugins.CHX350.header.nozzle");
		case "bed": return i18n.global.t("plugins.CHX350.header.bed");
		case "chamber": return i18n.global.t("plugins.CHX350.header.chamber");
		default: return "";
	}
});

type Action = "set" | "off" | "reset";
const sending = ref<Action | null>(null);
const error = ref<string | null>(null);

const faulted = computed(() => heater.value?.state === HeaterState.fault);
const phase = computed(() => heaterPhase(heater.value));
const setpointText = computed(() => {
	const h = heater.value;
	switch (h?.state) {
		case HeaterState.active:
		case HeaterState.tuning:
			return i18n.global.t("plugins.CHX350.heater.setpoint", { temp: formatTemp(h.active, 0) });
		case HeaterState.standby:
			return i18n.global.t("plugins.CHX350.heater.standby", { temp: formatTemp(h.standby, 0) });
		case HeaterState.fault:
			return i18n.global.t("plugins.CHX350.heater.faulted");
		default:
			return i18n.global.t("plugins.CHX350.heater.isOff");
	}
});

const disabled = computed(() => state.uiFrozen.value || heater.value === null || faulted.value || sending.value !== null);
/**
 * A running job needs the bed, the chamber and the selected tool's nozzles; switching one of them
 * off would ruin the part. New setpoints stay possible, as in the Anpassen dialog
 */
const offLocked = computed(() => {
	if (!state.printing.value || state.jobPaused.value) {
		return false;
	}
	return props.target?.kind !== "nozzle" || tool.value?.number === machineStore.model.state.currentTool;
});

// RRF rejects setpoints at or above the heater's M143 limit (and at or below its lower limit)
const maxTemp = computed(() => heater.value?.max ?? 0);
const minTemp = computed(() => Math.max(heater.value?.min ?? 0, 0));
const presets = computed(() => {
	const all = props.target?.kind === "nozzle" ? settingsStore.temperatures.tool.active
		: props.target?.kind === "bed" ? settingsStore.temperatures.bed.active : settingsStore.temperatures.chamber;
	return [...new Set(all)].filter((t) => t > minTemp.value && t < maxTemp.value).sort((a, b) => a - b);
});

// #region Entry

const entry = ref("");
const value = computed(() => parseInt(entry.value, 10));
const valid = computed(() => Number.isFinite(value.value) && value.value > minTemp.value && value.value < maxTemp.value);

// Start from the setpoint the heater runs at, so +5/−5 adjusts it directly
watch(() => props.target, (target) => {
	error.value = null;
	const h = heater.value;
	const setpoint = h?.state === HeaterState.standby ? h.standby : (h?.active ?? 0);
	entry.value = (target !== null && setpoint > 0) ? String(Math.round(setpoint)) : "";
}, { immediate: true });

function press(key: string) {
	if (key === "back") {
		entry.value = entry.value.slice(0, -1);
	} else if (key === "C") {
		entry.value = "";
	} else if (entry.value.length < 4) {
		entry.value = (entry.value === "0") ? key : entry.value + key;
	}
}

function nudge(delta: number) {
	const current = Number.isFinite(value.value) ? value.value : 0;
	entry.value = String(Math.min(Math.max(current + delta, 0), Math.floor(maxTemp.value)));
}

// #endregion

// #region Sending

// The dialog closes once the code went through; a fault reset keeps it open to set the heater again
async function send(kind: Action, code: string, closeAfter = true) {
	error.value = null;
	sending.value = kind;
	try {
		await sendChecked(code, false);
		sending.value = null;
		if (closeAfter) {
			close();
		}
	} catch (e) {
		error.value = getErrorMessage(e);
		sending.value = null;
	}
}

/**
 * M568 S only stores the setpoint of a heater that is off (RRF switches on only heaters in
 * active or standby), so an idle machine also turns the nozzle on with A2. During a job the slicer
 * manages active and standby, so a parked nozzle keeps its state there
 */
function apply() {
	if (!valid.value || props.target === null) {
		return;
	}
	if (props.target.kind === "nozzle") {
		const t = tool.value;
		const index = t?.heaters.indexOf(props.target.heater) ?? -1;
		if (t === null || index < 0) {
			return;
		}
		const setpoints = t.active.map((temp, i) => (i === index) ? value.value : temp).join(":");
		const turnOn = heater.value?.state === HeaterState.off || !state.printing.value;
		send("set", `M568 P${t.number} S${setpoints}${turnOn ? " A2" : ""}`);
	} else {
		// M140/M141 S also switch the heater to active
		send("set", `${props.target.kind === "bed" ? "M140" : "M141"} P0 S${value.value}`);
	}
}

// A0 keeps the tool's setpoints for the next time it is switched on
function switchOff() {
	if (props.target === null) {
		return;
	}
	if (props.target.kind === "nozzle") {
		if (tool.value !== null) {
			send("off", `M568 P${tool.value.number} A0`);
		}
	} else {
		send("off", `${props.target.kind === "bed" ? "M140" : "M141"} P0 S-273.15`);
	}
}

// #endregion

function close() {
	if (sending.value === null) {
		emit("close");
	}
}
</script>
