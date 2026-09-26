import { load as loadYaml } from "js-yaml";

/**
 * Parser for flow macros. A flow is an ordinary RRF macro; everything the CHX 350 UI needs to show
 * it as a sequence of steps lives in comments, which the firmware skips:
 *
 * - A YAML front matter at the very top, written as comment lines between two `; ---` lines
 *   (Jekyll style), turns the macro into a flow with a tile: title, icon, page(s), order, ...
 * - `;;` lines directly above an M291 are that prompt's Markdown, like `///` doc comments in Rust.
 *   Blank lines and plain `;` comments may sit in between. The prompt's literal R title is the key
 *   the UI matches `state.messageBox.title` against, so it has to be unique within the file
 * - `{{ }}` / `{% %}` in the Markdown and in the front matter fields description, hint, enabled and
 *   visible are Jinja (Nunjucks), evaluated by the UI against the live object model
 * - `echo ";; Completed"` is the line a flow reaches when it went through. Only that output makes
 *   the UI report it as completed; error lines on the way do not decide (homing resolves some itself)
 * - An `M98` with a literal P path is a call. The UI lists the documented prompts of the called file
 *   as steps of the caller, where the call stands. A called flow takes `C0` from its caller and
 *   leaves out its completion line: only the flow the UI started ends with it
 *
 * This module is pure (no DOM, no Vue) so it can be tested on its own
 */

/**
 * Pages that show flow tiles: start (the daily cycle), job (pause controls of the running-job page,
 * while a job is paused), calibrate (hardware changed, calibrations), service (technician)
 */
export const FLOW_PAGES = ["start", "job", "calibrate", "service"] as const;
export type FlowPage = typeof FLOW_PAGES[number];

/** Front matter of a flow */
export interface FlowMeta {
	title: string;
	/** Tile subtitle (Jinja) */
	description: string | null;
	/** mdi icon name */
	icon: string | null;
	/** Pages that show the tile (`page: start` or `page: [start, job]`); empty = no tile, the flow only renders while it runs */
	pages: Array<FlowPage>;
	/** Sort order, ascending; the same on every page of the flow */
	order: number;
	/** Jinja template that renders "true" when the tile may be started; null = while the machine is idle */
	enabled: string | null;
	/** Jinja template that renders "true" when the tile is shown; null = always */
	visible: string | null;
	/** Shown instead of the description while the tile is disabled (Jinja) */
	hint: string | null;
}

/** An M291 with a doc block */
export interface FlowStep {
	/** Literal R parameter */
	title: string;
	/** Markdown of the doc block (may contain Jinja) */
	markdown: string;
	/** 1-based line of the M291 */
	line: number;
	/** 1-based line where the doc block starts */
	docLine: number;
	/** Literal S parameter (message box mode), null when absent or an expression */
	mode: number | null;
}

/** Literal texts of an M291, checked for markup the UI would remove */
export interface FlowPrompt {
	line: number;
	title: string | null;
	message: string | null;
}

/** An M98 with a literal P path */
export interface FlowCall {
	/** 1-based line of the M98 */
	line: number;
	/** Literal P parameter; a relative path starts in the system directory, as with M98 */
	path: string;
	/** The call passes C0, so a called flow leaves out its completion line; null when C is an expression */
	c0: boolean | null;
}

/** Problem found in a file; `key` is an i18n key below plugins.CHX350.flows.issue */
export interface FlowIssue {
	line: number;
	key: string;
	params?: Record<string, string | number>;
}

export interface ParsedFlowFile {
	/** Front matter, null when the file has none (it can still hold doc blocks) */
	meta: FlowMeta | null;
	steps: Array<FlowStep>;
	prompts: Array<FlowPrompt>;
	calls: Array<FlowCall>;
	/** The file has the completion line, so a run that does not reach it has failed */
	completes: boolean;
	issues: Array<FlowIssue>;
}

/** Output of the completion line `echo ";; Completed"` */
export const COMPLETION_MARKER = ";; Completed";

/** A parameter of a G-code command as written in the file */
export interface GCodeParameter {
	kind: "string" | "expression" | "bare";
	/** String literals are unescaped (`""` → `"`); expressions keep their braces */
	value: string;
}

const FRONT_MATTER_FENCE = /^\s*;\s?---\s*$/;
const DOC_LINE = /^\s*;;/;
const COMPLETION_LINE = /^echo\s+";; Completed"$/;
const KNOWN_META_KEYS = ["title", "description", "icon", "page", "order", "enabled", "visible", "hint"];

/**
 * Split a line into its code and comment part. A `;` inside a double-quoted string (also inside
 * a `{ }` expression) does not start a comment; `""` inside a string is an escaped quote and
 * toggles the state twice, which leaves it unchanged
 */
function splitComment(line: string): { code: string; comment: string | null } {
	let inString = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (c === "\"") {
			inString = !inString;
		} else if (c === ";" && !inString) {
			return { code: line.slice(0, i), comment: line.slice(i + 1) };
		}
	}
	return { code: line, comment: null };
}

/** Strip indentation, a leading line number (`N123`, added on deploy) and a trailing checksum or CRC */
function normaliseCode(code: string): string {
	let text = code.trim().replace(/^N\d+\s*/i, "");
	// `*` outside a string and outside braces starts the checksum; inside `{ }` it multiplies
	let inString = false, depth = 0;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === "\"") {
			inString = !inString;
		} else if (!inString) {
			if (c === "{") {
				depth++;
			} else if (c === "}") {
				depth = Math.max(0, depth - 1);
			} else if (c === "*" && depth === 0) {
				text = text.slice(0, i);
				break;
			}
		}
	}
	return text.trim();
}

/**
 * Parse the parameters of a G-code command (everything after the command itself). Values are
 * string literals, `{ }` expressions or bare tokens such as numbers
 */
export function parseParameters(args: string): Map<string, GCodeParameter> {
	const result = new Map<string, GCodeParameter>();
	let i = 0;
	while (i < args.length) {
		const c = args[i];
		if (!/[a-z]/i.test(c)) {
			i++;
			continue;
		}
		const letter = c.toUpperCase();
		i++;
		if (args[i] === "\"") {
			let value = "";
			i++;
			while (i < args.length) {
				if (args[i] === "\"") {
					if (args[i + 1] === "\"") {
						value += "\"";
						i += 2;
						continue;
					}
					i++;
					break;
				}
				value += args[i++];
			}
			result.set(letter, { kind: "string", value });
		} else if (args[i] === "{") {
			const start = i;
			let depth = 0, inString = false;
			while (i < args.length) {
				const ch = args[i];
				if (ch === "\"") {
					inString = !inString;
				} else if (!inString) {
					if (ch === "{") {
						depth++;
					} else if (ch === "}") {
						depth--;
						if (depth === 0) {
							i++;
							break;
						}
					}
				}
				i++;
			}
			result.set(letter, { kind: "expression", value: args.slice(start, i) });
		} else {
			const start = i;
			while (i < args.length && /[-+0-9.:]/.test(args[i])) {
				i++;
			}
			result.set(letter, { kind: "bare", value: args.slice(start, i) });
		}
	}
	return result;
}

/** Parameters of the command on this code, or null when the code is another one */
function parseCommand(code: string, command: "M98" | "M291"): Map<string, GCodeParameter> | null {
	const match = new RegExp(`^${command}(?![\\d.])`, "i").exec(code);
	return match ? parseParameters(code.slice(match[0].length)) : null;
}

function asText(value: unknown): string | null {
	if (value === undefined || value === null) {
		return null;
	}
	return (typeof value === "string") ? value : String(value);
}

function parseFrontMatter(lines: Array<string>, firstLine: number, issues: Array<FlowIssue>): FlowMeta | null {
	let data: unknown;
	try {
		data = loadYaml(lines.join("\n"));
	} catch (e) {
		const mark = (e as { mark?: { line?: number } }).mark;
		issues.push({ line: firstLine + (mark?.line ?? 0), key: "yaml", params: { error: (e as Error).message.split("\n")[0] } });
		return null;
	}
	if (data === null || typeof data !== "object" || Array.isArray(data)) {
		issues.push({ line: firstLine, key: "yamlNoMapping" });
		return null;
	}

	const record = data as Record<string, unknown>;
	for (const key of Object.keys(record)) {
		if (!KNOWN_META_KEYS.includes(key)) {
			issues.push({ line: firstLine, key: "unknownKey", params: { key } });
		}
	}

	const title = asText(record.title);
	if (title === null || title.trim() === "") {
		issues.push({ line: firstLine, key: "missingTitle" });
		return null;
	}

	// One page or a YAML list of pages; unknown entries are reported and skipped
	const pages: Array<FlowPage> = [];
	const pageValues = (record.page === undefined || record.page === null) ? [] : (Array.isArray(record.page) ? record.page : [record.page]);
	for (const value of pageValues) {
		const name = asText(value);
		if (name !== null && (FLOW_PAGES as ReadonlyArray<string>).includes(name)) {
			if (!pages.includes(name as FlowPage)) {
				pages.push(name as FlowPage);
			}
		} else {
			issues.push({ line: firstLine, key: "invalidPage", params: { page: String(name), pages: FLOW_PAGES.join(", ") } });
		}
	}

	let order = 100;
	if (record.order !== undefined) {
		if (typeof record.order === "number" && isFinite(record.order)) {
			order = record.order;
		} else {
			issues.push({ line: firstLine, key: "invalidOrder" });
		}
	}

	return {
		title: title.trim(),
		description: asText(record.description),
		icon: asText(record.icon),
		pages,
		order,
		// YAML reads an unquoted true/false as a boolean
		enabled: asText(record.enabled),
		visible: asText(record.visible),
		hint: asText(record.hint)
	};
}

/**
 * Parse a macro file
 * @param text File content
 */
export function parseFlowFile(text: string): ParsedFlowFile {
	const lines = text.split("\n").map((line) => line.replace(/\r$/, ""));
	const issues: Array<FlowIssue> = [];
	const steps: Array<FlowStep> = [];
	const prompts: Array<FlowPrompt> = [];
	const calls: Array<FlowCall> = [];
	let meta: FlowMeta | null = null;
	let completes = false;

	let index = 0;
	while (index < lines.length && lines[index].trim() === "") {
		index++;
	}

	// Front matter: `; ---` on the first line that is not blank, closed by the next `; ---`
	if (index < lines.length && FRONT_MATTER_FENCE.test(lines[index])) {
		const start = index;
		const body: Array<string> = [];
		let closed = false;
		for (index++; index < lines.length; index++) {
			const line = lines[index];
			if (FRONT_MATTER_FENCE.test(line)) {
				closed = true;
				index++;
				break;
			}
			const trimmed = line.trimStart();
			if (trimmed !== "" && !trimmed.startsWith(";")) {
				break;
			}
			body.push(trimmed.replace(/^;/, "").replace(/^ /, ""));
		}
		if (closed) {
			meta = parseFrontMatter(body, start + 2, issues);
		} else {
			issues.push({ line: start + 1, key: "frontMatterUnclosed" });
			index = start + 1;
		}
	}

	let doc: Array<string> = [];
	let docLine = 0;
	for (; index < lines.length; index++) {
		const line = lines[index];
		const lineNumber = index + 1;
		if (DOC_LINE.test(line)) {
			if (doc.length === 0) {
				docLine = lineNumber;
			} else if (index > 0 && lines[index - 1].trim() === "") {
				// Two doc runs separated by a blank line belong to the same prompt
				doc.push("");
			}
			doc.push(line.trimStart().slice(2).replace(/^ /, ""));
			continue;
		}

		const { code: rawCode } = splitComment(line);
		const code = normaliseCode(rawCode);
		if (code === "") {
			// Blank line or plain comment: a pending doc block stays attached to the next code line
			continue;
		}

		if (COMPLETION_LINE.test(code)) {
			completes = true;
		}
		const params = parseCommand(code, "M291");
		if (params !== null) {
			const r = params.get("R"), p = params.get("P"), s = params.get("S");
			prompts.push({
				line: lineNumber,
				title: r?.kind === "string" ? r.value : null,
				message: p?.kind === "string" ? p.value : null
			});
			if (doc.length > 0) {
				if (r?.kind !== "string" || r.value.trim() === "") {
					issues.push({ line: lineNumber, key: "titleNotLiteral" });
				} else if (steps.some((step) => step.title === r.value)) {
					issues.push({ line: lineNumber, key: "duplicateTitle", params: { title: r.value } });
				} else {
					const mode = (s?.kind === "bare" && /^\d+$/.test(s.value)) ? parseInt(s.value, 10) : null;
					steps.push({ title: r.value, markdown: doc.join("\n").trim(), line: lineNumber, docLine, mode });
				}
			}
		} else {
			const call = parseCommand(code, "M98");
			const p = call?.get("P"), c = call?.get("C");
			if (p?.kind === "string") {
				// A P{…} expression names its file at run time only
				const c0 = (c === undefined) ? false : ((c.kind === "expression") ? null : (c.kind === "bare" && c.value !== "" && Number(c.value) === 0));
				calls.push({ line: lineNumber, path: p.value, c0 });
			}
			if (doc.length > 0) {
				issues.push({ line: docLine, key: "docWithoutPrompt" });
			}
		}
		doc = [];
	}
	if (doc.length > 0) {
		issues.push({ line: docLine, key: "docWithoutPrompt" });
	}
	if (meta !== null && !completes) {
		issues.push({ line: 1, key: "noCompletion" });
	}

	return { meta, steps, prompts, calls, completes, issues };
}
