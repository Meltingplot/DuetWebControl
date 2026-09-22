<style scoped>
:deep(.v-navigation-drawer) {
	border-right: 0;
}
:deep(.v-app-bar.v-toolbar) {
	background: transparent;
}
:deep(.v-toolbar__content) {
	padding: 0;
}
.chx-main {
	background: var(--surface-page);
}
.chx-content {
	min-height: calc(100dvh - var(--v-layout-top, 72px));
	min-width: 0;
}
</style>

<template>
	<v-app class="chx-shell">
		<v-navigation-drawer permanent rail :rail-width="104" :width="104" color="#004276">
			<ChxSidebar />
		</v-navigation-drawer>

		<v-app-bar flat :height="72">
			<ChxHeader />
		</v-app-bar>

		<v-main class="chx-main">
			<!-- Stock DWC pages get the same container padding the built-in shell gives them -->
			<v-container v-if="!isChxRoute" fluid class="global-container pa-4 chx-content">
				<DwcRouterView />
			</v-container>
			<div v-else class="chx-content">
				<DwcRouterView />
			</div>
		</v-main>

		<NotAusOverlay />
	</v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";

import DwcRouterView from "@/components/misc/DwcRouterView.vue";
import { useMachineStore } from "@/stores/machine";

import { ROUTES } from "../routes";
import { adoptChxThemeOnce } from "../theme";
import ChxHeader from "./ChxHeader.vue";
import ChxSidebar from "./ChxSidebar.vue";
import NotAusOverlay from "./NotAusOverlay.vue";

const machineStore = useMachineStore();
const route = useRoute();

const isChxRoute = computed(() => route.path === ROUTES.start || route.path === ROUTES.job || route.path.startsWith("/CHX/"));

// Apply the brand theme once the shell is up and settings are loaded (they are, once connected)
onMounted(adoptChxThemeOnce);
watch(() => machineStore.isConnected, (connected) => {
	if (connected) {
		adoptChxThemeOnce();
	}
});
</script>
