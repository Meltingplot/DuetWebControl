import { MachineStatus, type ThumbnailInfo } from "@duet3d/objectmodel";
import { computed } from "vue";

import { useMachineStore } from "@/stores/machine";
import { useSettingsStore } from "@/stores/settings";
import { isPaused, isPrinting } from "@/utils/enums";
import { extractFileName } from "@/utils/path";

import { filamentGrams, useChxGlobals } from "./useChxGlobals";

/** Density (g/cm³) assumed for the gram figures when the tool's spool carries none */
const FALLBACK_DENSITY = 1.24;

export type LastJobResult = "finished" | "cancelled" | "aborted" | "simulated" | null;

/**
 * Operator-facing view of the object model's job section (verified against a live OrcaSlicer job
 * on the CHX 350, 2026-09-22):
 *
 * - `job.file` is populated for the whole print with slicer totals (`printTime`, `numLayers`,
 *   `height`, `filament[]` per extruder, thumbnails). It is reset to null after the job ends;
 *   `job.lastFileName` / `lastDuration` / `lastFile*` describe the previous job then
 * - `job.timesLeft.slicer` is a countdown: the slicer's `printTime` minus the print time so far
 *   (the Meltingplot OrcaSlicer profile writes no M73). It stops at 1 s once the estimate is used
 *   up, so on a job that runs ~5 % slower than estimated it read 1 s for the last 25 layers
 *   (2026-09-23: 6077 s estimated, 6412 s printed). `timesLeft.file` (bytes) is useless with big
 *   header thumbnails and `timesLeft.filament` stays null until enough filament was extruded
 * - `job.rawExtrusion` counts filament (mm) since job start incl. purge lines; the extruder's
 *   `rawPosition` is the same figure. It is 0 while the machine heats up and runs the start code.
 *   Filament extruded against the slicer total tracked the elapsed share of the real print time
 *   within 4 points over the whole job
 * - `job.layer` is 1-based and set once the first layer starts; `job.layers[]` only contains
 *   completed layers, so the per-layer charts stay empty during layer 1
 * - `job.duration` includes `warmUpDuration`; `layerTime` is the running time of the current layer
 */
export function useJob() {
	const machineStore = useMachineStore();
	const settingsStore = useSettingsStore();
	const globals = useChxGlobals();

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

	// --- Progress -----------------------------------------------------------------------------

	/** DWC's progress: filament extruded against the slicer total, else the file position */
	const progress = computed(() => machineStore.jobProgress);
	/** `progress` is the filament-based figure (same conditions as machineStore.jobProgress) */
	const filamentProgress = computed(() => active.value && !simulating.value
		&& machineStore.model.move.extruders.length > 0 && (file.value?.filament ?? []).some((mm) => mm > 0));

	/**
	 * Slicer time for the filament still to extrude: consistent with the progress figure, starts at
	 * the full estimate and never runs out before the job does (see the notes above). Without
	 * filament totals DWC's JobTimesPanel order applies: slicer, filament, file position
	 */
	const timeLeft = computed<number | null>(() => {
		if (!active.value) {
			return null;
		}
		if (filamentProgress.value && printTime.value) {
			return Math.round(Number(printTime.value) * (1 - progress.value));
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

	// Diameter and density belong to the tool (globals filament_diameter[], spool_density[]); the
	// slicer's extruder i is tool i on the CHX 350, the lookup only covers an unusual tool mapping
	function toolForExtruder(extruder: number): number {
		return machineStore.model.tools.find((t) => t !== null && t.extruders[0] === extruder)?.number ?? extruder;
	}
	function filamentDiameter(extruder = 0): number {
		return globals.filamentDiameter(toolForExtruder(extruder)) ?? machineStore.model.move.extruders[extruder]?.filamentDiameter ?? 1.75;
	}
	function mmToGrams(mm: number, extruder = 0): number {
		const density = globals.spool(toolForExtruder(extruder))?.density || FALLBACK_DENSITY;
		return filamentGrams(mm, filamentDiameter(extruder), density);
	}
	/** Filament (mm) the slicer expects for the whole job, all extruders */
	const filamentTotal = computed(() => (file.value?.filament ?? []).reduce((a, b) => a + b, 0));
	/** Filament (mm) extruded since the job started */
	const filamentUsed = computed(() => active.value ? (job.value.rawExtrusion ?? 0) : 0);
	const filamentLeft = computed(() => Math.max(0, filamentTotal.value - filamentUsed.value));
	/** Grams per mm of the job's filament, weighted by what each extruder needs (for all-extruder totals) */
	const gramsPerMm = computed(() => {
		const amounts = file.value?.filament ?? [];
		const total = amounts.reduce((a, b) => a + b, 0);
		return total > 0 ? amounts.reduce((sum, mm, e) => sum + mmToGrams(mm, e), 0) / total : mmToGrams(1);
	});
	/** Grams the running job still needs from an extruder: slicer total minus what the extruder fed so far */
	function gramsLeft(extruder: number): number {
		if (!active.value) {
			return 0;
		}
		const total = file.value?.filament[extruder] ?? 0;
		const done = machineStore.model.move.extruders[extruder]?.rawPosition ?? 0;
		return mmToGrams(Math.max(0, total - done), extruder);
	}

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
		progress,
		layer, numLayers, layersDone, layerTime, layerHeight, height, currentHeight,
		filamentDiameter, mmToGrams, filamentTotal, filamentUsed, filamentLeft, gramsPerMm, gramsLeft,
		currentTool, speedFactor, extrusionFactor, partFan,
		thumbnail, thumbnailUrl
	};
}
