import { computed, ref, shallowRef, watch, type Ref } from "vue";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { getErrorMessage } from "@/utils/errors";

import { qa, type QaJobEntry, type QaLayer, type QaLayers } from "../api";
import type { JobLayers, LayerChannel } from "./useJobAnalysis";

export interface RecordedJobAnalysis extends JobLayers {
	/** QA's entry of the job (file, result, print time) */
	job: Ref<QaJobEntry | null>;
	loading: Ref<boolean>;
	error: Ref<string | null>;
}

/** Sum over every extruder that has a value; null when none has */
function sumOf(record: Record<string, number | null | undefined>): number | null {
	let sum: number | null = null;
	for (const value of Object.values(record)) {
		if (value !== null && value !== undefined && Number.isFinite(value)) {
			sum = (sum ?? 0) + value;
		}
	}
	return sum;
}

function filamentOf(layer: QaLayer): number | null {
	const perExtruder: Record<string, number | null> = {};
	for (const [extruder, f] of Object.entries(layer.filament ?? {})) {
		perExtruder[extruder] = f.extruderMm ?? f.commandedMm;
	}
	return sumOf(perExtruder);
}

/**
 * Volumetric flow from the extruder movement. QA's own flow uses the filament monitor's
 * totalExtrusion, which advances in steps of about 5 mm: on the CHX 350 a job of 87 layers
 * (2026-09-28, QA v0.1.0-rc.1) had 12 layers with flow 0 although the extruder fed filament.
 * QA's value stays the fallback for an extruder without diameter or extruder movement
 */
function flowOf(layer: QaLayer, diameters: Record<string, number | null>): number | null {
	const perExtruder: Record<string, number | null> = {};
	for (const [extruder, f] of Object.entries(layer.filament ?? {})) {
		const d = diameters[extruder];
		perExtruder[extruder] = d && f.extruderMm !== null && layer.durationS
			? Math.max(0, f.extruderMm) * Math.PI * (d / 2) ** 2 / layer.durationS
			: (layer.flow?.[extruder] ?? null);
	}
	return sumOf(perExtruder);
}

/**
 * Per-layer analysis of a job the quality-assurance plugin recorded, in the channels of the
 * object-model analysis plus QA's own: heater load per nozzle heater and the filament monitors.
 * Mapping from QA's docs/chx-integration.md §3 (v0.1.0-rc.1), except the flow (flowOf). Filament
 * and flow are summed over the extruders so a job printed with T1 (or two tools at once) counts too
 */
export function useRecordedJobAnalysis(jobId: Ref<string | null>): RecordedJobAnalysis {
	const machineStore = useMachineStore();
	const job = shallowRef<QaJobEntry | null>(null);
	const answer = shallowRef<QaLayers | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);

	// A newer id supersedes a request still under way
	let request = 0;
	watch(jobId, async (id) => {
		const current = ++request;
		job.value = null;
		answer.value = null;
		error.value = null;
		loading.value = id !== null;
		if (id === null) {
			return;
		}
		try {
			const [entry, layers] = await Promise.all([qa.job(id), qa.layers(id)]);
			if (current === request) {
				job.value = entry;
				answer.value = layers;
			}
		} catch (e) {
			if (current === request) {
				error.value = getErrorMessage(e);
			}
		} finally {
			if (current === request) {
				loading.value = false;
			}
		}
	}, { immediate: true });

	const layers = computed(() => answer.value?.layers ?? []);
	const count = computed(() => layers.value.length);

	// QA's z is the cumulative height; a layer without one continues from the last by its thickness
	const heights = computed(() => {
		let z = 0;
		return layers.value.map((l) => (z = l.z ?? z + (l.height ?? 0)));
	});

	const cumulativeFilament = computed(() => {
		let sum = 0;
		return layers.value.map((l) => (sum += filamentOf(l) ?? 0));
	});

	/** Tool label of an extruder from the machine's tool list, else the extruder number */
	function extruderLabel(extruder: number): string {
		const tool = machineStore.model.tools.find((t) => t !== null && t.extruders.includes(extruder));
		return tool ? `T${tool.number}` : `E${extruder}`;
	}

	function hasData(values: Array<number | null>): boolean {
		return values.some((v) => v !== null);
	}

	const sensorChannels = computed<Array<LayerChannel>>(() => {
		const result: Array<LayerChannel> = [];
		for (const sensor of answer.value?.meta.sensors ?? []) {
			const values = layers.value.map((l) => l.temps?.sensors?.[sensor.index]?.mean ?? null);
			if (hasData(values)) {
				result.push({
					key: `sensor${sensor.index}`,
					label: sensor.name || `Sensor ${sensor.index}`,
					translated: true,
					unit: "°C",
					values,
					precision: 1
				});
			}
		}
		return result;
	});

	const channels = computed<Array<LayerChannel>>(() => {
		const result: Array<LayerChannel> = [
			{
				key: "duration",
				label: "plugins.CHX350.analysis.channelDuration",
				translated: false,
				unit: "s",
				values: layers.value.map((l) => l.durationS),
				precision: 0
			},
			{
				key: "filament",
				label: "plugins.CHX350.analysis.channelFilament",
				translated: false,
				unit: "mm",
				values: layers.value.map(filamentOf),
				precision: 0
			},
			{
				key: "flow",
				label: "plugins.CHX350.analysis.channelFlow",
				translated: false,
				unit: "mm³/s",
				values: layers.value.map((l) => flowOf(l, answer.value?.meta.filamentDiameters ?? {})),
				precision: 1
			},
			...sensorChannels.value
		];

		// Heater load of the nozzle heaters that reached a setpoint in this job, in percent
		for (const heater of answer.value?.meta.heaters ?? []) {
			if (heater.role !== "nozzle") {
				continue;
			}
			const tool = heater.tool !== null ? `T${heater.tool}` : `H${heater.index}`;
			const load = layers.value.map((l) => l.loadStats?.[heater.index] ?? null);
			const mean = load.map((s) => (s ? s.mean * 100 : null));
			if (!hasData(mean)) {
				continue;
			}
			result.push({
				key: `load${heater.index}`,
				label: i18n.global.t("plugins.CHX350.analysis.channelHeaterLoad", { tool }),
				translated: true,
				unit: "%",
				values: mean,
				range: [0, 100],
				precision: 0
			}, {
				key: `loadHigh${heater.index}`,
				label: i18n.global.t("plugins.CHX350.analysis.channelHeaterLoadHigh", { tool }),
				translated: true,
				unit: "%",
				values: load.map((s) => (s ? s.shareHigh * 100 : null)),
				range: [0, 100],
				precision: 0
			});
		}

		// Filament monitors of the extruders that fed filament in this job
		const monitors = new Set<string>();
		for (const l of layers.value) {
			for (const [monitor, f] of Object.entries(l.filament ?? {})) {
				if ((f.extruderMm ?? f.commandedMm ?? 0) > 0 && l.fmStats?.[monitor]) {
					monitors.add(monitor);
				}
			}
		}
		for (const monitor of [...monitors].sort((a, b) => Number(a) - Number(b))) {
			const tool = extruderLabel(Number(monitor));
			result.push({
				key: `monitor${monitor}`,
				label: i18n.global.t("plugins.CHX350.analysis.channelMonitor", { tool }),
				translated: true,
				unit: "%",
				values: layers.value.map((l) => l.fmStats?.[monitor]?.mean ?? null),
				precision: 0
			}, {
				key: `monitorAvg${monitor}`,
				label: i18n.global.t("plugins.CHX350.analysis.channelMonitorAvg", { tool }),
				translated: true,
				unit: "%",
				values: layers.value.map((l) => l.fmStats?.[monitor]?.avgPercentage ?? null),
				precision: 0
			});
		}
		return result;
	});

	// QA names the chamber: a sensor, or the chamber heater (its sensor's channel, else the
	// chamber aggregate QA keeps per layer)
	const chamberChannel = computed<LayerChannel | null>(() => {
		const chamber = answer.value?.meta.chamber;
		if (!chamber) {
			return null;
		}
		const sensor = chamber[0] === "sensor"
			? chamber[1]
			: (answer.value?.meta.heaters.find((h) => h.index === chamber[1])?.sensor ?? null);
		const channel = sensor !== null ? sensorChannels.value.find((c) => c.key === `sensor${sensor}`) : undefined;
		if (channel) {
			return channel;
		}
		const values = layers.value.map((l) => l.temps?.chamber?.mean ?? null);
		return hasData(values)
			? { key: "chamber", label: "plugins.CHX350.header.chamber", translated: false, unit: "°C", values, precision: 1 }
			: null;
	});

	const currentIndex = computed(() => Math.max(0, count.value - 1));

	return { job, loading, error, count, heights, cumulativeFilament, channels, chamberChannel, currentIndex };
}
