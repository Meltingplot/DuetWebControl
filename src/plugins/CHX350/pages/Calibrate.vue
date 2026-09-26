<style scoped>
.routines {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
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
.routine__icon {
	color: var(--text-brand);
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
</style>

<template>
	<div class="chx-page">
		<!-- Under LEERLAUF the header already says "keine Achsbewegung" -->
		<ChxPageHeader :subtitle="state.axesLocked.value && state.plate.value !== 'idle' ? $t('plugins.CHX350.generic.lockedAxes') : ''" :back="ROUTES.start" />
		<!-- Flows of the machine configuration with `page: calibrate`: hardware changed, calibrations -->
		<div class="routines">
			<div v-for="tile in flowTiles" :key="tile.path" class="chx-card routine">
				<v-icon size="32" class="routine__icon">{{ tile.icon }}</v-icon>
				<div class="flex-grow-1" style="min-width: 0">
					<div class="routine__title">
						{{ tile.title }}
						<v-icon v-if="tile.warn" size="18" color="warning">mdi-alert-outline</v-icon>
					</div>
					<div class="routine__desc">{{ tile.subtitle }}</div>
				</div>
				<!-- One flow at a time: a second one would queue behind the running macro -->
				<v-btn color="secondary" size="large" class="chx-btn" :disabled="tile.disabled" @click="tile.run()">
					<v-icon start>mdi-play</v-icon>
					{{ $t("plugins.CHX350.calibrate.run") }}
				</v-btn>
			</div>
			<div v-if="flowTiles.length === 0" class="chx-card routine">
				<div class="routine__desc">{{ $t("plugins.CHX350.calibrate.none") }}</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import ChxPageHeader from "../components/ChxPageHeader.vue";
import { useMachineState } from "../composables/useMachineState";
import { useFlowTiles } from "../flows/useFlowTiles";
import { ROUTES } from "../routes";

const state = useMachineState();
const flowTiles = useFlowTiles("calibrate");
</script>
