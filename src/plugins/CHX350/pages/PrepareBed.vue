<template>
	<div class="chx-page">
		<ChxPageHeader :title="$t('plugins.CHX350.prepareBed.title')" :subtitle="$t('plugins.CHX350.generic.step', { n: step + 1, total: steps.length })" :back="ROUTES.start" />
		<ChxStepper v-model:step="step" :steps="steps" :busy="runner.busy.value" @action="onAction">
			<template #step="{ step: s }">
				<div v-if="s === 0 && !runner.configured.value" class="text-body-2 text-medium-emphasis">
					{{ $t("plugins.CHX350.generic.notConfigured") }}
				</div>
			</template>
		</ChxStepper>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import i18n from "@/i18n";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import ChxStepper, { type WizardStep } from "../components/ChxStepper.vue";
import { useMachineState } from "../composables/useMachineState";
import { useMacroRunner } from "../composables/useMacroRunner";
import { ROUTES } from "../routes";
import { useChxSettings } from "../settings";

const router = useRouter();
const state = useMachineState();
const { macros } = useChxSettings();
const runner = useMacroRunner(computed(() => macros.value.prepareBed));

const step = ref(0);
const t = (key: string) => i18n.global.t(`plugins.CHX350.prepareBed.${key}`);

const steps = computed<Array<WizardStep>>(() => [
	{ title: t("s1Title"), body: t("s1Body"), warn: t("s1Warn"), cta: t("s1Cta"), icon: "mdi-tray-arrow-up", disabled: !runner.configured.value || state.axesLocked.value },
	{ title: t("s2Title"), body: t("s2Body"), warn: t("s2Warn"), cta: t("s2Cta"), icon: "mdi-check" },
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
