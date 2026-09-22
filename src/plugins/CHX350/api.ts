import { ref } from "vue";

import { useMachineStore } from "@/stores/machine";

import { PLUGIN_ID } from "./settings";

/** Slicer settings parsed from a job file's trailing CONFIG_BLOCK by the SBC backend */
export interface SlicerConfig {
	filament_settings_id?: string;
	filament_type?: string;
	nozzle_diameter?: string;
	printer_model?: string;
	printer_settings_id?: string;
	print_settings_id?: string;
	curr_bed_type?: string;
	print_sequence?: string;
	layer_height?: string;
	[key: string]: string | undefined;
}

export interface BackendFileInfo {
	name: string;
	size: number;
	mtime: string;
	source: "config_block" | "tail" | "none";
	config: SlicerConfig;
}

export interface HistoryEntry {
	file: string;
	result: "finished" | "cancelled";
	/** Print time in seconds as logged by the firmware */
	printTimeS: number | null;
	/** ISO timestamp of the log line */
	timestamp: string | null;
}

export interface BackendStatus {
	version: string;
	uptime: number;
}

/** True once a request succeeded; false after a 404 (backend not installed/running); null = unknown */
export const backendAvailable = ref<boolean | null>(null);

async function get<T>(path: string, params: Record<string, string | number> | null = null): Promise<T> {
	const machineStore = useMachineStore();
	try {
		const result = await machineStore.request("GET", `machine/${PLUGIN_ID}/${path}`, params, "json", null, 15000, undefined, undefined, undefined, 0) as T;
		backendAvailable.value = true;
		return result;
	} catch (e) {
		if (isNotFound(e)) {
			backendAvailable.value = false;
		}
		throw e;
	}
}

function isNotFound(e: unknown): boolean {
	const name = (e as { constructor?: { name?: string } })?.constructor?.name ?? "";
	const message = String((e as { message?: string })?.message ?? e);
	return name === "FileNotFoundError" || /404|not found/i.test(message);
}

export const api = {
	status: () => get<BackendStatus>("status"),
	fileinfo: (name: string) => get<BackendFileInfo>("fileinfo", { name }),
	history: (limit = 100) => get<{ entries: Array<HistoryEntry> }>("history", { limit })
};
