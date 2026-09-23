<style scoped>
.banner {
	display: flex;
	align-items: center;
	gap: 14px;
	padding: 10px 14px;
	border-radius: var(--mp-radius);
	background: var(--surface-error, #C8354A);
	color: #fff;
}
.banner--warn {
	background: var(--mp-accent);
	color: var(--mp-neutral-900);
}
.banner__title {
	font: 700 15px/1.2 var(--mp-font-body, sans-serif);
}
.banner__body {
	font: 400 13px/1.3 var(--mp-font-body, sans-serif);
	/* 0.9 would drop white on the red surface below 4.5:1 */
	opacity: 0.95;
}
</style>

<template>
	<div v-for="fault in faults" :key="fault.index" class="banner">
		<v-icon size="26">mdi-alert-octagon-outline</v-icon>
		<div class="flex-grow-1">
			<div class="banner__title">{{ $t("plugins.CHX350.job.heaterFault", { heater: fault.name }) }}</div>
			<div class="banner__body">{{ $t("plugins.CHX350.job.heaterFaultBody") }}</div>
		</div>
		<CodeButton :code="`M562 P${fault.index}`" color="white" variant="flat" class="chx-btn chx-text-alarm" :log="false">
			{{ $t("plugins.CHX350.job.acknowledge") }}
		</CodeButton>
	</div>
	<div v-if="state.doorOpen.value && state.printing.value" class="banner banner--warn">
		<v-icon size="26">mdi-door-open</v-icon>
		<div class="flex-grow-1">
			<div class="banner__title">{{ $t("plugins.CHX350.job.doorOpen") }}</div>
			<div class="banner__body">{{ $t("plugins.CHX350.job.doorOpenBody") }}</div>
		</div>
	</div>
	<div v-if="monitorIssue" class="banner banner--warn">
		<v-icon size="26">mdi-alert-outline</v-icon>
		<div class="flex-grow-1">
			<div class="banner__title">{{ $t("plugins.CHX350.job.filamentMonitor", { status: monitorIssue }) }}</div>
			<div class="banner__body">{{ $t("plugins.CHX350.job.filamentMonitorBody") }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { FilamentMonitorStatus } from "@duet3d/objectmodel";
import { computed } from "vue";

import CodeButton from "@/components/buttons/CodeButton.vue";
import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";

import { useMachineState } from "../composables/useMachineState";

const machineStore = useMachineStore();
const state = useMachineState();

const faults = computed(() => state.heaterFaults.value.map((index) => {
	const bed = machineStore.bedHeaterMapping.some((slot) => slot.includes(index));
	const tool = machineStore.model.tools.find((t) => t !== null && t.heaters.includes(index));
	const name = bed ? i18n.global.t("plugins.CHX350.header.bed") : (tool ? `T${tool.number}` : `H${index}`);
	return { index, name };
}));

const monitorIssue = computed(() => {
	if (!state.printing.value) {
		return null;
	}
	const monitor = machineStore.model.sensors.filamentMonitors.find((m) => m !== null);
	if (!monitor || monitor.status === FilamentMonitorStatus.ok || monitor.status === FilamentMonitorStatus.noMonitor) {
		return null;
	}
	return i18n.global.t(`plugins.CHX350.start.monitor.${monitor.status}`);
});
</script>
