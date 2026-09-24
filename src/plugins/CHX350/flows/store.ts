import type { MessageBox } from "@duet3d/objectmodel";
import { defineStore } from "pinia";

import { useMachineStore } from "@/stores/machine";
import { getErrorMessage } from "@/utils/errors";
import Path from "@/utils/path";

import { replyError } from "../composables/useMacroRunner";
import { parseFlowFile, type FlowIssue, type FlowPage, type FlowStep, type ParsedFlowFile } from "./parse";
import { checkTemplate, renderMarkdown, sanitizeHtml } from "./render";

/** An indexed macro: parse result plus where it came from */
export interface FlowFile extends ParsedFlowFile {
	path: string;
	/** Size and modification time the parse result belongs to */
	stamp: string;
}

/** A flow issue with the file it belongs to */
export interface FileIssue extends FlowIssue {
	path: string;
}

/** The flow shown in the panel */
export interface ActiveFlow {
	/** File of the flow (a flow with front matter, or a file that only documents prompts) */
	path: string;
	/** Started from a tile of this client: the macro's reply ends it. Otherwise the panel follows the machine */
	startedHere: boolean;
	/** Outcome once the macro has returned (started here only) */
	result: { ok: boolean; error: string | null } | null;
}

/** Largest file the index reads; macros are a few kB */
const MAX_FILE_SIZE = 256 * 1024;
const MAX_DEPTH = 4;
const SKIPPED_EXTENSIONS = /\.(png|jpe?g|webp|gif|svg|bmp|ico|bin|uf2|zip|csv|json|html?|css|js|map|txt|md)$/i;
const CACHE_KEY = "chx350.flowIndex.v1";

interface CacheEntry {
	stamp: string;
	/** Omitted for files without front matter or doc blocks, so they are not downloaded again */
	parsed?: ParsedFlowFile;
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
		for (const field of [parsed.meta.description, parsed.meta.enabled, parsed.meta.hint]) {
			if (field) {
				for (const finding of checkTemplate(field)) {
					issues.push({ line: 1, ...finding });
				}
			}
		}
	}
	return issues;
}

function stampOf(size: bigint | number, lastModified: Date | null): string {
	return `${size}:${lastModified ? new Date(lastModified).getTime() : 0}`;
}

export const useFlowStore = defineStore("chx350Flows", {
	state: () => ({
		/** Indexed files that are flows or document prompts, by path */
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
			return [...fromFiles, ...state.runtimeIssues].sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
		}
	},
	actions: {
		flowsOn(page: FlowPage): Array<FlowFile> {
			return this.flows.filter((file) => file.meta!.page === page);
		},

		hasIssues(path: string): boolean {
			return this.issues.some((issue) => issue.path === path);
		},

		/**
		 * Find the step a message box belongs to: in the active flow first, then in the flows, then
		 * in files that only document prompts (e.g. the door check in the sys helpers)
		 */
		findStep(title: string): { file: FlowFile; step: FlowStep; index: number } | null {
			const candidates = Object.values(this.files).sort((a, b) => {
				const rank = (file: FlowFile) => (file.path === this.active?.path) ? 0 : (file.meta !== null ? 1 : 2);
				return rank(a) - rank(b);
			});
			for (const file of candidates) {
				const index = file.steps.findIndex((step) => step.title === title);
				if (index >= 0) {
					return { file, step: file.steps[index], index };
				}
			}
			return null;
		},

		/** Whether the CHX 350 shell shows this message box instead of DWC's dialog */
		claims(box: MessageBox): boolean {
			return this.active !== null || this.findStep(box.title) !== null;
		},

		/** Index a file from its text; used by the scan and by tests */
		ingest(path: string, text: string, stamp = "") {
			const parsed = parseFlowFile(text);
			parsed.issues.push(...checkFile(parsed));
			if (parsed.meta !== null || parsed.steps.length > 0 || parsed.issues.length > 0) {
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
						const relevant = parsed.meta !== null || parsed.steps.length > 0 || parsed.issues.length > 0;
						nextCache[path] = relevant ? { stamp, parsed } : { stamp };
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
				this.active = { path, startedHere: false, result: null };
			}
		},

		/** Start a flow from its tile; resolves when the macro has returned */
		async start(path: string) {
			if (this.active !== null && this.active.result === null) {
				return;
			}
			this.active = { path, startedHere: true, result: null };
			let result: ActiveFlow["result"];
			try {
				// The reply arrives when the macro has returned, prompts included
				const reply = await useMachineStore().sendCode(`M98 P"${path.replace(/"/g, '""')}"`, false, true) ?? "";
				const error = replyError(reply);
				result = { ok: error === null, error };
			} catch (e) {
				result = { ok: false, error: getErrorMessage(e) };
			}
			if (this.active?.path === path && this.active.startedHere && this.active.result === null) {
				this.active.result = result;
			}
		},

		close() {
			this.active = null;
		}
	}
});
