import { computed, ref } from "vue";

import { useMachineStore } from "@/stores/machine";
import { displaySize } from "@/utils/display";
import { isPrinting } from "@/utils/enums";
import { getErrorMessage } from "@/utils/errors";
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

const HISTORY_LIMIT = 100;

/** Same lines as dsf/chx350_eventlog.py parses: "<ts> Finished printing file <f>, print time was 1h 36m" */
const LOG_LINE_RE = /^(?:(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\s+)?(Finished|Cancelled) printing file (.+?)(?:, print time was ([\dhms ]+))?\s*$/;

function parsePrintTime(value: string | undefined): number | null {
	const m = /^\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?\s*$/.exec(value ?? "");
	if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) {
		return null;
	}
	return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** Parse the event log text into history entries, newest first (browser fallback of the backend) */
export function parseEventLog(text: string, limit = HISTORY_LIMIT): Array<HistoryEntry> {
	const entries: Array<HistoryEntry> = [];
	for (const raw of text.split("\n")) {
		const m = LOG_LINE_RE.exec(raw.trim());
		if (m) {
			entries.push({
				file: m[4],
				result: m[3] === "Finished" ? "finished" : "cancelled",
				printTimeS: parsePrintTime(m[5]),
				timestamp: m[1] ? `${m[1]}T${m[2]}` : null
			});
		}
	}
	return entries.reverse().slice(0, limit);
}

/** Largest event log the browser fallback downloads (the backend reads any size) */
const MAX_LOG_BYTES = 8 * 1024 * 1024;

/**
 * Job history: the running/last job from the object model on top, the firmware event log below.
 * The SBC backend parses the log; without it the browser downloads and parses the log itself.
 * The quality-assurance plugin will replace the log source with its own records later - this
 * composable is the seam
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
			const result = await api.history(HISTORY_LIMIT);
			entries.value = result.entries ?? [];
		} catch (e) {
			if (backendAvailable.value === false) {
				try {
					entries.value = await readEventLog();
				} catch (fallbackError) {
					entries.value = [];
					error.value = getErrorMessage(fallbackError);
				}
			} else {
				entries.value = [];
				error.value = getErrorMessage(e);
			}
		} finally {
			loading.value = false;
		}
	}

	/** Event log without the backend. Logging is off when the firmware has no log file (M929) */
	const loggingOff = computed(() => !machineStore.model.state.logFile);
	async function readEventLog(): Promise<Array<HistoryEntry>> {
		const logFile = machineStore.model.state.logFile;
		if (!logFile) {
			return [];
		}
		const dir = logFile.substring(0, logFile.lastIndexOf("/"));
		const name = extractFileName(logFile);
		const info = (await machineStore.getFileList(dir)).find((f) => f.name === name);
		if (!info) {
			return [];
		}
		if (Number(info.size) > MAX_LOG_BYTES) {
			throw new Error(`${name}: ${displaySize(Number(info.size))}`);
		}
		const text = await machineStore.download({ filename: logFile, type: "text" }, false, false, false);
		return parseEventLog(String(text));
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
		// A copy: the log line's timestamp is merged in below and must not change `current` itself
		if (current.value) {
			list.push({ ...current.value });
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

	return { items, current, loading, error, loggingOff, backendAvailable, load };
}
