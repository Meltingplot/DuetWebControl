<style scoped>
.chart {
	position: relative;
	width: 100%;
	height: 100%;
	min-height: 80px;
}
.chart svg {
	display: block;
	width: 100%;
	height: 100%;
}
.axis {
	font: 500 11px var(--mp-font-mono, monospace);
	fill: var(--text-body, #4A5568);
}
.axis-x {
	font: 500 11px var(--mp-font-body, sans-serif);
	fill: var(--text-body, #4A5568);
}
</style>

<template>
	<div ref="root" class="chart">
		<svg :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none">
			<template v-for="g in gridLines" :key="g.y">
				<line :x1="padL" :x2="width - padR" :y1="g.y" :y2="g.y" stroke="var(--border-subtle, #E2EAF0)" stroke-width="1" />
				<text :x="padL - 8" :y="g.y + 4" text-anchor="end" class="axis">{{ g.label }}</text>
			</template>
			<path v-if="areaPath" :d="areaPath" fill="rgba(0,66,118,0.14)" />
			<path v-if="linePath" :d="linePath" fill="none" stroke="var(--mp-primary-dark, #004276)" stroke-width="2.5" stroke-linejoin="round" />
			<line v-if="projection" :x1="projection.x1" :y1="projection.y1" :x2="projection.x2" :y2="projection.y2"
				  stroke="var(--text-muted, #9CADBC)" stroke-width="2" stroke-dasharray="6 6" />
			<circle v-if="last" :cx="last.x" :cy="last.y" r="5" fill="var(--mp-primary-dark, #004276)" />
			<line :x1="padL" :x2="width - padR" :y1="height - padB" :y2="height - padB" stroke="var(--border-default, #CDD9E2)" stroke-width="1" />
			<text :x="padL" :y="height - padB + 14" class="axis-x">{{ $t("plugins.CHX350.job.chartStart") }}</text>
			<text :x="width - padR" :y="height - padB + 14" text-anchor="end" class="axis-x">{{ $t("plugins.CHX350.job.chartEnd") }}</text>
		</svg>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

// Cumulative filament usage over the job (from job.layers) against the slicer's total, with a
// dashed projection to the end of the job. Values are in mm of filament; the label formatter
// converts to the unit shown on the axis
const props = defineProps<{
	/** Cumulative values per layer (mm) */
	cumulative: Array<number>;
	/** Slicer total (mm); the chart's y range */
	total: number;
	/** Expected number of layers in total (x range) */
	totalLayers: number;
	/** Formats a value in mm for the y-axis */
	format: (mm: number) => string;
}>();

const root = ref<HTMLElement | null>(null);
const width = ref(600);
const height = 140;
const padL = 56, padR = 10, padT = 10, padB = 20;

let observer: ResizeObserver | null = null;
onMounted(() => {
	if (root.value) {
		width.value = Math.max(200, root.value.clientWidth);
		observer = new ResizeObserver(() => {
			if (root.value) {
				width.value = Math.max(200, root.value.clientWidth);
			}
		});
		observer.observe(root.value);
	}
});
onBeforeUnmount(() => observer?.disconnect());

const yMax = computed(() => Math.max(props.total, props.cumulative[props.cumulative.length - 1] ?? 0, 1));
const xCount = computed(() => Math.max(props.totalLayers, props.cumulative.length, 1));

const X = (i: number) => padL + (i / xCount.value) * (width.value - padL - padR);
const Y = (mm: number) => (height - padB) - (mm / yMax.value) * (height - padB - padT);

const points = computed(() => props.cumulative.map((v, i) => [X(i + 1), Y(v)] as [number, number]));

const linePath = computed(() => {
	if (points.value.length === 0) {
		return "";
	}
	return `M ${X(0)} ${Y(0)} ` + points.value.map((p) => `L ${p[0]} ${p[1]}`).join(" ");
});
const areaPath = computed(() => {
	if (points.value.length === 0) {
		return "";
	}
	const lastP = points.value[points.value.length - 1];
	return `${linePath.value} L ${lastP[0]} ${Y(0)} Z`;
});
const last = computed(() => points.value.length > 0 ? { x: points.value[points.value.length - 1][0], y: points.value[points.value.length - 1][1] } : null);
const projection = computed(() => {
	if (!last.value || props.cumulative.length >= xCount.value) {
		return null;
	}
	return { x1: last.value.x, y1: last.value.y, x2: X(xCount.value), y2: Y(props.total) };
});
const gridLines = computed(() => [0, 0.5, 1].map((f) => ({ y: Y(yMax.value * f), label: props.format(yMax.value * f) })));
</script>
