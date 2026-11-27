// Meltingplot fork: regression test for the incompatible versions check, which upstream 23b24f0f
// ("Incompatible versions check ran between the boards of a multi-board update") fixed
import { MachineStatus } from "@duet3d/objectmodel";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { VBtn, VCard, VCardActions, VCardText, VCardTitle, VDialog, VIcon, VSpacer } from "vuetify/components";

import IncompatibleVersionsDialog from "@/components/dialogs/IncompatibleVersionsDialog.vue";
import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import vuetify from "@/vue-plugins/vuetify";

import packageInfo from "../../../package.json";

// The machine store imports the plugin loader (src/stores/machine.ts:12 and :14), which pulls in the
// router, the generated layouts and the built-in plugins through virtual modules that only the plugins
// of vite.config.mts provide. The dialog uses none of it
vi.mock("@/plugins", () => ({
	checkManifest: vi.fn(),
	checkVersion: vi.fn(),
	loadDwcPlugin: vi.fn(),
	loadDwcPlugins: vi.fn(),
	unloadDwcPlugin: vi.fn()
}));

// The check runs 2 s after it is scheduled (IncompatibleVersionsDialog.vue:149)
const checkDelay = 2000;

// The main board runs the DWC version, so the DWC comparison finds no difference (IncompatibleVersionsDialog.vue:119-130,
// src/utils/version.ts:50). An expansion board on another minor version is a mismatch that is not at patch level
// (src/utils/version.ts:41-43 and :53-55), which opens the dialog (IncompatibleVersionsDialog.vue:94-99 and :132)
const mainboardVersion = packageInfo.version;
const otherMinorVersion = "3.99.0";

describe("IncompatibleVersionsDialog", () => {
	let machineStore: ReturnType<typeof useMachineStore>;
	let wrapper: VueWrapper;

	/**
	 * Report a new status the way a connector does, through updateModel (src/stores/machine.ts:1213),
	 * and let the watchers of the dialog run
	 */
	async function setStatus(status: MachineStatus) {
		machineStore.updateModel({ state: { status } });
		await nextTick();
	}

	/**
	 * Report the firmware version of expansion board 1, the main board keeps the DWC version.
	 * The main board is the one without a CAN address (IncompatibleVersionsDialog.vue:82)
	 */
	async function setExpansionBoardVersion(version: string) {
		machineStore.updateModel({
			boards: [
				{ canAddress: null, firmwareVersion: mainboardVersion },
				{ canAddress: 1, firmwareVersion: version }
			]
		});
		await nextTick();
	}

	/**
	 * Whether a check has run and found the mismatch: the dialog is open and its title is on the page
	 */
	async function dialogShown(): Promise<boolean> {
		await nextTick();
		const open = wrapper.getComponent(VDialog).props("modelValue") as boolean;
		const titleOnPage = document.body.textContent?.includes(i18n.global.t("dialog.incompatibleVersions.title")) ?? false;
		expect(titleOnPage, "dialog title on the page").toBe(open);
		return open;
	}

	beforeEach(async () => {
		vi.useFakeTimers();

		const pinia = createPinia();
		setActivePinia(pinia);
		machineStore = useMachineStore();

		// Connected, idle and all boards on the same version
		await setStatus(MachineStatus.idle);
		await setExpansionBoardVersion(mainboardVersion);
		expect(machineStore.model.boards.map((board) => [board.canAddress, board.firmwareVersion]))
			.toEqual([[null, mainboardVersion], [1, mainboardVersion]]);

		wrapper = mount(IncompatibleVersionsDialog, {
			attachTo: document.body,
			global: {
				plugins: [pinia, i18n, vuetify],
				// The app registers the Vuetify components it uses globally (src/plugins/index.ts:361-362)
				components: { VBtn, VCard, VCardActions, VCardText, VCardTitle, VDialog, VIcon, VSpacer }
			}
		});

		// The check scheduled on mount (IncompatibleVersionsDialog.vue:164-168) finds nothing
		await vi.advanceTimersByTimeAsync(checkDelay + 100);
		expect(await dialogShown()).toBe(false);
	});

	afterEach(() => {
		wrapper.unmount();
		document.body.replaceChildren();
		vi.useRealTimers();
	});

	it("does not check while the machine is in a transient state and checks 2 s after it leaves it", async () => {
		await setStatus(MachineStatus.updating);
		await setExpansionBoardVersion(otherMinorVersion);
		await vi.advanceTimersByTimeAsync(5 * checkDelay);
		expect(await dialogShown()).toBe(false);

		// From one transient state to the next
		await setStatus(MachineStatus.starting);
		await vi.advanceTimersByTimeAsync(5 * checkDelay);
		expect(await dialogShown()).toBe(false);

		await setStatus(MachineStatus.idle);
		await vi.advanceTimersByTimeAsync(checkDelay - 100);
		expect(await dialogShown()).toBe(false);
		await vi.advanceTimersByTimeAsync(200);
		expect(await dialogShown()).toBe(true);
	});

	it("drops a scheduled check when the machine enters a transient state within 2 s", async () => {
		await setStatus(MachineStatus.disconnected);
		await setExpansionBoardVersion(otherMinorVersion);
		await setStatus(MachineStatus.idle);
		await vi.advanceTimersByTimeAsync(checkDelay / 2);

		await setStatus(MachineStatus.disconnected);
		await vi.advanceTimersByTimeAsync(5 * checkDelay);
		expect(await dialogShown()).toBe(false);

		await setStatus(MachineStatus.idle);
		await vi.advanceTimersByTimeAsync(checkDelay + 100);
		expect(await dialogShown()).toBe(true);
	});

	it("does not check between the boards of a multi-board update, only after the last board", async () => {
		// An update of expansion board 1 and the main board, as runUpdate() in
		// src/composables/useFirmwareInstall.ts:403 and :418 starts it
		machineStore.boardsBeingUpdated = [1, 0];
		machineStore.boardBeingUpdated = 1;
		await setStatus(MachineStatus.updating);

		// Board 1 comes back with the new version while the main board still has the old one, and the
		// status drops back to idle before the main board is updated: runUpdate() sends the next M997 only
		// once the status is no longer updating (src/composables/useFirmwareInstall.ts:420-421 and :471-477),
		// see also upstream's comment at IncompatibleVersionsDialog.vue:176
		await setExpansionBoardVersion(otherMinorVersion);
		await setStatus(MachineStatus.idle);
		await vi.advanceTimersByTimeAsync(5 * checkDelay);
		expect(await dialogShown(), "check ran between the boards").toBe(false);

		// The main board (src/composables/useFirmwareInstall.ts:445)
		machineStore.boardBeingUpdated = 0;
		await setStatus(MachineStatus.updating);
		await vi.advanceTimersByTimeAsync(5 * checkDelay);
		await setStatus(MachineStatus.idle);
		await vi.advanceTimersByTimeAsync(5 * checkDelay);
		expect(await dialogShown(), "check ran before the board list was cleared").toBe(false);

		// The update is over (src/composables/useFirmwareInstall.ts:457-458). Here the main board kept
		// its old version, so the check that runs now finds the mismatch
		machineStore.boardBeingUpdated = -1;
		machineStore.boardsBeingUpdated = [];
		await nextTick();
		await vi.advanceTimersByTimeAsync(checkDelay - 100);
		expect(await dialogShown()).toBe(false);
		await vi.advanceTimersByTimeAsync(200);
		expect(await dialogShown(), "check did not run after the update").toBe(true);
	});
});
