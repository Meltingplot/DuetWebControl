import { computed, type WritableComputedRef } from "vue";

import { useSettingsStore } from "@/stores/settings";

export const PLUGIN_ID = "CHX350";

/**
 * Machine actions the operator UI triggers. Each entry is a G-code string sent verbatim through
 * machineStore.sendCode(). The defaults are placeholders - the real macros are configured per
 * machine in Settings > CHX 350
 */
export interface ChxMacroSettings {
	/** "Bett vorbereiten": park the print heads and lower the bed */
	prepareBed: string;
	/** "Vorheizen": bring bed and tools to their standby temperatures */
	preheat: string;
	/** "Kalibrieren": per calibration routine */
	calibrateZero: string;
	calibrateMesh: string;
	calibrateAlignZ: string;
	/** "Referenzieren": home all axes */
	home: string;
}

export interface ChxBedMapSettings {
	/** Printable bed size in mm (X and Y). Defaults match the CHX 350 */
	sizeX: number;
	sizeY: number;
	/** Minimum distance between the two print heads (IDEX keep-out band) in mm */
	headSpacing: number;
	/** Axis letter the second tool's Y motion uses */
	tool1YAxis: string;
	/** Feedrate for tap-to-move and Z jogs in mm/min */
	moveFeedrate: number;
	/** Selectable Z step sizes in mm */
	zSteps: Array<number>;
}

export interface ChxSupportSettings {
	company: string;
	phone: string;
	phoneHours: string;
	email: string;
	url: string;
	/** Machine model shown on About/Support */
	model: string;
}

export interface ChxSettings {
	macros: ChxMacroSettings;
	bedMap: ChxBedMapSettings;
	support: ChxSupportSettings;
	/** Press-and-hold duration for NOT-AUS in ms */
	estopHoldMs: number;
}

export const PLACEHOLDER_MACRO = 'M98 P""';

export const CHX_DEFAULTS: ChxSettings = {
	macros: {
		prepareBed: PLACEHOLDER_MACRO,
		preheat: PLACEHOLDER_MACRO,
		calibrateZero: PLACEHOLDER_MACRO,
		calibrateMesh: PLACEHOLDER_MACRO,
		calibrateAlignZ: PLACEHOLDER_MACRO,
		home: "G28"
	},
	bedMap: {
		sizeX: 880,
		sizeY: 422,
		headSpacing: 60,
		tool1YAxis: "U",
		moveFeedrate: 6000,
		zSteps: [0.01, 0.1, 1, 5]
	},
	support: {
		company: "Meltingplot GmbH",
		phone: "+49 431 000 000",
		phoneHours: "Mo–Fr 8–17 Uhr",
		email: "support@meltingplot.net",
		url: "https://www.meltingplot.net",
		model: "CHX 350"
	},
	estopHoldMs: 1200
};

/**
 * Whether a configured macro is still the placeholder (nothing to run)
 */
export function isPlaceholderMacro(code: string | null | undefined): boolean {
	const trimmed = (code ?? "").trim();
	return trimmed === "" || trimmed === PLACEHOLDER_MACRO;
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
	const macros: WritableComputedRef<ChxMacroSettings> = computed({
		get: () => readSetting("macros"),
		set: (value) => writeSetting("macros", value)
	});
	const bedMap: WritableComputedRef<ChxBedMapSettings> = computed({
		get: () => readSetting("bedMap"),
		set: (value) => writeSetting("bedMap", value)
	});
	const support: WritableComputedRef<ChxSupportSettings> = computed({
		get: () => readSetting("support"),
		set: (value) => writeSetting("support", value)
	});
	const estopHoldMs: WritableComputedRef<number> = computed({
		get: () => readSetting("estopHoldMs"),
		set: (value) => writeSetting("estopHoldMs", value)
	});
	return { macros, bedMap, support, estopHoldMs };
}
