<style scoped>
.check {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr) 380px;
	gap: 16px;
}
.file {
	padding: 18px 20px;
	display: flex;
	flex-direction: column;
	gap: 14px;
	overflow: auto;
}
.file__head {
	display: flex;
	gap: 16px;
	align-items: flex-start;
}
.file__thumb {
	width: 120px;
	height: 120px;
	flex: none;
	border-radius: var(--mp-radius);
	background: var(--surface-sunken);
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}
.file__thumb :deep(img) {
	width: 100%;
	height: 100%;
	object-fit: contain;
}
.file__name {
	font: 700 18px/1.25 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
	word-break: break-word;
}
.meta {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 10px 16px;
}
.meta__val {
	font: 700 18px/1.2 var(--mp-font-mono, monospace);
	color: var(--text-strong);
	margin-top: 4px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.checks {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.chk {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px 12px;
	border-radius: var(--mp-radius);
	background: var(--surface-page);
	border-left: 4px solid var(--border-subtle);
}
.chk--mismatch {
	border-left-color: var(--mp-accent);
	background: rgba(232, 155, 38, 0.10);
}
.chk--unknown {
	border-left-color: var(--border-default);
}
.chk--info {
	border-left-color: var(--mp-primary);
}
/* Vuetify's primary (#009AD7) misses 3:1 on the light page surface; the brand ink tone does not */
.chk--info .v-icon {
	color: var(--text-brand);
}
.chk__title {
	font: 600 14px/1.25 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
.chk__detail {
	font: 400 12px/1.3 var(--mp-font-mono, monospace);
	color: var(--text-body);
}
.side {
	display: flex;
	flex-direction: column;
	gap: 12px;
	min-height: 0;
}
.pre {
	padding: 16px 18px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.pre__row {
	display: flex;
	align-items: center;
	gap: 10px;
	font: 500 14px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
	min-height: 40px;
}
.cta {
	margin-top: auto;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.cta__hint {
	font: 400 12px/1.35 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
</style>

<template>
	<div class="chx-page">
		<ChxPageHeader :back="ROUTES.jobs" />

		<div class="check">
			<div class="chx-card file">
				<div class="file__head">
					<div class="file__thumb">
						<ThumbnailImg v-if="job.thumbnail.value" :thumbnail="job.thumbnail.value" />
						<v-icon v-else size="48" class="chx-icon-muted">mdi-file-document-outline</v-icon>
					</div>
					<div style="min-width: 0">
						<div class="file__name">{{ job.fileName.value }}</div>
						<div class="text-body-2 text-medium-emphasis mt-1">{{ job.info.value?.generatedBy ?? "" }}</div>
						<div v-if="job.loading.value" class="mt-2"><v-progress-linear indeterminate color="primary" /></div>
						<v-alert v-else-if="job.infoError.value" class="mt-2" type="error" variant="tonal" density="compact" :text="$t('plugins.CHX350.check.fileError', { error: job.infoError.value })" />
					</div>
				</div>

				<div class="meta">
					<div>
						<div class="chx-label">{{ $t("plugins.CHX350.check.printTime") }}</div>
						<div class="meta__val">{{ job.info.value?.printTime ? displayTime(Number(job.info.value.printTime)) : "—" }}</div>
					</div>
					<div>
						<div class="chx-label">{{ $t("plugins.CHX350.check.printMode") }}</div>
						<div class="meta__val">{{ job.meta.value.printMode ?? "—" }}</div>
					</div>
					<div>
						<div class="chx-label">{{ $t("plugins.CHX350.check.height") }}</div>
						<div class="meta__val">{{ job.info.value?.height ? display(job.info.value.height, 2, "mm") : "—" }}</div>
					</div>
					<div>
						<div class="chx-label">{{ $t("plugins.CHX350.check.layerHeight") }}</div>
						<div class="meta__val">{{ job.meta.value.layerHeight ? display(job.meta.value.layerHeight, 2, "mm") : "—" }}</div>
					</div>
					<div>
						<div class="chx-label">{{ $t("plugins.CHX350.check.filament") }}</div>
						<div class="meta__val">{{ job.totalFilament.value > 0 ? display(job.totalFilament.value / 1000, 1, "m") : "—" }}</div>
					</div>
					<div>
						<div class="chx-label">{{ $t("plugins.CHX350.check.layers") }}</div>
						<div class="meta__val">{{ job.info.value?.numLayers || "—" }}</div>
					</div>
					<div>
						<div class="chx-label">{{ $t("plugins.CHX350.check.size") }}</div>
						<div class="meta__val">{{ job.info.value ? displaySize(Number(job.info.value.size)) : "—" }}</div>
					</div>
					<div>
						<div class="chx-label">{{ $t("plugins.CHX350.check.source") }}</div>
						<div class="meta__val">{{ $t(`plugins.CHX350.check.source_${job.meta.value.source}`) }}</div>
					</div>
				</div>

				<div class="checks">
					<div v-for="(chk, i) in job.checks.value" :key="i" class="chk" :class="`chk--${chk.state}`">
						<v-icon size="24" :color="CHECK_ICONS[chk.state].color">{{ CHECK_ICONS[chk.state].icon }}</v-icon>
						<div style="min-width: 0">
							<div class="chk__title">{{ $t(chk.title, chk.titleParams ?? {}) }}</div>
							<div class="chk__detail">{{ chk.detail }}</div>
						</div>
					</div>
					<div v-if="job.backendError.value && job.meta.value.source !== 'backend'" class="text-caption text-medium-emphasis px-3">
						{{ $t("plugins.CHX350.check.noBackend") }}
					</div>
				</div>
			</div>

			<div class="side">
				<div class="chx-card pre">
					<div class="chx-label">{{ $t("plugins.CHX350.check.beforeStart") }}</div>
					<label class="pre__row">
						<v-checkbox-btn v-model="bedClear" color="primary" />
						{{ $t("plugins.CHX350.check.bedClear") }}
					</label>
					<!-- The machine's print start (print/prepare.g) homes unhomed axes itself -->
					<div class="pre__row">
						<v-icon v-if="allHomed" color="success">mdi-check-circle</v-icon>
						<v-icon v-else class="chx-icon-muted">mdi-information-outline</v-icon>
						{{ allHomed ? $t("plugins.CHX350.check.homed") : $t("plugins.CHX350.check.homedAtStart") }}
					</div>
					<!-- Door and mode are not listed: the header plate shows AUTOMATIK, or LEERLAUF with the reason -->
					<div class="pre__row">
						<v-progress-circular v-if="job.loading.value" indeterminate size="22" width="3" color="primary" />
						<v-icon v-else-if="job.verdict.value === 'blocked'" color="warning">mdi-alert</v-icon>
						<v-icon v-else-if="job.verdict.value === 'ok'" color="success">mdi-check-circle</v-icon>
						<v-icon v-else class="chx-icon-muted">mdi-help-circle-outline</v-icon>
						{{ job.loading.value ? $t("plugins.CHX350.check.checking") : $t(`plugins.CHX350.check.verdict.${job.verdict.value}`) }}
					</div>
				</div>

				<div class="cta">
					<v-alert v-if="startError" type="error" variant="tonal" density="compact" :text="startError" />
					<div v-if="startHint" class="cta__hint">{{ startHint }}</div>
					<v-btn color="secondary" size="x-large" class="chx-btn" block :disabled="!canStart" :loading="starting" @click="start">
						<v-icon start>mdi-play</v-icon>
						{{ job.blocked.value ? $t("plugins.CHX350.check.startBlocked") : $t("plugins.CHX350.check.start") }}
					</v-btn>
					<v-btn variant="outlined" size="large" class="chx-btn" block @click="router.push(ROUTES.jobs)">
						{{ $t("plugins.CHX350.generic.cancel") }}
					</v-btn>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import ThumbnailImg from "@/components/misc/ThumbnailImg.vue";
import { showConfirmDialog } from "@/composables/useConfirmDialog";
import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { display, displaySize, displayTime } from "@/utils/display";
import { getErrorMessage } from "@/utils/errors";
import { escapeFilename } from "@/utils/path";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import { useJobMeta, type CheckState } from "../composables/useJobMeta";
import { sendChecked } from "../composables/useMacroRunner";
import { ROUTES } from "../routes";

const CHECK_ICONS: Record<CheckState, { icon: string; color?: string }> = {
	ok: { icon: "mdi-check-circle", color: "success" },
	mismatch: { icon: "mdi-alert", color: "warning" },
	info: { icon: "mdi-information-outline" },
	unknown: { icon: "mdi-help-circle-outline" }
};

const route = useRoute();
const router = useRouter();
const machineStore = useMachineStore();

const filePath = computed(() => {
	const q = route.query.file;
	return typeof q === "string" ? q : "";
});
const job = useJobMeta(filePath);

const bedClear = ref(false);
const allHomed = computed(() => {
	const axes = machineStore.model.move.axes.filter((a) => a.visible);
	return axes.length > 0 && axes.every((a) => a.homed);
});

const canStart = computed(() => !!filePath.value && machineStore.isConnected && !job.state.printing.value
	&& !job.loading.value && job.infoError.value === null
	&& !job.blocked.value && bedClear.value && job.state.isAutomatic.value && !job.state.doorOpen.value);

const startHint = computed(() => {
	// A running job is on the header plate (DRUCKT/PAUSIERT)
	if (job.state.printing.value) {
		return "";
	}
	if (job.infoError.value !== null) {
		return i18n.global.t("plugins.CHX350.check.hintFile");
	}
	if (!job.state.isAutomatic.value || job.state.doorOpen.value) {
		return i18n.global.t("plugins.CHX350.check.hintMode");
	}
	if (job.blocked.value) {
		return i18n.global.t("plugins.CHX350.check.hintBlocked");
	}
	if (!bedClear.value) {
		return i18n.global.t("plugins.CHX350.check.hintBed");
	}
	return "";
});

const starting = ref(false);
const startError = ref<string | null>(null);
watch(filePath, () => { startError.value = null; });
async function start() {
	if (!canStart.value) {
		return;
	}
	const name = job.fileName.value;
	if (!(await showConfirmDialog(i18n.global.t("dialog.startJob.title", [name]), i18n.global.t("dialog.startJob.prompt", [name]), "mdi-play"))) {
		return;
	}
	starting.value = true;
	startError.value = null;
	try {
		// start.g refuses with an error reply (doors, mode); stay on the page and show why
		await sendChecked(`M32 "${escapeFilename(filePath.value)}"`);
		router.push(ROUTES.job);
	} catch (e) {
		startError.value = getErrorMessage(e);
	} finally {
		starting.value = false;
	}
}
</script>
