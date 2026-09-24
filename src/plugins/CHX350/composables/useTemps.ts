import { HeaterState, type AnalogSensor, type Heater, type Tool } from "@duet3d/objectmodel";
import { computed } from "vue";

import { useMachineStore } from "@/stores/machine";

import { useChxGlobals, type NozzleType, type SpoolState } from "./useChxGlobals";

/** Analog sensor name the CHX 350 uses for the scanning Z probe coil (doubles as chamber reading) */
const SZP_SENSOR_NAME = "szp coil";

export interface ToolTemps {
	tool: Tool;
	number: number;
	heater: Heater | null;
	current: number | null;
	active: number | null;
	standby: number | null;
	state: HeaterState | null;
	/** Loaded filament name ("" when none) */
	filament: string;
	nozzleDiameter: number | null;
	nozzleType: NozzleType | null;
	/** Filament diameter the tool is built for (mm): the machine global, else the extruder's M404 value */
	filamentDiameter: number | null;
	/** Mounted spool, null when none was recorded or no filament is loaded */
	spool: SpoolState | null;
	extruderIndex: number;
}

/**
 * A nozzle is a tool heater. A tool that prints with two nozzles at once shares the heaters of the
 * single-nozzle tools, so nozzles are counted by heater rather than by tool
 */
export interface NozzleTemp {
	heater: number;
	/** Tool the nozzle is named after: the first tool that heats only this nozzle, else the first that heats it */
	tool: number;
	current: number | null;
	/** The nozzle belongs to the selected tool */
	selected: boolean;
	/** The nozzle is selected, or its heater is on (not standby) */
	inUse: boolean;
}

export function useTemps() {
	const machineStore = useMachineStore();
	const globals = useChxGlobals();

	function heater(index: number | null | undefined): Heater | null {
		if (index === null || index === undefined || index < 0) {
			return null;
		}
		return machineStore.model.heat.heaters[index] ?? null;
	}

	const bedHeater = computed(() => heater(machineStore.bedHeaterMapping[0]?.[0]));
	const chamberHeater = computed(() => heater(machineStore.chamberHeaterMapping[0]?.[0]));
	const hasChamberHeater = computed(() => chamberHeater.value !== null);

	const szpSensor = computed<AnalogSensor | null>(() =>
		machineStore.model.sensors.analog.find((s) => s !== null && (s.name ?? "").trim().toLowerCase() === SZP_SENSOR_NAME) ?? null);

	/** Chamber reading: the chamber heater when configured, else the SZP coil sensor */
	const chamberCurrent = computed<number | null>(() =>
		chamberHeater.value?.current ?? szpSensor.value?.lastReading ?? null);
	const chamberSource = computed<"heater" | "szp" | "none">(() =>
		chamberHeater.value ? "heater" : (szpSensor.value ? "szp" : "none"));

	const bedCurrent = computed(() => bedHeater.value?.current ?? null);
	const bedActive = computed(() => bedHeater.value?.active ?? null);

	const tools = computed<Array<ToolTemps>>(() => machineStore.model.tools
		.filter((t): t is Tool => t !== null)
		.map((tool) => {
			const h = heater(tool.heaters[0]);
			const extruderIndex = tool.filamentExtruder >= 0 ? tool.filamentExtruder : (tool.extruders[0] ?? -1);
			const extruder = extruderIndex >= 0 ? machineStore.model.move.extruders[extruderIndex] : null;
			return {
				tool,
				number: tool.number,
				heater: h,
				current: h?.current ?? null,
				active: tool.active[0] ?? h?.active ?? null,
				standby: tool.standby[0] ?? h?.standby ?? null,
				state: h?.state ?? null,
				filament: extruder?.filament ?? "",
				nozzleDiameter: globals.nozzleDiameter(tool.number),
				nozzleType: globals.nozzleType(tool.number),
				filamentDiameter: globals.filamentDiameter(tool.number) ?? extruder?.filamentDiameter ?? null,
				spool: extruder?.filament ? globals.spool(tool.number) : null,
				extruderIndex
			};
		}));

	const nozzles = computed<Array<NozzleTemp>>(() => {
		const currentTool = machineStore.model.state.currentTool;
		const result = new Map<number, NozzleTemp>();
		const tools = machineStore.model.tools
			.filter((t): t is Tool => t !== null)
			.sort((a, b) => a.heaters.length - b.heaters.length || a.number - b.number);
		for (const tool of tools) {
			for (const index of tool.heaters) {
				let nozzle = result.get(index);
				if (nozzle === undefined) {
					const h = heater(index);
					const on = h?.state === HeaterState.active || h?.state === HeaterState.tuning;
					nozzle = { heater: index, tool: tool.number, current: h?.current ?? null, selected: false, inUse: on };
					result.set(index, nozzle);
				}
				if (tool.number === currentTool) {
					nozzle.selected = nozzle.inUse = true;
				}
			}
		}
		return [...result.values()].sort((a, b) => a.tool - b.tool);
	});

	const maxTemperature = computed(() => {
		const values = [bedCurrent.value, chamberCurrent.value, ...tools.value.map((t) => t.current)]
			.filter((v): v is number => typeof v === "number");
		return values.length > 0 ? Math.max(...values) : null;
	});

	return { bedHeater, bedCurrent, bedActive, chamberHeater, hasChamberHeater, chamberCurrent, chamberSource, szpSensor, tools, nozzles, maxTemperature };
}

/** Where a heater stands against the setpoint of its state (standby compares with the standby value) */
export type HeaterPhase = "off" | "heating" | "cooling" | "reached";

export function heaterPhase(heater: Heater | null | undefined, tolerance = 2): HeaterPhase {
	if (!heater) {
		return "off";
	}
	const setpoint = heater.state === HeaterState.active ? heater.active : (heater.state === HeaterState.standby ? heater.standby : 0);
	if (setpoint <= 0 || (heater.state !== HeaterState.active && heater.state !== HeaterState.standby)) {
		return "off";
	}
	if (heater.current < setpoint - tolerance) {
		return "heating";
	}
	return heater.current > setpoint + 2 * tolerance ? "cooling" : "reached";
}

export function formatTemp(value: number | null | undefined, digits = 1): string {
	if (value === null || value === undefined || !Number.isFinite(value) || value < -50) {
		return "—";
	}
	return `${value.toFixed(digits)} °C`;
}
