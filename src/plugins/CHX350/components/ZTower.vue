<style scoped>
.z {
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 12px 14px;
	min-height: 0;
}
.z__value {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
}
.z__num {
	font: 800 26px/1 var(--mp-font-mono, monospace);
	color: var(--text-strong);
}
.z__target {
	font: 500 12px/1 var(--mp-font-mono, monospace);
	color: var(--mp-accent);
}
.steps {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 6px;
}
.step {
	all: unset;
	box-sizing: border-box;
	text-align: center;
	min-height: 40px;
	line-height: 40px;
	border-radius: var(--mp-radius);
	background: var(--surface-page);
	border: 1px solid var(--border-subtle);
	font: 600 13px var(--mp-font-mono, monospace);
	color: var(--text-strong);
	cursor: pointer;
}
.step--active {
	background: var(--mp-primary-dark);
	border-color: var(--mp-primary-dark);
	color: #fff;
}
.jog {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;
}
.tower {
	position: relative;
	flex: 1;
	min-height: 120px;
	border-radius: var(--mp-radius);
	background: var(--surface-sunken);
	border: 1px solid var(--border-subtle);
	touch-action: none;
	cursor: pointer;
	overflow: hidden;
}
.tower--locked {
	opacity: 0.5;
	cursor: not-allowed;
}
.tower__fill {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 154, 215, 0.18);
}
.tower__cur {
	position: absolute;
	left: 0;
	right: 0;
	height: 3px;
	background: var(--mp-primary);
}
.tower__tgt {
	position: absolute;
	left: 0;
	right: 0;
	height: 0;
	border-top: 2px dashed var(--mp-accent);
}
.tower__tick {
	position: absolute;
	right: 6px;
	font: 500 10px/1 var(--mp-font-mono, monospace);
	color: var(--text-muted);
	transform: translateY(-50%);
}
</style>

<template>
	<div class="chx-card z">
		<div class="chx-label">{{ $t("plugins.CHX350.control.zAxis") }}</div>
		<div class="z__value">
			<span class="z__num">{{ current !== null ? current.toFixed(2) : "—" }} <span class="text-body-2">mm</span></span>
			<span v-if="target !== null" class="z__target">→ {{ target.toFixed(2) }}</span>
		</div>

		<div class="steps">
			<button v-for="st in steps" :key="st" type="button" class="step" :class="{ 'step--active': st === step }" @click="step = st">{{ st }}</button>
		</div>
		<div class="jog">
			<v-btn variant="tonal" color="secondary" size="large" class="chx-btn" :disabled="locked || atMax" @click="jog(1)">
				<v-icon start>mdi-arrow-up-bold</v-icon>Z+
			</v-btn>
			<v-btn variant="tonal" color="secondary" size="large" class="chx-btn" :disabled="locked || atMin" @click="jog(-1)">
				<v-icon start>mdi-arrow-down-bold</v-icon>Z−
			</v-btn>
		</div>

		<div ref="tower" class="tower" :class="{ 'tower--locked': locked }" @pointerdown="pick" @pointermove="drag" @contextmenu.prevent="enter">
			<div class="tower__fill" :style="{ height: `${fracOf(current ?? 0) * 100}%` }" />
			<div v-for="t in ticks" :key="t" class="tower__tick" :style="{ top: `${(1 - fracOf(t)) * 100}%` }">{{ t }}</div>
			<div v-if="target !== null" class="tower__tgt" :style="{ top: `${(1 - fracOf(target)) * 100}%` }" />
			<div class="tower__cur" :style="{ top: `calc(${(1 - fracOf(current ?? 0)) * 100}% - 1px)` }" />
		</div>

		<div class="jog">
			<v-btn variant="outlined" size="large" class="chx-btn" :disabled="locked" @click="enter">
				<v-icon start>mdi-keyboard-outline</v-icon>{{ $t("plugins.CHX350.control.enterZ") }}
			</v-btn>
			<v-btn color="secondary" size="large" class="chx-btn" :disabled="locked || target === null" @click="goTarget">
				<v-icon start>mdi-arrow-collapse-down</v-icon>{{ $t("plugins.CHX350.control.goZ") }}
			</v-btn>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { getNumericInput } from "@/composables/useInputDialog";
import i18n from "@/i18n";

const props = withDefaults(defineProps<{
	current: number | null;
	min: number;
	max: number;
	steps: Array<number>;
	locked?: boolean;
}>(), {
	locked: false
});

const emit = defineEmits<{
	(e: "jog", delta: number): void;
	(e: "goto", z: number): void;
}>();

const step = ref(props.steps[Math.min(2, props.steps.length - 1)] ?? 1);
const target = ref<number | null>(null);
const tower = ref<HTMLElement | null>(null);

const atMin = computed(() => props.current !== null && props.current - step.value < props.min - 1e-6);
const atMax = computed(() => props.current !== null && props.current + step.value > props.max + 1e-6);

function fracOf(z: number): number {
	const span = props.max - props.min || 1;
	return Math.max(0, Math.min(1, (z - props.min) / span));
}
const ticks = computed(() => {
	const span = props.max - props.min;
	const stepSize = span > 500 ? 200 : (span > 100 ? 50 : 10);
	const result: Array<number> = [];
	for (let z = Math.ceil(props.min / stepSize) * stepSize; z <= props.max; z += stepSize) {
		result.push(z);
	}
	return result;
});

function snap(z: number): number {
	const st = step.value;
	return Math.max(props.min, Math.min(props.max, Math.round(z / st) * st));
}

function zFromEvent(e: PointerEvent): number | null {
	const el = tower.value;
	if (!el) {
		return null;
	}
	const rect = el.getBoundingClientRect();
	const f = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
	return snap(props.min + f * (props.max - props.min));
}

function pick(e: PointerEvent) {
	if (props.locked) {
		return;
	}
	const z = zFromEvent(e);
	if (z !== null) {
		target.value = z;
	}
}
function drag(e: PointerEvent) {
	if (!props.locked && e.buttons > 0) {
		pick(e);
	}
}

function jog(direction: 1 | -1) {
	if (props.locked) {
		return;
	}
	emit("jog", direction * step.value);
}

async function enter() {
	if (props.locked) {
		return;
	}
	const value = await getNumericInput(i18n.global.t("plugins.CHX350.control.enterZTitle"),
		i18n.global.t("plugins.CHX350.control.enterZPrompt", { min: props.min, max: props.max }),
		props.current ?? props.min, props.min, props.max);
	if (value !== null) {
		target.value = Math.max(props.min, Math.min(props.max, value));
	}
}

function goTarget() {
	if (target.value !== null && !props.locked) {
		emit("goto", target.value);
		target.value = null;
	}
}
</script>
