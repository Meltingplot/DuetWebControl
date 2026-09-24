<style scoped>
.estop-card {
	width: min(560px, 90vw);
	padding: 32px 36px;
	border-radius: var(--mp-radius-lg, 14px);
	background: var(--surface-error, #C8354A);
	color: #fff;
	text-align: center;
	box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
}
.estop-card__title {
	font: 800 40px/1 var(--mp-font-body, sans-serif);
	letter-spacing: 0.08em;
	margin-bottom: 14px;
}
.estop-card__text {
	font: 400 16px/1.5 var(--mp-font-body, sans-serif);
	margin-bottom: 26px;
	opacity: 0.95;
}
</style>

<template>
	<v-overlay :model-value="halted" persistent :z-index="3000" class="d-flex align-center justify-center" scrim="#1A1F24" opacity="0.85">
		<div class="estop-card">
			<div class="estop-card__title">{{ $t("plugins.CHX350.estop.title") }}</div>
			<div class="estop-card__text">{{ $t("plugins.CHX350.estop.text") }}</div>
			<CodeButton code="M999" color="white" variant="flat" size="x-large" class="chx-btn chx-text-alarm" :log="false">
				<v-icon start>mdi-restart</v-icon>
				{{ $t("plugins.CHX350.estop.reset") }}
			</CodeButton>
		</div>
	</v-overlay>
</template>

<script setup lang="ts">
import { MachineStatus } from "@duet3d/objectmodel";
import { computed, watch } from "vue";
import { useRouter } from "vue-router";

import CodeButton from "@/components/buttons/CodeButton.vue";
import { useMachineStore } from "@/stores/machine";

import { ROUTES } from "../routes";

const machineStore = useMachineStore();
const router = useRouter();
const halted = computed(() => machineStore.isConnected && machineStore.model.state.status === MachineStatus.halted);

// After the reset the operator starts over from the overview; the page behind the overlay (a
// wizard step, the job) no longer matches the machine
watch(halted, (now, before) => {
	if (before && !now && router.currentRoute.value.path !== ROUTES.start) {
		router.push(ROUTES.start);
	}
});
</script>
