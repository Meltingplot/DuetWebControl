<style scoped>
.grid {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr) 340px;
	gap: 16px;
}
.routines {
	display: flex;
	flex-direction: column;
	gap: 12px;
}
.routine {
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 16px 20px;
}
.routine__title {
	font: 700 17px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
.routine__desc {
	font: 400 13px/1.35 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	margin-top: 4px;
}
.info {
	padding: 16px 18px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.info__row {
	display: flex;
	justify-content: space-between;
	gap: 12px;
	font: 500 13px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.info__row b {
	font-family: var(--mp-font-mono, monospace);
	color: var(--text-strong);
}
</style>

<template>
	<div class="chx-page">
		<!-- Under LEERLAUF the header already says "keine Achsbewegung" -->
		<ChxPageHeader :subtitle="state.axesLocked.value && state.plate.value !== 'idle' ? $t('plugins.CHX350.generic.lockedAxes') : ''" :back="ROUTES.start" />
		<div class="grid">
			<div class="routines">
				<div v-for="r in routines" :key="r.key" class="chx-card routine">
					<v-icon size="32" color="secondary">{{ r.icon }}</v-icon>
					<div class="flex-grow-1" style="min-width: 0">
						<div class="routine__title">{{ r.title }}</div>
						<div class="routine__desc">{{ r.configured ? r.desc : $t("plugins.CHX350.generic.notConfigured") }}</div>
					</div>
					<v-btn color="secondary" size="large" class="chx-btn" :disabled="!r.configured || state.axesLocked.value" :loading="r.busy" @click="r.run()">
						<v-icon start>mdi-play</v-icon>
						{{ $t("plugins.CHX350.calibrate.run") }}
					</v-btn>
				</div>
			</div>
			<div class="chx-card info">
				<div class="chx-label">{{ $t("plugins.CHX350.calibrate.meshInfo") }}</div>
				<div class="info__row"><span>{{ $t("plugins.CHX350.calibrate.meshFile") }}</span><b>{{ compensation.file ? extractFileName(compensation.file) : "—" }}</b></div>
				<div class="info__row"><span>{{ $t("plugins.CHX350.calibrate.meshType") }}</span><b>{{ compensation.type }}</b></div>
				<div class="info__row"><span>{{ $t("plugins.CHX350.calibrate.meshDeviation") }}</span><b>{{ compensation.meshDeviation ? `${compensation.meshDeviation.deviation.toFixed(3)} mm` : "—" }}</b></div>
				<div class="info__row"><span>{{ $t("plugins.CHX350.calibrate.meshMean") }}</span><b>{{ compensation.meshDeviation ? `${compensation.meshDeviation.mean.toFixed(3)} mm` : "—" }}</b></div>
				<div class="info__row"><span>{{ $t("plugins.CHX350.calibrate.probeTrigger") }}</span><b>{{ probe ? `${probe.triggerHeight} mm` : "—" }}</b></div>
				<div class="info__row"><span>{{ $t("plugins.CHX350.calibrate.probeValue") }}</span><b>{{ probe ? probe.value.join(" / ") : "—" }}</b></div>
				<v-btn variant="outlined" class="chx-btn mt-2" @click="router.push('/Plugins/HeightMap')">
					<v-icon start>mdi-grid</v-icon>
					{{ $t("plugins.CHX350.service.heightmap") }}
				</v-btn>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { extractFileName } from "@/utils/path";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import { useMachineState } from "../composables/useMachineState";
import { useMacroRunner } from "../composables/useMacroRunner";
import { ROUTES } from "../routes";
import { useChxSettings } from "../settings";

const machineStore = useMachineStore();
const router = useRouter();
const state = useMachineState();
const { macros } = useChxSettings();

const zero = useMacroRunner(computed(() => macros.value.calibrateZero));
const mesh = useMacroRunner(computed(() => macros.value.calibrateMesh));
const alignZ = useMacroRunner(computed(() => macros.value.calibrateAlignZ));

const t = (key: string) => i18n.global.t(`plugins.CHX350.calibrate.${key}`);
const routines = computed(() => [
	{ key: "zero", icon: "mdi-target", title: t("zeroTitle"), desc: t("zeroDesc"), configured: zero.configured.value, busy: zero.busy.value, run: zero.run },
	{ key: "mesh", icon: "mdi-grid", title: t("meshTitle"), desc: t("meshDesc"), configured: mesh.configured.value, busy: mesh.busy.value, run: mesh.run },
	{ key: "alignZ", icon: "mdi-align-vertical-center", title: t("alignZTitle"), desc: t("alignZDesc"), configured: alignZ.configured.value, busy: alignZ.busy.value, run: alignZ.run }
]);

const compensation = computed(() => machineStore.model.move.compensation);
const probe = computed(() => machineStore.model.sensors.probes.find((p) => p !== null) ?? null);
</script>
