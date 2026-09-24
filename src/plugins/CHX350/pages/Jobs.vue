<style scoped>
.list {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	gap: 8px;
	overflow: hidden;
}
.row {
	all: unset;
	box-sizing: border-box;
	display: grid;
	grid-template-columns: 56px minmax(0, 1fr) auto;
	align-items: center;
	gap: 16px;
	padding: 8px 16px 8px 10px;
	min-height: 74px;
	border-radius: var(--mp-radius-lg);
	background: var(--surface-card);
	border: 1px solid var(--border-subtle);
	box-shadow: var(--mp-shadow-sm);
	cursor: pointer;
	color: var(--text-strong);
}
.row:active {
	transform: scale(0.995);
}
.row__thumb {
	width: 56px;
	height: 56px;
	border-radius: var(--mp-radius);
	background: var(--surface-sunken);
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}
.row__thumb :deep(img) {
	width: 100%;
	height: 100%;
	object-fit: contain;
}
/* Two lines: slicer names of one part differ only at the end ("…_3h30m" vs "…_5h59m") */
.row__name {
	font: 600 15px/1.25 var(--mp-font-body, sans-serif);
	overflow-wrap: anywhere;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
.row__meta {
	font: 400 12px/1.3 var(--mp-font-mono, monospace);
	color: var(--text-body);
	margin-top: 3px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.row__time {
	font: 700 18px/1.2 var(--mp-font-mono, monospace);
	text-align: right;
}
.row__date {
	font: 400 11px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	text-align: right;
}
.pager {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font: 500 13px/1 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.pager__btn {
	min-width: var(--chx-touch);
	min-height: var(--chx-touch);
}
.empty {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 14px;
	color: var(--text-muted);
}
</style>

<template>
	<div class="chx-page">
		<ChxPageHeader :subtitle="subtitle" :back="ROUTES.start">
			<template #actions>
				<v-btn variant="text" icon="mdi-refresh" :loading="browser.loading.value" :aria-label="$t('plugins.CHX350.jobs.refresh')" @click="reload" />
			</template>
		</ChxPageHeader>

		<div class="list">
			<template v-if="pageItems.length > 0">
				<button v-for="item in pageItems" :key="item.name" type="button" class="row" @click="open(item)">
					<span class="row__thumb">
						<ThumbnailImg v-if="item.thumbnails && item.thumbnails.length > 0" :thumbnail="pickThumbnail(item)" />
						<v-icon v-else size="30" class="chx-icon-muted">mdi-file-document-outline</v-icon>
					</span>
					<span style="min-width: 0">
						<div class="row__name">{{ item.name }}</div>
						<div class="row__meta">{{ metaLine(item) }}</div>
					</span>
					<span>
						<div class="row__time">{{ item.printTime ? displayTime(Number(item.printTime)) : "—" }}</div>
						<div class="row__date">{{ item.lastModified ? formatDate(item.lastModified) : "" }}</div>
					</span>
				</button>
			</template>
			<div v-else-if="browser.loading.value" class="empty">
				<v-progress-circular indeterminate color="primary" />
			</div>
			<div v-else-if="browser.errorReason.value" class="empty">
				<v-icon size="48">{{ browser.errorReason.value === "missing" ? "mdi-folder-alert-outline" : "mdi-alert-circle-outline" }}</v-icon>
				<div>{{ $t(`plugins.CHX350.jobs.${browser.errorReason.value === "missing" ? "missing" : "error"}`) }}</div>
				<v-btn variant="outlined" size="large" class="chx-btn" @click="reload">
					<v-icon start>mdi-refresh</v-icon>
					{{ $t("plugins.CHX350.jobs.refresh") }}
				</v-btn>
			</div>
			<div v-else class="empty">{{ $t("plugins.CHX350.jobs.empty") }}</div>
		</div>

		<div v-if="pages > 1" class="pager">
			<span>{{ $t("plugins.CHX350.jobs.range", { from: page * PAGE_SIZE + 1, to: Math.min(files.length, (page + 1) * PAGE_SIZE), total: files.length }) }}</span>
			<span class="d-flex align-center ga-2">
				<v-btn class="pager__btn" variant="outlined" icon="mdi-chevron-left" :disabled="page === 0" @click="page--" />
				<span>{{ $t("plugins.CHX350.jobs.page", { n: page + 1, total: pages }) }}</span>
				<v-btn class="pager__btn" variant="outlined" icon="mdi-chevron-right" :disabled="page >= pages - 1" @click="page++" />
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { ThumbnailInfo } from "@duet3d/objectmodel";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";

import ThumbnailImg from "@/components/misc/ThumbnailImg.vue";
import { useFileBrowser } from "@/composables/useFileBrowser";
import { useGcodeThumbnails, type GcodeThumbnailItem } from "@/composables/useGcodeThumbnails";
import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { useSettingsStore } from "@/stores/settings";
import { displaySize, displayTime, display } from "@/utils/display";
import Path from "@/utils/path";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import { ROUTES } from "../routes";

const PAGE_SIZE = 7;

const machineStore = useMachineStore();
const settingsStore = useSettingsStore();
const router = useRouter();

const gcodesDir = computed(() => machineStore.model.directories.gCodes || Path.gCodes);
const thumbnails = useGcodeThumbnails();
const browser = useFileBrowser({
	initialDirectory: gcodesDir.value,
	decorate: thumbnails.decorate
});
onBeforeUnmount(() => thumbnails.cancelInFlight());

const files = computed(() => (browser.filelist.value as Array<GcodeThumbnailItem>)
	.filter((item) => !item.isDirectory && Path.isGCodePath(item.name, gcodesDir.value))
	.slice()
	.sort((a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0)));

const page = ref(0);
const pages = computed(() => Math.max(1, Math.ceil(files.value.length / PAGE_SIZE)));
watch(pages, (p) => { if (page.value > p - 1) page.value = Math.max(0, p - 1); });
const pageItems = computed(() => files.value.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE));

const subtitle = computed(() => thumbnails.fileinfoProgress.value >= 0 && thumbnails.fileinfoTotal.value > 0
	? i18n.global.t("plugins.CHX350.jobs.loadingInfo", { done: thumbnails.fileinfoProgress.value, total: thumbnails.fileinfoTotal.value })
	: i18n.global.t("plugins.CHX350.jobs.count", { count: files.value.length }));

function reload() {
	thumbnails.clearCacheForDirectory(browser.directory.value);
	browser.refresh();
}

function pickThumbnail(item: GcodeThumbnailItem): ThumbnailInfo | null {
	const list = item.thumbnails ?? [];
	if (list.length === 0) {
		return null;
	}
	// Smallest thumbnail that is still at least 48 px, else the largest one
	const sorted = list.slice().sort((a, b) => a.width * a.height - b.width * b.height);
	return sorted.find((t) => t.width >= 48) ?? sorted[sorted.length - 1];
}

function metaLine(item: GcodeThumbnailItem): string {
	const parts: Array<string> = [displaySize(Number(item.size))];
	if (item.height) {
		parts.push(display(item.height, 2, "mm"));
	}
	if (item.layerHeight) {
		parts.push(display(item.layerHeight, 2, "mm"));
	}
	if (item.filament && item.filament.length > 0) {
		const total = item.filament.reduce((a, b) => a + b, 0);
		parts.push(i18n.global.t("plugins.CHX350.jobs.filament", { value: display(total / 1000, 1, "m") }));
	}
	return parts.join(" · ");
}

function formatDate(date: Date): string {
	return date.toLocaleString(settingsStore.locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function open(item: GcodeThumbnailItem) {
	const fullPath = Path.combine(browser.directory.value, item.name);
	router.push({ path: ROUTES.check, query: { file: fullPath } });
}
</script>
