<style scoped>
.tile {
	all: unset;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 14px 18px;
	min-height: 84px;
	min-width: 0;
	border-radius: var(--mp-radius-lg, 14px);
	background: var(--surface-card);
	border: 1px solid var(--border-subtle);
	box-shadow: var(--mp-shadow-sm);
	cursor: pointer;
	color: var(--text-strong);
	transition: transform var(--mp-dur, 200ms) var(--mp-ease, ease), box-shadow var(--mp-dur, 200ms) var(--mp-ease, ease);
}
.tile:active {
	transform: scale(0.985);
}
.tile:focus-visible {
	box-shadow: 0 0 0 3px var(--focus-ring);
}
.tile--primary {
	background: var(--mp-primary-dark);
	border-color: var(--mp-primary-dark);
	color: #fff;
}
.tile--disabled {
	opacity: 0.55;
	cursor: not-allowed;
}
.tile__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 54px;
	height: 54px;
	flex: none;
	border-radius: var(--mp-radius);
	background: var(--surface-sunken);
	color: var(--mp-primary-dark);
}
.tile--primary .tile__icon {
	background: rgba(255, 255, 255, 0.16);
	color: #fff;
}
.tile__body {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
}
.tile__title {
	font: 700 17px/1.2 var(--mp-font-body, sans-serif);
}
.tile__sub {
	font: 400 13px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.tile--primary .tile__sub {
	color: rgba(255, 255, 255, 0.8);
}
.tile__trail {
	margin-left: auto;
	flex: none;
	display: flex;
	align-items: center;
}
</style>

<template>
	<button type="button" class="tile" :class="{ 'tile--primary': primary, 'tile--disabled': disabled }"
			:disabled="disabled" @click="onClick">
		<span class="tile__icon">
			<v-icon size="30">{{ icon }}</v-icon>
		</span>
		<span class="tile__body">
			<span class="tile__title">{{ title }}</span>
			<span v-if="subtitle" class="tile__sub">{{ subtitle }}</span>
		</span>
		<span v-if="$slots.trail" class="tile__trail">
			<slot name="trail" />
		</span>
	</button>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

const props = defineProps<{
	icon: string;
	title: string;
	subtitle?: string;
	to?: string;
	primary?: boolean;
	disabled?: boolean;
}>();

const emit = defineEmits<{
	(e: "click"): void;
}>();

const router = useRouter();

function onClick() {
	if (props.disabled) {
		return;
	}
	emit("click");
	if (props.to) {
		router.push(props.to);
	}
}
</script>
