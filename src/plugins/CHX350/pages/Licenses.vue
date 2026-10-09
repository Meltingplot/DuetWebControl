<style scoped>
.grid {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	gap: 14px;
}
.grid--single {
	grid-template-columns: minmax(0, 1fr);
}
@media (max-width: 900px) {
	.grid {
		grid-template-columns: minmax(0, 1fr);
	}
}
.card {
	padding: 16px 18px;
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-height: 0;
}
.scroll {
	flex: 1;
	min-height: 0;
	overflow: auto;
}
.hint {
	font: 400 13px/1.45 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	margin: 0;
}
/* v-alert grows in a flex column (flex: 1 1) */
.missing {
	flex: none;
}
.pkg {
	border-bottom: 1px solid var(--border-subtle);
}
.pkg:last-child {
	border-bottom: 0;
}
.pkg__head {
	all: unset;
	box-sizing: border-box;
	width: 100%;
	min-height: 48px;
	padding: 6px 4px;
	display: flex;
	align-items: center;
	gap: 12px;
	cursor: pointer;
	background: var(--surface-card);
}
.pkg__head:disabled {
	cursor: default;
}
/* The open package's head stays on top while its text scrolls by, to close it again */
.pkg--open .pkg__head {
	position: sticky;
	top: 0;
	z-index: 1;
	border-bottom: 1px solid var(--border-subtle);
}
.pkg__name {
	flex: 1;
	min-width: 0;
	font: 600 14px/1.25 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
	overflow-wrap: anywhere;
}
.pkg__head:disabled .pkg__name {
	font-weight: 400;
	color: var(--text-body);
}
.pkg__ver {
	max-width: 45%;
	font: 400 12px/1.25 var(--mp-font-mono, monospace);
	color: var(--text-body);
	text-align: right;
	overflow-wrap: anywhere;
}
.pkg__icon {
	flex: none;
	width: 24px;
	color: var(--text-muted);
}
.pkg__body {
	padding: 8px 4px 16px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.pkg__source {
	font: 400 12px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-muted);
}
</style>

<template>
	<div class="chx-page">
		<ChxPageHeader :subtitle="subtitle" :back="ROUTES.about">
			<template #actions>
				<v-btn-toggle v-model="view" mandatory divided variant="outlined" color="secondary">
					<v-btn v-for="v in views" :key="v.value" :value="v.value" class="chx-btn">
						<v-icon start>{{ v.icon }}</v-icon>
						{{ $t(v.label) }}
					</v-btn>
				</v-btn-toggle>
			</template>
		</ChxPageHeader>

		<v-alert v-if="panel === null" class="missing" type="info" variant="tonal" density="compact" :text="$t('plugins.CHX350.licenses.panelMissing')" />

		<!-- Operator panel (HMI): the image's notice and its Debian packages -->
		<div v-if="view === 'panel'" class="grid">
			<section class="chx-card card">
				<div class="chx-label">{{ $t("plugins.CHX350.licenses.notice") }}</div>
				<div class="scroll">
					<ChxLicenseText :text="panelNotice" />
				</div>
			</section>
			<section class="chx-card card">
				<div class="chx-label">{{ $t("plugins.CHX350.licenses.packages", { count: panel?.packages.length ?? 0 }) }}</div>
				<p class="hint">{{ $t("plugins.CHX350.licenses.packagesHint") }}</p>
				<div class="scroll">
					<ChxLicenseText v-if="panel === undefined" :text="{ status: 'loading' }" />
					<div v-for="pkg in panel?.packages ?? []" :key="pkg.name" class="pkg" :class="{ 'pkg--open': openPackage === pkg.name }">
						<button type="button" class="pkg__head" :disabled="!pkg.copyright" @click="togglePackage(pkg, $event)">
							<span class="pkg__name">{{ pkg.name }}</span>
							<span class="pkg__ver">{{ pkg.version }}</span>
							<v-icon class="pkg__icon" size="22">{{ !pkg.copyright ? "" : (openPackage === pkg.name ? "mdi-chevron-up" : "mdi-chevron-down") }}</v-icon>
						</button>
						<div v-if="openPackage === pkg.name" class="pkg__body">
							<div v-if="pkg.source && pkg.source !== pkg.name" class="pkg__source">{{ $t("plugins.CHX350.licenses.source", { source: pkg.source }) }}</div>
							<ChxLicenseText :text="packageText" />
						</div>
					</div>
				</div>
			</section>
		</div>

		<!-- Printer computer (Duet Pi): its notice in the virtual SD card -->
		<div v-else-if="view === 'printer'" class="grid grid--single">
			<section class="chx-card card">
				<div class="chx-label">{{ $t("plugins.CHX350.licenses.notice") }}</div>
				<div class="scroll">
					<ChxLicenseText :text="printerNotice" />
				</div>
			</section>
		</div>

		<!-- User interface: texts bundled with DWC -->
		<div v-else class="grid">
			<section class="chx-card card">
				<div class="chx-label">{{ $t("plugins.CHX350.licenses.dwc") }}</div>
				<div class="scroll">
					<ChxLicenseText :text="{ status: 'ready', text: dwcLicense }" />
				</div>
			</section>
			<section class="chx-card card">
				<div class="chx-label">{{ $t("plugins.CHX350.licenses.fonts") }}</div>
				<div class="scroll">
					<ChxLicenseText :text="{ status: 'ready', text: fontLicense }" />
				</div>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
import { FileNotFoundError } from "@duet3d/connectors";
import { computed, nextTick, onMounted, ref, watch } from "vue";

import { useMachineStore } from "@/stores/machine";

import dwcLicense from "../../../../LICENSE?raw";
import fontLicense from "../assets/fonts/OFL.txt?raw";
import ChxLicenseText from "../components/ChxLicenseText.vue";
import ChxPageHeader from "../components/ChxPageHeader.vue";
import { loadPanelLicenses, loadPanelText, type LicenseText, type PanelLicenses, type PanelPackage } from "../licenses";
import { ROUTES } from "../routes";

const machineStore = useMachineStore();

const errorText = (e: unknown) => (e instanceof Error) ? e.message : String(e);

type View = "panel" | "printer" | "ui";

/** The panel's license index: undefined while loading, null when this connection has none */
const panel = ref<PanelLicenses | null | undefined>(undefined);
const panelNotice = ref<LicenseText>({ status: "loading" });
const printerNotice = ref<LicenseText>({ status: "loading" });

const view = ref<View>("panel");
const views = computed(() => [
	...(panel.value !== null ? [{ value: "panel", icon: "mdi-tablet-dashboard", label: "plugins.CHX350.licenses.panel" }] : []),
	{ value: "printer", icon: "mdi-printer-3d", label: "plugins.CHX350.licenses.printer" },
	{ value: "ui", icon: "mdi-web", label: "plugins.CHX350.licenses.ui" }
]);
const subtitle = computed(() => (view.value === "panel") ? panel.value?.image : undefined);

onMounted(async () => {
	const index = await loadPanelLicenses();
	panel.value = index;
	if (index === null) {
		// Without the panel's notices the printer computer's come first, with a hint
		if (view.value === "panel") {
			view.value = "printer";
		}
		return;
	}
	try {
		panelNotice.value = { status: "ready", text: await loadPanelText(index.notice) };
	} catch (e) {
		panelNotice.value = { status: "failed", error: errorText(e) };
	}
});

// The printer computer's notice comes through DSF, read when its view opens first
let printerRequested = false;
watch(view, async (to) => {
	if (to !== "printer" || printerRequested) {
		return;
	}
	printerRequested = true;
	try {
		const text = await machineStore.download({ filename: "0:/sys/LICENSES.txt", type: "text" }, false, false, false);
		printerNotice.value = { status: "ready", text: String(text) };
	} catch (e) {
		printerNotice.value = (e instanceof FileNotFoundError) ? { status: "missing" } : { status: "failed", error: errorText(e) };
		printerRequested = false;
	}
}, { immediate: true });

// #region Packages: one open at a time, its copyright file read when it opens (some have thousands of lines)

const openPackage = ref<string | null>(null);
const packageText = ref<LicenseText>({ status: "loading" });

async function togglePackage(pkg: PanelPackage, event: MouseEvent) {
	if (pkg.copyright === null) {
		return;
	}
	if (openPackage.value === pkg.name) {
		openPackage.value = null;
		return;
	}

	openPackage.value = pkg.name;
	packageText.value = { status: "loading" };
	// Closing a long text above moves the tapped package: bring it back into view
	const head = event.currentTarget as HTMLElement;
	await nextTick();
	head.scrollIntoView({ block: "nearest" });

	let text: LicenseText;
	try {
		text = { status: "ready", text: await loadPanelText(pkg.copyright) };
	} catch (e) {
		text = { status: "failed", error: errorText(e) };
	}
	if (openPackage.value === pkg.name) {
		packageText.value = text;
	}
}

// #endregion
</script>
