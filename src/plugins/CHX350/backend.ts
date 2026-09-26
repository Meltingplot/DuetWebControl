import { useMachineStore } from "@/stores/machine";

import { PLUGIN_ID } from "./settings";

const WAIT_ATTEMPTS = 20;
const WAIT_INTERVAL_MS = 1500;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make sure the SBC daemon runs. After a plugin upgrade DSF leaves the daemon stopped ("partially
 * started"), and a fresh install does not auto-start it either; DWC's plugin page can start it
 * but the operator UI should not depend on that. Mirrors dwc-vigil's recovery: wait for the
 * plugin's object-model entry, then request a start when its pid says it is not running.
 * A crash later on is covered by the manifest's sbcAutoRestart
 */
export async function ensureBackendRunning(): Promise<void> {
	const machineStore = useMachineStore();
	if (!machineStore.isSbcMode) {
		return;
	}

	let entry = machineStore.model.plugins.get(PLUGIN_ID) ?? null;
	for (let i = 0; i < WAIT_ATTEMPTS && entry === null && machineStore.isConnected; i++) {
		await sleep(WAIT_INTERVAL_MS);
		entry = machineStore.model.plugins.get(PLUGIN_ID) ?? null;
	}
	if (entry === null) {
		// DSF part not installed on this SBC
		return;
	}

	if (!(entry.pid > 0)) {
		try {
			await machineStore.startSbcPlugin(PLUGIN_ID);
		} catch (e) {
			console.warn(`[${PLUGIN_ID}] could not start SBC backend`, e);
		}
	}
}
