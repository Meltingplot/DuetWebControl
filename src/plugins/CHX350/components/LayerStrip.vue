<style scoped>
.strip {
	position: relative;
	width: 100%;
	height: 100%;
	min-height: 40px;
}
.strip svg {
	display: block;
	width: 100%;
	height: 100%;
}
.strip--interactive svg {
	cursor: crosshair;
	touch-action: none;
}
</style>

<template>
	<div ref="root" class="strip" :class="{ 'strip--interactive': interactive }">
		<svg :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none"
			 @pointerdown="onPointer" @pointermove="onMove">
			<template v-for="bar in bars" :key="bar.i">
				<rect :x="bar.x" :y="bar.y" :width="bar.w" :height="bar.h" :fill="bar.color" />
			</template>
			<line v-if="marker !== null" :x1="markerX" :x2="markerX" :y1="0" :y2="height" stroke="var(--text-strong, #1A1F24)" stroke-width="2" />
		</svg>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import { rampColor } from "../composables/useJobAnalysis";

// Compact per-layer bar strip: one bar per layer bucket, height and colour follow the value.
// Bars beyond `printed` are drawn as flat placeholders so the total length of the job stays
// visible while it is running. Purely SVG - no chart dependency
const props = withDefaults(defineProps<{
	values: Array<number | null>;
	/** Number of layers the job will have in total (>= values.length); placeholders beyond values */
	total?: number;
	range: [number, number];
	/** Layer index (0-based) to mark with a vertical line */
	marker?: number | null;
	interactive?: boolean;
}>(), {
	total: 0,
	marker: null,
	interactive: false
});

const emit = defineEmits<{
	(e: "pick", index: number): void;
}>();

const root = ref<HTMLElement | null>(null);
const width = ref(600);
const height = 60;

let observer: ResizeObserver | null = null;
onMounted(() => {
	if (root.value) {
		width.value = Math.max(100, root.value.clientWidth);
		observer = new ResizeObserver(() => {
			if (root.value) {
				width.value = Math.max(100, root.value.clientWidth);
			}
		});
		observer.observe(root.value);
	}
});
onBeforeUnmount(() => observer?.disconnect());

const count = computed(() => Math.max(props.values.length, props.total, 1));
const bucketCount = computed(() => Math.max(20, Math.min(220, Math.floor(width.value / 5))));

const bars = computed(() => {
	const n = bucketCount.value;
	const total = count.value;
	const bw = width.value / n;
	const [min, max] = props.range;
	const span = max - min || 1;
	const result: Array<{ i: number; x: number; y: number; w: number; h: number; color: string }> = [];
	for (let b = 0; b < n; b++) {
		const from = Math.floor((b * total) / n);
		const to = Math.max(from + 1, Math.floor(((b + 1) * total) / n));
		let sum = 0, cnt = 0;
		for (let l = from; l < to && l < props.values.length; l++) {
			const v = props.values[l];
			if (v !== null && Number.isFinite(v)) {
				sum += v;
				cnt++;
			}
		}
		const x = b * bw;
		const w = Math.max(1, bw - 1.2);
		if (cnt === 0) {
			result.push({ i: b, x, y: height - 3, w, h: 3, color: "var(--border-default, #CDD9E2)" });
			continue;
		}
		const u = (sum / cnt - min) / span;
		const h = Math.max(4, 8 + Math.max(0, Math.min(1, u)) * (height - 12));
		result.push({ i: b, x, y: height - h, w, h, color: rampColor(u) });
	}
	return result;
});

const markerX = computed(() => props.marker === null ? 0 : ((props.marker + 0.5) / count.value) * width.value);

function indexFromEvent(e: PointerEvent): number | null {
	const el = root.value;
	if (!el) {
		return null;
	}
	const rect = el.getBoundingClientRect();
	const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
	return Math.min(count.value - 1, Math.floor(f * count.value));
}

function onPointer(e: PointerEvent) {
	if (!props.interactive) {
		return;
	}
	const i = indexFromEvent(e);
	if (i !== null) {
		emit("pick", i);
	}
}

function onMove(e: PointerEvent) {
	if (props.interactive && e.buttons > 0) {
		onPointer(e);
	}
}
</script>
