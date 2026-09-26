import { computed } from "vue";

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
	filament_diameter?: string;
	filament_density?: string;
	/** Minimum nozzle hardness the filament profile asks for (OrcaSlicer: 3 for PLA, 40 for PA-CF) */
	required_nozzle_HRC?: string;
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

export interface BackendDiagnostics extends BackendStatus {
	python: string;
	eventlogTail: Array<string>;
}

/**
 * Whether the SBC daemon runs, from its pid in the object model. DSF sets the pid when the process
 * starts and exits; the registered endpoints are no signal because DSF keeps them after a crash,
 * and a 404 can also be the daemon's answer for a missing job file
 */
export const backendAvailable = computed(() => (useMachineStore().model.plugins.get(PLUGIN_ID)?.pid ?? -1) > 0);

function get<T>(path: string, params: Record<string, string | number> | null = null): Promise<T> {
	return useMachineStore().request("GET", `machine/${PLUGIN_ID}/${path}`, params, "json", null, 15000, undefined, undefined, undefined, 0) as Promise<T>;
}

export const api = {
	status: () => get<BackendStatus>("status"),
	fileinfo: (name: string) => get<BackendFileInfo>("fileinfo", { name }),
	history: (limit = 100) => get<{ entries: Array<HistoryEntry> }>("history", { limit }),
	diagnostics: () => get<BackendDiagnostics>("diagnostics")
};
