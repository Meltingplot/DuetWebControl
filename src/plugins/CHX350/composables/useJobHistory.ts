import { computed, ref } from "vue";

import { useMachineStore } from "@/stores/machine";
import { displaySize } from "@/utils/display";
import { isPrinting } from "@/utils/enums";
import { getErrorMessage } from "@/utils/errors";
import { extractFileName } from "@/utils/path";

import { api, backendAvailable, qa, qaAvailable, type HistoryEntry } from "../api";

export interface JobHistoryItem {
	file: string;
	name: string;
	result: HistoryEntry["result"];
	printTimeS: number | null;
	timestamp: Date | null;
	/** Whether a layer analysis is available: the object model's for the running/last job, QA's for recorded ones */
	analysable: boolean;
	/** QA job id: the analysis page shows QA's record of this job instead of the object model */
	id: string | null;
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
 * Job history: the running/last job from the object model on top, the recorded jobs below. The
 * records come from the quality-assurance plugin when it runs (every job with its analysis),
 * else from the firmware event log: parsed by the SBC backend, or without it downloaded and
 * parsed by the browser
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
			if (qaAvailable.value) {
				try {
					entries.value = (await qa.jobs(HISTORY_LIMIT)).jobs ?? [];
					return;
				} catch (e) {
					console.warn("[CHX350] QA job list failed, reading the event log instead", e);
				}
			}
			if (backendAvailable.value) {
				try {
					entries.value = (await api.history(HISTORY_LIMIT)).entries ?? [];
					return;
				} catch (e) {
					console.warn("[CHX350] backend history failed, reading the event log instead", e);
				}
			}
			entries.value = await readEventLog();
		} catch (e) {
			entries.value = [];
			error.value = getErrorMessage(e);
		} finally {
			loading.value = false;
		}
	}

	/** Event log without the backend. Logging is off when the firmware has no log file (M929); QA does not need it */
	const loggingOff = computed(() => !qaAvailable.value && !machineStore.model.state.logFile);
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
			return { file: job.file.fileName, name: extractFileName(job.file.fileName), result: "running", printTimeS: job.duration, timestamp: null, analysable: true, id: null };
		}
		if (job.lastFileName) {
			return {
				file: job.lastFileName,
				name: extractFileName(job.lastFileName),
				result: job.lastFileAborted ? "aborted" : (job.lastFileCancelled ? "cancelled" : "finished"),
				printTimeS: job.lastDuration,
				timestamp: null,
				analysable: machineStore.model.job.layers.length > 0,
				id: null
			};
		}
		return null;
	});

	const items = computed<Array<JobHistoryItem>>(() => {
		const list: Array<JobHistoryItem> = [];
		// A copy: the record's timestamp and id are merged in below and must not change `current` itself
		if (current.value) {
			list.push({ ...current.value });
		}
		for (const e of entries.value) {
			// The first record describes the object model's job when the file matches: the log line
			// of the last job, or QA's record of the running one (QA lists it as running, and still
			// does for up to 10 s after the end while it waits for the outcome flags). A running job
			// never matches a record that has ended: that is an earlier print of the same file
			const ended = e.result !== "running";
			if (current.value && list.length === 1 && e.file === current.value.file && !(current.value.result === "running" && ended)) {
				list[0].timestamp = e.timestamp && current.value.result !== "running" ? new Date(e.timestamp) : null;
				list[0].id = e.id ?? null;
				list[0].analysable = list[0].analysable || e.analysable === true;
				continue;
			}
			list.push({
				file: e.file,
				name: extractFileName(e.file),
				result: e.result,
				printTimeS: e.printTimeS,
				// QA gives the start time while a job runs; the row reads "ended <date>"
				timestamp: e.timestamp && ended ? new Date(e.timestamp) : null,
				analysable: e.analysable === true,
				id: e.id ?? null
			});
		}
		return list;
	});

	return { items, current, loading, error, loggingOff, backendAvailable, qaAvailable, load };
}
