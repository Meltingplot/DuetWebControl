// Meltingplot fork: setup for the unit tests (vitest.config.mts)

// Vuetify's VOverlay, which v-dialog opens, reads the bare global visualViewport
// (node_modules/vuetify/lib/components/VOverlay/locationStrategies.js:38-53, always with ?. so null is fine).
// happy-dom has no visualViewport, which turns the identifier into a ReferenceError
if (!("visualViewport" in globalThis)) {
	Object.defineProperty(globalThis, "visualViewport", { value: null, configurable: true, writable: true });
}
