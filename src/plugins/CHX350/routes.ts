/**
 * Route table of the CHX 350 operator UI. Pages live under /CHX/*; "/" and "/Job/Status" are
 * overridden through the layout registration so DWC's own navigation (e.g. the automatic switch to
 * the job page on print start) lands on the CHX pages
 */
export const ROUTES = {
	start: "/",
	jobs: "/CHX/Jobs",
	check: "/CHX/Check",
	job: "/Job/Status",
	filament: "/CHX/Filament",
	prepareBed: "/CHX/PrepareBed",
	preheat: "/CHX/Preheat",
	calibrate: "/CHX/Calibrate",
	home: "/CHX/Home",
	control: "/CHX/Control",
	history: "/CHX/History",
	analysis: "/CHX/Analysis",
	about: "/CHX/About",
	support: "/CHX/Support",
	service: "/CHX/Service"
} as const;

export interface NavItem {
	path: string;
	icon: string;
	/** i18n key */
	caption: string;
	/** Route prefixes that highlight this entry */
	matches: Array<string>;
}

/** Primary sidebar entries (top to bottom) */
export const NAV_ITEMS: ReadonlyArray<NavItem> = [
	{
		path: ROUTES.start, icon: "mdi-view-grid-outline", caption: "plugins.CHX350.nav.start",
		matches: ["/", ROUTES.jobs, ROUTES.check, ROUTES.job, ROUTES.filament, ROUTES.prepareBed, ROUTES.preheat, ROUTES.calibrate, ROUTES.home]
	},
	{ path: ROUTES.control, icon: "mdi-axis-arrow", caption: "plugins.CHX350.nav.control", matches: [ROUTES.control] },
	{ path: ROUTES.history, icon: "mdi-history", caption: "plugins.CHX350.nav.history", matches: [ROUTES.history, ROUTES.analysis] },
	{ path: ROUTES.support, icon: "mdi-headset", caption: "plugins.CHX350.nav.support", matches: [ROUTES.support] },
	{ path: ROUTES.about, icon: "mdi-information-outline", caption: "plugins.CHX350.nav.about", matches: [ROUTES.about] }
];

/** Bottom sidebar entry */
export const SERVICE_ITEM: NavItem = {
	path: ROUTES.service, icon: "mdi-lock-outline", caption: "plugins.CHX350.nav.service",
	matches: [ROUTES.service, "/Console", "/Plugins", "/Settings", "/Explorer", "/Macros", "/Temperatures", "/Dashboard", "/Jobs", "/Job/Webcam"]
};
