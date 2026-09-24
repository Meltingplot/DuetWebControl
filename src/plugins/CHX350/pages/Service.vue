<style scoped>
.service {
	align-items: center;
}
.service__box {
	min-height: 0;
	width: min(980px, 100%);
	display: flex;
	flex-direction: column;
	gap: 16px;
}
.service__intro {
	font: 400 15px/1.5 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	margin: 0;
}
.tools {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 12px;
}
.service__scroll {
	min-height: 0;
	overflow: auto;
	display: flex;
	flex-direction: column;
	gap: 16px;
}
/* The scroll area scrolls; its children keep their height */
.service__scroll > * {
	flex: none;
}
.flows {
	padding: 16px 18px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.flows__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}
.flows__summary {
	font: 400 14px/1.4 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.flows__issues {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.flows__issues li {
	display: flex;
	gap: 10px;
	align-items: flex-start;
	font: 400 14px/1.4 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
.flows__where {
	font-family: var(--mp-font-mono, monospace);
	font-size: 12px;
	color: var(--text-body);
}
</style>

<template>
	<div class="chx-page service">
		<div class="service__box">
			<ChxPageHeader>
				<template #actions>
					<v-btn v-if="serviceStore.lockAvailable && serviceStore.unlocked" variant="outlined" class="chx-btn" @click="serviceStore.lock()">
						{{ $t("plugins.CHX350.service.lock") }}
					</v-btn>
				</template>
			</ChxPageHeader>

			<div v-if="serviceStore.unlocked" class="service__scroll">
				<p class="service__intro">{{ $t("plugins.CHX350.service.intro") }}</p>
				<div class="tools">
					<ChxTile v-for="tool in tools" :key="tool.path" :icon="tool.icon" :title="$t(tool.title)" :subtitle="$t(tool.desc)"
							 :disabled="tool.disabled" :to="tool.path" />
					<ChxTile icon="mdi-monitor-dashboard" :title="$t('plugins.CHX350.service.classicDwc')"
							 :subtitle="$t('plugins.CHX350.service.classicDwcDesc')" @click="openClassicDwc" />
					<!-- Service flows of the machine configuration (`page: service`) -->
					<ChxTile v-for="tile in flowTiles" :key="tile.path" :icon="tile.icon" :title="tile.title" :subtitle="tile.subtitle"
							 :disabled="tile.disabled" @click="tile.run()">
						<template v-if="tile.warn" #trail><v-icon color="warning">mdi-alert-outline</v-icon></template>
					</ChxTile>
				</div>

				<!-- What the flow index found: for whoever writes or edits flow macros -->
				<div class="chx-card flows">
					<div class="flows__head">
						<span class="chx-label">{{ $t("plugins.CHX350.flows.indexTitle") }}</span>
						<v-btn variant="outlined" class="chx-btn" :loading="flowStore.scanning" @click="flowStore.scan(true)">
							<v-icon start>mdi-refresh</v-icon>
							{{ $t("plugins.CHX350.flows.rescan") }}
						</v-btn>
					</div>
					<div class="flows__summary">
						{{ $t("plugins.CHX350.flows.indexSummary", { flows: flowStore.flows.length, issues: flowStore.issues.length }) }}
					</div>
					<v-alert v-if="flowStore.scanError" type="error" variant="tonal" density="compact" :text="flowStore.scanError" />
					<ul v-if="flowStore.issues.length > 0" class="flows__issues">
						<li v-for="(issue, index) in flowStore.issues" :key="index">
							<v-icon size="20" color="warning">mdi-alert-outline</v-icon>
							<div>
								<div>{{ $t(`plugins.CHX350.flows.issue.${issue.key}`, issue.params ?? {}) }}</div>
								<div class="flows__where">{{ issue.path }}:{{ issue.line }}</div>
							</div>
						</li>
					</ul>
				</div>
			</div>
			<template v-else>
				<p class="service__intro">{{ $t("plugins.CHX350.service.lockedIntro") }}</p>
				<v-btn color="secondary" class="chx-btn align-self-start" size="large" @click="serviceStore.unlock()">
					<v-icon start>mdi-lock-open-variant-outline</v-icon>
					{{ $t("plugins.CHX350.service.unlock") }}
				</v-btn>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import { showConfirmDialog } from "@/composables/useConfirmDialog";
import i18n from "@/i18n";
import { useMenuStore } from "@/stores/menu";
import { useSettingsStore } from "@/stores/settings";

import ChxPageHeader from "../components/ChxPageHeader.vue";
import ChxTile from "../components/ChxTile.vue";
import { useFlowStore } from "../flows/store";
import { useFlowTiles } from "../flows/useFlowTiles";
import { useServiceStore } from "../stores/service";

const menuStore = useMenuStore();
const router = useRouter();
const serviceStore = useServiceStore();
const settingsStore = useSettingsStore();
const flowStore = useFlowStore();
const flowTiles = useFlowTiles("service");

// External plugins (Vigil) register their route at runtime; look it up in the menu store so the
// tile only shows when the plugin is actually loaded
const vigilPath = computed(() => menuStore.allItems.find((item) => /vigil/i.test(item.path))?.path ?? null);
const hasRoute = (path: string) => router.getRoutes().some((r) => r.path === path);

const tools = computed(() => [
	{ path: "/Console", icon: "mdi-console", title: "plugins.CHX350.service.console", desc: "plugins.CHX350.service.consoleDesc", disabled: false },
	{ path: "/Plugins/ObjectModel", icon: "mdi-file-tree", title: "plugins.CHX350.service.objectModel", desc: "plugins.CHX350.service.objectModelDesc", disabled: !hasRoute("/Plugins/ObjectModel") },
	{ path: "/Plugins/HeightMap", icon: "mdi-grid", title: "plugins.CHX350.service.heightmap", desc: "plugins.CHX350.service.heightmapDesc", disabled: !hasRoute("/Plugins/HeightMap") },
	{ path: "/Plugins/InputShaping", icon: "mdi-transition", title: "plugins.CHX350.service.inputShaping", desc: "plugins.CHX350.service.inputShapingDesc", disabled: !hasRoute("/Plugins/InputShaping") },
	{ path: vigilPath.value ?? "/Plugins/Vigil", icon: "mdi-shield-check-outline", title: "plugins.CHX350.service.vigil", desc: "plugins.CHX350.service.vigilDesc", disabled: vigilPath.value === null },
	{ path: "/Settings/CHX350", icon: "mdi-cog-outline", title: "plugins.CHX350.service.settings", desc: "plugins.CHX350.service.settingsDesc", disabled: false },
	{ path: "/Plugins", icon: "mdi-puzzle-outline", title: "plugins.CHX350.service.plugins", desc: "plugins.CHX350.service.pluginsDesc", disabled: false }
]);

async function openClassicDwc() {
	const ok = await showConfirmDialog(
		i18n.global.t("plugins.CHX350.service.classicDwcTitle"),
		i18n.global.t("plugins.CHX350.service.classicDwcPrompt"),
		"mdi-monitor-dashboard"
	);
	if (!ok) {
		return;
	}
	// Mirrors the /BuiltInLayout guard: an explicit user choice that suppresses takeoverOnFirstLoad
	settingsStore.useCustomLayout = false;
	settingsStore.activeLayoutId = null;
	settingsStore.layoutUserSet = true;
	router.push("/");
}
</script>
