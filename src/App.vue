<template>
	<router-view />

	<!-- App-wide overlays. Mounted here, outside the active layout, so a custom shell registered
		 via registerLayout() gets them for free without having to re-declare each one -->
	<GlobalUploadOverlay />
	<ConnectDialog />
	<ConnectionProgressDialog />
	<FileTransferDialog />
	<IncompatibleVersionsDialog />
	<MessageBoxDialog />
	<PluginInstallDialog />
	<ConfirmDialogQueue />
	<InputDialogQueue />
	<NotificationQueue />
</template>

<script setup lang="ts">
import type { Volume } from "@duet3d/objectmodel";
import Piecon from "piecon";

import i18n from "@/i18n";
import { _markAppMounted } from "@/plugins/layout";
import { useMachineStore } from "@/stores/machine";
import { useSettingsStore } from "@/stores/settings";
import { LogLevel, useUiStore } from "@/stores/ui";
import { isPrinting } from "@/utils/enums";

const machineStore = useMachineStore();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();
const router = useRouter();

// Tune Piecon - blue progress wedge on a grey background, white outer ring; no title-bar
// fallback (we already overlay the percentage into document.title via the watcher below)
Piecon.setOptions({ color: "#1976D2", background: "#BBB", shadow: "#FFF", fallback: false });

// Attempt to connect straight away unless running in dev mode. Fire-and-forget; the store
// surfaces failures through the connectError / connectionError event bus. The .catch keeps the
// browser quiet about the unhandled rejection that would otherwise log on connect failures
if (!import.meta.env.DEV) {
	machineStore.connect().catch((e) => console.warn(e));
}

// Flip the layout module's pre-mount marker. registerLayout reads it to decide whether
// `locked: true` is honoured (pre-mount: yes; post-mount: downgraded with warning) - the lock
// installs a router guard that cuts off URL escape and is gated to pre-mount registration only
onMounted(() => _markAppMounted());

// #region Document title and favicon job progress (Piecon)

const machineName = computed(() => machineStore.model.network.name || "Duet Web Control");
const status = computed(() => machineStore.model.state.status);
const jobProgress = computed(() => machineStore.jobProgress);

// Title and favicon wedge share one watcher so the title write is always the last writer:
// Piecon.reset() restores the document.title it captured on its first setProgress call, which
// would otherwise clobber the title back to a stale "(x%) name" when a print stops.
// Every Piecon.setProgress call swaps in a new data-URL favicon that the browser loads as a
// request of its own, and jobProgress changes with every status update while printing. A 16/32 px
// wedge cannot show more than whole percents, so the favicon is only redrawn when those change
let wasPrinting = false, faviconPercent: number | null = null;
watch([machineName, status, jobProgress], () => {
	const printing = isPrinting(status.value);
	const showProgress = printing && jobProgress.value > 0;

	if (showProgress) {
		const percent = Math.round(Math.min(100, Math.max(0, jobProgress.value * 100)));
		if (percent !== faviconPercent) {
			Piecon.setProgress(percent);
			faviconPercent = percent;
		}
	} else if (wasPrinting && !printing) {
		Piecon.reset();
		faviconPercent = null;
	}
	wasPrinting = printing;

	const title = showProgress ? `(${(jobProgress.value * 100).toFixed(1)}%) ${machineName.value}` : machineName.value;
	if (document.title !== title) {
		document.title = title;
	}
}, { immediate: true });

// #endregion

// #region Auto-switch to Job page on print start

// Watch the state.status edge from not-printing to printing. Gated on the user setting
// (Settings > General > Behaviour > Switch to Job page on print start). Only navigates when
// the user is on a page that doesn't already show full job controls - if they're already on
// /Job/Status or on /Job/Webcam (watching the print live) we leave them alone
let wasPrintingForNav = isPrinting(status.value);
watch(status, (current) => {
	const nowPrinting = isPrinting(current);
	if (!wasPrintingForNav && nowPrinting && settingsStore.behaviour.switchToJobOnPrintStart
		&& router.currentRoute.value.path !== "/Job/Status") {
		router.push("/Job/Status").catch(() => { /* navigation guard rejections are fine */ });
	}
	wasPrintingForNav = nowPrinting;
});

// #endregion

// #region Free-space warning on (re)connect

// Fires once when a freshly-connected machine reports a near-full SD volume (<5% free, ignoring
// tiny volumes under 256 MiB which trip on noise). Watching isConnecting catches both the initial
// connect and the reconnect path
const FREE_SPACE_RATIO_THRESHOLD = 0.05;
const FREE_SPACE_MIN_CAPACITY = 256 * 1024 * 1024;

// DSF's default base directory of the virtual SD card (0:/)
const SBC_SD_DIRECTORY = "/opt/dsf/sd";

// Volumes that hold the SD card. In SBC mode the volumes are the host's mount points and
// volumes[0] is "/"; an image with a read-only root (reported with 0 bytes free) bind-mounts the
// writable SD directories (gcodes, sys, ...) below /opt/dsf/sd. Those mounts count, else the
// mount that holds /opt/dsf/sd, else (standalone firmware, paths like "0:/") the first volume
function sdVolumes(): Array<Volume> {
	const volumes = machineStore.model.volumes;
	const below = volumes.filter((volume) => volume.path === SBC_SD_DIRECTORY || volume.path?.startsWith(`${SBC_SD_DIRECTORY}/`));
	if (below.length > 0) {
		return below;
	}
	const holding = volumes
		.filter((volume) => volume.path !== null && SBC_SD_DIRECTORY.startsWith(volume.path.endsWith("/") ? volume.path : `${volume.path}/`))
		.sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0));
	return holding.length > 0 ? holding.slice(0, 1) : volumes.slice(0, 1);
}

function isNearlyFull(volume: Volume): boolean {
	const { capacity, freeSpace } = volume;
	if (capacity === null || freeSpace === null) {
		return false;
	}
	const capacityNum = typeof capacity === "bigint" ? Number(capacity) : capacity;
	const freeSpaceNum = typeof freeSpace === "bigint" ? Number(freeSpace) : freeSpace;
	return capacityNum > FREE_SPACE_MIN_CAPACITY && freeSpaceNum / capacityNum < FREE_SPACE_RATIO_THRESHOLD;
}

watch(() => machineStore.isConnecting, (to, from) => {
	if (to || !from) {
		return;
	}
	if (sdVolumes().some(isNearlyFull)) {
		uiStore.log(LogLevel.warning,
			i18n.global.t("notification.freeSpaceWarning.title"),
			i18n.global.t("notification.freeSpaceWarning.message"));
	}
});

// #endregion

// #region Graceful disconnect on window unload

// Best-effort attempt to send a disconnect when the user closes the tab. `pagehide` fires only
// after the unload is committed - that way a `beforeunload` prompt the user cancels (e.g. when
// an editor still has unsaved changes) doesn't trigger a spurious disconnect that leaves the
// page connected-to-nothing. We don't await it - the browser doesn't give us time - but firing
// the request before tearing the page down lets the firmware drop the HTTP session immediately
// instead of waiting for the keep-alive timeout
window.addEventListener("pagehide", () => {
	if (machineStore.isConnected) {
		machineStore.disconnect(false).catch(() => { /* tab is going away */ });
	}
});

// #endregion
</script>
