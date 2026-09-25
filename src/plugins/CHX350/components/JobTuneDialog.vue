<style scoped>
.tune {
	padding: 20px 22px;
	display: flex;
	flex-direction: column;
	gap: 14px;
	max-height: calc(100dvh - 48px);
	overflow: auto;
}
.tune__head {
	display: flex;
	align-items: center;
	gap: 12px;
}
.tune__head h2 {
	flex: 1;
	margin: 0;
	font: 700 22px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
.grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 12px;
}
.item {
	padding: 12px 14px;
	border-radius: var(--mp-radius);
	background: var(--surface-page);
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.item--wide {
	grid-column: span 2;
}
.item__head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
}
.item__value {
	font: 700 22px/1 var(--mp-font-mono, monospace);
	color: var(--text-strong);
}
.item__value--changed {
	color: var(--text-brand);
}
.item__hint {
	font: 400 12px/1.35 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.item__buttons {
	display: flex;
	gap: 8px;
}
.item__buttons > .v-btn {
	flex: 1;
	min-height: var(--chx-touch, 56px);
	font-family: var(--mp-font-mono, monospace);
}
.load {
	font-weight: 600;
	white-space: nowrap;
}
.load + .load::before {
	content: "· ";
}
/* Ink tones, as HeaterPhaseLabel */
.load--high {
	color: var(--text-warning);
}
.load--limit {
	color: rgb(var(--v-theme-error));
}
.temps {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 12px;
}
</style>

<template>
	<!-- Attached to the shell so the CHX tokens (surfaces, ink tones) apply inside the dialog -->
	<v-dialog :model-value="modelValue" attach=".chx-shell" max-width="900" scrollable @update:model-value="emit('update:modelValue', $event)">
		<div class="chx-card tune">
			<div class="tune__head">
				<h2>{{ $t("plugins.CHX350.tune.title") }}</h2>
				<v-btn variant="text" icon="mdi-close" size="large" :aria-label="$t('plugins.CHX350.generic.close')" @click="emit('update:modelValue', false)" />
			</div>

			<div class="grid">
				<!-- Babystepping shifts the whole print in Z; it stays in effect until reset (also for the
					 next job), Kalibrieren offers to store it as the probe's Z offset -->
				<div v-if="zAxis" class="item">
					<div class="item__head">
						<span class="chx-label">{{ $t("plugins.CHX350.tune.babystep") }}</span>
						<span class="item__value" :class="{ 'item__value--changed': babystep !== 0 }">{{ formatSigned(babystep, 2) }} mm</span>
					</div>
					<div class="item__buttons">
						<v-btn v-for="step in BABYSTEPS" :key="step" variant="outlined" :disabled="!canTune" @click="send(`M290 R1 S${step}`)">{{ formatSigned(step, 2) }}</v-btn>
					</div>
					<div class="item__hint">{{ $t("plugins.CHX350.tune.babystepHint") }}</div>
				</div>

				<div class="item">
					<div class="item__head">
						<span class="chx-label">{{ $t("plugins.CHX350.tune.speed") }}</span>
						<span class="item__value" :class="{ 'item__value--changed': speedPct !== 100 }">{{ speedPct }} %</span>
					</div>
					<div class="item__buttons">
						<v-btn variant="outlined" :disabled="!canTune || speedPct <= SPEED_MIN" @click="setSpeed(speedPct - 10)">−10</v-btn>
						<v-btn variant="outlined" :disabled="!canTune || speedPct >= SPEED_MAX" @click="setSpeed(speedPct + 10)">+10</v-btn>
						<v-btn variant="outlined" :disabled="!canTune || speedPct === 100" @click="setSpeed(100)">100 %</v-btn>
					</div>
					<!-- Live heater load of the nozzles in use: the speed is the lever against an overloaded heater -->
					<div v-if="loads.length > 0" class="item__hint">
						{{ $t("plugins.CHX350.tune.heaterLoad") }}
						<span v-for="l in loads" :key="l.number" class="load" :class="l.level && `load--${l.level}`">T{{ l.number }} {{ formatLoad(l.load) }}</span>
						· {{ $t("plugins.CHX350.tune.heaterLoadHint", { limit: formatLoad(LOAD_HIGH) }) }}
					</div>
				</div>

				<div v-for="t in toolsInUse" :key="`flow${t.number}`" class="item">
					<div class="item__head">
						<span class="chx-label">{{ $t("plugins.CHX350.tune.flow", { tool: `T${t.number}` }) }}</span>
						<span class="item__value" :class="{ 'item__value--changed': t.flowPct !== 100 }">{{ t.flowPct }} %</span>
					</div>
					<div class="item__buttons">
						<v-btn variant="outlined" :disabled="!canTune || t.extruder < 0 || t.flowPct <= FLOW_MIN" @click="setFlow(t.extruder, t.flowPct - 5)">−5</v-btn>
						<v-btn variant="outlined" :disabled="!canTune || t.extruder < 0 || t.flowPct >= FLOW_MAX" @click="setFlow(t.extruder, t.flowPct + 5)">+5</v-btn>
						<v-btn variant="outlined" :disabled="!canTune || t.extruder < 0 || t.flowPct === 100" @click="setFlow(t.extruder, 100)">100 %</v-btn>
					</div>
				</div>

				<div v-for="t in toolsWithFan" :key="`fan${t.number}`" class="item">
					<div class="item__head">
						<span class="chx-label">{{ $t("plugins.CHX350.tune.fan", { tool: `T${t.number}` }) }}</span>
						<span class="item__value">{{ t.fanPct }} %</span>
					</div>
					<div class="item__buttons">
						<v-btn variant="outlined" :disabled="!canTune || t.fanPct <= 0" @click="setFan(t.fan, t.fanPct - 10)">−10</v-btn>
						<v-btn variant="outlined" :disabled="!canTune || t.fanPct >= 100" @click="setFan(t.fan, t.fanPct + 10)">+10</v-btn>
						<v-btn variant="outlined" :disabled="!canTune || t.fanPct === 0" @click="setFan(t.fan, 0)">{{ $t("plugins.CHX350.generic.off") }}</v-btn>
					</div>
				</div>

				<!-- Manual extrusion only while paused: purging after a filament problem. resume.g
					 re-primes the melt zone by what was retracted here -->
				<div v-if="paused" class="item item--wide">
					<div class="item__head">
						<span class="chx-label">{{ $t("plugins.CHX350.tune.extrude", { tool: pausedTool ? `T${pausedTool.number}` : "" }) }}</span>
						<span class="item__value">{{ pausedTool ? formatTemp(pausedTool.current, 0) : "—" }}</span>
					</div>
					<div class="item__buttons">
						<v-btn variant="outlined" :disabled="!canExtrude" @click="extrude(-10)">−10 mm</v-btn>
						<v-btn variant="outlined" :disabled="!canExtrude" @click="extrude(10)">+10 mm</v-btn>
						<v-btn variant="outlined" :disabled="!canExtrude" @click="extrude(50)">+50 mm</v-btn>
					</div>
					<div class="item__hint">{{ canExtrude ? $t("plugins.CHX350.tune.extrudeHint") : $t("plugins.CHX350.tune.extrudeCold", { temp: formatTemp(coldExtrude, 0) }) }}</div>
				</div>

				<div class="item item--wide">
					<span class="chx-label">{{ $t("plugins.CHX350.tune.temperatures") }}</span>
					<div class="temps">
						<div v-for="t in toolsInUse" :key="`temp${t.number}`">
							<div class="item__hint">{{ $t("plugins.CHX350.header.nozzleTool", { n: t.number }) }} · {{ formatTemp(t.current) }}</div>
							<ControlInput type="tool" :index="t.number" :tool-heater-index="0" active :disabled="uiFrozen" />
						</div>
						<div v-if="temps.bedHeater.value">
							<div class="item__hint">{{ $t("plugins.CHX350.header.bed") }} · {{ formatTemp(temps.bedCurrent.value) }}</div>
							<ControlInput type="bed" :index="0" active :disabled="uiFrozen" />
						</div>
						<div v-if="temps.hasChamberHeater.value">
							<div class="item__hint">{{ $t("plugins.CHX350.header.chamber") }} · {{ formatTemp(temps.chamberCurrent.value) }}</div>
							<ControlInput type="chamber" :index="0" active :disabled="uiFrozen" />
						</div>
					</div>
				</div>
			</div>

			<v-alert v-if="error" type="error" variant="tonal" density="compact" :text="error" />
		</div>
	</v-dialog>
</template>

<script setup lang="ts">
import { HeaterState, MachineStatus, type Tool } from "@duet3d/objectmodel";
import { computed, ref } from "vue";

import ControlInput from "@/components/inputs/ControlInput.vue";
import { useMachineStore } from "@/stores/machine";
import { getErrorMessage } from "@/utils/errors";

import { useMachineState } from "../composables/useMachineState";
import { sendChecked } from "../composables/useMacroRunner";
import { formatTemp, useTemps } from "../composables/useTemps";
import { formatLoad, heaterLoad, LOAD_HIGH, useHeaterLoadStore } from "../stores/heaterLoad";

const BABYSTEPS = [-0.05, -0.01, 0.01, 0.05];
const SPEED_MIN = 20;
const SPEED_MAX = 300;
const FLOW_MIN = 50;
const FLOW_MAX = 200;
/** Tools shown at once; on a 16-nozzle machine at most two print at the same time */
const MAX_TOOLS = 2;

defineProps<{
	modelValue: boolean;
}>();
const emit = defineEmits<{
	(e: "update:modelValue", value: boolean): void;
}>();

const machineStore = useMachineStore();
const state = useMachineState();
const temps = useTemps();
const heaterLoadStore = useHeaterLoadStore();

const uiFrozen = computed(() => state.uiFrozen.value);
/** Adjustments apply to a running or paused job */
const canTune = computed(() => !uiFrozen.value && state.printing.value);
const paused = computed(() => state.status.value === MachineStatus.paused);

const zAxis = computed(() => machineStore.model.move.axes.find((a) => a.letter === "Z") ?? null);
const babystep = computed(() => zAxis.value?.babystep ?? 0);
const speedPct = computed(() => Math.round(machineStore.model.move.speedFactor * 100));

/**
 * The selected tool first, then tools whose heater is on (IDEX copy/mirror prints with two); the
 * first tool when neither applies (e.g. the start code has not selected one yet)
 */
const toolsInUse = computed(() => {
	const current = machineStore.model.state.currentTool;
	const all = machineStore.model.tools.filter((t): t is Tool => t !== null);
	let list = all
		.filter((t) => t.number === current || t.heaters.some((h) => machineStore.model.heat.heaters[h]?.state === HeaterState.active))
		.sort((a, b) => (a.number === current ? -1 : 0) - (b.number === current ? -1 : 0) || a.number - b.number)
		.slice(0, MAX_TOOLS);
	if (list.length === 0) {
		list = all.slice(0, 1);
	}
	return list.map((tool) => {
		const extruder = tool.extruders[0] ?? -1;
		const fan = tool.fans[0] ?? -1;
		return {
			number: tool.number,
			current: temps.tools.value.find((t) => t.number === tool.number)?.current ?? null,
			extruder,
			flowPct: Math.round((machineStore.model.move.extruders[extruder]?.factor ?? 1) * 100),
			fan,
			fanPct: Math.round((machineStore.model.fans[fan]?.requestedValue ?? 0) * 100)
		};
	});
});
/** Live load of the heated nozzles in use; the colour follows the one-minute mean the banner uses */
const loads = computed(() => toolsInUse.value.map((t) => {
	const index = machineStore.model.tools[t.number]?.heaters[0] ?? -1;
	const heater = machineStore.model.heat.heaters[index];
	return {
		number: t.number,
		load: heater?.state === HeaterState.active ? heaterLoad(heater) : null,
		level: heaterLoadStore.nozzles.find((n) => n.heater === index)?.level ?? null
	};
}).filter((l) => l.load !== null));
const toolsWithFan = computed(() => toolsInUse.value.filter((t) => t.fan >= 0 && machineStore.model.fans[t.fan]));

const coldExtrude = computed(() => machineStore.model.heat.coldExtrudeTemperature);
const pausedTool = computed(() => temps.tools.value.find((t) => t.number === machineStore.model.state.currentTool) ?? null);
const canExtrude = computed(() => canTune.value && paused.value && pausedTool.value !== null
	&& (pausedTool.value.current ?? 0) >= coldExtrude.value);

function formatSigned(value: number, digits: number): string {
	return `${value > 0 ? "+" : (value < 0 ? "−" : "±")}${Math.abs(value).toFixed(digits)}`;
}

const error = ref<string | null>(null);
async function send(code: string) {
	error.value = null;
	try {
		await sendChecked(code, false);
	} catch (e) {
		error.value = getErrorMessage(e);
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
const setSpeed = (pct: number) => send(`M220 S${clamp(pct, SPEED_MIN, SPEED_MAX)}`);
const setFlow = (extruder: number, pct: number) => send(`M221 D${extruder} S${clamp(pct, FLOW_MIN, FLOW_MAX)}`);
const setFan = (fan: number, pct: number) => send(`M106 P${fan} S${(clamp(pct, 0, 100) / 100).toFixed(2)}`);
// M120/M121 keep the channel's extrusion mode, as DWC's ExtrudePanel does
const extrude = (mm: number) => send(`M120\nM83\nG1 E${mm} F300\nM121`);
</script>
