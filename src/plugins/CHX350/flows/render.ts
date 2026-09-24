import createDOMPurify from "dompurify";
import { marked } from "marked";
import nunjucks from "nunjucks";

import type { FlowIssue } from "./parse";

/**
 * Rendering of flow texts: Jinja (Nunjucks) first, then Markdown, then DOMPurify.
 *
 * Nunjucks is no sandbox - a template that reaches a function constructor runs arbitrary
 * JavaScript. Every template therefore passes {@link checkTemplate} first, and one with findings
 * is shown as plain text instead of being evaluated. The rule is strict on purpose: filters and
 * the loop helpers only, no method calls
 */

const env = new nunjucks.Environment([], { autoescape: true, throwOnUndefined: false });

/** Globals a template may call; everything else that is called is reported */
const CALLABLE_GLOBALS = ["range", "cycler", "joiner", "caller"];

/** Property names that lead from any object to its constructor */
const FORBIDDEN_NAMES = ["constructor", "__proto__", "prototype", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__"];

/** Template tags that need a loader, which the flows do not have */
const UNSUPPORTED_NODES = ["Include", "Import", "FromImport", "Extends"];

interface TemplateNode {
	typename: string;
	fields?: Array<string>;
	value?: unknown;
	[key: string]: unknown;
}

function childNodes(node: TemplateNode): Array<TemplateNode> {
	const children: Array<TemplateNode> = [];
	for (const field of node.fields ?? []) {
		const value = node[field];
		if (Array.isArray(value)) {
			children.push(...value.filter((v): v is TemplateNode => v !== null && typeof v === "object"));
		} else if (value !== null && typeof value === "object") {
			children.push(value as TemplateNode);
		}
	}
	return children;
}

function symbolName(node: unknown): string | null {
	const n = node as TemplateNode | null;
	return (n && n.typename === "Symbol" && typeof n.value === "string") ? n.value : null;
}

/** Nunjucks' parser is part of the browser bundle but missing from the type definitions */
const parser = (nunjucks as unknown as { parser: { parse(src: string, extensions?: Array<unknown>, opts?: object): TemplateNode } }).parser;

/**
 * Check a template without evaluating it
 * @returns Findings; empty when the template may be rendered
 */
export function checkTemplate(src: string): Array<Omit<FlowIssue, "line">> {
	if (!/{[{%]/.test(src)) {
		return [];
	}

	let root: TemplateNode;
	try {
		root = parser.parse(src, [], {});
	} catch (e) {
		return [{ key: "templateSyntax", params: { error: String((e as Error).message ?? e).split("\n")[0] } }];
	}

	const findings: Array<Omit<FlowIssue, "line">> = [];
	const macros = new Set<string>();
	const stack = [root];
	while (stack.length > 0) {
		const node = stack.pop()!;
		if (node.typename === "Macro") {
			const name = symbolName(node.name);
			if (name !== null) {
				macros.add(name);
			}
		}
		stack.push(...childNodes(node));
	}

	stack.push(root);
	while (stack.length > 0) {
		const node = stack.pop()!;
		switch (node.typename) {
			case "FunCall": {
				const name = symbolName(node.name);
				if (name === null || (!CALLABLE_GLOBALS.includes(name) && !macros.has(name))) {
					findings.push({ key: "templateCall" });
				}
				break;
			}
			case "LookupVal": {
				const val = node.val as TemplateNode | undefined;
				if (val && val.typename === "Literal" && FORBIDDEN_NAMES.includes(String(val.value))) {
					findings.push({ key: "templateForbidden", params: { name: String(val.value) } });
				}
				break;
			}
			case "Literal":
				if (typeof node.value === "string" && FORBIDDEN_NAMES.includes(node.value)) {
					findings.push({ key: "templateForbidden", params: { name: node.value } });
				}
				break;
			case "Set":
				// Re-binding a callable global would make a later call look harmless
				for (const target of (node.targets as Array<unknown>) ?? []) {
					const name = symbolName(target);
					if (name !== null && (CALLABLE_GLOBALS.includes(name) || macros.has(name))) {
						findings.push({ key: "templateRebind", params: { name } });
					}
				}
				break;
			default:
				if (UNSUPPORTED_NODES.includes(node.typename)) {
					findings.push({ key: "templateUnsupported", params: { tag: node.typename.toLowerCase() } });
				}
				break;
		}
		stack.push(...childNodes(node));
	}

	// One finding per kind is enough to explain why the template is not evaluated
	return findings.filter((f, i) => findings.findIndex((o) => o.key === f.key && JSON.stringify(o.params) === JSON.stringify(f.params)) === i);
}

/** Compiled templates by source; null marks a template that must not be evaluated */
const compiled = new Map<string, nunjucks.Template | null>();

function compile(src: string): nunjucks.Template | null {
	let template = compiled.get(src);
	if (template === undefined) {
		template = null;
		if (checkTemplate(src).length === 0) {
			try {
				template = new nunjucks.Template(src, env, undefined, true);
			} catch {
				template = null;
			}
		}
		compiled.set(src, template);
	}
	return template;
}

/**
 * Render a Jinja template. Text without template tags is returned as it is; a template that
 * failed the check, does not compile or throws while rendering is returned unevaluated
 * @param src Template source
 * @param context Variables (the object model)
 */
export function renderTemplate(src: string, context: object): string {
	if (!/{[{%]/.test(src)) {
		return src;
	}
	const template = compile(src);
	if (template === null) {
		return src;
	}
	try {
		return template.render(context as object);
	} catch {
		return src;
	}
}

/** Whether a template renders "true" (for the front matter's `enabled`) */
export function renderFlag(src: string | null, context: object): boolean {
	if (src === null) {
		return true;
	}
	const value = renderTemplate(src.includes("{") ? src : `{{ ${src} }}`, context).trim().toLowerCase();
	return value === "true" || value === "1";
}

/**
 * Text for plain-text places (tile subtitles). Autoescaping turns `<` into `&lt;`, which a text
 * node would show literally
 */
export function renderText(src: string | null, context: object): string {
	if (src === null) {
		return "";
	}
	const html = renderTemplate(src, context);
	const doc = new DOMParser().parseFromString(html, "text/html");
	return (doc.body.textContent ?? "").trim();
}

// #region Markdown and HTML

const purify = createDOMPurify(window);
const PURIFY_CONFIG = {
	FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select", "option", "iframe", "object", "embed"],
	FORBID_ATTR: ["style"]
};

/** Resolves `0:/…` image sources to a loadable URL (or "" while it is being fetched) */
export type ImageResolver = (path: string) => string;

let imageResolver: ImageResolver | null = null;
purify.addHook("afterSanitizeAttributes", (node) => {
	if (node.tagName === "IMG") {
		const src = node.getAttribute("src") ?? "";
		if (/^\d+:\//.test(src)) {
			node.setAttribute("data-machine-src", src);
			node.setAttribute("src", imageResolver?.(src) ?? "");
		}
		node.setAttribute("loading", "lazy");
	}
	if (node.tagName === "A") {
		node.setAttribute("target", "_blank");
		node.setAttribute("rel", "noopener noreferrer");
	}
});

export interface SanitizedHtml {
	html: string;
	/** Element and attribute names DOMPurify removed, empty when nothing was changed */
	removed: Array<string>;
}

/** Sanitize HTML, reporting what was removed */
export function sanitizeHtml(html: string, resolver: ImageResolver | null = null): SanitizedHtml {
	imageResolver = resolver;
	try {
		const clean = purify.sanitize(html, PURIFY_CONFIG) as string;
		const removed = purify.removed.map((entry) => {
			if ("attribute" in entry && entry.attribute) {
				return `${entry.attribute.name}=`;
			}
			return `<${(entry as { element: Element }).element.nodeName.toLowerCase()}>`;
		});
		return { html: clean, removed: [...new Set(removed)] };
	} finally {
		imageResolver = null;
	}
}

/** Markdown to HTML (CommonMark + GFM tables, no raw line breaks) */
export function renderMarkdown(markdown: string): string {
	return marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string;
}

/** Jinja, Markdown, DOMPurify - the full pipeline for a step's doc block */
export function renderStepHtml(markdown: string, context: object, resolver: ImageResolver | null): SanitizedHtml {
	return sanitizeHtml(renderMarkdown(renderTemplate(markdown, context)), resolver);
}

// #endregion
