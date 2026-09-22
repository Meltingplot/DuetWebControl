<style scoped>
.z {
	box-sizing: border-box;
	width: 168px;
	flex: none;
	padding: 14px 14px 16px;
	background: rgba(0, 0, 0, 0.55);
	display: flex;
	flex-direction: column;
	gap: 10px;
	color: #fff;
	user-select: none;
}
.z__title {
	font: 700 12px/1 var(--mp-font-body, sans-serif);
	letter-spacing: 0.1em;
	color: #D7E8F4;
	text-align: center;
}
.z__body {
	flex: 1;
	display: flex;
	gap: 8px;
	min-height: 0;
	padding: 8px 0;
}
.z__ticks {
	position: relative;
	width: 52px;
	flex: none;
}
.z__tick {
	position: absolute;
	right: 0;
	transform: translateY(-50%);
	font: 500 12px/1 var(--mp-font-mono, monospace);
	color: #D7E8F4;
	white-space: nowrap;
}
.z__track {
	position: relative;
	flex: 1;
	min-width: 0;
	border-radius: var(--mp-radius-sm);
	cursor: ns-resize;
	touch-action: none;
	background: linear-gradient(to bottom, #66D0FF 0%, #009AD7 28%, #004276 50%, #009AD7 72%, #66D0FF 100%);
}
.z--locked .z__track {
	cursor: not-allowed;
	opacity: 0.5;
}
.z__line {
	position: absolute;
	left: 0;
	right: 0;
	height: 1px;
	background: rgba(255, 255, 255, 0.45);
}
.z__knob {
	position: absolute;
	left: -5px;
	right: -5px;
	height: 8px;
	margin-top: -4px;
	border-radius: 4px;
	background: #fff;
	box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45);
	pointer-events: none;
}
.z__knob--target {
	background: var(--mp-accent);
}
.z__foot {
	text-align: center;
}
.z__num {
	font: 700 22px/1 var(--mp-font-mono, monospace);
	color: #fff;
	cursor: pointer;
}
.z__num--target {
	color: var(--mp-accent);
}
.z__step {
	margin-top: 6px;
	font: 500 12px/1.3 var(--mp-font-mono, monospace);
	color: #D7E8F4;
}
.z__hint {
	margin-top: 6px;
	font: 400 11px/1.3 var(--mp-font-body, sans-serif);
	color: #9CADBC;
	text-wrap: pretty;
}
</style>

<template>
	<div class="z" :class="{ 'z--locked': locked }">
		<div class="z__title">{{ $t("plugins.CHX350.control.zAxis") }}</div>
		<div class="z__body">
			<div class="z__ticks">
				<span v-for="t in ticks" :key="t" class="z__tick" :style="{ top: pct(t) }">{{ t }}</span>
			</div>
			<div ref="track" class="z__track" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp"
				 @pointercancel="onCancel" @contextmenu.prevent="enter">
				<div v-if="logScale" class="z__line" style="top: 28%" />
				<div v-if="logScale" class="z__line" style="top: 72%" />
				<div v-if="target !== null" class="z__knob z__knob--target" :style="{ top: pct(target) }" />
				<div class="z__knob" :style="{ top: pct(current ?? min) }" />
			</div>
		</div>
		<div class="z__foot">
			<div class="z__num" :class="{ 'z__num--target': target !== null }" @click="enter">{{ shown.toFixed(2) }}</div>
			<div class="z__step">{{ $t("plugins.CHX350.control.zStep", { step: stepLabel }) }}</div>
			<div class="z__hint">{{ locked ? $t("plugins.CHX350.generic.lockedAxes") : $t("plugins.CHX350.control.zHint") }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import { getNumericInput } from "@/composables/useInputDialog";
import i18n from "@/i18n";

// Z slider with a three-part scale as in the design mock: the first and last 10 mm of travel are
// logarithmic (0.01 mm resolution near the end stops), the range in between is linear. Z = min
// is at the top, matching the physical bed that lowers as Z grows. Dragging picks a target,
// releasing moves there; tapping the value (or a long press on the track) opens numeric entry
const props = withDefaults(defineProps<{
	current: number | null;
	min: number;
	max: number;
	locked?: boolean;
	/** Transient: pointer input is ignored without any visual change (see Control.vue) */
	busy?: boolean;
}>(), {
	locked: false,
	busy: false
});

const emit = defineEmits<{
	(e: "goto", z: number): void;
}>();

const LOG_PART = 0.28;
const LOG_MM = 10;
const LOG_MIN = 0.01;

const span = computed(() => Math.max(0, props.max - props.min));
const logScale = computed(() => span.value > 4 * LOG_MM);

function clamp(value: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, value));
}

/** 0..1 position on the track (0 = top = min) for a Z value */
function uFromZ(z: number): number {
	if (span.value <= 0) {
		return 0;
	}
	const d = clamp(z - props.min, 0, span.value);
	if (!logScale.value) {
		return d / span.value;
	}
	if (d <= LOG_MM) {
		return LOG_PART * Math.log10(Math.max(LOG_MIN, d) / LOG_MIN) / 3;
	}
	const r = span.value - d;
	if (r <= LOG_MM) {
		return 1 - LOG_PART * Math.log10(Math.max(LOG_MIN, r) / LOG_MIN) / 3;
	}
	return LOG_PART + (d - LOG_MM) / (span.value - 2 * LOG_MM) * (1 - 2 * LOG_PART);
}

function zFromU(u: number): number {
	if (u <= 0) {
		return props.min;
	}
	if (u >= 1) {
		return props.max;
	}
	if (!logScale.value) {
		return props.min + u * span.value;
	}
	if (u <= LOG_PART) {
		return props.min + LOG_MIN * Math.pow(10, (u / LOG_PART) * 3);
	}
	if (u >= 1 - LOG_PART) {
		return props.max - LOG_MIN * Math.pow(10, ((1 - u) / LOG_PART) * 3);
	}
	return props.min + LOG_MM + (u - LOG_PART) / (1 - 2 * LOG_PART) * (span.value - 2 * LOG_MM);
}

/** Snap step that matches the local resolution of the scale at track position u */
function stepAt(u: number, px: number): number {
	const d = Math.abs(zFromU(u + 1 / Math.max(80, px)) - zFromU(u));
	if (d < 0.02) return 0.01;
	if (d < 0.2) return 0.1;
	if (d < 2) return 1;
	return 5;
}

const pct = (z: number) => `${(uFromZ(z) * 100).toFixed(2)}%`;

const ticks = computed(() => {
	const lo = props.min, hi = props.max;
	if (!logScale.value) {
		return [lo, Math.round((lo + hi) / 2), hi];
	}
	const mid = span.value >= 200 ? Math.round((lo + hi) / 2 / 100) * 100 : Math.round((lo + hi) / 2);
	const values = [lo, lo + 1, lo + LOG_MM, mid, hi - LOG_MM, hi - 1, hi];
	return values.filter((v, i) => i === 0 || v > values[i - 1]).map((v) => Math.round(v * 100) / 100);
});

const track = ref<HTMLElement | null>(null);
const trackPx = ref(300);
const target = ref<number | null>(null);
let dragging = false;

const shown = computed(() => target.value ?? props.current ?? props.min);
const stepLabel = computed(() => stepAt(uFromZ(shown.value), trackPx.value).toFixed(2));

function pick(e: PointerEvent) {
	const el = track.value;
	if (!el) {
		return;
	}
	const rect = el.getBoundingClientRect();
	trackPx.value = rect.height;
	const u = clamp((e.clientY - rect.top) / rect.height, 0, 1);
	const step = stepAt(u, rect.height);
	target.value = clamp(Math.round(zFromU(u) / step) * step, props.min, props.max);
}

function onDown(e: PointerEvent) {
	if (props.locked || props.busy || e.button !== 0) {
		return;
	}
	dragging = true;
	track.value?.setPointerCapture(e.pointerId);
	pick(e);
}
function onMove(e: PointerEvent) {
	if (dragging) {
		pick(e);
	}
}
function onUp() {
	if (!dragging) {
		return;
	}
	dragging = false;
	if (target.value !== null && !props.locked && !props.busy) {
		emit("goto", target.value);
	}
	target.value = null;
}
function onCancel() {
	dragging = false;
	target.value = null;
}

async function enter() {
	// A long press on the track also lands here: never treat the pending drag as a release
	onCancel();
	if (props.locked || props.busy) {
		return;
	}
	const value = await getNumericInput(i18n.global.t("plugins.CHX350.control.enterZTitle"),
		i18n.global.t("plugins.CHX350.control.enterZPrompt", { min: props.min, max: props.max }),
		props.current ?? props.min, props.min, props.max);
	if (value !== null && !props.locked && !props.busy) {
		emit("goto", clamp(value, props.min, props.max));
	}
}

let observer: ResizeObserver | null = null;
onMounted(() => {
	if (track.value) {
		trackPx.value = track.value.clientHeight || trackPx.value;
		if (typeof ResizeObserver !== "undefined") {
			observer = new ResizeObserver(() => { trackPx.value = track.value?.clientHeight || trackPx.value; });
			observer.observe(track.value);
		}
	}
});
onBeforeUnmount(() => observer?.disconnect());
</script>
