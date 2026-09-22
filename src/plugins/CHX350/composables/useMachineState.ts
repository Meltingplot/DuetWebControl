import { HeaterState, MachineStatus, type Heater } from "@duet3d/objectmodel";
import { computed } from "vue";

import { useMachineStore } from "@/stores/machine";
import { useUiStore } from "@/stores/ui";
import { isPaused, isPrinting } from "@/utils/enums";

import { useChxGlobals } from "./useChxGlobals";

/** Operator-facing machine state shown on the header plate */
export type PlateState = "estop" | "paused" | "printing" | "busy" | "heating" | "automatic" | "idle" | "offline";

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
	const busy = computed(() => status.value !== MachineStatus.idle);
	// A heater is heating when it is below the setpoint that applies to its state: a tool parked
	// in standby is compared with its standby temperature, not with the active one
	const heating = computed(() => !printing.value && heaters.value.some((h) => {
		const setpoint = h.state === HeaterState.active ? h.active : (h.state === HeaterState.standby ? h.standby : 0);
		return setpoint > 0 && h.current < setpoint - 2;
	}));
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
		// A running macro (e.g. calibrate E-steps) outranks heating: the bed may warm up as a side
		// effect, but the operator has to know that the machine is executing something
		if (busy.value) {
			return "busy";
		}
		if (heating.value) {
			return "heating";
		}
		if (globals.isAutomatic.value && !doorOpen.value) {
			return "automatic";
		}
		return "idle";
	});

	const uiFrozen = computed(() => uiStore.uiFrozen);

	/**
	 * Axis moves from the UI are permitted in automatic mode only. The mode is the single source of
	 * truth: the firmware drops to default mode itself when a door opens, and a "busy" status must
	 * not lock the controls because that is exactly what a running axis move looks like
	 */
	const axesLocked = computed(() => uiFrozen.value || !globals.isAutomatic.value);

	const machineIsHot = computed(() => globals.machineIsHot.value);

	/**
	 * Default mode because the door interlock has not been confirmed yet: the operator has to open
	 * and close both doors once before the daemon switches to automatic mode
	 */
	const doorCheckPending = computed(() => !globals.isAutomatic.value && globals.available.value
		&& !(globals.doorLeftChecked.value && globals.doorRightChecked.value));

	return {
		status, connected, uiFrozen,
		doorOpen, doorCheckPending, heaterFaults, heaters, heatersOn,
		printing, paused, halted, heating, busy,
		plate, axesLocked, machineIsHot,
		machineMode: globals.machineMode,
		isAutomatic: globals.isAutomatic
	};
}
