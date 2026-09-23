<style scoped>
.choices {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 12px;
	overflow: auto;
	padding-right: 4px;
}
.choice {
	all: unset;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 14px 16px;
	min-height: 64px;
	border-radius: var(--mp-radius-lg);
	background: var(--surface-card);
	border: 1px solid var(--border-default);
	cursor: pointer;
	color: var(--text-strong);
}
.choice--active {
	border-color: var(--text-brand);
	box-shadow: 0 0 0 2px var(--text-brand) inset;
}
.choice__title {
	font: 700 16px/1.2 var(--mp-font-body, sans-serif);
}
.choice__sub {
	font: 400 12px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.steps {
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.step {
	display: flex;
	gap: 12px;
	align-items: flex-start;
	font: 400 15px/1.45 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.step__n {
	flex: none;
	width: 28px;
	height: 28px;
	border-radius: 50%;
	background: var(--mp-primary-dark);
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	font: 700 13px/1 var(--mp-font-mono, monospace);
}
.summary {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 12px 14px;
	border-radius: var(--mp-radius);
	background: var(--surface-page);
}
.summary b {
	font: 700 16px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
</style>

<template>
	<div class="chx-page">
		<ChxPageHeader :subtitle="$t('plugins.CHX350.generic.step', { n: step + 1, total: 3 })" :back="ROUTES.start" @back="onBack" />
		<ChxStepper v-model:step="step" :steps="steps" :busy="busy || hw.spool.busy.value" @action="onAction">
			<template #step="{ step: s }">
				<div v-if="s === 0" class="choices">
					<button v-for="tool in temps.tools.value" :key="tool.number" type="button" class="choice" :class="{ 'choice--active': tool.number === wizTool }" @click="wizTool = tool.number">
						<span class="choice__title">T{{ tool.number }}</span>
						<span class="choice__sub">{{ tool.nozzleDiameter !== null ? $t("plugins.CHX350.start.nozzle", { d: tool.nozzleDiameter }) + " · " : "" }}{{ tool.filament ? $t("plugins.CHX350.filament.loadedWith", { name: tool.filament }) : $t("plugins.CHX350.start.noFilament") }}</span>
					</button>
				</div>
				<div v-else-if="s === 1">
					<div v-if="loadingMaterials" class="d-flex justify-center py-4"><v-progress-circular indeterminate color="primary" /></div>
					<div v-else class="choices">
						<button v-for="mat in materials" :key="mat" type="button" class="choice" :class="{ 'choice--active': mat === wizMaterial }" @click="wizMaterial = mat">
							<span class="choice__title">{{ mat }}</span>
						</button>
						<button type="button" class="choice" :class="{ 'choice--active': wizMaterial === UNLOAD }" @click="wizMaterial = UNLOAD">
							<span class="choice__title">{{ $t("plugins.CHX350.filament.unloadOnly") }}</span>
							<span class="choice__sub">{{ $t("plugins.CHX350.filament.unloadOnlySub") }}</span>
						</button>
					</div>
				</div>
				<div v-else class="steps">
					<div class="step"><span class="step__n">1</span><span>{{ $t("plugins.CHX350.filament.i1") }}</span></div>
					<div class="step"><span class="step__n">2</span><span>{{ $t("plugins.CHX350.filament.i2") }}</span></div>
					<div class="step"><span class="step__n">3</span><span>{{ $t("plugins.CHX350.filament.i3") }}</span></div>
				</div>
			</template>
			<template #aside>
				<div class="chx-label">{{ $t("plugins.CHX350.filament.summary") }}</div>
				<div class="summary">
					<span class="text-body-2">{{ $t("plugins.CHX350.filament.tool") }}</span>
					<b>T{{ wizTool }}</b>
				</div>
				<div class="summary">
					<span class="text-body-2">{{ $t("plugins.CHX350.filament.currently") }}</span>
					<b>{{ currentTool?.filament || $t("plugins.CHX350.start.noFilament") }}</b>
				</div>
				<div class="summary">
					<span class="text-body-2">{{ $t("plugins.CHX350.filament.material") }}</span>
					<b>{{ wizMaterial === UNLOAD ? $t("plugins.CHX350.filament.unloadOnly") : (wizMaterial || "—") }}</b>
				</div>
				<div class="summary">
					<span class="text-body-2">{{ $t("plugins.CHX350.filament.spool") }}</span>
					<b>{{ spoolLabel }}</b>
				</div>
				<div class="text-body-2 text-medium-emphasis mt-2">{{ $t("plugins.CHX350.filament.spoolHint") }}</div>
				<!-- New spool of the same material, or a correction: the machine asks without a filament change -->
				<v-btn v-if="hw.hasSpool.value" variant="outlined" size="large" class="chx-btn" :disabled="!hw.allowed.value || busy" :loading="hw.spool.busy.value" @click="hw.spool.run()">
					<v-icon start>mdi-scale</v-icon>
					{{ $t("plugins.CHX350.filament.spoolRecord", { tool: `T${wizTool}` }) }}
				</v-btn>
				<div v-if="done" class="mt-auto">
					<v-alert type="success" variant="tonal" density="compact" :text="$t('plugins.CHX350.filament.done')" />
				</div>
			</template>
		</ChxStepper>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { LogLevel, useUiStore } from "@/stores/ui";
import { display } from "@/utils/display";
import Path from "@/utils/path";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import ChxStepper, { type WizardStep } from "../components/ChxStepper.vue";
import { useHardwareMacros } from "../composables/useHardwareMacros";
import { useMachineState } from "../composables/useMachineState";
import { useTemps } from "../composables/useTemps";
import { ROUTES } from "../routes";

const UNLOAD = "__unload__";

const machineStore = useMachineStore();
const uiStore = useUiStore();
const router = useRouter();
const state = useMachineState();
const temps = useTemps();

const step = ref(0);
const wizTool = ref(Math.max(0, machineStore.model.state.currentTool));
const wizMaterial = ref("");
const busy = ref(false);
const done = ref(false);

const currentTool = computed(() => temps.tools.value.find((t) => t.number === wizTool.value) ?? null);
const hw = useHardwareMacros(wizTool);
// The spool now on the tool; the load itself asks for the new one (spool/confirm.g on the machine)
const spoolLabel = computed(() => {
	const spool = currentTool.value?.spool;
	return spool
		? i18n.global.t("plugins.CHX350.filament.spoolValue", { left: display(spool.remaining / 1000, 2, "kg"), net: display(spool.netWeight / 1000, 2, "kg") })
		: i18n.global.t("plugins.CHX350.filament.spoolNone");
});

// Materials = RRF filament profiles (directories under 0:/filaments), like DWC's FilamentDialog
const materials = ref<Array<string>>([]);
const loadingMaterials = ref(false);
async function loadMaterials() {
	loadingMaterials.value = true;
	try {
		const dir = machineStore.model.directories.filaments || Path.filaments;
		const list = await machineStore.getFileList(dir);
		materials.value = list.filter((f) => f.isDirectory).map((f) => f.name).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
	} catch (e) {
		uiStore.notifyError(e, i18n.global.t("error.filelistRequestFailed"));
	} finally {
		loadingMaterials.value = false;
	}
}
onMounted(loadMaterials);

const t = (key: string) => i18n.global.t(`plugins.CHX350.filament.${key}`);
const machineBlocked = computed(() => state.uiFrozen.value || (state.printing.value && !state.paused.value));

const steps = computed<Array<WizardStep>>(() => [
	{ title: t("s1Title"), body: t("s1Body"), cta: t("next"), icon: "mdi-arrow-right", disabled: temps.tools.value.length === 0 },
	{ title: i18n.global.t("plugins.CHX350.filament.s2Title", { tool: `T${wizTool.value}` }), body: t("s2Body"), cta: t("next"), icon: "mdi-arrow-right", disabled: !wizMaterial.value },
	{
		title: wizMaterial.value === UNLOAD ? t("s3TitleUnload") : t("s3Title"),
		body: t("s3Body"),
		warn: t("s3Warn"),
		cta: done.value ? t("finish") : (wizMaterial.value === UNLOAD ? t("runUnload") : t("runLoad")),
		icon: done.value ? "mdi-check-all" : "mdi-play",
		disabled: machineBlocked.value
	}
]);

function onBack() {
	// handled by ChxPageHeader (back route); nothing else to reset
}

async function onAction(s: number) {
	if (s < 2) {
		step.value = s + 1;
		return;
	}
	if (done.value) {
		router.push(ROUTES.start);
		return;
	}
	busy.value = true;
	try {
		// Same sequence as DWC's FilamentDialog; DSF keeps the order of codes on one channel
		await machineStore.sendCode(`T${wizTool.value}`, false, false);
		if (currentTool.value?.filament) {
			await machineStore.sendCode("M702", false, true);
		}
		if (wizMaterial.value !== UNLOAD) {
			await machineStore.sendCode(`M701 S"${wizMaterial.value}"`, false, true);
			await machineStore.sendCode("M703", false, false);
		}
		done.value = true;
	} catch (e) {
		uiStore.log(LogLevel.error, t("title"), String(e));
	} finally {
		busy.value = false;
	}
}
</script>
