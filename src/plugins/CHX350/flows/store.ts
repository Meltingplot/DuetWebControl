import { CodeChannel, type MessageBox } from "@duet3d/objectmodel";
import { defineStore } from "pinia";
import { watch } from "vue";

import { lostCodeReply, useMachineStore } from "@/stores/machine";
import { useUiStore } from "@/stores/ui";
import { getErrorMessage } from "@/utils/errors";
import Events from "@/utils/events";
import Path from "@/utils/path";

import { COMPLETION_MARKER, parseFlowFile, type FlowIssue, type FlowPage, type FlowStep, type ParsedFlowFile } from "./parse";
import { checkTemplate, renderMarkdown, sanitizeHtml } from "./render";

/** An indexed macro (a flow, documents prompts or calls other files): parse result plus where it came from */
export interface FlowFile extends ParsedFlowFile {
	path: string;
	/** Size and modification time the parse result belongs to */
	stamp: string;
}

/** A flow issue with the file it belongs to */
export interface FileIssue extends FlowIssue {
	path: string;
}

/** A step of a flow's step list */
export interface FlowStepEntry {
	/** File that documents the step */
	path: string;
	step: FlowStep;
	/**
	 * Called flows (files with front matter) the step sits in, outermost first. Empty for the flow's
	 * own steps and for those of the helpers it calls, which count as its own
	 */
	via: Array<string>;
}

/**
 * How a flow started here ended: done when it reached its completion line, else cancelled when the
 * operator cancelled the prompt they answered last, else failed. A file without a completion line
 * cannot tell, it has ended
 */
export type FlowOutcome = "done" | "cancelled" | "failed" | "ended";

/** The flow shown in the panel */
export interface ActiveFlow {
	/** File of the flow (a flow with front matter, or a file that only documents prompts) */
	path: string;
	/** Started from a tile of this client: the macro's reply ends it. Otherwise the panel follows the machine */
	startedHere: boolean;
	/** The last prompt answered in this panel was cancelled */
	cancelled: boolean;
	/** Outcome once the macro has returned (started here only) */
	result: { outcome: FlowOutcome; error: string | null } | null;
}

/** Largest file the index reads; macros are a few kB */
const MAX_FILE_SIZE = 256 * 1024;
const MAX_DEPTH = 4;
/** RRF runs at most 10 nested macros */
const MAX_CALL_DEPTH = 10;
/** How long the macro's last output may trail the end of the macro (separate model updates) */
const MESSAGE_SETTLE_TIME = 1000;
const SKIPPED_EXTENSIONS = /\.(png|jpe?g|webp|gif|svg|bmp|ico|bin|uf2|zip|csv|json|html?|css|js|map|txt|md)$/i;
// Bump the version whenever the parse result changes shape (v2: `pages` list and `visible`, v3: `completes`, v4: `calls`)
const CACHE_KEY = "chx350.flowIndex.v4";
const OLD_CACHE_KEYS = ["chx350.flowIndex.v1", "chx350.flowIndex.v2", "chx350.flowIndex.v3"];

interface CacheEntry {
	stamp: string;
	/** Omitted for files the index does not keep, so they are not downloaded again */
	parsed?: ParsedFlowFile;
}

/** Whether the index keeps a file: a flow, a file that documents prompts or calls other files, or one with issues */
function isRelevant(parsed: ParsedFlowFile): boolean {
	return parsed.meta !== null || parsed.steps.length > 0 || parsed.calls.length > 0 || parsed.issues.length > 0;
}

/** The indexed file an M98 runs; a relative path starts in the system directory, as with M98 */
function callTarget(files: Record<string, FlowFile>, path: string): FlowFile | null {
	let absolute = path;
	if (absolute.startsWith("/")) {
		absolute = `0:${absolute}`;
	} else if (!/^\d+:/.test(absolute)) {
		absolute = Path.combine(useMachineStore().model.directories.system || Path.system, absolute);
	}
	return files[absolute] ?? null;
}

function readCache(): Record<string, CacheEntry> {
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

function writeCache(cache: Record<string, CacheEntry>) {
	try {
		for (const key of OLD_CACHE_KEYS) {
			localStorage.removeItem(key);
		}
		localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
	} catch {
		// Private window or full storage: the index is simply built again next time
	}
}

/**
 * Issues a file has on top of the parser's: markup in literal prompt texts or doc blocks that
 * DOMPurify would remove, and Jinja that the template check does not let through. Needs the
 * DOM, hence not part of the parser
 */
function checkFile(parsed: ParsedFlowFile): Array<FlowIssue> {
	const issues: Array<FlowIssue> = [];
	const html = (line: number, source: string) => {
		const { removed } = sanitizeHtml(source);
		if (removed.length > 0) {
			issues.push({ line, key: "markupRemoved", params: { removed: removed.join(", ") } });
		}
	};
	for (const prompt of parsed.prompts) {
		for (const text of [prompt.title, prompt.message]) {
			if (text) {
				html(prompt.line, text);
			}
		}
	}
	for (const step of parsed.steps) {
		for (const finding of checkTemplate(step.markdown)) {
			issues.push({ line: step.docLine, ...finding });
		}
		// Checked before Jinja runs: whatever a template produces is sanitized again when shown
		html(step.docLine, renderMarkdown(step.markdown));
	}
	if (parsed.meta) {
		for (const field of [parsed.meta.description, parsed.meta.enabled, parsed.meta.visible, parsed.meta.hint]) {
			if (field) {
				for (const finding of checkTemplate(field)) {
					issues.push({ line: 1, ...finding });
				}
			}
		}
	}
	return issues;
}

/** Whether the HTTP channel is in a macro */
function httpInMacro(): boolean {
	return (useMachineStore().model.inputs[CodeChannel.http]?.stackDepth ?? 0) > 0;
}

/** Resolves once the HTTP channel is out of every macro */
function macroReturned(): Promise<void> {
	return new Promise((resolve) => {
		if (!httpInMacro()) {
			resolve();
			return;
		}
		const stop = watch(httpInMacro, (inMacro) => {
			if (!inMacro) {
				stop();
				resolve();
			}
		});
	});
}

function stampOf(size: bigint | number, lastModified: Date | null): string {
	return `${size}:${lastModified ? new Date(lastModified).getTime() : 0}`;
}

export const useFlowStore = defineStore("chx350Flows", {
	state: () => ({
		/** Indexed files by path */
		files: {} as Record<string, FlowFile>,
		scanning: false,
		scanError: null as string | null,
		/** Markup removed while showing a step (text a template or the firmware produced) */
		runtimeIssues: [] as Array<FileIssue>,
		active: null as ActiveFlow | null
	}),
	getters: {
		/** Files with front matter, sorted for display */
		flows(state): Array<FlowFile> {
			return Object.values(state.files)
				.filter((file) => file.meta !== null)
				.sort((a, b) => (a.meta!.order - b.meta!.order) || a.meta!.title.localeCompare(b.meta!.title));
		},
		issues(state): Array<FileIssue> {
			const fromFiles = Object.values(state.files).flatMap((file) => file.issues.map((issue) => ({ ...issue, path: file.path })));
			// A called flow writes its completion line unless the caller passes C0, and that line would
			// report the flow the UI started as completed while it still runs
			const fromCalls = Object.values(state.files).flatMap((file) => file.calls.flatMap((call) => {
				const target = (call.c0 === false) ? callTarget(state.files, call.path) : null;
				return (target?.completes) ? [{ path: file.path, line: call.line, key: "callWithoutC0", params: { flow: target.path } }] : [];
			}));
			return [...fromFiles, ...fromCalls, ...state.runtimeIssues].sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
		}
	},
	actions: {
		flowsOn(page: FlowPage): Array<FlowFile> {
			return this.flows.filter((file) => file.meta!.pages.includes(page));
		},

		hasIssues(path: string): boolean {
			return this.issues.some((issue) => issue.path === path);
		},

		/**
		 * Find the step a message box belongs to: in the active flow first, then in the flows, then
		 * in files that only document prompts (e.g. the door check in the sys helpers)
		 */
		findStep(title: string): { file: FlowFile; step: FlowStep } | null {
			const candidates = Object.values(this.files).sort((a, b) => {
				const rank = (file: FlowFile) => (file.path === this.active?.path) ? 0 : (file.meta !== null ? 1 : 2);
				return rank(a) - rank(b);
			});
			for (const file of candidates) {
				const step = file.steps.find((s) => s.title === title);
				if (step) {
					return { file, step };
				}
			}
			return null;
		},

		/**
		 * Steps of a flow in the order of its file, with the documented prompts of the files it calls
		 * (M98 with a literal path) where the call stands, further down as well. A file is listed at its
		 * first call only, so a helper called in several places does not repeat its steps
		 */
		stepsOf(path: string): Array<FlowStepEntry> {
			const entries: Array<FlowStepEntry> = [];
			const visited = new Set<string>();
			const visit = (file: FlowFile, via: Array<string>, depth: number) => {
				visited.add(file.path);
				const items = [
					...file.steps.map((step) => ({ line: step.line, step, call: null })),
					...file.calls.map((call) => ({ line: call.line, step: null, call }))
				].sort((a, b) => a.line - b.line);
				for (const { step, call } of items) {
					if (step !== null) {
						entries.push({ path: file.path, step, via });
						continue;
					}
					const target = callTarget(this.files, call!.path);
					if (target !== null && !visited.has(target.path) && depth < MAX_CALL_DEPTH) {
						visit(target, target.meta ? [...via, target.path] : via, depth + 1);
					}
				}
			};
			const root = this.files[path];
			if (root) {
				visit(root, [], 1);
			}
			return entries;
		},

		/** Whether a file runs another one through its calls (M98 with a literal path), directly or further down */
		runs(from: string, to: string): boolean {
			const visited = new Set<string>();
			const visit = (path: string): boolean => {
				visited.add(path);
				return (this.files[path]?.calls ?? []).some((call) => {
					const target = callTarget(this.files, call.path);
					return target !== null && (target.path === to || (!visited.has(target.path) && visit(target.path)));
				});
			};
			return visit(from);
		},

		/** Whether the CHX 350 shell shows this message box instead of DWC's dialog */
		claims(box: MessageBox): boolean {
			return this.active !== null || this.findStep(box.title) !== null;
		},

		/** Index a file from its text; used by the scan and by tests */
		ingest(path: string, text: string, stamp = "") {
			const parsed = parseFlowFile(text);
			parsed.issues.push(...checkFile(parsed));
			if (isRelevant(parsed)) {
				this.files[path] = { ...parsed, path, stamp };
			} else {
				delete this.files[path];
			}
			return parsed;
		},

		/**
		 * Read the macro directories and index every file that is a flow or documents prompts.
		 * Unchanged files come from the cache in localStorage, so a reload only lists directories
		 * @param force Download every file again instead of using the cache
		 */
		async scan(force = false) {
			if (this.scanning) {
				return;
			}
			const machineStore = useMachineStore();
			if (!machineStore.isConnected) {
				return;
			}
			this.scanning = true;
			this.scanError = null;
			// Forced: read every file again, e.g. after the parser changed or to check a hand edit
			const cache = force ? {} : readCache();
			const nextCache: Record<string, CacheEntry> = {};
			const seen = new Set<string>();
			const system = machineStore.model.directories.system || Path.system;
			const roots = [machineStore.model.directories.macros || Path.macros, Path.combine(system, "meltingplot"), Path.combine(system, "overrides/flows")];

			const visit = async (directory: string, depth: number) => {
				let items;
				try {
					items = await machineStore.getFileList(directory);
				} catch {
					// A root that does not exist (no own flows yet) is not an error
					return;
				}
				for (const item of items) {
					const path = Path.combine(directory, item.name);
					if (item.isDirectory) {
						if (depth < MAX_DEPTH) {
							await visit(path, depth + 1);
						}
						continue;
					}
					if (SKIPPED_EXTENSIONS.test(item.name) || Number(item.size) > MAX_FILE_SIZE) {
						continue;
					}
					seen.add(path);
					const stamp = stampOf(item.size, item.lastModified);
					const cached = cache[path];
					if (cached && cached.stamp === stamp) {
						nextCache[path] = cached;
						if (!cached.parsed) {
							delete this.files[path];
						} else if (this.files[path]?.stamp !== stamp) {
							this.files[path] = { ...cached.parsed, path, stamp };
						}
						continue;
					}
					try {
						const text = String(await machineStore.download({ filename: path, type: "text" }, false, false, false));
						const parsed = this.ingest(path, text, stamp);
						nextCache[path] = isRelevant(parsed) ? { stamp, parsed } : { stamp };
					} catch (e) {
						console.warn(`[CHX350] flow index: ${path}`, e);
					}
				}
			};

			try {
				for (const root of roots) {
					await visit(root, 0);
				}
				for (const path of Object.keys(this.files)) {
					if (!seen.has(path)) {
						delete this.files[path];
					}
				}
				this.runtimeIssues = this.runtimeIssues.filter((issue) => seen.has(issue.path));
				writeCache(nextCache);
			} catch (e) {
				this.scanError = getErrorMessage(e);
			} finally {
				this.scanning = false;
			}
		},

		/** Record markup removed while showing a step, once per place */
		reportRuntimeIssue(path: string, line: number, removed: Array<string>) {
			const params = { removed: removed.join(", ") };
			if (!this.runtimeIssues.some((issue) => issue.path === path && issue.line === line && issue.params?.removed === params.removed)) {
				this.runtimeIssues.push({ path, line, key: "markupRemovedLive", params });
			}
		},

		/** Follow a flow that was not started here (console, second panel, reload) */
		attach(path: string) {
			if (this.active === null) {
				this.active = { path, startedHere: false, cancelled: false, result: null };
			}
		},

		/**
		 * Start a flow from its tile; resolves when the macro has returned. The reply of M98 marks the
		 * end, but a flow waits for the operator for as long as it takes and the request may not last
		 * that long. sendCode waits out a proxy timeout itself; a reconnect rejects the request. DSF
		 * runs the macro on when the request goes away, so a reply or a failed request only ends the
		 * flow once the HTTP channel has left the macro. Until then the panel follows the channel in
		 * the object model
		 */
		async start(path: string) {
			if (this.active !== null && this.active.result === null) {
				return;
			}
			this.active = { path, startedHere: true, cancelled: false, result: null };

			// DSF sends the macro's output as messages (the toast) and replies to M98 with nothing,
			// standalone RRF puts it into the reply, so both are read. Only the completion line decides;
			// the last error line is the reason shown when it is missing, as a routine may report an
			// error it resolves itself (homing). The machine does not say which channel a message came from
			const run = { completed: false, error: null as string | null, onCompleted: () => {} };
			const read = (text: string) => {
				for (const line of text.split("\n").map((l) => l.trim())) {
					if (line === COMPLETION_MARKER) {
						run.completed = true;
						run.onCompleted();
					} else if (line.startsWith("Error:")) {
						run.error = line.replace(/^Error:\s*/, "");
					}
				}
			};
			const onMessage = ({ content }: { content: string }) => read(content);
			Events.on("message", onMessage);
			const code = `M98 P"${path.replace(/"/g, '""')}"`;
			let requestError: string | null = null;
			try {
				let reply: string | null = null;
				try {
					// Logged here: the panel shows how the flow ended, a lost reply is no news
					reply = await useMachineStore().sendCode(code, false, false) ?? "";
				} catch (e) {
					requestError = getErrorMessage(e);
				}
				if (httpInMacro()) {
					// The request ended before the macro did
					requestError = null;
					await macroReturned();
				} else if (reply && reply !== lostCodeReply()) {
					useUiStore().logCode(code, reply);
					read(reply);
				}
				if (!run.completed) {
					await new Promise<void>((resolve) => {
						const timer = setTimeout(resolve, MESSAGE_SETTLE_TIME);
						run.onCompleted = () => {
							clearTimeout(timer);
							resolve();
						};
					});
				}
			} finally {
				Events.off("message", onMessage);
			}

			const flow = this.active;
			if (flow?.path === path && flow.startedHere && flow.result === null) {
				let outcome: FlowOutcome;
				if (run.completed) {
					outcome = "done";
				} else if (flow.cancelled) {
					outcome = "cancelled";
				} else if (requestError !== null || this.files[path]?.completes) {
					outcome = "failed";
				} else {
					outcome = "ended";
				}
				flow.result = { outcome, error: (outcome === "done") ? null : (requestError ?? run.error) };
			}
		},

		/** Remember whether the operator cancelled the prompt they answered last */
		noteAnswer(cancelled: boolean) {
			if (this.active !== null && this.active.result === null) {
				this.active.cancelled = cancelled;
			}
		},

		close() {
			this.active = null;
		}
	}
});
