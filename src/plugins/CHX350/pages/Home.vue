<style scoped>
.axes {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.axis {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 8px 12px;
	border-radius: var(--mp-radius);
	background: var(--surface-page);
	font: 600 15px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
.axis__state {
	margin-left: auto;
	font: 500 13px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.axis__state--ok {
	color: var(--text-brand);
}
</style>

<template>
	<div class="chx-page">
		<ChxPageHeader :subtitle="$t('plugins.CHX350.generic.step', { n: step + 1, total: steps.length })" :back="ROUTES.start" />
		<ChxStepper v-model:step="step" :steps="steps" :busy="runner.busy.value" @action="onAction">
			<template #aside>
				<div class="chx-label">{{ $t("plugins.CHX350.home.axes") }}</div>
				<div class="axes">
					<div v-for="axis in axes" :key="axis.letter" class="axis">
						<v-progress-circular v-if="!axis.homed && homing" indeterminate size="22" width="3" color="primary" />
						<v-icon v-else :color="axis.homed ? 'success' : undefined">{{ axis.homed ? "mdi-check-circle" : "mdi-circle-outline" }}</v-icon>
						{{ axis.letter }}
						<span class="axis__state" :class="{ 'axis__state--ok': axis.homed }">{{ axis.homed ? $t("plugins.CHX350.start.homed") : (homing ? $t("plugins.CHX350.home.moving") : $t("plugins.CHX350.home.open")) }}</span>
						<CodeButton v-if="step > 0" :code="`G28 ${axisGCodeLetter(axis.letter)}`" size="small" variant="outlined" :disabled="state.axesLocked.value" :log="false">
							G28 {{ axis.letter }}
						</CodeButton>
					</div>
				</div>
			</template>
		</ChxStepper>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

import CodeButton from "@/components/buttons/CodeButton.vue";
import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { axisGCodeLetter } from "@/utils/gcode";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import ChxStepper, { type WizardStep } from "../components/ChxStepper.vue";
import { useMachineState } from "../composables/useMachineState";
import { useMacroRunner } from "../composables/useMacroRunner";
import { ROUTES } from "../routes";
import { useChxSettings } from "../settings";

const machineStore = useMachineStore();
const router = useRouter();
const state = useMachineState();
const { macros } = useChxSettings();
const runner = useMacroRunner(computed(() => macros.value.home));

const axes = computed(() => machineStore.model.move.axes.filter((a) => a.visible));
/** Homing runs (ours, or a G28 button) and the axes still open are on their way to the end stops */
const homing = computed(() => runner.busy.value || (step.value > 0 && state.busy.value));
const allHomed = computed(() => axes.value.length > 0 && axes.value.every((a) => a.homed));

const step = ref(0);
const t = (key: string) => i18n.global.t(`plugins.CHX350.home.${key}`);

const steps = computed<Array<WizardStep>>(() => [
	{ title: t("s1Title"), body: t("s1Body"), cta: t("s1Cta"), icon: "mdi-check", disabled: state.axesLocked.value || !runner.configured.value },
	{
		title: t("s2Title"), body: t("s2Body"), warn: t("s2Warn"), cta: allHomed.value ? t("s2CtaDone") : t("s2Cta"), icon: "mdi-home-import-outline",
		disabled: !allHomed.value && (state.busy.value || runner.busy.value), error: runner.error.value
	},
	{ title: t("s3Title"), body: t("s3Body"), cta: t("s3Cta"), icon: "mdi-check-all" }
]);

// Advance automatically once every axis reports homed after the homing run
watch(allHomed, (homed) => {
	if (homed && step.value === 1 && !runner.busy.value) {
		step.value = 2;
	}
});

async function onAction(s: number) {
	if (s === 0) {
		step.value = 1;
		if ((await runner.run()) && allHomed.value) {
			step.value = 2;
		}
	} else if (s === 1) {
		if (allHomed.value) {
			step.value = 2;
		} else {
			await runner.run();
		}
	} else {
		router.push(ROUTES.start);
	}
}
</script>
