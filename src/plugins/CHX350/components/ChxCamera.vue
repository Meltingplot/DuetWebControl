<style scoped>
.cam {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #0B0F13;
}
.cam img {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: contain;
}
.cam :deep(.webcam-view) {
	position: absolute;
	inset: 0;
}
.cam__off {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	color: var(--mp-neutral-400);
	font: 500 14px/1 var(--mp-font-mono, monospace);
}
.flip-x {
	transform: scaleX(-1);
}
.flip-y {
	transform: scaleY(-1);
}
.flip-x.flip-y {
	transform: scale(-1, -1);
}
.rotate-90 {
	transform: rotate(90deg);
}
.rotate-180 {
	transform: rotate(180deg);
}
.rotate-270 {
	transform: rotate(270deg);
}
</style>

<template>
	<div class="cam">
		<!-- WebRTC sources keep using the stock component; everything else is a plain image so the
			 picture scales to the box (an iframe does neither scale nor center an MJPEG stream) -->
		<WebcamView v-if="enabled && isRtc" />
		<img v-else-if="enabled" ref="img" :src="src" alt="" :class="classList" @load="onLoad" @error="onError">
		<div v-else class="cam__off">
			<v-icon size="56">mdi-camera-off-outline</v-icon>
			<span>{{ $t("plugins.CHX350.start.cameraOff") }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import WebcamView from "@/components/panels/WebcamView.vue";
import { useSettingsStore, WebcamFlip } from "@/stores/settings";

import { cameraLive, resolveWebcamUrl, setCameraRatio } from "../webcam";

const settingsStore = useSettingsStore();

const enabled = computed(() => settingsStore.webcam.enabled);
const isRtc = computed(() => /^wss?:/i.test(settingsStore.webcam.url));
// A continuous stream (MJPEG) is kept open; only a still-image source is re-requested periodically.
// "embedded" is what operators used to pick for a stream, so it selects streaming mode here as well
const streaming = computed(() => settingsStore.webcam.embedded || settingsStore.webcam.updateInterval <= 0);

const img = ref<HTMLImageElement | null>(null);
const src = ref("");

const classList = computed(() => {
	const result: Array<string> = [];
	const flip = settingsStore.webcam.flip;
	if (flip === WebcamFlip.X || flip === WebcamFlip.Both) {
		result.push("flip-x");
	}
	if (flip === WebcamFlip.Y || flip === WebcamFlip.Both) {
		result.push("flip-y");
	}
	switch (settingsStore.webcam.rotation) {
		case 90: result.push("rotate-90"); break;
		case 180: result.push("rotate-180"); break;
		case 270: result.push("rotate-270"); break;
	}
	return result;
});

let pollTimer: ReturnType<typeof setInterval> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let ratioTimer: ReturnType<typeof setInterval> | null = null;
let generation = 0;

function withCacheBuster(url: string): string {
	// Same convention as the stock WebcamView: some cameras 404 on extra query parameters
	if (settingsStore.webcam.useFix) {
		return `${url}_${Math.random()}`;
	}
	return url + (url.indexOf("?") === -1 ? "?dummy=" : "&dummy=") + Math.random();
}

function load(forceReconnect = false) {
	const url = resolveWebcamUrl(settingsStore.webcam.url);
	// A stream only needs a fresh URL when it has to be re-opened after an error; re-setting the
	// same src would not make the browser reconnect
	src.value = (!streaming.value || forceReconnect || generation > 0) ? withCacheBuster(url) : url;
	generation++;
	watchRatio();
}

// The load event of a multipart stream is not guaranteed to fire in every browser, so the natural
// size is also polled for a while after (re)connecting
function watchRatio() {
	stopRatioTimer();
	let attempts = 0;
	ratioTimer = setInterval(() => {
		const el = img.value;
		if (el && el.naturalWidth > 0 && el.naturalHeight > 0) {
			setCameraRatio(el.naturalWidth, el.naturalHeight);
			cameraLive.value = true;
			stopRatioTimer();
		} else if (++attempts > 20) {
			stopRatioTimer();
		}
	}, 500);
}
function stopRatioTimer() {
	if (ratioTimer !== null) {
		clearInterval(ratioTimer);
		ratioTimer = null;
	}
}

function onLoad() {
	const el = img.value;
	if (el) {
		setCameraRatio(el.naturalWidth, el.naturalHeight);
		cameraLive.value = el.naturalWidth > 0;
	}
}

function onError() {
	cameraLive.value = false;
	// Camera restarting or network hiccup: try again a bit later
	if (retryTimer === null) {
		retryTimer = setTimeout(() => {
			retryTimer = null;
			load(true);
		}, 3000);
	}
}

function restart() {
	if (pollTimer !== null) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
	if (retryTimer !== null) {
		clearTimeout(retryTimer);
		retryTimer = null;
	}
	if (!enabled.value || isRtc.value) {
		src.value = "";
		cameraLive.value = false;
		return;
	}
	generation = 0;
	load();
	if (!streaming.value) {
		pollTimer = setInterval(() => load(), settingsStore.webcam.updateInterval);
	}
}

onMounted(restart);
watch(() => settingsStore.webcam, restart, { deep: true });

onBeforeUnmount(() => {
	if (pollTimer !== null) {
		clearInterval(pollTimer);
	}
	if (retryTimer !== null) {
		clearTimeout(retryTimer);
	}
	stopRatioTimer();
	// Drop the stream connection right away instead of when the element is garbage collected
	if (img.value) {
		img.value.src = "";
	}
});
</script>
