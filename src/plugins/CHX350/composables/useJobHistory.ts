import { computed, ref } from "vue";

import { useMachineStore } from "@/stores/machine";
import { isPrinting } from "@/utils/enums";
import { extractFileName } from "@/utils/path";

import { api, backendAvailable, type HistoryEntry } from "../api";

export interface JobHistoryItem {
	file: string;
	name: string;
	result: "running" | "finished" | "cancelled" | "aborted";
	printTimeS: number | null;
	timestamp: Date | null;
	/** Whether the layer analysis (object model) is available for this entry */
	analysable: boolean;
}

/**
 * Job history: the running/last job from the object model on top, the firmware event log
 * (parsed by the SBC backend) below. The quality-assurance plugin will replace the log source
 * with its own records later - this composable is the seam
 */
export function useJobHistory() {
	const machineStore = useMachineStore();
	const entries = ref<Array<HistoryEntry>>([]);
	const loading = ref(false);
	const error = ref<string | null>(null);

	async function load() {
		if (!machineStore.isConnected) {
			return;
		}
		loading.value = true;
		error.value = null;
		try {
			const result = await api.history(100);
			entries.value = result.entries ?? [];
		} catch (e) {
			entries.value = [];
			error.value = String((e as Error)?.message ?? e);
		} finally {
			loading.value = false;
		}
	}

	const current = computed<JobHistoryItem | null>(() => {
		const job = machineStore.model.job;
		const status = machineStore.model.state.status;
		if (isPrinting(status) && job.file?.fileName) {
			return { file: job.file.fileName, name: extractFileName(job.file.fileName), result: "running", printTimeS: job.duration, timestamp: null, analysable: true };
		}
		if (job.lastFileName) {
			return {
				file: job.lastFileName,
				name: extractFileName(job.lastFileName),
				result: job.lastFileAborted ? "aborted" : (job.lastFileCancelled ? "cancelled" : "finished"),
				printTimeS: job.lastDuration,
				timestamp: null,
				analysable: machineStore.model.job.layers.length > 0
			};
		}
		return null;
	});

	const items = computed<Array<JobHistoryItem>>(() => {
		const list: Array<JobHistoryItem> = [];
		if (current.value) {
			list.push(current.value);
		}
		for (const e of entries.value) {
			// Skip the log line that describes the same job as the object model's last job
			if (current.value && current.value.result !== "running" && list.length === 1 && e.file === current.value.file) {
				list[0].timestamp = e.timestamp ? new Date(e.timestamp) : null;
				continue;
			}
			list.push({
				file: e.file,
				name: extractFileName(e.file),
				result: e.result,
				printTimeS: e.printTimeS,
				timestamp: e.timestamp ? new Date(e.timestamp) : null,
				analysable: false
			});
		}
		return list;
	});

	return { items, current, loading, error, backendAvailable, load };
}
