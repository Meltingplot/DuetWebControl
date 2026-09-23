<style scoped>
.list {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	gap: 8px;
	overflow: auto;
}
.row {
	display: grid;
	grid-template-columns: 48px minmax(0, 1fr) auto;
	align-items: center;
	gap: 16px;
	padding: 10px 16px;
	min-height: 70px;
	border-radius: var(--mp-radius-lg);
	background: var(--surface-card);
	border: 1px solid var(--border-subtle);
	box-shadow: var(--mp-shadow-sm);
}
.row__icon {
	width: 44px;
	height: 44px;
	border-radius: var(--mp-radius);
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--surface-sunken);
	color: var(--text-brand);
}
.row__icon--warn {
	background: var(--mp-accent);
	color: var(--mp-neutral-900);
}
.row__icon--run {
	background: var(--mp-primary-dark);
	color: #fff;
}
.row__name {
	font: 600 15px/1.25 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.row__meta {
	font: 400 12px/1.3 var(--mp-font-mono, monospace);
	color: var(--text-body);
	margin-top: 3px;
}
.empty {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--text-muted);
	text-align: center;
}
</style>

<template>
	<div class="chx-page">
		<ChxPageHeader :subtitle="history.backendAvailable.value === false ? $t('plugins.CHX350.generic.backendMissing') : ''">
			<template #actions>
				<v-btn variant="text" icon="mdi-refresh" :loading="history.loading.value" :aria-label="$t('plugins.CHX350.history.refresh')" @click="history.load()" />
			</template>
		</ChxPageHeader>

		<div v-if="history.items.value.length > 0" class="list">
			<div v-for="(item, i) in history.items.value" :key="i" class="row">
				<span class="row__icon" :class="{ 'row__icon--warn': item.result === 'cancelled' || item.result === 'aborted', 'row__icon--run': item.result === 'running' }">
					<v-icon size="24">{{ icon(item.result) }}</v-icon>
				</span>
				<span style="min-width: 0">
					<div class="row__name">{{ item.name }}</div>
					<div class="row__meta">
						{{ item.timestamp ? formatDate(item.timestamp) + " · " : "" }}{{ $t(`plugins.CHX350.history.${item.result}`) }}{{ item.printTimeS !== null ? " · " + $t("plugins.CHX350.history.printTime", { time: displayTime(item.printTimeS) }) : "" }}
					</div>
				</span>
				<v-btn :variant="item.analysable ? 'flat' : 'text'" :color="item.analysable ? 'secondary' : undefined" class="chx-btn" :disabled="!item.analysable" @click="router.push(ROUTES.analysis)">
					<v-icon start>mdi-chart-box-outline</v-icon>
					{{ item.analysable ? $t("plugins.CHX350.history.openAnalysis") : $t("plugins.CHX350.history.noAnalysis") }}
				</v-btn>
			</div>
		</div>
		<div v-else-if="history.loading.value" class="empty"><v-progress-circular indeterminate color="primary" /></div>
		<div v-else class="empty">{{ $t("plugins.CHX350.history.empty") }}</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";

import { useSettingsStore } from "@/stores/settings";
import { displayTime } from "@/utils/display";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import { useJobHistory } from "../composables/useJobHistory";
import { ROUTES } from "../routes";

const router = useRouter();
const settingsStore = useSettingsStore();
const history = useJobHistory();

onMounted(() => history.load());

function icon(result: string): string {
	switch (result) {
		case "running": return "mdi-play";
		case "finished": return "mdi-check";
		default: return "mdi-exclamation-thick";
	}
}
function formatDate(date: Date): string {
	return date.toLocaleString(settingsStore.locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
</script>
