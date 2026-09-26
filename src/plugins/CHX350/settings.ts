import { computed, type WritableComputedRef } from "vue";

import { useSettingsStore } from "@/stores/settings";

export const PLUGIN_ID = "CHX350";

export interface ChxBedMapSettings {
	/** Printable bed size in mm (X and Y). Defaults match the CHX 350 */
	sizeX: number;
	sizeY: number;
	/** Minimum distance between the two print heads (IDEX keep-out band) in mm */
	headSpacing: number;
	/** Axis letter the second tool's Y motion uses */
	tool1YAxis: string;
	/** Selectable Z step sizes in mm */
	zSteps: Array<number>;
}

export interface ChxSupportSettings {
	company: string;
	/** Postal address shown under the company name */
	address: string;
	phone: string;
	phoneHours: string;
	email: string;
	url: string;
	/** Machine model shown on About/Support */
	model: string;
}

export interface ChxSettings {
	bedMap: ChxBedMapSettings;
	support: ChxSupportSettings;
	/** Press-and-hold duration for NOT-AUS in ms */
	estopHoldMs: number;
}

export const CHX_DEFAULTS: ChxSettings = {
	bedMap: {
		sizeX: 880,
		sizeY: 422,
		headSpacing: 60,
		tool1YAxis: "U",
		zSteps: [0.01, 0.1, 1, 5]
	},
	support: {
		company: "Meltingplot GmbH",
		address: "Edisonstrasse 3, 24145 Kiel",
		phone: "+49 431 55681260",
		phoneHours: "",
		email: "info@meltingplot.de",
		url: "https://www.meltingplot.de",
		model: "CHX 350"
	},
	estopHoldMs: 1200
};

/**
 * Contact placeholders from the prototype that earlier versions saved as defaults. A stored field
 * still holding one of them reads as the current default
 */
const PROTOTYPE_SUPPORT_PLACEHOLDERS: Partial<ChxSupportSettings> = {
	phone: "+49 431 000 000",
	phoneHours: "Mo–Fr 8–17 Uhr",
	email: "support@meltingplot.net",
	url: "https://www.meltingplot.net"
};

function withCurrentContact(support: ChxSupportSettings): ChxSupportSettings {
	const result = { ...support };
	for (const [key, placeholder] of Object.entries(PROTOTYPE_SUPPORT_PLACEHOLDERS) as Array<[keyof ChxSupportSettings, string]>) {
		if (result[key] === placeholder) {
			result[key] = CHX_DEFAULTS.support[key];
		}
	}
	return result;
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

/**
 * Register the plugin's setting defaults with the settings store. Called from the entry point and
 * again whenever persisted settings are (re)loaded, because settingsStore.load() replaces the
 * `plugins` record wholesale
 */
export function registerChxSettingDefaults(): void {
	const settingsStore = useSettingsStore();
	for (const [key, value] of Object.entries(CHX_DEFAULTS)) {
		settingsStore.registerPluginData(PLUGIN_ID, key, clone(value));
	}
}

function readSetting<K extends keyof ChxSettings>(key: K): ChxSettings[K] {
	const settingsStore = useSettingsStore();
	const stored = settingsStore.plugins[PLUGIN_ID]?.[key];
	const fallback = CHX_DEFAULTS[key];
	if (stored === undefined || stored === null) {
		return clone(fallback);
	}
	if (typeof fallback === "object" && !Array.isArray(fallback)) {
		// Backfill keys added since the record was persisted
		return { ...clone(fallback), ...(stored as object) } as ChxSettings[K];
	}
	return stored as ChxSettings[K];
}

function writeSetting<K extends keyof ChxSettings>(key: K, value: ChxSettings[K]): void {
	useSettingsStore().setPluginData(PLUGIN_ID, key, clone(value));
}

/**
 * Reactive accessors for the plugin settings. Reads always resolve against the defaults, so a
 * missing or partially persisted record never yields undefined fields
 */
export function useChxSettings() {
	const bedMap: WritableComputedRef<ChxBedMapSettings> = computed({
		get: () => readSetting("bedMap"),
		set: (value) => writeSetting("bedMap", value)
	});
	const support: WritableComputedRef<ChxSupportSettings> = computed({
		get: () => withCurrentContact(readSetting("support")),
		set: (value) => writeSetting("support", value)
	});
	const estopHoldMs: WritableComputedRef<number> = computed({
		get: () => readSetting("estopHoldMs"),
		set: (value) => writeSetting("estopHoldMs", value)
	});
	return { bedMap, support, estopHoldMs };
}
