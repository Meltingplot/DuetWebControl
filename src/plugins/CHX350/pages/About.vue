<style scoped>
.grid {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
	gap: 14px;
}
.card {
	padding: 16px 18px;
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-height: 0;
	overflow: auto;
}
.hint {
	font: 400 13px/1.45 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	margin: 0;
}
.comp {
	display: flex;
	justify-content: space-between;
	gap: 12px;
	padding: 8px 0;
	border-bottom: 1px solid var(--border-subtle);
}
.comp:last-child {
	border-bottom: 0;
}
.comp__name {
	font: 600 14px/1.25 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
.comp__note {
	font: 400 12px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.comp__ver {
	font: 600 13px/1.25 var(--mp-font-mono, monospace);
	color: var(--text-strong);
	text-align: right;
	white-space: nowrap;
}
.comp__lic {
	font: 400 11px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-muted);
	text-align: right;
}
/* Inline so the ink follows the theme (the dark theme shows the white negative logo) */
.wordmark {
	width: 200px;
	color: var(--mp-logo-ink);
}
.wordmark :deep(svg) {
	display: block;
	width: 100%;
	height: auto;
}
</style>

<template>
	<div class="chx-page">
		<div class="grid">
			<div class="chx-card card">
				<div class="chx-label">{{ $t("plugins.CHX350.about.components") }}</div>
				<p class="hint">{{ $t("plugins.CHX350.about.componentsHint") }}</p>
				<div>
					<div v-for="c in components" :key="c.name" class="comp">
						<div style="min-width: 0">
							<div class="comp__name">{{ c.name }}</div>
							<div class="comp__note">{{ c.note }}</div>
						</div>
						<div>
							<div class="comp__ver">{{ c.version }}</div>
							<div class="comp__lic">{{ c.license }}</div>
						</div>
					</div>
				</div>
			</div>
			<div class="chx-card card">
				<div class="wordmark" role="img" aria-label="Meltingplot" v-html="wordmarkSvg" />
				<p class="hint">{{ support.company }}</p>
				<p class="hint">{{ $t("plugins.CHX350.about.licenseText") }}</p>
				<v-btn variant="outlined" class="chx-btn" :to="ROUTES.licenses">
					<v-icon start>mdi-license</v-icon>
					{{ $t("plugins.CHX350.about.showLicenses") }}
				</v-btn>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import i18n from "@/i18n";
import { getBuiltInPlugins } from "@/plugins";
import { useMachineStore } from "@/stores/machine";

import packageInfo from "../../../../package.json";
import wordmarkSvg from "../assets/meltingplot-wordmark.svg?raw";
import { ROUTES } from "../routes";
import { PLUGIN_ID, useChxSettings } from "../settings";

const machineStore = useMachineStore();
const { support: supportRef } = useChxSettings();
const support = computed(() => supportRef.value);

const model = computed(() => machineStore.model);
const deps = packageInfo.dependencies as Record<string, string>;

const note = (key: string) => i18n.global.t(`plugins.CHX350.about.note.${key}`);
const components = computed(() => [
	{ name: "Duet Web Control", version: packageInfo.version, license: "GPL-3.0", note: note("dwc") },
	{ name: "CHX 350 UI", version: getBuiltInPlugins().find((p) => p.id === PLUGIN_ID)?.version ?? packageInfo.version, license: "GPL-3.0", note: note("plugin") },
	{ name: "RepRapFirmware", version: model.value.boards[0]?.firmwareVersion ?? "—", license: "GPL-3.0", note: model.value.boards[0]?.name ?? "" },
	{ name: "Duet Software Framework", version: model.value.sbc?.dsf.version ?? "—", license: "GPL-3.0", note: note("dsf") },
	{ name: "@duet3d/objectmodel", version: deps["@duet3d/objectmodel"], license: "GPL-3.0", note: note("objectModel") },
	{ name: "Vue", version: deps["vue"], license: "MIT", note: note("framework") },
	{ name: "Vuetify", version: deps["vuetify"], license: "MIT", note: note("components") },
	{ name: "@duet3d/gcodeviewer", version: deps["@duet3d/gcodeviewer"], license: "GPL-3.0", note: note("gcodeViewer") },
	{ name: "Chart.js", version: deps["chart.js"], license: "MIT", note: note("charts") },
	{ name: "Jost · JetBrains Mono", version: "Google Fonts", license: "SIL OFL 1.1", note: note("fonts") }
]);
</script>
