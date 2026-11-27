#!/usr/bin/env node
/**
 * Meltingplot fork: checks of the production bundle, run after `npm run build` (npm run check-build [dist])
 *
 * d3 selection.interrupt() and selection.transition()
 *   d3-transition adds both methods to d3's selection prototype as a side effect of being loaded
 *   (node_modules/d3-transition/dist/d3-transition.mjs:873-874). d3 declares itself side-effect free
 *   ("sideEffects": false in node_modules/d3/package.json), and "since the d3 update" (upstream 23b24f0f) the
 *   production build dropped that install for code that only imports d3, so the G-Code Viewer gauges threw
 *   "interrupt is not a function". 23b24f0f imports d3-transition directly (src/plugins/GCodeViewer/Gauge/gauge.ts:2-3).
 *   Only the tree-shaken production bundle loses it: plain Node and the dev server's prebundled d3 both run the
 *   install, so neither the dev server nor a unit test sees the bug.
 *
 *   Rule: every chunk that calls .interrupt() or .transition() must load the matching install
 *   `<x>.prototype.interrupt = ...` / `<x>.prototype.transition = ...` itself or through its static imports
 *   (the chunks that are evaluated before it). Calls that the source map places in a package which is neither
 *   a d3 package nor depends on d3, d3-selection or d3-transition cannot be d3 selection calls and are skipped;
 *   without a source map every call counts. Calls and installs come from the parsed code, so strings (such as
 *   the inlined G-Code Viewer worker) and comments do not count.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { parseAst } from "vite";

const D3_METHODS = ["interrupt", "transition"];
const D3_PACKAGES = new Set(["d3", "d3-selection", "d3-transition"]);

const distDir = resolve(process.argv[2] ?? "dist");
const show = (file) => relative(process.cwd(), file) || file;

function walk(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
}

/** Name of a non-computed or string-literal member, else null */
function memberName(node) {
	if (node?.type !== "MemberExpression") {
		return null;
	}
	if (!node.computed && node.property.type === "Identifier") {
		return node.property.name;
	}
	if (node.computed && node.property.type === "Literal" && typeof node.property.value === "string") {
		return node.property.value;
	}
	return null;
}

/** Static imports, calls of the d3 methods and prototype installs of the d3 methods in one chunk */
function scanChunk(file) {
	const code = readFileSync(file, "utf8");
	const result = { file, code, imports: [], calls: [], installs: new Set() };
	const stack = [parseAst(code)];
	while (stack.length > 0) {
		const node = stack.pop();
		switch (node.type) {
			case "ImportDeclaration":
			case "ExportAllDeclaration":
			case "ExportNamedDeclaration":
				if (node.source && typeof node.source.value === "string") {
					result.imports.push(node.source.value);
				}
				break;
			case "CallExpression": {
				const name = memberName(node.callee);
				if (D3_METHODS.includes(name)) {
					const offset = node.callee.property.start;
					// Source map lookups below need string offsets, so make sure the parser reports them
					if (!node.callee.computed && code.slice(offset, node.callee.property.end) !== name) {
						throw new Error(`${show(file)}: parser offset ${offset} does not point at .${name}`);
					}
					result.calls.push({ name, offset });
				}
				break;
			}
			case "AssignmentExpression": {
				const name = memberName(node.left);
				if (D3_METHODS.includes(name) && memberName(node.left.object) === "prototype") {
					result.installs.add(name);
				}
				break;
			}
		}
		for (const value of Object.values(node)) {
			if (Array.isArray(value)) {
				for (const item of value) {
					if (item && typeof item.type === "string") {
						stack.push(item);
					}
				}
			} else if (value && typeof value.type === "string") {
				stack.push(value);
			}
		}
	}
	result.calls.sort((a, b) => a.offset - b.offset);
	return result;
}

// #region Source maps

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Decode the mappings of the generated lines 0..lastLine into [column, source, line] segments per line */
function decodeMappings(mappings, lastLine) {
	const lines = [];
	let i = 0, source = 0, sourceLine = 0, sourceColumn = 0;
	while (lines.length <= lastLine && i <= mappings.length) {
		const segments = [];
		let column = 0;
		while (i < mappings.length && mappings[i] !== ";") {
			if (mappings[i] === ",") {
				i++;
				continue;
			}
			const fields = [];
			while (i < mappings.length && mappings[i] !== "," && mappings[i] !== ";") {
				let value = 0, shift = 0, digit;
				do {
					digit = BASE64.indexOf(mappings[i++]);
					if (digit < 0) {
						throw new Error("invalid source map mappings");
					}
					value += (digit & 31) * 2 ** shift;
					shift += 5;
				} while (digit & 32);
				fields.push((value % 2) ? -Math.floor(value / 2) : value / 2);
			}
			column += fields[0];
			if (fields.length >= 4) {
				source += fields[1];
				sourceLine += fields[2];
				sourceColumn += fields[3];
				segments.push([column, source, sourceLine]);
			} else {
				segments.push([column, -1, 0]);
			}
		}
		lines.push(segments);
		i++;
	}
	return lines;
}

/** Original file and line of each call, or null when the chunk has no source map or no mapping there */
function locateCalls(chunk) {
	const mapFile = `${chunk.file}.map`;
	if (!existsSync(mapFile)) {
		return chunk.calls.map(() => null);
	}
	const map = JSON.parse(readFileSync(mapFile, "utf8"));
	const positions = chunk.calls.map(({ offset }) => {
		const lineStart = chunk.code.lastIndexOf("\n", offset - 1) + 1;
		let line = 0;
		for (let i = chunk.code.indexOf("\n"); i !== -1 && i < lineStart; i = chunk.code.indexOf("\n", i + 1)) {
			line++;
		}
		return { line, column: offset - lineStart };
	});
	const lines = decodeMappings(map.mappings, Math.max(...positions.map((p) => p.line)));
	return positions.map(({ line, column }) => {
		const segment = (lines[line] ?? []).filter((s) => s[0] <= column).at(-1);
		if (!segment || segment[1] < 0) {
			return null;
		}
		return { file: resolve(dirname(mapFile), map.sourceRoot ?? "", map.sources[segment[1]]), line: segment[2] + 1 };
	});
}

// #endregion

/** Whether code from this original file can hold a d3 selection: own code, d3 packages and packages depending on them */
function mayCallD3(location) {
	const parts = location?.file.split(/[\\/]/) ?? [];
	const nm = parts.lastIndexOf("node_modules");
	if (nm < 0) {
		return true;
	}
	const pkgParts = parts.slice(nm + 1, parts[nm + 1]?.startsWith("@") ? nm + 3 : nm + 2);
	const pkg = pkgParts.join("/");
	if (pkg === "d3" || pkg.startsWith("d3-")) {
		return true;
	}
	const pkgJson = join(parts.slice(0, nm + 1).join("/") || "/", ...pkgParts, "package.json");
	if (!existsSync(pkgJson)) {
		return true;
	}
	const { dependencies = {}, peerDependencies = {} } = JSON.parse(readFileSync(pkgJson, "utf8"));
	return Object.keys({ ...dependencies, ...peerDependencies }).some((dep) => D3_PACKAGES.has(dep));
}

const files = existsSync(distDir) ? walk(distDir).filter((file) => file.endsWith(".js")) : [];
if (files.length === 0) {
	console.error(`mp-check-build: no .js files in ${show(distDir)}, run npm run build first`);
	process.exit(1);
}

const chunks = new Map(files.map((file) => [file, scanChunk(file)]));

/** The chunk and every chunk it loads through static imports */
function staticClosure(chunk) {
	const seen = new Set([chunk.file]), queue = [chunk];
	while (queue.length > 0) {
		const current = queue.shift();
		for (const specifier of current.imports) {
			if (!specifier.startsWith(".")) {
				continue;
			}
			const target = resolve(dirname(current.file), specifier);
			if (!chunks.has(target)) {
				throw new Error(`${show(current.file)} imports ${specifier}, which is not in ${show(distDir)}`);
			}
			if (!seen.has(target)) {
				seen.add(target);
				queue.push(chunks.get(target));
			}
		}
	}
	return [...seen].map((file) => chunks.get(file));
}

const failures = [], passes = [];
let skipped = 0;
for (const chunk of chunks.values()) {
	if (chunk.calls.length === 0) {
		continue;
	}
	const locations = locateCalls(chunk);
	const closure = staticClosure(chunk);
	chunk.calls.forEach(({ name }, index) => {
		const location = locations[index];
		if (!mayCallD3(location)) {
			skipped++;
			return;
		}
		const where = `${show(chunk.file)}: .${name}() from ${location ? `${show(location.file)}:${location.line}` : "(no source map)"}`;
		const installer = closure.find((c) => c.installs.has(name));
		if (installer) {
			passes.push(`${where}, installed by ${show(installer.file)}`);
		} else {
			failures.push(`${where}, but neither this chunk nor its ${closure.length - 1} static import(s) install selection.prototype.${name}`);
		}
	});
}

const skippedNote = skipped > 0 ? `, ${skipped} call(s) from packages unrelated to d3 skipped` : "";
if (failures.length > 0) {
	console.error(`mp-check-build: FAILED, d3 selection methods called without d3-transition's install (upstream 23b24f0f)${skippedNote}`);
	for (const line of failures) {
		console.error(`  ${line}`);
	}
	console.error("  d3 is declared side-effect free, so importing d3 alone does not keep the install: import 'd3-transition' where they are called (see src/plugins/GCodeViewer/Gauge/gauge.ts:2-3)");
	process.exit(1);
}
console.log(`mp-check-build: OK, ${files.length} file(s) scanned, each of the ${passes.length} d3 selection call(s) of ${D3_METHODS.map((m) => `.${m}()`).join("/")} loads d3-transition's install${skippedNote}`);
for (const line of passes) {
	console.log(`  ${line}`);
}
