import { registerTheme } from "@/plugins/theme";
import { useCacheStore } from "@/stores/cache";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";

import { PLUGIN_ID } from "./settings";

export const THEME_LIGHT = "meltingplot";
export const THEME_DARK = "meltingplot-dark";

const brand = {
	primary: "#009AD7",
	secondary: "#004276",
	accent: "#E89B26",
	success: "#00A77B",
	warning: "#E89B26",
	error: "#D94052",
	info: "#009AD7",
	navy: "#004276",
	"on-navy": "#FFFFFF",
	amber: "#E89B26",
	"on-amber": "#1A1F24"
};

/**
 * Register the Meltingplot light and dark themes. Safe to call more than once (a plugin reload
 * re-runs the entry point) - a theme that is already registered is left untouched
 */
export function registerChxThemes(): void {
	try {
		registerTheme(THEME_LIGHT, {
			dark: false,
			caption: "Meltingplot",
			colors: {
				...brand,
				// Status colors are mostly text, icons and tonal chips in Vuetify. The CI tones only
				// reach 2.3-4.4:1 on the light surfaces, these ink tones keep 4.5:1 even on a tonal chip
				success: "#007456",
				warning: "#8E5C0F",
				error: "#BA3145",
				background: "#F5F8FA",
				surface: "#FFFFFF",
				"on-surface": "#1A1F24",
				"card-title": "#394955",
				"main-menu-category": "#394955",
				"main-menu-route": "#394955",
				"chart-grid": "#CDD9E2"
			}
		});
	} catch {
		// already registered
	}
	try {
		registerTheme(THEME_DARK, {
			dark: true,
			caption: "Meltingplot (dunkel)",
			colors: {
				...brand,
				// Lighter ink tones for text, icons and tonal chips on the dark surfaces (4.5:1)
				success: "#00B182",
				error: "#EE7785",
				background: "#1A1F24",
				surface: "#21272E",
				"on-surface": "#E6F4F1",
				"card-title": "#E6F4F1",
				"main-menu-category": "#E6F4F1",
				"main-menu-route": "#E6F4F1",
				"chart-grid": "#4A5763"
			}
		});
	} catch {
		// already registered
	}
}

/**
 * Adopt the Meltingplot theme once while the CHX layout is active and the user has not picked a
 * plugin theme yet. The one-shot flag lives in the cache so the stock Settings > Display dropdown
 * keeps working afterwards (switching back to light/dark is honoured and never overridden again)
 */
export function adoptChxThemeOnce(): void {
	const cacheStore = useCacheStore();
	const settingsStore = useSettingsStore();
	const uiStore = useUiStore();

	cacheStore.registerPluginData(PLUGIN_ID, "themeApplied", false);
	if (cacheStore.plugins[PLUGIN_ID]?.themeApplied) {
		return;
	}
	if (uiStore.activeLayout?.options.id !== LAYOUT_ID || settingsStore.themeName !== null) {
		return;
	}
	settingsStore.themeName = settingsStore.darkTheme ? THEME_DARK : THEME_LIGHT;
	cacheStore.setPluginData(PLUGIN_ID, "themeApplied", true);
}

export const LAYOUT_ID = "chx350";
