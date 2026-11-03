import { DirectoryNotFoundError } from "@duet3d/connectors";
import { onBeforeUnmount, onMounted, ref } from "vue";

import { showConfirmDialog } from "@/composables/useConfirmDialog";
import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import Path from "@/utils/path";

/**
 * USB sticks at the operator panel (rpi-image-gen layer mp-hmi-usb). The panel's haproxy passes
 * /hmi/usb/ on to a read-only server there, for the panel's own browser only. Anywhere else (a
 * browser in the customer network, DWC served by the SBC itself) the path answers 404 or with
 * DWC's index page, and no stick is shown
 *
 *   GET /hmi/usb/list               { sticks: [{ name, label }] }
 *   GET /hmi/usb/list?path=<path>   { entries: [{ name, type: "dir" } | { name, type: "file", size, mtime }] }
 *   GET /hmi/usb/file?path=<path>   a G-code file
 *
 * <path> is the stick's name followed by the folders and the file on it, separated by "/"
 */
const BASE = "/hmi/usb";

/** How often the job list asks whether a stick is in (ms) */
const POLL_INTERVAL = 3000;

export interface UsbStick {
	/** Kernel name of the partition (e.g. sda1), first element of every path */
	name: string;
	/** Filesystem label, empty if the stick has none */
	label: string;
}

export interface UsbEntry {
	name: string;
	type: "dir" | "file";
	/** Bytes (files only) */
	size?: number;
	/** Last modification, seconds since the epoch (files only) */
	mtime?: number;
}

function query(path: string) {
	return `?path=${encodeURIComponent(path)}`;
}

/** Sticks at the panel, asked for while the calling component is mounted */
export function useUsbSticks() {
	const sticks = ref<Array<UsbStick>>([]);
	let timer: ReturnType<typeof setTimeout> | null = null;
	let stopped = false;

	async function poll() {
		let next: Array<UsbStick> = [];
		try {
			const response = await fetch(`${BASE}/list`, { cache: "no-store" });
			if (response.ok) {
				next = (await response.json()).sticks ?? [];
			}
		} catch {
			// Not the panel, or its server is down: no stick
		}
		if (JSON.stringify(next) !== JSON.stringify(sticks.value)) {
			sticks.value = next;
		}
		if (!stopped) {
			timer = setTimeout(poll, POLL_INTERVAL);
		}
	}

	onMounted(poll);
	onBeforeUnmount(() => {
		stopped = true;
		if (timer !== null) {
			clearTimeout(timer);
		}
	});
	return { sticks };
}

/** Name of a stick as the operator knows it */
export function stickCaption(stick: UsbStick) {
	return stick.label || i18n.global.t("plugins.CHX350.usb.stick");
}

/**
 * Folders and G-code files of a folder on a stick
 * @returns null when the folder is gone (stick pulled)
 */
export async function listUsbFolder(path: string): Promise<Array<UsbEntry> | null> {
	const response = await fetch(`${BASE}/list${query(path)}`, { cache: "no-store" });
	if (response.status === 404) {
		return null;
	}
	if (!response.ok) {
		throw new Error(i18n.global.t("plugins.CHX350.usb.readError"));
	}
	return (await response.json()).entries ?? [];
}

/**
 * Copy a G-code file from a stick to the job folder of the machine. When a job of that name exists
 * already, the operator is asked first
 * @param path Path of the file on the stick
 * @param showSuccess Show DWC's notification once the upload is done
 * @returns Path of the job on the machine, or null when the operator kept the existing one
 */
export async function copyUsbJob(path: string, showSuccess: boolean): Promise<string | null> {
	const machineStore = useMachineStore();
	const gcodesDir = machineStore.model.directories.gCodes || Path.gCodes;
	const name = path.substring(path.lastIndexOf("/") + 1);
	const target = Path.combine(gcodesDir, name);

	let exists = false;
	try {
		exists = (await machineStore.getFileList(gcodesDir)).some((item) => !item.isDirectory && item.name === name);
	} catch (e) {
		// The upload creates the folder
		if (!(e instanceof DirectoryNotFoundError)) {
			throw e;
		}
	}
	if (exists && !(await showConfirmDialog(
		i18n.global.t("plugins.CHX350.usb.replaceTitle"),
		i18n.global.t("plugins.CHX350.usb.replacePrompt", { name }),
		"mdi-file-replace-outline"))) {
		return null;
	}

	const response = await fetch(`${BASE}/file${query(path)}`, { cache: "no-store" });
	if (!response.ok) {
		throw new Error(i18n.global.t(response.status === 404 ? "plugins.CHX350.usb.gone" : "plugins.CHX350.usb.readError"));
	}
	let content: Blob;
	try {
		content = await response.blob();
	} catch {
		// Stick pulled mid-file: the body ends short of its Content-Length
		throw new Error(i18n.global.t("plugins.CHX350.usb.readError"));
	}
	// The caller shows a failure next to the file
	await machineStore.upload({ filename: target, content }, true, showSuccess, false);
	return target;
}
