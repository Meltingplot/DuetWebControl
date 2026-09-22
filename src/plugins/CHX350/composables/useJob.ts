import { MachineStatus, type ThumbnailInfo } from "@duet3d/objectmodel";
import { computed } from "vue";

import { useMachineStore } from "@/stores/machine";
import { useSettingsStore } from "@/stores/settings";
import { isPaused, isPrinting } from "@/utils/enums";
import { extractFileName } from "@/utils/path";

/** Assumed filament density (g/cm³) for the gram figures; the object model carries no material density */
const DENSITY_G_CM3 = 1.24;

export type ProgressSource = "slicer" | "filament" | "file" | "none";
export type LastJobResult = "finished" | "cancelled" | "aborted" | "simulated" | null;

/**
 * Operator-facing view of the object model's job section (verified against a live OrcaSlicer job
 * on the CHX 350, 2026-09-22):
 *
 * - `job.file` is populated for the whole print with slicer totals (`printTime`, `numLayers`,
 *   `height`, `filament[]` per extruder, thumbnails). It is reset to null after the job ends;
 *   `job.lastFileName` / `lastDuration` / `lastFile*` describe the previous job then
 * - `job.timesLeft.slicer` follows the slicer's M73 remaining time and is available from the
 *   first second on; `timesLeft.file` (bytes) is useless with big header thumbnails and
 *   `timesLeft.filament` stays null until enough filament was extruded
 * - `job.rawExtrusion` counts filament (mm) since job start incl. purge lines; the extruder's
 *   `rawPosition` is the same figure. It is 0 during warm-up, so a filament-based progress shows
 *   0 % for the first minutes
 * - `job.layer` is 1-based and set once the first layer starts; `job.layers[]` only contains
 *   completed layers, so the per-layer charts stay empty during layer 1
 * - `job.duration` includes `warmUpDuration`; `layerTime` is the running time of the current layer
 */
export function useJob() {
	const machineStore = useMachineStore();
	const settingsStore = useSettingsStore();

	const job = computed(() => machineStore.model.job);
	const status = computed(() => machineStore.model.state.status);

	/** A job is loaded and either printing, paused, or in a transition (pausing/resuming/cancelling) */
	const active = computed(() => isPrinting(status.value));
	const paused = computed(() => isPaused(status.value));
	const pausing = computed(() => status.value === MachineStatus.pausing);
	const resuming = computed(() => status.value === MachineStatus.resuming);
	const cancelling = computed(() => status.value === MachineStatus.cancelling);
	const simulating = computed(() => status.value === MachineStatus.simulating);

	const file = computed(() => job.value.file);
	const filePath = computed(() => file.value?.fileName ?? job.value.lastFileName ?? null);
	const fileName = computed(() => filePath.value ? extractFileName(filePath.value) : "");
	const lastFilePath = computed(() => job.value.lastFileName);

	/** How the previous job ended (only meaningful while no job is active) */
	const lastResult = computed<LastJobResult>(() => {
		if (active.value || job.value.lastFileName === null) {
			return null;
		}
		if (job.value.lastFileSimulated) {
			return "simulated";
		}
		if (job.value.lastFileAborted) {
			return "aborted";
		}
		if (job.value.lastFileCancelled) {
			return "cancelled";
		}
		return "finished";
	});
	const lastDuration = computed(() => job.value.lastDuration);

	// --- Time ---------------------------------------------------------------------------------

	/** Seconds since job start including warm-up (null when idle) */
	const elapsed = computed(() => active.value ? job.value.duration : null);
	const warmUp = computed(() => job.value.warmUpDuration);
	const pauseDuration = computed(() => job.value.pauseDuration ?? 0);
	/** Total print time the slicer estimated for the file (s) */
	const printTime = computed(() => file.value?.printTime ?? null);

	// Same priority as DWC's JobTimesPanel: slicer estimate first, then filament, then file position
	const timeLeft = computed<number | null>(() => {
		if (!active.value) {
			return null;
		}
		const t = job.value.timesLeft;
		return t.slicer ?? t.filament ?? t.file ?? null;
	});
	const eta = computed<Date | null>(() => timeLeft.value === null ? null : new Date(Date.now() + timeLeft.value * 1000));
	const finishAt = computed(() => {
		const d = eta.value;
		if (d === null) {
			return "—";
		}
		const time = d.toLocaleTimeString(settingsStore.locale, { hour: "2-digit", minute: "2-digit" });
		return d.toDateString() === new Date().toDateString()
			? time
			: `${d.toLocaleDateString(settingsStore.locale, { weekday: "short" })} ${time}`;
	});

	// --- Progress -----------------------------------------------------------------------------

	/**
	 * Progress consistent with the time-left figure: the slicer's remaining time against its total
	 * (this is what OrcaSlicer's M73 reports), else DWC's filament-based estimate. The slicer figure
	 * moves from the first minute on, the filament figure sits at 0 % through the warm-up
	 */
	const progressSource = computed<ProgressSource>(() => {
		if (!active.value) {
			return job.value.lastFileName !== null ? "file" : "none";
		}
		const t = job.value.timesLeft;
		if (t.slicer !== null && printTime.value !== null && printTime.value > 0 && !simulating.value) {
			return "slicer";
		}
		if (t.filament !== null || (file.value?.filament.length ?? 0) > 0) {
			return "filament";
		}
		return "file";
	});
	const progress = computed(() => {
		if (!active.value) {
			return machineStore.jobProgress;
		}
		if (progressSource.value === "slicer") {
			const total = Number(printTime.value);
			const left = Number(job.value.timesLeft.slicer);
			return Math.max(0, Math.min(1, (total - left) / total));
		}
		return machineStore.jobProgress;
	});

	// --- Layers and height --------------------------------------------------------------------

	/** Current layer (1-based) as reported by the firmware */
	const layer = computed(() => active.value ? job.value.layer : null);
	const numLayers = computed(() => file.value?.numLayers ?? 0);
	/** Number of completed layers with per-layer data */
	const layersDone = computed(() => job.value.layers.length);
	const layerTime = computed(() => active.value ? job.value.layerTime : null);
	const layerHeight = computed(() => file.value?.layerHeight ?? null);
	/** Object height (mm) from the slicer */
	const height = computed(() => file.value?.height ?? null);
	/** Nominal print height of the current layer (mm); the Z axis position includes hops and offsets */
	const currentHeight = computed(() => {
		if (layer.value === null || layerHeight.value === null) {
			return null;
		}
		return Math.min(layer.value * layerHeight.value, height.value ?? Infinity);
	});

	// --- Filament -----------------------------------------------------------------------------

	function filamentDiameter(extruder = 0): number {
		return machineStore.model.move.extruders[extruder]?.filamentDiameter ?? 1.75;
	}
	function mmToGrams(mm: number, extruder = 0): number {
		const r = filamentDiameter(extruder) / 2;
		return (Math.PI * r * r * mm) / 1000 * DENSITY_G_CM3;
	}
	/** Filament (mm) the slicer expects for the whole job, all extruders */
	const filamentTotal = computed(() => (file.value?.filament ?? []).reduce((a, b) => a + b, 0));
	/** Filament (mm) extruded since the job started */
	const filamentUsed = computed(() => active.value ? (job.value.rawExtrusion ?? 0) : 0);
	const filamentLeft = computed(() => Math.max(0, filamentTotal.value - filamentUsed.value));

	// --- Machine parameters that matter while printing ---------------------------------------

	const currentTool = computed(() => machineStore.model.state.currentTool);
	const speedFactor = computed(() => machineStore.model.move.speedFactor);
	const extrusionFactor = computed(() => {
		const tool = machineStore.model.tools[currentTool.value] ?? null;
		const extruder = tool?.extruders[0] ?? 0;
		return machineStore.model.move.extruders[extruder]?.factor ?? 1;
	});
	/** Part cooling fan of the current tool (0..1) or null when the tool has no fan */
	const partFan = computed(() => {
		const tool = machineStore.model.tools[currentTool.value] ?? null;
		const fanIndex = tool?.fans[0];
		if (fanIndex === undefined) {
			return null;
		}
		return machineStore.model.fans[fanIndex]?.requestedValue ?? null;
	});

	// --- Thumbnail ----------------------------------------------------------------------------

	const thumbnail = computed<ThumbnailInfo | null>(() => {
		const list = file.value?.thumbnails ?? [];
		if (list.length === 0) {
			return null;
		}
		return list.slice().sort((a, b) => b.width * b.height - a.width * a.height)[0];
	});
	const thumbnailUrl = computed(() => {
		const t = thumbnail.value;
		if (!t || !t.data) {
			return null;
		}
		const mime = t.format === "jpeg" ? "image/jpeg" : (t.format === "qoi" ? null : "image/png");
		return mime ? `data:${mime};base64,${t.data}` : null;
	});

	return {
		job, status,
		active, paused, pausing, resuming, cancelling, simulating,
		file, filePath, fileName, lastFilePath, lastResult, lastDuration,
		elapsed, warmUp, pauseDuration, printTime, timeLeft, eta, finishAt,
		progress, progressSource,
		layer, numLayers, layersDone, layerTime, layerHeight, height, currentHeight,
		filamentDiameter, mmToGrams, filamentTotal, filamentUsed, filamentLeft,
		currentTool, speedFactor, extrusionFactor, partFan,
		thumbnail, thumbnailUrl
	};
}
