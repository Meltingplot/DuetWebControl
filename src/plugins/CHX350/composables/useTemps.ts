import { HeaterState, type AnalogSensor, type Heater, type Tool } from "@duet3d/objectmodel";
import { computed } from "vue";

import { useMachineStore } from "@/stores/machine";

import { useChxGlobals } from "./useChxGlobals";

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
	extruderIndex: number;
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
				extruderIndex
			};
		}));

	const maxTemperature = computed(() => {
		const values = [bedCurrent.value, chamberCurrent.value, ...tools.value.map((t) => t.current)]
			.filter((v): v is number => typeof v === "number");
		return values.length > 0 ? Math.max(...values) : null;
	});

	return { bedHeater, bedCurrent, bedActive, chamberHeater, hasChamberHeater, chamberCurrent, chamberSource, szpSensor, tools, maxTemperature };
}

export function formatTemp(value: number | null | undefined, digits = 1): string {
	if (value === null || value === undefined || !Number.isFinite(value) || value < -50) {
		return "—";
	}
	return `${value.toFixed(digits)} °C`;
}
