import { computed } from "vue";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";

/**
 * The machine's safety-relevant globals are bit-flip hardened: "true" is stored as 0x55555555
 * (rendered 1431655765), "false" as 0xAAAAAAAA (2863311530). Plain booleans and 0/1 are accepted
 * too so the UI keeps working against a machine with conventional globals
 */
export const HARDENED_TRUE = 1431655765;

export function truthy(value: unknown): boolean {
	return value === true || value === 1 || value === HARDENED_TRUE || value === String(HARDENED_TRUE);
}

export type MachineMode = "automatic" | "default" | "unknown";

/** Keys of global.nozzle_type (hardware/confirm-nozzle-type.g); "unknown" reads as null */
export const NOZZLE_TYPES = ["brass", "cht", "hardened", "cht-hardened", "tungsten-carbide", "copper", "other"] as const;
export type NozzleType = typeof NOZZLE_TYPES[number];

/** Nozzle types rated for abrasive (fibre-filled) filament */
export const ABRASIVE_NOZZLE_TYPES: ReadonlyArray<NozzleType> = ["hardened", "cht-hardened", "tungsten-carbide"];

/** Keys of global.bed_surface (hardware/confirm-bed-surface.g); "unknown" reads as null */
export const BED_SURFACES = ["pei", "pei-textured", "pertinax", "g10", "carbon", "glass", "other"] as const;
export type BedSurface = typeof BED_SURFACES[number];

/** The spool mounted on a tool (global.spool_*[tool], persisted by spool/store.g) */
export interface SpoolState {
	/** Nominal net filament weight of the spool (g) */
	netWeight: number;
	/** Filament left on the spool (g); the machine books the consumption every 60 s while printing */
	remaining: number;
	/** Density of the filament on it (g/cm³); 0 means the consumption is not tracked */
	density: number;
}

/** Grams of filament in `mm` millimetres - the formula of the machine's spool/track.g and print/prepare.g */
export function filamentGrams(mm: number, diameter: number, density: number): number {
	return mm * Math.PI * (diameter / 2) ** 2 * density / 1000;
}

// i18n keys are camelCase ("cht-hardened" -> "chtHardened")
function labelKey(key: string): string {
	return key.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
}
export function nozzleTypeLabel(type: NozzleType): string {
	return i18n.global.t(`plugins.CHX350.nozzleType.${labelKey(type)}`);
}
export function bedSurfaceLabel(surface: BedSurface): string {
	return i18n.global.t(`plugins.CHX350.bedSurface.${labelKey(surface)}`);
}

function isKey<T extends string>(keys: ReadonlyArray<T>, value: unknown): value is T {
	return typeof value === "string" && (keys as ReadonlyArray<string>).includes(value);
}

/**
 * Typed, reactive reads of the Meltingplot machine globals (sys/meltingplot/globals). Every value
 * falls back to the "restrictive" interpretation when it is missing
 */
export function useChxGlobals() {
	const machineStore = useMachineStore();

	function get(key: string): unknown {
		// ModelDictionary is a Map subclass; Vue's reactive proxy tracks Map.get
		return machineStore.model.global.get(key);
	}

	const machineMode = computed<MachineMode>(() => {
		const value = get("machine_mode");
		if (value === "automatic" || value === "default") {
			return value;
		}
		return value === undefined || value === null ? "unknown" : "default";
	});
	const isAutomatic = computed(() => machineMode.value === "automatic");

	const doorLeftOpen = computed(() => truthy(get("door_left_open")));
	const doorRightOpen = computed(() => truthy(get("door_right_open")));
	// The daemon only upgrades to automatic mode once both doors have been opened and closed
	// again since boot (or since the last job): these flags are that interlock
	const doorLeftChecked = computed(() => truthy(get("door_left_switch_checked")));
	const doorRightChecked = computed(() => truthy(get("door_right_switch_checked")));
	const machineIsHot = computed(() => truthy(get("machine_is_hot")));
	const potentialUnsafeState = computed(() => truthy(get("potential_unsafe_state")));

	/** Installed nozzle diameter per tool number (mm), null when unknown */
	function nozzleDiameter(tool: number): number | null {
		const value = get("nozzle_diameter");
		if (Array.isArray(value)) {
			const entry = value[tool];
			return typeof entry === "number" ? entry : null;
		}
		return typeof value === "number" && tool === 0 ? value : null;
	}

	/** Entry of a per-tool global array (globals.g sizes them for two tools) */
	function perTool(key: string, tool: number): unknown {
		const value = get(key);
		return Array.isArray(value) ? value[tool] : undefined;
	}
	function positive(value: unknown): number | null {
		return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
	}

	/** Installed nozzle type per tool, null when not recorded */
	function nozzleType(tool: number): NozzleType | null {
		const value = perTool("nozzle_type", tool);
		return isKey(NOZZLE_TYPES, value) ? value : null;
	}

	/** Filament diameter the tool is built for (mm), null when unknown */
	function filamentDiameter(tool: number): number | null {
		return positive(perTool("filament_diameter", tool));
	}

	/** Surface of the installed build plate, null when not recorded */
	const bedSurface = computed<BedSurface | null>(() => {
		const value = get("bed_surface");
		return isKey(BED_SURFACES, value) ? value : null;
	});

	/**
	 * Spool recorded for a tool, null when none was entered (net weight 0). Unloading filament
	 * does not clear it, so callers only show it while the tool has filament loaded
	 */
	function spool(tool: number): SpoolState | null {
		const netWeight = positive(perTool("spool_net_weight", tool));
		if (netWeight === null) {
			return null;
		}
		return {
			netWeight,
			remaining: positive(perTool("spool_remaining", tool)) ?? 0,
			density: positive(perTool("spool_density", tool)) ?? 0
		};
	}

	/** Whether the machine exposes the Meltingplot globals at all */
	const available = computed(() => get("machine_mode") !== undefined);

	return {
		get, machineMode, isAutomatic, doorLeftOpen, doorRightOpen, doorLeftChecked, doorRightChecked,
		machineIsHot, potentialUnsafeState, nozzleDiameter, nozzleType, filamentDiameter, bedSurface, spool, available
	};
}
