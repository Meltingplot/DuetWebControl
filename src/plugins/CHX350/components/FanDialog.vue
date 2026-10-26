<style scoped>
.fans {
	padding: 20px 22px;
	display: flex;
	flex-direction: column;
	gap: 14px;
	max-height: calc(100dvh - 48px);
	overflow: auto;
}
.fans__head {
	display: flex;
	align-items: center;
	gap: 12px;
}
.fans__head h2 {
	flex: 1;
	margin: 0;
	font: 700 22px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
.grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 12px;
}
.empty,
.note {
	font: 400 13px/1.35 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.auto {
	display: flex;
	flex-direction: column;
	border-radius: var(--mp-radius);
	background: var(--surface-page);
}
.auto__row {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px 14px;
	font: 400 14px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.auto__row + .auto__row {
	border-top: 1px solid var(--border-default);
}
.auto__name {
	flex: 1;
	min-width: 0;
	font-weight: 600;
	color: var(--text-strong);
}
.auto__reading {
	font: 700 15px/1 var(--mp-font-mono, monospace);
	color: var(--text-strong);
	white-space: nowrap;
}
.auto__row--stalled .auto__name,
.auto__row--stalled .auto__reading {
	color: var(--text-warning);
}
</style>

<template>
	<!-- Attached to the shell so the CHX tokens (surfaces, ink tones) apply inside the dialog -->
	<v-dialog :model-value="modelValue" attach=".chx-shell" max-width="900" scrollable @update:model-value="emit('update:modelValue', $event)">
		<div class="chx-card fans">
			<div class="fans__head">
				<h2>{{ $t("plugins.CHX350.fans.title") }}</h2>
				<v-btn variant="text" icon="mdi-close" size="large" :aria-label="$t('plugins.CHX350.generic.close')" @click="emit('update:modelValue', false)" />
			</div>

			<div v-if="fans.adjustable.value.length > 0" class="grid">
				<FanControls @error="error = $event" />
			</div>
			<div v-else class="empty">{{ $t("plugins.CHX350.fans.none") }}</div>

			<v-alert v-if="error" type="error" variant="tonal" density="compact" :text="error" />

			<!-- Fans the machine configuration runs itself (temperature, job, door): shown, never set -->
			<template v-if="fans.automatic.value.length > 0 || fans.exhaustRunOn.value !== null">
				<span class="chx-label">{{ $t("plugins.CHX350.fans.automatic") }}</span>
				<div class="auto">
					<div v-for="fan in fans.automatic.value" :key="fan.index" class="auto__row" :class="{ 'auto__row--stalled': isStalled(fan) }">
						<v-icon v-if="isStalled(fan)" size="20">mdi-fan-alert</v-icon>
						<span class="auto__name">{{ fan.label }}</span>
						<span>{{ fan.thermostatic ? $t("plugins.CHX350.fans.thermostatic") : $t("plugins.CHX350.fans.byMachine") }}</span>
						<!-- With a tacho the speed is the reading that counts: the water pump turns even at 0 % PWM -->
						<span class="auto__reading">{{ isStalled(fan) ? $t("plugins.CHX350.fans.stalled") : reading(fan) }}</span>
					</div>
					<div v-if="fans.exhaustRunOn.value !== null" class="auto__row">
						<v-icon size="20">mdi-timer-outline</v-icon>
						<span class="auto__name">{{ $t("plugins.CHX350.fans.runOn") }}</span>
						<span class="auto__reading">{{ $t("plugins.CHX350.fans.runOnLeft", { time: formatDuration(fans.exhaustRunOn.value) }) }}</span>
					</div>
				</div>
				<div class="note">{{ $t("plugins.CHX350.fans.automaticNote") }}</div>
			</template>
		</div>
	</v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

import i18n from "@/i18n";

import { formatPercent, type FanInfo, useFans } from "../composables/useFans";
import FanControls from "./FanControls.vue";

const props = defineProps<{
	modelValue: boolean;
}>();
const emit = defineEmits<{
	(e: "update:modelValue", value: boolean): void;
}>();

const fans = useFans();
const error = ref<string | null>(null);

watch(() => props.modelValue, () => error.value = null);

function isStalled(fan: FanInfo): boolean {
	return fans.stalled.value.includes(fan);
}

function reading(fan: FanInfo): string {
	return fan.rpm !== null ? i18n.global.t("plugins.CHX350.fans.rpm", { rpm: fan.rpm }) : formatPercent(fan.actual);
}

function formatDuration(seconds: number): string {
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
</script>
