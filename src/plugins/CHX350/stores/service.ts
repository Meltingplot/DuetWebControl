import { defineStore } from "pinia";

/**
 * Service-area access state. v1 is always unlocked; the store exists so the Service page, the
 * sidebar and a future WebAuthn/FIDO unlock flow share one source of truth
 */
export const useServiceStore = defineStore("chx350-service", {
	state: () => ({
		unlocked: true,
		/** Whether an unlock mechanism is configured at all (false = no lock UI shown) */
		lockAvailable: false
	}),
	actions: {
		async unlock(): Promise<boolean> {
			// TODO: WebAuthn/FIDO challenge against the SBC backend
			this.unlocked = true;
			return true;
		},
		lock() {
			if (this.lockAvailable) {
				this.unlocked = false;
			}
		}
	}
});
