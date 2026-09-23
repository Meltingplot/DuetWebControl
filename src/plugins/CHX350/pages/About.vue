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
.license {
	font: 400 11px/1.4 var(--mp-font-mono, monospace);
	white-space: pre-wrap;
	max-height: 260px;
	overflow: auto;
	padding: 10px;
	border-radius: var(--mp-radius);
	background: var(--surface-page);
	color: var(--text-body);
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
				<v-btn variant="outlined" class="chx-btn" @click="toggleLicenses">
					<v-icon start>mdi-license</v-icon>
					{{ showLicenses ? $t("plugins.CHX350.about.hideLicenses") : $t("plugins.CHX350.about.showLicenses") }}
				</v-btn>
				<template v-if="showLicenses">
					<div class="chx-label">{{ $t("plugins.CHX350.about.dwcLicense") }}</div>
					<div class="license">{{ dwcLicense }}</div>
					<div class="chx-label">{{ $t("plugins.CHX350.about.machineLicenses") }}</div>
					<div class="license">{{ machineLicenses ?? "…" }}</div>
				</template>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { getBuiltInPlugins } from "@/plugins";
import { useMachineStore } from "@/stores/machine";

import dwcLicense from "../../../../LICENSE?raw";
import packageInfo from "../../../../package.json";
import wordmarkSvg from "../assets/meltingplot-wordmark.svg?raw";
import { PLUGIN_ID, useChxSettings } from "../settings";

const machineStore = useMachineStore();
const { support: supportRef } = useChxSettings();
const support = computed(() => supportRef.value);

const model = computed(() => machineStore.model);
const deps = packageInfo.dependencies as Record<string, string>;

const components = computed(() => [
	{ name: "Duet Web Control", version: packageInfo.version, license: "GPL-3.0", note: "Bedienoberfläche · Meltingplot-Fork" },
	{ name: "CHX 350 UI", version: getBuiltInPlugins().find((p) => p.id === PLUGIN_ID)?.version ?? packageInfo.version, license: "GPL-3.0", note: "Plugin CHX350" },
	{ name: "RepRapFirmware", version: model.value.boards[0]?.firmwareVersion ?? "—", license: "GPL-3.0", note: model.value.boards[0]?.name ?? "" },
	{ name: "Duet Software Framework", version: model.value.sbc?.dsf.version ?? "—", license: "GPL-3.0", note: "SBC-Dienst" },
	{ name: "@duet3d/objectmodel", version: deps["@duet3d/objectmodel"], license: "GPL-3.0", note: "Objektmodell" },
	{ name: "Vue", version: deps["vue"], license: "MIT", note: "Framework" },
	{ name: "Vuetify", version: deps["vuetify"], license: "MIT", note: "Komponenten" },
	{ name: "@duet3d/gcodeviewer", version: deps["@duet3d/gcodeviewer"], license: "GPL-3.0", note: "G-Code-Betrachter" },
	{ name: "Chart.js", version: deps["chart.js"], license: "MIT", note: "Diagramme" },
	{ name: "Jost · JetBrains Mono", version: "Google Fonts", license: "SIL OFL 1.1", note: "Schriften" }
]);

const showLicenses = ref(false);
const machineLicenses = ref<string | null>(null);
async function toggleLicenses() {
	showLicenses.value = !showLicenses.value;
	if (showLicenses.value && machineLicenses.value === null) {
		try {
			machineLicenses.value = String(await machineStore.download({ filename: "0:/sys/LICENSES.txt", type: "text" }, false, false, false));
		} catch {
			machineLicenses.value = "—";
		}
	}
}
</script>
