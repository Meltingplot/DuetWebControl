import i18n from "@/i18n";
import { registerPluginMessages, registerRoute, registerSettingTab } from "@/plugins";
import { registerLayout } from "@/plugins/layout";
import { useMachineStore } from "@/stores/machine";
import Events from "@/utils/events";

import "./styles/chx.scss";
import { ensureBackendRunning } from "./backend";
import { useFlowStore } from "./flows/store";
import de from "./i18n/de.json";
import en from "./i18n/en.json";
import ChxShell from "./layout/ChxShell.vue";
import { ROUTES } from "./routes";
import { PLUGIN_ID, registerChxSettingDefaults } from "./settings";
import { useHeaterLoadStore } from "./stores/heaterLoad";
import { LAYOUT_ID, registerChxThemes } from "./theme";
import { normalizeWebcamUrls } from "./webcam";

import Start from "./pages/Start.vue";
import Service from "./pages/Service.vue";
import Jobs from "./pages/Jobs.vue";
import CheckJob from "./pages/CheckJob.vue";
import RunningJob from "./pages/RunningJob.vue";
import FilamentWizard from "./pages/FilamentWizard.vue";
import Preheat from "./pages/Preheat.vue";
import Calibrate from "./pages/Calibrate.vue";
import Home from "./pages/Home.vue";
import Control from "./pages/Control.vue";
import History from "./pages/History.vue";
import Analysis from "./pages/Analysis.vue";
import About from "./pages/About.vue";
import Support from "./pages/Support.vue";
import SettingsTab from "./pages/SettingsTab.vue";

// 1. Translations (plugins.CHX350.*)
registerPluginMessages(PLUGIN_ID, { de, en });

// 2. Brand themes (selectable from Settings > Display, adopted automatically by the shell)
registerChxThemes();

// 3. Plugin settings defaults - re-applied after every settings load because the persisted
//    `plugins` record replaces the in-memory one wholesale
registerChxSettingDefaults();
Events.on("settingsLoaded", registerChxSettingDefaults);

// Webcam: turn a relative stream path into a full URL with the [HOSTNAME] placeholder
normalizeWebcamUrls();
Events.on("settingsLoaded", normalizeWebcamUrls);

// 4. Pages. All live under /CHX/* and are hidden from the stock navigation drawer; they stay
//    reachable by URL under the built-in shell as well
const pages: Array<{ name: string; path: string; component: any; icon: string }> = [
	{ name: "Jobs", path: ROUTES.jobs, component: Jobs, icon: "mdi-file-document-multiple-outline" },
	{ name: "Check", path: ROUTES.check, component: CheckJob, icon: "mdi-clipboard-check-outline" },
	{ name: "Filament", path: ROUTES.filament, component: FilamentWizard, icon: "mdi-swap-horizontal" },
	{ name: "Preheat", path: ROUTES.preheat, component: Preheat, icon: "mdi-thermometer-chevron-up" },
	{ name: "Calibrate", path: ROUTES.calibrate, component: Calibrate, icon: "mdi-target" },
	{ name: "Home", path: ROUTES.home, component: Home, icon: "mdi-home-import-outline" },
	{ name: "Control", path: ROUTES.control, component: Control, icon: "mdi-axis-arrow" },
	{ name: "History", path: ROUTES.history, component: History, icon: "mdi-history" },
	{ name: "Analysis", path: ROUTES.analysis, component: Analysis, icon: "mdi-chart-box-outline" },
	{ name: "About", path: ROUTES.about, component: About, icon: "mdi-information-outline" },
	{ name: "Support", path: ROUTES.support, component: Support, icon: "mdi-headset" },
	{ name: "Service", path: ROUTES.service, component: Service, icon: "mdi-lock-outline" }
];
for (const page of pages) {
	registerRoute(page.component, {
		Plugins: {
			[`CHX350${page.name}`]: {
				icon: page.icon,
				caption: `plugins.CHX350.nav.${page.name.charAt(0).toLowerCase()}${page.name.slice(1)}`,
				path: page.path,
				condition: () => false,
				pageFill: true
			}
		}
	});
}

// 5. Settings tab (macros, bed map, support data) in the stock Settings page
registerSettingTab({
	key: PLUGIN_ID,
	icon: "mdi-printer-3d",
	caption: () => i18n.global.t("plugins.CHX350.nav.settings"),
	component: SettingsTab,
	order: 58
});

// 6. The shell. "/" and "/Job/Status" are overridden so DWC's own navigation (print-start switch,
//    hub) lands on the CHX pages while this layout is active
registerLayout(ChxShell, {
	id: LAYOUT_ID,
	caption: "CHX 350",
	takeoverOnFirstLoad: true,
	routes: {
		"/": Start,
		"/Job/Status": RunningJob
	}
});

// 7. Flow macros: index the macro directories once connected and whenever files there change
const flowStore = useFlowStore();
let flowScanTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleFlowScan(delay = 1500) {
	if (flowScanTimer !== null) {
		clearTimeout(flowScanTimer);
	}
	flowScanTimer = setTimeout(() => {
		flowScanTimer = null;
		flowStore.scan().catch((e) => console.warn(e));
	}, delay);
}
Events.on("connected", () => scheduleFlowScan(0));
Events.on("filesOrDirectoriesChanged", ({ files }) => {
	const model = useMachineStore().model;
	const roots = [model.directories.macros || "0:/macros", model.directories.system || "0:/sys"];
	if (!files || files.some((f) => roots.some((root) => f.startsWith(root)))) {
		scheduleFlowScan();
	}
});
if (useMachineStore().isConnected) {
	scheduleFlowScan(0);
}

// 8. Nozzle heater load: sampled from plugin load on, so the one-minute mean is ready whichever
//    page is open when it matters
useHeaterLoadStore();

// 9. SBC backend (slicer metadata, job history): start it if DSF left it stopped
Events.on("connected", () => { ensureBackendRunning().catch((e) => console.warn(e)); });
if (useMachineStore().isConnected) {
	ensureBackendRunning().catch((e) => console.warn(e));
}
