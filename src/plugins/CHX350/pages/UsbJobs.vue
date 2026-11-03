<style scoped>
.alert {
	flex: 0 0 auto;
}
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
	color: var(--text-strong);
}
button.row {
	cursor: pointer;
}
button.row:active {
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
}
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
.row__actions {
	display: flex;
	gap: 8px;
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
		<ChxPageHeader :subtitle="subtitle" :back="backTarget" />

		<v-alert v-if="error" class="alert" type="error" variant="tonal" density="compact" closable :text="error" @click:close="error = null" />

		<div class="list">
			<div v-if="gone" class="empty">
				<v-icon size="48">mdi-usb-flash-drive-outline</v-icon>
				<div>{{ $t("plugins.CHX350.usb.gone") }}</div>
				<v-btn variant="outlined" size="large" class="chx-btn" @click="router.push(ROUTES.jobs)">
					<v-icon start>mdi-arrow-left</v-icon>
					{{ $t("plugins.CHX350.usb.toJobs") }}
				</v-btn>
			</div>
			<template v-else-if="pageItems.length > 0">
				<template v-for="item in pageItems" :key="item.type + item.name">
					<button v-if="item.type === 'dir'" type="button" class="row" @click="openFolder(item)">
						<span class="row__thumb">
							<v-icon size="30" class="chx-icon-muted">mdi-folder-outline</v-icon>
						</span>
						<span class="row__name">{{ item.name }}</span>
						<v-icon class="chx-icon-muted">mdi-chevron-right</v-icon>
					</button>
					<div v-else class="row">
						<span class="row__thumb">
							<v-icon size="30" class="chx-icon-muted">mdi-file-document-outline</v-icon>
						</span>
						<span style="min-width: 0">
							<div class="row__name">{{ item.name }}</div>
							<div class="row__meta">{{ metaLine(item) }}</div>
						</span>
						<span class="row__actions">
							<v-btn variant="outlined" size="large" class="chx-btn" :disabled="!canCopy" :loading="busy === item.name && busyAction === 'copy'" @click="copy(item, 'copy')">
								<v-icon start>mdi-content-copy</v-icon>
								{{ $t("plugins.CHX350.usb.copy") }}
							</v-btn>
							<v-btn color="secondary" size="large" class="chx-btn" :disabled="!canCopy" :loading="busy === item.name && busyAction === 'start'" @click="copy(item, 'start')">
								<v-icon start>mdi-play</v-icon>
								{{ $t("plugins.CHX350.usb.start") }}
							</v-btn>
						</span>
					</div>
				</template>
			</template>
			<div v-else-if="loading" class="empty">
				<v-progress-circular indeterminate color="primary" />
			</div>
			<div v-else class="empty">{{ $t("plugins.CHX350.usb.empty") }}</div>
		</div>

		<div v-if="pages > 1" class="pager">
			<span>{{ $t("plugins.CHX350.jobs.range", { from: page * PAGE_SIZE + 1, to: Math.min(items.length, (page + 1) * PAGE_SIZE), total: items.length }) }}</span>
			<span class="d-flex align-center ga-2">
				<v-btn class="pager__btn" variant="outlined" icon="mdi-chevron-left" :disabled="page === 0" @click="page--" />
				<span>{{ $t("plugins.CHX350.jobs.page", { n: page + 1, total: pages }) }}</span>
				<v-btn class="pager__btn" variant="outlined" icon="mdi-chevron-right" :disabled="page >= pages - 1" @click="page++" />
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useMachineStore } from "@/stores/machine";
import { useSettingsStore } from "@/stores/settings";
import { displaySize } from "@/utils/display";
import { getErrorMessage } from "@/utils/errors";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import { copyUsbJob, listUsbFolder, stickCaption, useUsbSticks, type UsbEntry } from "../composables/useUsbStick";
import { ROUTES } from "../routes";

const PAGE_SIZE = 7;

const route = useRoute();
const router = useRouter();
const machineStore = useMachineStore();
const settingsStore = useSettingsStore();

/** <stick>[/<folder>...] */
const path = computed(() => typeof route.query.path === "string" ? route.query.path : "");
const segments = computed(() => path.value.split("/"));

const { sticks } = useUsbSticks();
const stick = computed(() => sticks.value.find((s) => s.name === segments.value[0]) ?? null);

const subtitle = computed(() => [stick.value ? stickCaption(stick.value) : "", ...segments.value.slice(1)].filter((s) => s).join(" / "));
const backTarget = computed(() => segments.value.length > 1
	? `${ROUTES.usb}?path=${encodeURIComponent(segments.value.slice(0, -1).join("/"))}`
	: ROUTES.jobs);

const entries = ref<Array<UsbEntry>>([]);
const loading = ref(false);
/** The folder or the whole stick is not there (any more) */
const gone = ref(false);
const error = ref<string | null>(null);

async function load() {
	loading.value = true;
	try {
		const list = path.value ? await listUsbFolder(path.value) : null;
		gone.value = list === null;
		entries.value = list ?? [];
	} catch (e) {
		error.value = getErrorMessage(e);
		entries.value = [];
	} finally {
		loading.value = false;
	}
}

const page = ref(0);
watch(path, () => {
	page.value = 0;
	error.value = null;
	load();
}, { immediate: true });

// Pulled: say so instead of offering files that cannot be read. Put back in: list it again
watch(stick, (now, before) => {
	if (before && !now) {
		gone.value = true;
		entries.value = [];
	} else if (now && !before && gone.value) {
		load();
	}
});

/** Folders by name, then the jobs, newest first as in the job list */
const items = computed(() => [
	...entries.value.filter((e) => e.type === "dir"),
	...entries.value.filter((e) => e.type === "file").sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0))
]);
const pages = computed(() => Math.max(1, Math.ceil(items.value.length / PAGE_SIZE)));
watch(pages, (p) => { if (page.value > p - 1) page.value = Math.max(0, p - 1); });
const pageItems = computed(() => items.value.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE));

function metaLine(item: UsbEntry): string {
	const parts: Array<string> = [displaySize(item.size ?? 0)];
	if (item.mtime) {
		parts.push(new Date(item.mtime * 1000).toLocaleString(settingsStore.locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }));
	}
	return parts.join(" · ");
}

function openFolder(item: UsbEntry) {
	router.push({ path: ROUTES.usb, query: { path: `${path.value}/${item.name}` } });
}

const busy = ref<string | null>(null);
const busyAction = ref<"copy" | "start">("copy");
const canCopy = computed(() => machineStore.isConnected && busy.value === null);

/** Copy a job to the machine; "start" then opens the job check, where the print is started */
async function copy(item: UsbEntry, action: "copy" | "start") {
	busy.value = item.name;
	busyAction.value = action;
	error.value = null;
	try {
		const target = await copyUsbJob(`${path.value}/${item.name}`, action === "copy");
		if (target !== null && action === "start") {
			router.push({ path: ROUTES.check, query: { file: target } });
		}
	} catch (e) {
		error.value = getErrorMessage(e);
	} finally {
		busy.value = null;
	}
}
</script>
