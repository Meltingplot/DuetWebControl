import type { AnalogSensor, Layer } from "@duet3d/objectmodel";
import { computed, type ComputedRef } from "vue";

import { useMachineStore } from "@/stores/machine";

/** A per-layer data channel derived from job.layers[] */
export interface LayerChannel {
	key: string;
	/** i18n key or literal label */
	label: string;
	translated: boolean;
	unit: string;
	values: Array<number | null>;
	/** Fixed display range, otherwise computed from the data */
	range?: [number, number];
	precision: number;
}

export interface LayerAnalysis {
	layers: ComputedRef<Array<Layer>>;
	/** Cumulative height (mm) after each layer */
	heights: ComputedRef<Array<number>>;
	/** Cumulative filament (mm) after each layer */
	cumulativeFilament: ComputedRef<Array<number>>;
	channels: ComputedRef<Array<LayerChannel>>;
	/** Sensor-based temperature channels resolved by sensor name */
	temperatureChannel: (predicate: (sensor: AnalogSensor, index: number) => boolean) => ComputedRef<LayerChannel | null>;
	/** Index of the layer currently printing (0-based) or the last one when idle */
	currentIndex: ComputedRef<number>;
}

/**
 * Per-layer analysis of the current (or last) job straight from the object model. RRF keeps
 * job.layers[] until the next job starts, so the last job stays analysable after it finished.
 * The QA plugin will later provide the same shape for historical jobs
 */
export function useJobAnalysis(): LayerAnalysis {
	const machineStore = useMachineStore();

	const layers = computed(() => machineStore.model.job.layers as Array<Layer>);

	const heights = computed(() => {
		let sum = 0;
		return layers.value.map((l) => (sum += l.height ?? 0));
	});

	const cumulativeFilament = computed(() => {
		let sum = 0;
		return layers.value.map((l) => (sum += l.filamentUsage ?? 0));
	});

	// job.layers[].temperatures: RRF documents the array as parallel to sensors.analog, yet boards
	// with gaps in the sensor list (null entries) report a compact array. Resolve the column of a
	// sensor for both layouts
	function temperatureColumn(sensorIndex: number): number | null {
		const analog = machineStore.model.sensors.analog;
		const sample = layers.value.find((l) => l.temperatures && l.temperatures.length > 0);
		if (!sample) {
			return null;
		}
		const count = sample.temperatures.length;
		if (count === analog.length) {
			return sensorIndex;
		}
		const nonNull = analog.map((s, i) => (s !== null ? i : -1)).filter((i) => i >= 0);
		if (count === nonNull.length) {
			const col = nonNull.indexOf(sensorIndex);
			return col >= 0 ? col : null;
		}
		return sensorIndex < count ? sensorIndex : null;
	}

	function temperatureChannel(predicate: (sensor: AnalogSensor, index: number) => boolean): ComputedRef<LayerChannel | null> {
		return computed(() => {
			const analog = machineStore.model.sensors.analog;
			const index = analog.findIndex((s, i) => s !== null && predicate(s, i));
			if (index < 0) {
				return null;
			}
			const col = temperatureColumn(index);
			if (col === null) {
				return null;
			}
			const sensor = analog[index]!;
			return {
				key: `sensor${index}`,
				label: sensor.name || `Sensor ${index}`,
				translated: true,
				unit: "°C",
				values: layers.value.map((l) => l.temperatures?.[col] ?? null),
				precision: 1
			};
		});
	}

	const channels = computed<Array<LayerChannel>>(() => {
		const result: Array<LayerChannel> = [
			{
				key: "duration",
				label: "plugins.CHX350.analysis.channelDuration",
				translated: false,
				unit: "s",
				values: layers.value.map((l) => l.duration ?? null),
				precision: 0
			},
			{
				key: "filament",
				label: "plugins.CHX350.analysis.channelFilament",
				translated: false,
				unit: "mm",
				values: layers.value.map((l) => l.filamentUsage ?? null),
				precision: 0
			},
			{
				key: "flow",
				label: "plugins.CHX350.analysis.channelFlow",
				translated: false,
				unit: "mm³/s",
				// Volumetric flow approximated from filament per layer and layer duration
				values: layers.value.map((l) => {
					const extruder = machineStore.model.move.extruders[0];
					const d = extruder?.filamentDiameter ?? 1.75;
					const area = Math.PI * (d / 2) ** 2;
					return l.duration > 0 && l.filamentUsage > 0 ? (l.filamentUsage * area) / l.duration : null;
				}),
				precision: 1
			}
		];
		// One channel per analog sensor that has data
		machineStore.model.sensors.analog.forEach((sensor, index) => {
			if (sensor === null) {
				return;
			}
			const col = temperatureColumn(index);
			if (col === null) {
				return;
			}
			result.push({
				key: `sensor${index}`,
				label: sensor.name || `Sensor ${index}`,
				translated: true,
				unit: "°C",
				values: layers.value.map((l) => l.temperatures?.[col] ?? null),
				precision: 1
			});
		});
		return result;
	});

	const currentIndex = computed(() => {
		const layer = machineStore.model.job.layer;
		if (layer !== null && layer > 0) {
			return Math.min(layer - 1, Math.max(0, layers.value.length - 1));
		}
		return Math.max(0, layers.value.length - 1);
	});

	return { layers, heights, cumulativeFilament, channels, temperatureChannel, currentIndex };
}

/** Meltingplot blue ramp used for per-layer colouring (dark = low, light = high) */
const RAMP = ["#002858", "#004276", "#0077AD", "#009AD7", "#66D0FF"];

function hex(h: string): [number, number, number] {
	return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

export function rampColor(u: number): string {
	u = Math.max(0, Math.min(1, Number.isFinite(u) ? u : 0));
	const x = u * (RAMP.length - 1);
	const i = Math.min(RAMP.length - 2, Math.floor(x));
	const f = x - i;
	const a = hex(RAMP[i]), b = hex(RAMP[i + 1]);
	return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

/** Min/max of a channel, honouring a fixed range; falls back to [0, 1] for empty data */
export function channelRange(channel: LayerChannel): [number, number] {
	if (channel.range) {
		return channel.range;
	}
	const values = channel.values.filter((v): v is number => v !== null && Number.isFinite(v));
	if (values.length === 0) {
		return [0, 1];
	}
	let min = Math.min(...values), max = Math.max(...values);
	if (max - min < 1e-6) {
		min -= 1;
		max += 1;
	}
	return [min, max];
}
