<style scoped>
.placeholder {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 12px;
	color: var(--text-muted);
	text-align: center;
}
</style>

<template>
	<div class="chx-page">
		<ChxPageHeader :title="title" :back="back" />
		<div class="placeholder">
			<v-icon size="64">{{ icon ?? "mdi-progress-clock" }}</v-icon>
			<div>{{ text ?? $t("plugins.CHX350.generic.comingSoon") }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import ChxPageHeader from "./ChxPageHeader.vue";

defineProps<{
	title: string;
	back?: string;
	icon?: string;
	text?: string;
}>();
</script>
