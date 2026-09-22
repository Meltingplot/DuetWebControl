import type { GCodeFileInfo, ThumbnailInfo } from "@duet3d/objectmodel";
import { computed, ref, watch, type Ref } from "vue";

import { useCacheStore } from "@/stores/cache";
import { useMachineStore } from "@/stores/machine";

import { api, type SlicerConfig } from "../api";
import { useChxGlobals } from "./useChxGlobals";
import { useMachineState } from "./useMachineState";
import { useTemps } from "./useTemps";

export type CheckState = "ok" | "mismatch" | "unknown";

export interface JobCheck {
	key: "material" | "nozzle" | "printer" | "surface";
	state: CheckState;
	/** i18n key of the title */
	title: string;
	/** Free-text detail (already localised where needed) */
	detail: string;
	/** Whether a mismatch blocks the start */
	blocking: boolean;
}

/** Slicer metadata merged from the backend config block, DSF customInfo and the file name */
export interface SlicerMeta {
	material: string | null;
	materialType: string | null;
	nozzle: number | null;
	printerModel: string | null;
	bedType: string | null;
	printMode: string | null;
	layerHeight: number | null;
	source: "backend" | "customInfo" | "filename" | "none";
}

const FILENAME_RE = /_L(?<layer>[\d.]+)mm_N(?<nozzle>[\d.]+)_(?<material>[A-Za-z0-9-]+)_(?<printer>.+?)_(?<time>[\dhms]+)\.(?:gcode|g|gco|gc)$/i;

function tokens(value: string | null | undefined): Array<string> {
	return (value ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 0);
}

/**
 * Loose material match: every token of the requested material must be a prefix of a token of
 * the loaded filament name ("PA-CF" ↔ "Meltingplot PA6 CF HT", "PLA" ↔ "PLA NX2 matt 0.8mm")
 */
export function materialMatches(required: string | null, loaded: string | null): CheckState {
	const req = tokens(required).filter((t) => !/^\d+(\.\d+)?(mm)?$/.test(t) && t !== "nozzle");
	const have = tokens(loaded);
	if (req.length === 0 || have.length === 0) {
		return "unknown";
	}
	return req.every((r) => have.some((h) => h.startsWith(r))) ? "ok" : "mismatch";
}

export function useJobMeta(path: Ref<string>) {
	const machineStore = useMachineStore();
	const cacheStore = useCacheStore();
	const globals = useChxGlobals();
	const temps = useTemps();
	const state = useMachineState();

	const info = ref<GCodeFileInfo | null>(null);
	const config = ref<SlicerConfig | null>(null);
	const loading = ref(false);
	const backendError = ref<string | null>(null);

	async function load() {
		const file = path.value;
		info.value = null;
		config.value = null;
		backendError.value = null;
		if (!file || !machineStore.isConnected) {
			return;
		}
		loading.value = true;
		try {
			let cached = cacheStore.fileInfos[file];
			if (!cached) {
				cached = await machineStore.getFileInfo(file, true);
				cacheStore.setFileInfo(file, cached);
			}
			if (path.value === file) {
				info.value = cached;
			}
		} catch (e) {
			console.warn(e);
		}
		try {
			const result = await api.fileinfo(file);
			if (path.value === file) {
				config.value = result.config ?? {};
			}
		} catch (e) {
			backendError.value = String((e as Error)?.message ?? e);
		} finally {
			loading.value = false;
		}
	}
	watch([path, () => machineStore.isConnected], load, { immediate: true });

	const customInfo = computed<Record<string, unknown>>(() => {
		const ci = info.value?.customInfo;
		return ci && ci.size > 0 ? Object.fromEntries(ci) : {};
	});

	const fileName = computed(() => path.value.split("/").pop() ?? path.value);

	const filenameMeta = computed(() => {
		const m = FILENAME_RE.exec(fileName.value);
		if (!m?.groups) {
			return null;
		}
		return {
			layer: parseFloat(m.groups.layer),
			nozzle: parseFloat(m.groups.nozzle),
			material: m.groups.material,
			printer: m.groups.printer
		};
	});

	function str(value: unknown): string | null {
		if (value === undefined || value === null) {
			return null;
		}
		const s = String(value).trim().replace(/^"|"$/g, "");
		return s.length > 0 ? s : null;
	}
	function num(value: unknown): number | null {
		const s = str(value);
		if (s === null) {
			return null;
		}
		const n = parseFloat(s.split(/[,;]/)[0]);
		return Number.isFinite(n) ? n : null;
	}

	const meta = computed<SlicerMeta>(() => {
		const c = config.value ?? {};
		const ci = customInfo.value;
		const fn = filenameMeta.value;
		const material = str(c.filament_settings_id) ?? str(ci.material) ?? str(ci.filament) ?? fn?.material ?? null;
		const materialType = str(c.filament_type) ?? str(ci.filamentType) ?? fn?.material ?? null;
		const nozzle = num(c.nozzle_diameter) ?? num(ci.nozzle) ?? num(ci.nozzleDiameter) ?? fn?.nozzle ?? null;
		const printerModel = str(c.printer_model) ?? str(ci.printer) ?? fn?.printer ?? null;
		const bedType = str(c.curr_bed_type) ?? str(ci.bedType) ?? str(ci.surface) ?? null;
		const printMode = str(ci.printMode) ?? str(ci.idexMode) ?? null;
		const layerHeight = num(c.layer_height) ?? info.value?.layerHeight ?? fn?.layer ?? null;
		const source: SlicerMeta["source"] = Object.keys(c).length > 0 ? "backend" : (Object.keys(ci).length > 0 ? "customInfo" : (fn ? "filename" : "none"));
		return { material, materialType, nozzle, printerModel, bedType, printMode, layerHeight, source };
	});

	/** Tools the job uses (from the slicer's per-extruder filament amounts), defaulting to tool 0 */
	const usedTools = computed(() => {
		const filament = info.value?.filament ?? [];
		const tools = temps.tools.value;
		const used = tools.filter((t) => t.extruderIndex >= 0 && (filament[t.extruderIndex] ?? 0) > 0);
		return used.length > 0 ? used : tools.slice(0, 1);
	});

	const checks = computed<Array<JobCheck>>(() => {
		const result: Array<JobCheck> = [];
		const m = meta.value;

		// Material per used tool
		for (const tool of usedTools.value) {
			const required = m.materialType ?? m.material;
			const stateValue = required ? materialMatches(m.material, tool.filament) === "ok" || materialMatches(m.materialType, tool.filament) === "ok"
				? "ok"
				: (tool.filament ? "mismatch" : "unknown") : "unknown";
			result.push({
				key: "material",
				state: stateValue,
				title: stateValue === "ok" ? "plugins.CHX350.check.materialOk" : (stateValue === "mismatch" ? "plugins.CHX350.check.materialBad" : "plugins.CHX350.check.materialUnknown"),
				detail: `T${tool.number}: ${required ?? "?"} ↔ ${tool.filament || "—"}`,
				blocking: true
			});

			// Nozzle diameter per used tool
			const installed = tool.nozzleDiameter ?? globals.nozzleDiameter(tool.number);
			let nozzleState: CheckState = "unknown";
			if (m.nozzle !== null && installed !== null) {
				nozzleState = Math.abs(m.nozzle - installed) < 0.011 ? "ok" : "mismatch";
			}
			result.push({
				key: "nozzle",
				state: nozzleState,
				title: nozzleState === "ok" ? "plugins.CHX350.check.nozzleOk" : (nozzleState === "mismatch" ? "plugins.CHX350.check.nozzleBad" : "plugins.CHX350.check.nozzleUnknown"),
				detail: `T${tool.number}: ${m.nozzle !== null ? m.nozzle.toFixed(2) + " mm" : "?"} ↔ ${installed !== null ? installed.toFixed(2) + " mm" : "—"}`,
				blocking: true
			});
		}

		// Printer model
		let printerState: CheckState = "unknown";
		if (m.printerModel) {
			printerState = /chx\s*350/i.test(m.printerModel) ? "ok" : "mismatch";
		}
		result.push({
			key: "printer",
			state: printerState,
			title: printerState === "ok" ? "plugins.CHX350.check.printerOk" : (printerState === "mismatch" ? "plugins.CHX350.check.printerBad" : "plugins.CHX350.check.printerUnknown"),
			detail: m.printerModel ?? "",
			blocking: printerState === "mismatch"
		});

		// Bed surface - informational only (no sensor for the mounted plate)
		result.push({
			key: "surface",
			state: m.bedType ? "ok" : "unknown",
			title: m.bedType ? "plugins.CHX350.check.surface" : "plugins.CHX350.check.surfaceUnknown",
			detail: m.bedType ?? "",
			blocking: false
		});
		return result;
	});

	const blocked = computed(() => checks.value.some((c) => c.blocking && c.state === "mismatch"));

	const thumbnail = computed<ThumbnailInfo | null>(() => {
		const list = info.value?.thumbnails ?? [];
		if (list.length === 0) {
			return null;
		}
		return list.slice().sort((a, b) => b.width * b.height - a.width * a.height)[0];
	});

	const totalFilament = computed(() => (info.value?.filament ?? []).reduce((a, b) => a + b, 0));

	return { info, config, meta, checks, blocked, loading, backendError, thumbnail, fileName, usedTools, totalFilament, customInfo, state, reload: load };
}
