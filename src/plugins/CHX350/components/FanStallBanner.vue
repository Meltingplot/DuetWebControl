<style scoped>
/* As FaultBanner, inset by the page padding above the page frame */
.banner {
	display: flex;
	align-items: center;
	gap: 14px;
	margin: 16px 22px 0;
	padding: 10px 14px;
	border-radius: var(--mp-radius);
	background: var(--surface-error, #C8354A);
	color: #fff;
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

<!-- Shown above every page: while a fan stands, start.g refuses every new job. Reported by the
	 machine configuration (global.fan_stalled), which also decides the reaction; the entry clears
	 by itself once the fan turns again -->
<template>
	<div v-if="fans.stalledLabels.value" class="banner" role="alert">
		<v-icon size="26">mdi-fan-alert</v-icon>
		<div class="flex-grow-1">
			<div class="banner__title">{{ $t("plugins.CHX350.fans.stalledTitle", { fans: fans.stalledLabels.value }) }}</div>
			<div class="banner__body">{{ $t("plugins.CHX350.fans.stalledBody") }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useFans } from "../composables/useFans";

const fans = useFans();
</script>
