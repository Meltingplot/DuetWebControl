import type { Fan, Tool } from "@duet3d/objectmodel";
import { computed } from "vue";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";

import { useChxGlobals } from "./useChxGlobals";
import { useMachineState } from "./useMachineState";
import { sendChecked } from "./useMacroRunner";

/*
 * What the UI offers is decided by the machine configuration (chx350-config, sys/meltingplot/fan/),
 * which owns all fan logic: the exhaust run-on, switching off fans left on while idle, and the watch
 * over the fan tachos. The UI reads the outcome from these globals; none of them is bit-flip hardened
 */
/** Fan numbers the operator may set (config.g enables a fan where it creates it) */
const GLOBAL_ADJUSTABLE_FANS = "fan_adjustable";
/** state.upTime (s) until which the exhaust runs on by itself; 0 or past = no run-on */
const GLOBAL_EXHAUST_UNTIL = "fan_exhaust_until";
/** Fan numbers whose tacho reports a standstill although the fan is driven; clears by itself */
const GLOBAL_STALLED_FANS = "fan_stalled";

/** i18n keys (below plugins.CHX350.fans.name) of the CHX 350 fans by their M106 C name */
const FAN_NAMES: Record<string, string> = {
	"part cooling": "partCooling",
	"part cooling #2": "partCooling2",
	"aux": "aux",
	"exhaust": "exhaust",
	"lower radiator": "lowerRadiator",
	"upper radiator": "upperRadiator",
	"water pump": "waterPump"
};

export interface FanInfo {
	index: number;
	label: string;
	/** Value set by M106 S (0..1) */
	value: number;
	/** PWM the fan runs at (0..1) */
	actual: number;
	/** Measured speed, null when the fan has no tacho */
	rpm: number | null;
	/** Controlled by temperature; RRF ignores M106 S for it */
	thermostatic: boolean;
}

function numberList(value: unknown): Array<number> | null {
	return Array.isArray(value) ? value.filter((n): n is number => Number.isInteger(n) && n >= 0) : null;
}

export function fanLabel(fan: Fan, index: number): string {
	const key = FAN_NAMES[fan.name.trim().toLowerCase()];
	if (key !== undefined) {
		return i18n.global.t(`plugins.CHX350.fans.name.${key}`);
	}
	return fan.name || i18n.global.t("plugins.CHX350.fans.name.fallback", { n: index });
}

export function formatPercent(value: number): string {
	return `${Math.round(value * 100)} %`;
}

export function useFans() {
	const machineStore = useMachineStore();
	const globals = useChxGlobals();
	const state = useMachineState();

	// The part cooling fans of several tools share a name; the tool number tells them apart
	const tools = computed(() => machineStore.model.tools.filter((t): t is Tool => t !== null));
	function label(fan: Fan, index: number): string {
		const tool = tools.value.length > 1 ? tools.value.find((t) => t.fans.includes(index)) : undefined;
		return tool ? `${fanLabel(fan, index)} T${tool.number}` : fanLabel(fan, index);
	}

	const all = computed<Array<FanInfo>>(() => machineStore.model.fans.flatMap((fan, index) => fan === null ? [] : [{
		index,
		label: label(fan, index),
		value: fan.requestedValue,
		actual: fan.actualValue,
		rpm: fan.rpm >= 0 ? fan.rpm : null,
		thermostatic: fan.thermostatic.sensors.length > 0
	}]));

	/**
	 * Without the global (an older machine configuration) only the part cooling fans of the tools
	 * are offered: the exhaust must never be switched from here
	 */
	const adjustableIndices = computed(() => numberList(globals.get(GLOBAL_ADJUSTABLE_FANS))
		?? tools.value.flatMap((tool) => tool.fans));

	/** A thermostatic fan is left out even when listed: it would ignore the value */
	const adjustable = computed(() => all.value.filter((f) => !f.thermostatic && adjustableIndices.value.includes(f.index)));
	const automatic = computed(() => all.value.filter((f) => !adjustable.value.includes(f)));
	const running = computed(() => adjustable.value.filter((f) => f.value > 0).length);

	/**
	 * Seconds left of the exhaust run-on, null when none is running. The value is read live: an
	 * opened door extends it, and it may lag behind upTime until the machine resets it to 0
	 */
	const exhaustRunOn = computed(() => {
		const until = globals.get(GLOBAL_EXHAUST_UNTIL);
		if (typeof until !== "number" || until <= 0) {
			return null;
		}
		const left = Math.ceil(until - machineStore.model.state.upTime);
		return left > 0 ? left : null;
	});

	const stalled = computed(() => {
		const indices = numberList(globals.get(GLOBAL_STALLED_FANS)) ?? [];
		return all.value.filter((f) => indices.includes(f.index));
	});

	/**
	 * While a job is paused, resume.g's M106 R1 sets the part cooling fans of the paused tool back
	 * to the value they had when the pause began; a value set in between is lost then. Null when
	 * this does not apply to the fan
	 */
	function resumeValue(index: number): number | null {
		const point = state.jobPaused.value ? machineStore.model.move.motionSystems[0]?.restorePoints[1] : null;
		if (!point) {
			return null;
		}
		const fans = (point.toolNumber >= 0) ? (machineStore.model.tools[point.toolNumber]?.fans ?? []) : [0];
		return fans.includes(index) ? point.fanPwm : null;
	}

	async function setFan(index: number, percent: number) {
		const value = Math.min(100, Math.max(0, Math.round(percent))) / 100;
		await sendChecked(`M106 P${index} S${value.toFixed(2)}`, false);
	}

	return { all, adjustable, automatic, running, exhaustRunOn, stalled, resumeValue, setFan };
}
