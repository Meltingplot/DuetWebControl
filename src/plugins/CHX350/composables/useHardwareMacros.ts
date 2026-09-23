import { MachineStatus } from "@duet3d/objectmodel";
import { computed, type Ref } from "vue";

import { useMachineStore } from "@/stores/machine";

import { useChxGlobals } from "./useChxGlobals";
import { useMachineState } from "./useMachineState";
import { useMacroRunner } from "./useMacroRunner";

/** Operator macros of the machine configuration (chx350-config 3.7) that record installed hardware */
const MACRO_DIR = "0:/macros/meltingplot/maintenance";

/**
 * Runners for the macros that record the nozzle, the spool and the build plate. The machine asks
 * with its own M291 prompts (recorded value preselected, cancel keeps it) and persists the answer
 * in sys/generated/, so the UI only starts them. Each is offered only when the configuration
 * declares the matching global, i.e. when the macro exists. They refuse while a job prints and
 * accept a paused job (nozzle swap after a clog, spool change)
 */
export function useHardwareMacros(spoolTool: Ref<number> = computed(() => 0)) {
	const machineStore = useMachineStore();
	const globals = useChxGlobals();
	const state = useMachineState();

	const allowed = computed(() => !state.uiFrozen.value && (!state.printing.value || state.status.value === MachineStatus.paused));

	function macro(name: string, params: Ref<string> = computed(() => "")) {
		return useMacroRunner(computed(() => `M98 P"${MACRO_DIR}/${name}"${params.value}`));
	}

	/**
	 * set-nozzle-diameter records diameter and type of the current tool of the motion system (it
	 * takes no T parameter), clamped to 0..1 like the macro does
	 */
	const nozzleTool = computed(() => Math.min(Math.max(machineStore.model.state.currentTool, 0), 1));
	const nozzle = macro("set-nozzle-diameter");
	const spool = macro("set-spool-size", computed(() => ` T${spoolTool.value}`));
	const bedSurface = macro("set-bed-surface");

	return {
		allowed,
		nozzle, nozzleTool, hasNozzle: computed(() => globals.get("nozzle_type") !== undefined),
		spool, hasSpool: computed(() => globals.get("spool_net_weight") !== undefined),
		bedSurface, hasBedSurface: computed(() => globals.get("bed_surface") !== undefined)
	};
}
