<template>
	<v-row>
		<v-col cols="12" md="6">
			<v-card>
				<v-card-title>
					<v-icon class="mr-2">mdi-script-text-outline</v-icon>
					{{ $t("plugins.CHX350.settings.macros") }}
				</v-card-title>
				<v-card-text>
					<p class="text-body-2 text-medium-emphasis mb-4">{{ $t("plugins.CHX350.settings.macrosHint") }}</p>
					<v-textarea v-for="field in macroFields" :key="field.key" :model-value="macros[field.key]" :label="$t(field.label)"
								variant="outlined" density="comfortable" rows="2" auto-grow class="mb-2 font-mono"
								@update:model-value="setMacro(field.key, $event)" />
				</v-card-text>
			</v-card>
		</v-col>
		<v-col cols="12" md="6">
			<v-card class="mb-4">
				<v-card-title>
					<v-icon class="mr-2">mdi-axis-arrow</v-icon>
					{{ $t("plugins.CHX350.settings.bedMap") }}
				</v-card-title>
				<v-card-text>
					<v-row density="compact">
						<v-col cols="6"><v-text-field :model-value="bedMap.sizeX" type="number" min="1" :label="$t('plugins.CHX350.settings.sizeX')" suffix="mm" variant="outlined" density="comfortable" hide-details @update:model-value="setBed('sizeX', $event)" /></v-col>
						<v-col cols="6"><v-text-field :model-value="bedMap.sizeY" type="number" min="1" :label="$t('plugins.CHX350.settings.sizeY')" suffix="mm" variant="outlined" density="comfortable" hide-details @update:model-value="setBed('sizeY', $event)" /></v-col>
						<v-col cols="6"><v-text-field :model-value="bedMap.headSpacing" type="number" min="0" :label="$t('plugins.CHX350.settings.headSpacing')" suffix="mm" variant="outlined" density="comfortable" hide-details @update:model-value="setBed('headSpacing', $event)" /></v-col>
						<v-col cols="6"><v-text-field :model-value="bedMap.tool1YAxis" :label="$t('plugins.CHX350.settings.tool1YAxis')" variant="outlined" density="comfortable" hide-details maxlength="1" @update:model-value="setBedString('tool1YAxis', $event)" /></v-col>
						<v-col cols="6"><v-text-field :model-value="bedMap.moveFeedrate" type="number" min="1" :label="$t('plugins.CHX350.settings.moveFeedrate')" suffix="mm/min" variant="outlined" density="comfortable" hide-details @update:model-value="setBed('moveFeedrate', $event)" /></v-col>
						<v-col cols="6"><v-text-field :model-value="bedMap.zSteps.join(', ')" :label="$t('plugins.CHX350.settings.zSteps')" suffix="mm" variant="outlined" density="comfortable" hide-details @update:model-value="setZSteps($event)" /></v-col>
						<v-col cols="6"><v-text-field :model-value="estopHoldMs" type="number" min="300" step="100" :label="$t('plugins.CHX350.settings.estopHold')" suffix="ms" variant="outlined" density="comfortable" hide-details @update:model-value="estopHoldMs = toNumber($event, estopHoldMs)" /></v-col>
					</v-row>
				</v-card-text>
			</v-card>
			<v-card>
				<v-card-title>
					<v-icon class="mr-2">mdi-headset</v-icon>
					{{ $t("plugins.CHX350.settings.support") }}
				</v-card-title>
				<v-card-text>
					<v-row density="compact">
						<v-col v-for="field in supportFields" :key="field.key" cols="6">
							<v-text-field :model-value="support[field.key]" :label="$t(field.label)" variant="outlined" density="comfortable" hide-details @update:model-value="setSupport(field.key, $event)" />
						</v-col>
					</v-row>
				</v-card-text>
			</v-card>
		</v-col>
	</v-row>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { useChxSettings, type ChxBedMapSettings, type ChxMacroSettings, type ChxSupportSettings } from "../settings";

const { macros: macrosRef, bedMap: bedMapRef, support: supportRef, estopHoldMs } = useChxSettings();
const macros = computed(() => macrosRef.value);
const bedMap = computed(() => bedMapRef.value);
const support = computed(() => supportRef.value);

const macroFields: Array<{ key: keyof ChxMacroSettings; label: string }> = [
	{ key: "preheat", label: "plugins.CHX350.settings.macroPreheat" },
	{ key: "home", label: "plugins.CHX350.settings.macroHome" }
];
const supportFields: Array<{ key: keyof ChxSupportSettings; label: string }> = [
	{ key: "model", label: "plugins.CHX350.settings.model" },
	{ key: "company", label: "plugins.CHX350.settings.company" },
	{ key: "address", label: "plugins.CHX350.settings.address" },
	{ key: "phone", label: "plugins.CHX350.settings.phone" },
	{ key: "phoneHours", label: "plugins.CHX350.settings.phoneHours" },
	{ key: "email", label: "plugins.CHX350.settings.email" },
	{ key: "url", label: "plugins.CHX350.settings.url" }
];

function toNumber(value: unknown, fallback: number): number {
	const n = typeof value === "number" ? value : parseFloat(String(value));
	return Number.isFinite(n) ? n : fallback;
}

function setMacro(key: keyof ChxMacroSettings, value: string) {
	macrosRef.value = { ...macros.value, [key]: value };
}
function setBed(key: keyof ChxBedMapSettings, value: unknown) {
	bedMapRef.value = { ...bedMap.value, [key]: toNumber(value, bedMap.value[key] as number) };
}
function setBedString(key: "tool1YAxis", value: string) {
	const letter = value.trim().toUpperCase().slice(0, 1) || "U";
	bedMapRef.value = { ...bedMap.value, [key]: letter };
}
function setZSteps(value: string) {
	const steps = value.split(/[,;\s]+/).map((s) => parseFloat(s)).filter((n) => Number.isFinite(n) && n > 0);
	if (steps.length > 0) {
		bedMapRef.value = { ...bedMap.value, zSteps: steps };
	}
}
function setSupport(key: keyof ChxSupportSettings, value: string) {
	supportRef.value = { ...support.value, [key]: value };
}
</script>
