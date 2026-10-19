/**
 * License notices of the operator panel (HMI). Its image serves them under /licenses/ through the
 * reverse proxy that also serves DWC, so they come from the page's own origin. There is none when
 * the printer computer is reached directly or the panel runs an older image: a 404, or a web
 * server that answers with DWC's index.html, so anything but a valid index counts as missing
 */

/** A Debian package of the panel image */
export interface PanelPackage {
	name: string;
	version: string;
	/** Source package, null when the index names none */
	source: string | null;
	/** Copyright file relative to /licenses/, null when the package has none */
	copyright: string | null;
}

/** /licenses/index.json */
export interface PanelLicenses {
	/** Image name, e.g. mp-hmi-pi5-<version> */
	image: string;
	version: string;
	/** The image's notice relative to /licenses/ */
	notice: string;
	/** Sorted by name (code points) */
	packages: Array<PanelPackage>;
}

/** A license text on its way to the page */
export type LicenseText =
	| { status: "loading" }
	| { status: "ready"; text: string }
	| { status: "missing" }
	| { status: "failed"; error: string };

function baseUrl(): URL {
	return new URL("/licenses/", window.location.origin);
}

/** URL of a file the index names; it must stay below /licenses/ of this origin */
function fileUrl(path: string): URL {
	const base = baseUrl();
	const url = new URL(path, base);
	if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
		throw new Error(`Outside of ${base.pathname}: ${path}`);
	}
	return url;
}

const optionalString = (value: unknown) => (typeof value === "string" && value !== "") ? value : null;

/** Read the panel's license index, null when this origin serves none */
export async function loadPanelLicenses(): Promise<PanelLicenses | null> {
	let data: any;
	try {
		const response = await fetch(new URL("index.json", baseUrl()), { cache: "no-cache" });
		if (!response.ok) {
			return null;
		}
		data = await response.json();
	} catch {
		return null;
	}
	if (data === null || typeof data !== "object" || !Array.isArray(data.packages)) {
		return null;
	}

	const packages: Array<PanelPackage> = [];
	for (const item of data.packages) {
		if (item !== null && typeof item === "object" && typeof item.name === "string" && item.name !== "") {
			packages.push({
				name: item.name,
				version: optionalString(item.version) ?? "",
				source: optionalString(item.source),
				copyright: optionalString(item.copyright)
			});
		}
	}
	// Code point order, as the image writes it
	packages.sort((a, b) => (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0);

	return {
		image: optionalString(data.image) ?? "",
		version: optionalString(data.version) ?? "",
		notice: optionalString(data.notice) ?? "LICENSES.txt",
		packages
	};
}

/** Read a text file the index names (notice, copyright file) */
export async function loadPanelText(path: string): Promise<string> {
	const response = await fetch(fileUrl(path), { cache: "no-cache" });
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}
	return await response.text();
}
