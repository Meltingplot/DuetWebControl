<style scoped>
.hold-btn {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 9px;
	height: 52px;
	padding: 0 20px;
	border: 0;
	border-radius: var(--mp-radius, 8px);
	background: var(--mp-error, #D94052);
	color: #fff;
	font: 700 17px/1 var(--mp-font-body, sans-serif);
	letter-spacing: 0.06em;
	cursor: pointer;
	user-select: none;
	-webkit-user-select: none;
	touch-action: none;
	box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.35);
	overflow: hidden;
}
.hold-btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
.hold-btn__fill {
	position: absolute;
	inset: 0;
	width: 0%;
	background: rgba(255, 255, 255, 0.28);
	pointer-events: none;
}
.hold-btn--holding .hold-btn__fill {
	width: 100%;
	transition: width var(--hold-ms, 1200ms) linear;
}
.hold-btn__content {
	position: relative;
	display: inline-flex;
	align-items: center;
	gap: 9px;
}
.hold-btn__hint {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 2px;
	font: 600 9px/1 var(--mp-font-body, sans-serif);
	letter-spacing: 0.08em;
	opacity: 0.85;
}
</style>

<template>
	<button type="button" class="hold-btn" :class="{ 'hold-btn--holding': holding }" :style="{ '--hold-ms': `${holdMs}ms` }"
			:disabled="disabled" :aria-label="label"
			@pointerdown="start" @pointerup="cancel" @pointercancel="cancel" @pointerleave="cancel"
			@contextmenu.prevent @keydown.enter.prevent="start" @keyup.enter="cancel">
		<span class="hold-btn__fill" />
		<span class="hold-btn__content">
			<v-icon size="22">mdi-flash</v-icon>
			<span>{{ label }}</span>
		</span>
		<span v-if="holding" class="hold-btn__hint">{{ hint }}</span>
	</button>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";

// Press-and-hold trigger for destructive actions on a touchscreen. The action only fires after the
// pointer stayed down for `holdMs`; lifting or leaving early cancels it. No confirmation dialog -
// an emergency stop must not require a second tap
const props = withDefaults(defineProps<{
	label: string;
	hint?: string;
	holdMs?: number;
	disabled?: boolean;
}>(), {
	hint: "",
	holdMs: 1200,
	disabled: false
});

const emit = defineEmits<{
	(e: "held"): void;
}>();

const holding = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

function start(event?: Event) {
	if (props.disabled || holding.value) {
		return;
	}
	if (event instanceof PointerEvent && event.button !== 0) {
		return;
	}
	holding.value = true;
	timer = setTimeout(() => {
		timer = null;
		holding.value = false;
		if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
			navigator.vibrate(80);
		}
		emit("held");
	}, props.holdMs);
}

function cancel() {
	if (timer !== null) {
		clearTimeout(timer);
		timer = null;
	}
	holding.value = false;
}

onBeforeUnmount(cancel);
</script>
