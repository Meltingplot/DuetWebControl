import { computed } from "vue";

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

	/** Whether the machine exposes the Meltingplot globals at all */
	const available = computed(() => get("machine_mode") !== undefined);

	return { get, machineMode, isAutomatic, doorLeftOpen, doorRightOpen, machineIsHot, potentialUnsafeState, nozzleDiameter, available };
}
