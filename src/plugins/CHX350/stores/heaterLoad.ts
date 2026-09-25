import { HeaterState, MachineStatus, type Heater, type Tool } from "@duet3d/objectmodel";
import { defineStore } from "pinia";
import { ref } from "vue";

import { useMachineStore } from "@/stores/machine";

/**
 * Load (PWM share of the heater's maximum) a nozzle heater may need on average while printing.
 * A heater that constantly needs more has too little headroom left for a stable process: the
 * melt rate asks more than it can deliver, the temperature sags at the next demand peak
 */
export const LOAD_HIGH = 0.8;
export const LOAD_LIMIT = 0.9;
/** A level only clears once the mean has dropped this far below its threshold, so the banner does not flicker */
const HYSTERESIS = 0.05;
/** RRF smooths avgPwm over a few seconds only; "constantly" is judged over this window */
const WINDOW_MS = 60_000;
const SAMPLE_MS = 1000;
/** Samples the window needs before its mean counts (a background tab samples less often) */
const MIN_SAMPLES = 45;
/** The setpoint counts as reached within this band; the heater is sampled from then on */
const REACHED_TOLERANCE = 2;

export type LoadLevel = "high" | "limit";

export interface NozzleLoad {
	heater: number;
	/** Tool the nozzle is named after (see useTemps().nozzles) */
	tool: number;
	/** Mean load over the window, null until the window holds enough samples */
	mean: number | null;
	level: LoadLevel | null;
}

interface Track {
	setpoint: number;
	/** The heater has reached the setpoint: the heat-up phase at full power is not counted */
	reached: boolean;
	samples: Array<{ time: number; load: number }>;
	level: LoadLevel | null;
}

/** Current load of a heater (0..1): avgPwm against the PWM cap set by M307 */
export function heaterLoad(heater: Heater | null | undefined): number | null {
	if (!heater) {
		return null;
	}
	const maxPwm = heater.model.maxPwm > 0 ? heater.model.maxPwm : 1;
	return Math.min(1, Math.max(0, heater.avgPwm / maxPwm));
}

export function formatLoad(load: number | null | undefined): string {
	return load === null || load === undefined ? "—" : `${Math.round(load * 100)} %`;
}

export function loadLevel(mean: number, previous: LoadLevel | null): LoadLevel | null {
	const limit = previous === "limit" ? LOAD_LIMIT - HYSTERESIS : LOAD_LIMIT;
	const high = previous !== null ? LOAD_HIGH - HYSTERESIS : LOAD_HIGH;
	return mean >= limit ? "limit" : (mean >= high ? "high" : null);
}

/**
 * Sustained load of the nozzle heaters while a job prints. Only the time at the setpoint counts:
 * a setpoint change (first-layer temperature, standby → active on the IDEX) starts over, and so
 * does a pause. A temperature that sags below the setpoint after it was reached keeps counting,
 * that is the overload case itself
 */
export const useHeaterLoadStore = defineStore("chx350HeaterLoad", () => {
	const machineStore = useMachineStore();
	const tracks = new Map<number, Track>();
	const nozzles = ref<Array<NozzleLoad>>([]);

	/** Nozzle heaters, named after the first tool that heats only this nozzle (as useTemps().nozzles) */
	function nozzleHeaters(): Map<number, number> {
		const result = new Map<number, number>();
		machineStore.model.tools
			.filter((t): t is Tool => t !== null)
			.sort((a, b) => a.heaters.length - b.heaters.length || a.number - b.number)
			.forEach((tool) => tool.heaters.forEach((h) => { if (!result.has(h)) result.set(h, tool.number); }));
		return result;
	}

	function sample() {
		const now = Date.now();
		const printing = machineStore.isConnected && machineStore.model.state.status === MachineStatus.processing;
		const heaters = printing ? nozzleHeaters() : new Map<number, number>();
		const result: Array<NozzleLoad> = [];
		for (const index of tracks.keys()) {
			if (!heaters.has(index)) {
				tracks.delete(index);
			}
		}
		for (const [index, tool] of heaters) {
			const heater = machineStore.model.heat.heaters[index];
			const load = heaterLoad(heater);
			if (!heater || load === null || heater.state !== HeaterState.active || heater.active <= 0) {
				tracks.delete(index);
				continue;
			}
			let track = tracks.get(index);
			if (!track || track.setpoint !== heater.active) {
				track = { setpoint: heater.active, reached: false, samples: [], level: null };
				tracks.set(index, track);
			}
			track.reached ||= heater.current >= heater.active - REACHED_TOLERANCE;
			if (!track.reached) {
				continue;
			}
			track.samples.push({ time: now, load });
			while (track.samples.length > 0 && track.samples[0].time < now - WINDOW_MS) {
				track.samples.shift();
			}
			const mean = track.samples.length >= MIN_SAMPLES
				? track.samples.reduce((sum, s) => sum + s.load, 0) / track.samples.length
				: null;
			track.level = mean !== null ? loadLevel(mean, track.level) : null;
			result.push({ heater: index, tool, mean, level: track.level });
		}
		nozzles.value = result;
	}

	setInterval(sample, SAMPLE_MS);

	return { nozzles };
});
