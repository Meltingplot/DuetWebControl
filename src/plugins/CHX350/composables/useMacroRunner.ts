import { computed, ref, type Ref } from "vue";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { LogLevel, useUiStore } from "@/stores/ui";

import { isPlaceholderMacro } from "../settings";

/**
 * Runs a configurable G-code string (from the plugin settings) with busy tracking. A placeholder
 * value (`M98 P""` or empty) is reported as "not configured" instead of being sent
 */
export function useMacroRunner(code: Ref<string>) {
	const machineStore = useMachineStore();
	const uiStore = useUiStore();
	const busy = ref(false);
	const configured = computed(() => !isPlaceholderMacro(code.value));

	async function run(): Promise<boolean> {
		if (!configured.value) {
			uiStore.log(LogLevel.warning, i18n.global.t("plugins.CHX350.generic.notConfigured"));
			return false;
		}
		busy.value = true;
		try {
			await machineStore.sendCode(code.value, false, true);
			return true;
		} catch (e) {
			uiStore.log(LogLevel.error, code.value, String(e));
			return false;
		} finally {
			busy.value = false;
		}
	}

	return { busy, configured, run };
}
