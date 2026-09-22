<style scoped>
.stepper {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	gap: 14px;
}
.bar {
	height: 6px;
	border-radius: 999px;
	background: var(--surface-sunken);
	overflow: hidden;
}
.bar__fill {
	height: 100%;
	background: var(--mp-primary);
	transition: width var(--mp-dur, 200ms) var(--mp-ease, ease);
}
.body {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	gap: 16px;
}
.body--single {
	grid-template-columns: minmax(0, 1fr);
}
.text {
	padding: 22px 24px;
	display: flex;
	flex-direction: column;
	gap: 14px;
	overflow: auto;
}
.text h2 {
	font: 700 24px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
	margin: 0;
}
.text p {
	font: 400 16px/1.5 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	margin: 0;
}
.warn {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 12px;
	border-radius: var(--mp-radius);
	background: rgba(232, 155, 38, 0.14);
	color: var(--mp-neutral-900);
	font: 600 13px/1.3 var(--mp-font-body, sans-serif);
}
.cta {
	margin-top: auto;
	display: flex;
	gap: 10px;
}
</style>

<template>
	<div class="stepper">
		<div class="bar">
			<div class="bar__fill" :style="{ width: `${((step + 1) / steps.length) * 100}%` }" />
		</div>
		<div class="body" :class="{ 'body--single': !$slots.aside }">
			<div class="chx-card text">
				<h2>{{ current.title }}</h2>
				<p>{{ current.body }}</p>
				<div v-if="current.warn" class="warn">
					<v-icon size="22">mdi-alert-outline</v-icon>
					<span>{{ current.warn }}</span>
				</div>
				<slot name="step" :step="step" />
				<div class="cta">
					<v-btn v-if="step > 0" variant="outlined" size="x-large" class="chx-btn" :disabled="busy" @click="$emit('update:step', step - 1)">
						{{ $t("plugins.CHX350.generic.back") }}
					</v-btn>
					<v-btn color="secondary" size="x-large" class="chx-btn flex-grow-1" :disabled="current.disabled || busy" :loading="busy" @click="$emit('action', step)">
						<v-icon v-if="current.icon" start>{{ current.icon }}</v-icon>
						{{ current.cta }}
					</v-btn>
				</div>
			</div>
			<div v-if="$slots.aside" class="chx-card text">
				<slot name="aside" :step="step" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";

export interface WizardStep {
	title: string;
	body: string;
	warn?: string;
	cta: string;
	icon?: string;
	disabled?: boolean;
}

const props = defineProps<{
	steps: Array<WizardStep>;
	step: number;
	busy?: boolean;
}>();

defineEmits<{
	(e: "update:step", step: number): void;
	(e: "action", step: number): void;
}>();

const current = computed(() => props.steps[Math.max(0, Math.min(props.steps.length - 1, props.step))]);
</script>
