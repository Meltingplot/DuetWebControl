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
	/** The event log knows finished and cancelled; QA adds the others ("unknown": its daemon did not run when the job ended) */
	result: "running" | "finished" | "cancelled" | "aborted" | "unknown";
	/** Print time in seconds as logged by the firmware */
	printTimeS: number | null;
	/** ISO timestamp of the log line (local time), or QA's end time (UTC; the start time while running) */
	timestamp: string | null;
	/** QA job id, to open the recorded analysis of the job */
	id?: string;
	/** QA recorded the layers of this job */
	analysable?: boolean;
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

function get<T>(path: string, params: Record<string, string | number> | null = null, plugin: string = PLUGIN_ID): Promise<T> {
	return useMachineStore().request("GET", `machine/${plugin}/${path}`, params, "json", null, 15000, undefined, undefined, undefined, 0) as Promise<T>;
}

export const api = {
	status: () => get<BackendStatus>("status"),
	fileinfo: (name: string) => get<BackendFileInfo>("fileinfo", { name }),
	history: (limit = 100) => get<{ entries: Array<HistoryEntry> }>("history", { limit }),
	diagnostics: () => get<BackendDiagnostics>("diagnostics")
};

// Quality assurance plugin (Meltingplot/dwc-quality-assurance). It records every job on the SBC;
// the shapes below are its docs/api.md and src/core/api.ts as of v0.1.0-rc.1 (2026-09-28)

export const QA_PLUGIN_ID = "QualityAssurance";

/** Whether QA's daemon runs: its pid, for the same reason as backendAvailable */
export const qaAvailable = computed(() => (useMachineStore().model.plugins.get(QA_PLUGIN_ID)?.pid ?? -1) > 0);

/** A value QA's daemon publishes in the object model (its plugin.json `data`: currentJobId, lastJobId, …) */
export function qaPluginData(key: string): unknown {
	const data: unknown = useMachineStore().model.plugins.get(QA_PLUGIN_ID)?.data;
	return data instanceof Map ? data.get(key) : undefined;
}

/** Entry of QA's job list: the HistoryEntry fields plus QA's own */
export interface QaJobEntry extends HistoryEntry {
	id: string;
	analysable: boolean;
	numLayers: number | null;
	material: string | null;
}

export interface QaStats {
	min: number;
	max: number;
	mean: number;
	std: number;
}

/** One layer as QA aggregates it; keyed records are by extruder, heater or sensor index */
export interface QaLayer {
	/** job.layer numbering (RRF's) */
	layer: number;
	durationS: number | null;
	/** Layer thickness from DSF's job.layers[], null when DSF had none */
	height: number | null;
	/** Machine Z of the layer's last extruding sample */
	z: number | null;
	filament: Record<string, { commandedMm: number | null; measuredMm: number | null; extruderMm: number | null }>;
	/** mm³/s */
	flow: Record<string, number>;
	temps: {
		heaters: Record<string, QaStats & { setpoint: number | null }>;
		sensors: Record<string, QaStats & { name: string | null }>;
		chamber: QaStats | null;
	};
	/** Stats of lastPercentage, plus avgPercentage at the layer end */
	fmStats: Record<string, QaStats & { avgPercentage: number | null }>;
	/** Heater load (0…1) at a reached setpoint; shareHigh is the time share of the 60 s mean ≥ meta.heaterLoad.high */
	loadStats: Record<string, { mean: number; shareHigh: number; shareLimit: number } | null>;
}

export interface QaLayers {
	jobId: string;
	meta: {
		sensors: Array<{ index: number; name: string | null }>;
		heaters: Array<{ index: number; role: "nozzle" | "bed" | "chamber" | "other"; tool: number | null; sensor: number | null }>;
		/** QA's chamber rule: the chamber heater, else the sensor named "SZP coil" */
		chamber: ["sensor" | "heater", number] | null;
		/** mm, per extruder */
		filamentDiameters: Record<string, number | null>;
		heaterLoad: { high: number; limit: number };
	};
	layers: Array<QaLayer>;
}

/**
 * QA answers 401 to requests without a DWC session, so they go through the connector like the
 * backend's, never through fetch() or a bare URL
 */
export const qa = {
	jobs: (limit = 100) => get<{ total: number; offset: number; jobs: Array<QaJobEntry> }>("jobs", { limit }, QA_PLUGIN_ID),
	job: (id: string) => get<QaJobEntry>("job", { id }, QA_PLUGIN_ID),
	layers: (id: string) => get<QaLayers>("job/layers", { id }, QA_PLUGIN_ID)
};
