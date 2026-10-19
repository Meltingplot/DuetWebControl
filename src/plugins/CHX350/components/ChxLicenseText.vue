<style scoped>
/* The notices are plain text formatted for 80 columns: keep their layout, wrap long lines */
.text {
	margin: 0;
	font: 400 12px/1.45 var(--mp-font-mono, monospace);
	white-space: pre-wrap;
	overflow-wrap: anywhere;
	color: var(--text-body);
}
.state {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 6px 0;
	font: 400 14px/1.4 var(--mp-font-body, sans-serif);
	color: var(--text-muted);
}
</style>

<template>
	<pre v-if="text.status === 'ready'" class="text">{{ text.text }}</pre>
	<div v-else class="state">
		<v-progress-circular v-if="text.status === 'loading'" indeterminate size="20" width="2" color="primary" />
		<span>{{ message }}</span>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import i18n from "@/i18n";

import type { LicenseText } from "../licenses";

const props = defineProps<{ text: LicenseText }>();

const message = computed(() => {
	switch (props.text.status) {
		case "loading":
			return i18n.global.t("plugins.CHX350.licenses.loading");
		case "missing":
			return i18n.global.t("plugins.CHX350.licenses.missing");
		case "failed":
			return i18n.global.t("plugins.CHX350.licenses.failed", { error: props.text.error });
		default:
			return "";
	}
});
</script>
