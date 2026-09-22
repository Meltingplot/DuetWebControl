import { useSettingsStore } from "@/stores/settings";

/**
 * Make relative webcam URLs absolute. DWC's WebcamView resolves relative paths against the page
 * origin, which is wrong as soon as DWC is not served by the machine itself (dev server, external
 * kiosk browser). The `[HOSTNAME]` placeholder is replaced by WebcamView with the connected
 * machine's hostname, so `/webcam` becomes `http://[HOSTNAME]/webcam`. The change is persisted
 * with the other settings
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
