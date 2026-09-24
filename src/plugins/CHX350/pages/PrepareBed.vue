<style scoped>
.plate {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	padding: 12px 14px;
	border-radius: var(--mp-radius);
	background: var(--surface-page);
}
.plate__info {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
}
.plate__info b {
	font: 700 16px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
</style>

<template>
	<div class="chx-page">
		<ChxPageHeader :subtitle="$t('plugins.CHX350.generic.step', { n: step + 1, total: steps.length })" :back="ROUTES.start" />
		<ChxStepper v-model:step="step" :steps="steps" :busy="runner.busy.value || hw.bedSurface.busy.value" @action="onAction">
			<template #step="{ step: s }">
				<div v-if="s === 0 && !runner.configured.value" class="text-body-2 text-medium-emphasis">
					{{ $t("plugins.CHX350.generic.notConfigured") }}
				</div>
				<!-- Parts come off more easily once the bed has cooled; the reading shows how far it is -->
				<div v-else-if="s === 1 && temps.bedHeater.value" class="plate">
					<div class="plate__info">
						<span class="text-body-2">{{ $t("plugins.CHX350.prepareBed.bedTemp") }}</span>
						<b>{{ formatTemp(temps.bedCurrent.value) }}</b>
					</div>
					<span class="text-body-2">{{ bedTargetLabel }}</span>
				</div>
				<!-- A plate of another surface is recorded on the machine (global.bed_surface) -->
				<div v-else-if="s === 2 && hw.hasBedSurface.value" class="plate">
					<div class="plate__info">
						<span class="text-body-2">{{ $t("plugins.CHX350.prepareBed.surface") }}</span>
						<b>{{ surfaceLabel }}</b>
					</div>
					<v-btn variant="outlined" size="large" class="chx-btn" :disabled="!hw.allowed.value" :loading="hw.bedSurface.busy.value" @click="hw.bedSurface.run()">
						<v-icon start>mdi-swap-horizontal</v-icon>
						{{ $t("plugins.CHX350.prepareBed.surfaceChange") }}
					</v-btn>
				</div>
			</template>
		</ChxStepper>
	</div>
</template>

<script setup lang="ts">
import { HeaterState } from "@duet3d/objectmodel";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import i18n from "@/i18n";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import ChxStepper, { type WizardStep } from "../components/ChxStepper.vue";
import { bedSurfaceLabel, useChxGlobals } from "../composables/useChxGlobals";
import { useHardwareMacros } from "../composables/useHardwareMacros";
import { useMachineState } from "../composables/useMachineState";
import { useMacroRunner } from "../composables/useMacroRunner";
import { formatTemp, useTemps } from "../composables/useTemps";
import { ROUTES } from "../routes";
import { useChxSettings } from "../settings";

const router = useRouter();
const state = useMachineState();
const { macros } = useChxSettings();
const runner = useMacroRunner(computed(() => macros.value.prepareBed));
const globals = useChxGlobals();
const hw = useHardwareMacros();
const temps = useTemps();
const surfaceLabel = computed(() => globals.bedSurface.value !== null
	? bedSurfaceLabel(globals.bedSurface.value)
	: i18n.global.t("plugins.CHX350.prepareBed.surfaceNone"));

const step = ref(0);
const t = (key: string, params: Record<string, unknown> = {}) => i18n.global.t(`plugins.CHX350.prepareBed.${key}`, params);

/** Above this the bed is too hot to touch without gloves */
const HOT_BED = 45;
const bedHot = computed(() => (temps.bedCurrent.value ?? 0) >= HOT_BED);
const hotWarn = computed(() => bedHot.value ? t("bedHot", { temp: formatTemp(temps.bedCurrent.value, 0) }) : undefined);
const bedTargetLabel = computed(() => {
	const active = temps.bedActive.value ?? 0;
	return temps.bedHeater.value?.state === HeaterState.active && active > 0
		? i18n.global.t("plugins.CHX350.start.target", { t: formatTemp(active, 0) })
		: t("bedOff");
});

const steps = computed<Array<WizardStep>>(() => [
	{
		title: t("s1Title"), body: t("s1Body"), warn: hotWarn.value, cta: t("s1Cta"), icon: "mdi-tray-arrow-up",
		disabled: !runner.configured.value || state.axesLocked.value, error: runner.error.value
	},
	{ title: t("s2Title"), body: t("s2Body"), warn: hotWarn.value ?? t("s2Warn"), cta: t("s2Cta"), icon: "mdi-check" },
	{ title: t("s3Title"), body: t("s3Body"), warn: t("s3Warn"), cta: t("s3Cta"), icon: "mdi-check-all" }
]);

async function onAction(s: number) {
	if (s === 0) {
		if (await runner.run()) {
			step.value = 1;
		}
	} else if (s === 1) {
		step.value = 2;
	} else {
		router.push(ROUTES.start);
	}
}
</script>
