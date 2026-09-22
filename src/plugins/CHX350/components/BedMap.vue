<style scoped>
.map {
	position: relative;
	width: 100%;
	height: 100%;
	min-height: 200px;
	border-radius: var(--mp-radius-lg);
	overflow: hidden;
	background: #0B0F13;
}
.map svg {
	display: block;
	width: 100%;
	height: 100%;
	touch-action: none;
}
.map--locked svg {
	opacity: 0.55;
}
.lock {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8px;
	color: #fff;
	text-align: center;
	pointer-events: none;
}
.lock__title {
	font: 800 22px/1 var(--mp-font-body, sans-serif);
	letter-spacing: 0.08em;
}
.lock__body {
	font: 400 13px/1.4 var(--mp-font-body, sans-serif);
	max-width: 420px;
	opacity: 0.85;
}
.hint {
	position: absolute;
	left: 12px;
	top: 10px;
	display: flex;
	align-items: center;
	gap: 8px;
	color: #D7E8F4;
	font: 600 11px/1 var(--mp-font-body, sans-serif);
	letter-spacing: 0.06em;
	pointer-events: none;
}
.hint__dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--mp-accent);
}
.axis-label {
	font: 700 12px var(--mp-font-body, sans-serif);
	fill: #D7E8F4;
}
.tick {
	font: 500 11px var(--mp-font-mono, monospace);
	fill: #9CADBC;
}
.park {
	font: 700 10px var(--mp-font-body, sans-serif);
	fill: #9CADBC;
}
.head-label {
	font: 700 12px var(--mp-font-mono, monospace);
	fill: #fff;
	text-anchor: middle;
	dominant-baseline: central;
}
.band-label {
	font: 700 11px var(--mp-font-body, sans-serif);
	fill: var(--mp-accent, #E89B26);
}
</style>

<template>
	<div class="map" :class="{ 'map--locked': locked }">
		<svg :viewBox="`0 0 ${vbW} ${vbH}`" preserveAspectRatio="xMidYMid meet" @pointerdown="onTap">
			<!-- bed -->
			<rect :x="ox" :y="oy" :width="sizeX * s" :height="sizeY * s" fill="#10151A" stroke="#9CADBC" stroke-width="2" />
			<!-- grid -->
			<template v-for="x in gridX" :key="`gx${x}`">
				<line :x1="px(x)" :x2="px(x)" :y1="oy" :y2="oy + sizeY * s" stroke="#2C343C" stroke-width="1" />
				<text :x="px(x)" :y="oy + sizeY * s + 16" text-anchor="middle" class="tick">{{ x }}</text>
			</template>
			<template v-for="y in gridY" :key="`gy${y}`">
				<line :x1="ox" :x2="ox + sizeX * s" :y1="py(y)" :y2="py(y)" stroke="#2C343C" stroke-width="1" />
				<text :x="ox - 8" :y="py(y) + 4" text-anchor="end" class="tick">{{ y }}</text>
			</template>
			<text :x="ox + (sizeX * s) / 2" :y="vbH - 6" text-anchor="middle" class="axis-label">X {{ sizeX }} mm →</text>
			<text :transform="`translate(14, ${oy + (sizeY * s) / 2}) rotate(-90)`" text-anchor="middle" class="axis-label">Y{{ hasSecondTool ? " / " + tool1Axis : "" }} {{ sizeY }} mm →</text>

			<!-- keep-out band between the two heads (IDEX) -->
			<g v-if="hasSecondTool && band">
				<rect :x="ox" :y="band.y" :width="sizeX * s" :height="band.h" fill="rgba(232,155,38,0.12)" />
				<line :x1="ox" :x2="ox + sizeX * s" :y1="band.y" :y2="band.y" stroke="rgba(232,155,38,0.5)" stroke-width="1" stroke-dasharray="4 4" />
				<line :x1="ox" :x2="ox + sizeX * s" :y1="band.y + band.h" :y2="band.y + band.h" stroke="rgba(232,155,38,0.5)" stroke-width="1" stroke-dasharray="4 4" />
				<text v-if="band.h > 24" :x="ox + 12" :y="band.y + band.h / 2 + 4" class="band-label">{{ $t("plugins.CHX350.control.keepOut", { tool: selectedTool === 0 ? 1 : 0 }) }}</text>
			</g>

			<!-- target crosshair while moving -->
			<g v-if="target" stroke="#E89B26" stroke-width="2.5" fill="none">
				<circle :cx="px(target.x)" :cy="py(target.y)" r="16" />
				<line :x1="px(target.x) - 24" :x2="px(target.x) - 8" :y1="py(target.y)" :y2="py(target.y)" />
				<line :x1="px(target.x) + 8" :x2="px(target.x) + 24" :y1="py(target.y)" :y2="py(target.y)" />
				<line :x1="px(target.x)" :x2="px(target.x)" :y1="py(target.y) - 24" :y2="py(target.y) - 8" />
				<line :x1="px(target.x)" :x2="px(target.x)" :y1="py(target.y) + 8" :y2="py(target.y) + 24" />
			</g>

			<!-- heads -->
			<g v-for="head in heads" :key="head.tool">
				<template v-if="head.tool === selectedTool">
					<line :x1="px(head.x)" :x2="px(head.x)" :y1="oy" :y2="oy + sizeY * s" stroke="#009AD7" stroke-width="1.5" />
					<line :x1="ox" :x2="ox + sizeX * s" :y1="py(head.y)" :y2="py(head.y)" stroke="#009AD7" stroke-width="1.5" />
					<circle :cx="px(head.x)" :cy="py(head.y)" r="18" fill="#009AD7" />
				</template>
				<template v-else>
					<line :x1="ox" :x2="ox + sizeX * s" :y1="py(head.y)" :y2="py(head.y)" stroke="#4A5763" stroke-width="1.5" stroke-dasharray="5 5" />
					<circle :cx="px(head.x)" :cy="py(head.y)" r="16" fill="#10151A" stroke="#9CADBC" stroke-width="2.5" />
				</template>
				<text :x="px(head.x)" :y="py(head.y)" class="head-label">T{{ head.tool }}</text>
			</g>
		</svg>

		<div class="hint">
			<span class="hint__dot" />
			<span>{{ locked ? $t("plugins.CHX350.generic.lockedAxes") : (moving ? $t("plugins.CHX350.control.moving") : $t("plugins.CHX350.control.tapHint")) }}</span>
		</div>
		<div v-if="locked" class="lock">
			<v-icon size="40">mdi-lock-outline</v-icon>
			<div class="lock__title">{{ $t("plugins.CHX350.generic.lockedAxes") }}</div>
			<div class="lock__body">{{ lockReason }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

// Tap-to-move bed map. Renders the printable area to scale with the current head positions
// (from the object model) and moves the selected head to the tapped point with an absolute G1.
// For an IDEX machine the second head's Y motion is on its own axis (`tool1Axis`) and the band
// the other head occupies is drawn as a keep-out zone; taps into it are clamped
const props = withDefaults(defineProps<{
	sizeX: number;
	sizeY: number;
	/** [x, y] of each tool's head (mm); index = tool number */
	heads: Array<{ tool: number; x: number; y: number }>;
	selectedTool: number;
	/** Minimum head spacing in mm (IDEX) */
	headSpacing?: number;
	tool1Axis?: string;
	locked?: boolean;
	lockReason?: string;
	moving?: boolean;
	target?: { x: number; y: number } | null;
}>(), {
	headSpacing: 60,
	tool1Axis: "U",
	locked: false,
	lockReason: "",
	moving: false,
	target: null
});

const emit = defineEmits<{
	(e: "move", point: { x: number; y: number }): void;
	(e: "select", tool: number): void;
}>();

// Fixed viewBox in mm-ish units with margins for the axis labels; the SVG scales to its box
const padL = 44, padR = 16, padT = 14, padB = 30;
const vbW = computed(() => props.sizeX + padL + padR);
const vbH = computed(() => props.sizeY + padT + padB);
const s = 1;
const ox = padL, oy = padT;
const sizeX = computed(() => props.sizeX);
const sizeY = computed(() => props.sizeY);

const px = (x: number) => ox + x * s;
const py = (y: number) => oy + (props.sizeY - y) * s;

const gridX = computed(() => Array.from({ length: Math.floor(props.sizeX / 100) + 1 }, (_, i) => i * 100));
const gridY = computed(() => Array.from({ length: Math.floor(props.sizeY / 100) + 1 }, (_, i) => i * 100));

const hasSecondTool = computed(() => props.heads.length > 1);

// Band the OTHER head blocks for the selected one. T0 lives on Y (front), T1 on U (rear);
// the selected head may not come closer than headSpacing to the other one
const band = computed(() => {
	if (!hasSecondTool.value) {
		return null;
	}
	const other = props.heads.find((h) => h.tool !== props.selectedTool);
	if (!other) {
		return null;
	}
	const lo = props.selectedTool === 0 ? other.y - props.headSpacing : 0;
	const hi = props.selectedTool === 0 ? props.sizeY : other.y + props.headSpacing;
	const yTop = py(Math.min(props.sizeY, hi));
	const yBottom = py(Math.max(0, lo));
	return { y: yTop, h: Math.max(0, yBottom - yTop) };
});

const svgPoint = ref<DOMPoint | null>(null);
function onTap(e: PointerEvent) {
	if (props.locked) {
		return;
	}
	const svg = (e.currentTarget as SVGSVGElement);
	const pt = svg.createSVGPoint();
	pt.x = e.clientX;
	pt.y = e.clientY;
	const ctm = svg.getScreenCTM();
	if (!ctm) {
		return;
	}
	const local = pt.matrixTransform(ctm.inverse());
	svgPoint.value = local;
	const x = (local.x - ox) / s;
	const y = props.sizeY - (local.y - oy) / s;

	// Tapping the other head selects it
	const other = props.heads.find((h) => h.tool !== props.selectedTool);
	if (other && Math.hypot(local.x - px(other.x), local.y - py(other.y)) < 24) {
		emit("select", other.tool);
		return;
	}
	if (x < -10 || x > props.sizeX + 10 || y < -10 || y > props.sizeY + 10) {
		return;
	}
	let cx = Math.max(0, Math.min(props.sizeX, x));
	let cy = Math.max(0, Math.min(props.sizeY, y));
	if (other) {
		if (props.selectedTool === 0) {
			cy = Math.min(cy, Math.max(0, other.y - props.headSpacing));
		} else {
			cy = Math.max(cy, Math.min(props.sizeY, other.y + props.headSpacing));
		}
	}
	emit("move", { x: Math.round(cx * 10) / 10, y: Math.round(cy * 10) / 10 });
}
</script>
