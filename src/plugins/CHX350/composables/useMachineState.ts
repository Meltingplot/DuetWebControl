import { HeaterState, MachineStatus, type Heater } from "@duet3d/objectmodel";
import { computed } from "vue";

import { useMachineStore } from "@/stores/machine";
import { useUiStore } from "@/stores/ui";
import { isPaused, isPrinting } from "@/utils/enums";

import { useChxGlobals } from "./useChxGlobals";

/** Operator-facing machine state shown on the header plate */
export type PlateState = "estop" | "paused" | "printing" | "heating" | "automatic" | "idle" | "offline";

/** Door switch inputs (sensors.gpIn indices) on the CHX 350; 1 = closed, 0 = open */
const DOOR_INPUTS = [2, 3];

export function useMachineState() {
	const machineStore = useMachineStore();
	const uiStore = useUiStore();
	const globals = useChxGlobals();

	const status = computed(() => machineStore.model.state.status);
	const connected = computed(() => machineStore.isConnected);

	const doorOpen = computed(() => {
		if (globals.doorLeftOpen.value || globals.doorRightOpen.value) {
			return true;
		}
		const gpIn = machineStore.model.sensors.gpIn;
		return DOOR_INPUTS.some((index) => {
			const port = gpIn[index];
			return port !== null && port !== undefined && port.value === 0;
		});
	});

	const heaters = computed(() => machineStore.model.heat.heaters.filter((h): h is Heater => h !== null));
	const heaterFaults = computed(() => machineStore.model.heat.heaters
		.map((heater, index) => ({ heater, index }))
		.filter((entry) => entry.heater !== null && entry.heater.state === HeaterState.fault)
		.map((entry) => entry.index));

	const printing = computed(() => isPrinting(status.value));
	const paused = computed(() => isPaused(status.value));
	const halted = computed(() => status.value === MachineStatus.halted);
	const heating = computed(() => !printing.value && heaters.value.some((h) =>
		(h.state === HeaterState.active || h.state === HeaterState.standby) && h.active > 0 && h.current < h.active - 2));
	const heatersOn = computed(() => heaters.value.some((h) => h.state === HeaterState.active || h.state === HeaterState.standby));

	const plate = computed<PlateState>(() => {
		if (!connected.value || status.value === MachineStatus.disconnected) {
			return "offline";
		}
		if (halted.value) {
			return "estop";
		}
		if (paused.value) {
			return "paused";
		}
		if (printing.value) {
			return "printing";
		}
		if (heating.value) {
			return "heating";
		}
		if (globals.isAutomatic.value && !doorOpen.value) {
			return "automatic";
		}
		return "idle";
	});

	const busy = computed(() => status.value !== MachineStatus.idle);
	const uiFrozen = computed(() => uiStore.uiFrozen);

	/** Axis moves from the UI are only permitted in automatic mode with closed doors and an idle machine */
	const axesLocked = computed(() => uiFrozen.value || !globals.isAutomatic.value || doorOpen.value || busy.value);

	const machineIsHot = computed(() => globals.machineIsHot.value);

	return {
		status, connected, uiFrozen,
		doorOpen, heaterFaults, heaters, heatersOn,
		printing, paused, halted, heating, busy,
		plate, axesLocked, machineIsHot,
		machineMode: globals.machineMode,
		isAutomatic: globals.isAutomatic
	};
}
