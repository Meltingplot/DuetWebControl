import { ref } from "vue";

import { useMachineStore } from "@/stores/machine";
import { useSettingsStore } from "@/stores/settings";

/**
 * Make relative webcam URLs absolute. DWC's WebcamView resolves relative paths against the page
 * origin, which is wrong as soon as DWC is not served by the machine itself (dev server, external
 * kiosk browser). The `[HOSTNAME]` placeholder is replaced with the connected machine's hostname,
 * so `/webcam` becomes `http://[HOSTNAME]/webcam`. The change is persisted with the other settings
 */
export function normalizeWebcamUrls(): void {
	const settingsStore = useSettingsStore();
	const webcam = settingsStore.webcam;
	if (webcam.url.startsWith("/")) {
		webcam.url = `http://[HOSTNAME]${webcam.url}`;
	}
	if (webcam.liveUrl.startsWith("/")) {
		webcam.liveUrl = `http://[HOSTNAME]${webcam.liveUrl}`;
	}
}

/**
 * Resolve the `[HOSTNAME]` placeholder against the machine DWC is connected to (not necessarily
 * the host serving DWC)
 */
export function resolveWebcamUrl(url: string): string {
	const connector = useMachineStore().connector;
	const hostname = connector ? connector.hostname : location.hostname;
	return url.replace("[HOSTNAME]", hostname);
}

const RATIO_KEY = "chx350.cameraRatio";
export const DEFAULT_CAMERA_RATIO = 16 / 9;

function loadStoredRatio(): number {
	try {
		const value = Number(localStorage.getItem(RATIO_KEY));
		if (Number.isFinite(value) && value > 0.2 && value < 5) {
			return value;
		}
	} catch {
		// storage unavailable
	}
	return DEFAULT_CAMERA_RATIO;
}

/**
 * Width/height ratio of the camera image, detected from the first decoded frame and shared by all
 * camera boxes so every page sizes its viewport to the real picture instead of a fixed 16:9. The
 * last known ratio is remembered per browser so the layout does not jump on the next page load
 */
export const cameraRatio = ref(loadStoredRatio());

export function setCameraRatio(width: number, height: number): void {
	if (width > 0 && height > 0) {
		const ratio = Math.round((width / height) * 1000) / 1000;
		if (ratio !== cameraRatio.value) {
			cameraRatio.value = ratio;
			try {
				localStorage.setItem(RATIO_KEY, String(ratio));
			} catch {
				// storage unavailable
			}
		}
	}
}
