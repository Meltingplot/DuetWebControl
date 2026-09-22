<style scoped>
.box {
	position: relative;
	width: 100%;
	min-width: 0;
}
.box--fit {
	aspect-ratio: var(--chx-camera-ratio, 16 / 9);
}
.box--fill {
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
}
.stage {
	position: relative;
	border-radius: var(--mp-radius-lg);
	overflow: hidden;
	background: #0B0F13;
}
.box--fit > .stage {
	position: absolute;
	inset: 0;
}
</style>

<template>
	<div ref="box" class="box" :class="fill ? 'box--fill' : 'box--fit'" :style="{ '--chx-camera-ratio': ratio }">
		<div class="stage" :style="fill ? stageStyle : undefined">
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { cameraRatio } from "../webcam";

/**
 * Dark viewport sized to the camera's real aspect ratio. Without `fill` the box takes the full
 * width and derives its height; with `fill` it takes the space its parent gives it and centers
 * the largest stage with the camera ratio inside. Slot content positions itself absolutely
 * within the stage (camera image, badges, or the bed map in jog mode)
 */
const props = defineProps<{
	fill?: boolean;
}>();

const box = ref<HTMLElement | null>(null);
const ratio = computed(() => cameraRatio.value);

const stageSize = ref({ width: 0, height: 0 });
const stageStyle = computed(() => ({
	width: `${stageSize.value.width}px`,
	height: `${stageSize.value.height}px`
}));

function fit() {
	const el = box.value;
	if (!el || !props.fill) {
		return;
	}
	const w = el.clientWidth, h = el.clientHeight;
	if (w <= 0 || h <= 0) {
		return;
	}
	if (w / h > ratio.value) {
		stageSize.value = { width: Math.floor(h * ratio.value), height: h };
	} else {
		stageSize.value = { width: w, height: Math.floor(w / ratio.value) };
	}
}

let observer: ResizeObserver | null = null;
onMounted(() => {
	if (props.fill && typeof ResizeObserver !== "undefined" && box.value) {
		observer = new ResizeObserver(fit);
		observer.observe(box.value);
	}
	fit();
});
watch(ratio, fit);
onBeforeUnmount(() => {
	if (observer) {
		observer.disconnect();
		observer = null;
	}
});
</script>
