<style scoped>
/* As FanStallBanner, inset by the page padding above the page frame */
.banner {
	display: flex;
	align-items: center;
	gap: 14px;
	margin: 16px 22px 0;
	padding: 10px 14px;
	border-radius: var(--mp-radius);
}
.banner--error {
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

<!-- Shown above every page: what the last self-test found. The machine configuration runs the test
	 and start.g refuses the job; the UI only reports it -->
<template>
	<div v-for="banner in banners" :key="banner.key" class="banner" :class="`banner--${banner.kind}`" :role="banner.kind === 'error' ? 'alert' : 'status'">
		<v-icon size="26">{{ banner.icon }}</v-icon>
		<div class="flex-grow-1">
			<div class="banner__title">{{ banner.title }}</div>
			<div class="banner__body">{{ banner.body }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import i18n from "@/i18n";

import { useSelfTest } from "../composables/useSelfTest";

const selfTest = useSelfTest();

const banners = computed(() => {
	const t = i18n.global.t;
	const failedIcon = "mdi-clipboard-alert-outline";
	const list: Array<{ key: string; kind: "error" | "warn"; icon: string; title: string; body: string }> = [];
	if (selfTest.estopDefect.value) {
		list.push({ key: "estop", kind: "error", icon: "mdi-alert-octagon-outline", title: t("plugins.CHX350.selfTest.estopTitle"), body: t("plugins.CHX350.selfTest.estopBody") });
	}
	const findings = selfTest.findings.value;
	if (findings) {
		list.push(selfTest.blocksJobs.value
			? { key: "failed", kind: "error", icon: failedIcon, title: t("plugins.CHX350.selfTest.failedTitle"), body: t("plugins.CHX350.selfTest.failedBody", { findings }) }
			: { key: "failed", kind: "warn", icon: failedIcon, title: t("plugins.CHX350.selfTest.failedTitle"), body: t("plugins.CHX350.selfTest.reportedBody", { findings }) });
	}
	if (selfTest.monthlyFindings.value) {
		list.push({ key: "monthly", kind: "warn", icon: failedIcon, title: t("plugins.CHX350.selfTest.monthlyTitle"), body: t("plugins.CHX350.selfTest.monthlyBody", { findings: selfTest.monthlyFindings.value }) });
	}
	return list;
});
</script>
