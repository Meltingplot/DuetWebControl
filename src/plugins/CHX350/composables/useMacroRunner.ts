import { computed, ref, type Ref } from "vue";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { LogLevel, useUiStore } from "@/stores/ui";
import { getErrorMessage } from "@/utils/errors";

import { isPlaceholderMacro } from "../settings";

/**
 * First "Error: …" line of a code reply, else null. RRF reports a failed code (and a macro's
 * `echo "Error: …"` before M99) in the reply instead of failing the request, so sendCode resolves
 * normally and the caller has to look at the text
 */
export function replyError(reply: string | void | null | undefined): string | null {
	const line = (reply ?? "").split("\n").map((l) => l.trim()).find((l) => l.startsWith("Error:"));
	return line ? line.replace(/^Error:\s*/, "") : null;
}

/**
 * Send a code and throw when the firmware reports an error, so a sequence of codes stops at the
 * first failure. Replies are logged like any other code when `logReply` is set
 */
export async function sendChecked(code: string, logReply = true): Promise<string> {
	const reply = await useMachineStore().sendCode(code, false, logReply) ?? "";
	const error = replyError(reply);
	if (error !== null) {
		throw new Error(error);
	}
	return reply;
}

/**
 * Runs a configurable G-code string (from the plugin settings) with busy tracking. A placeholder
 * value (`M98 P""` or empty) is reported as "not configured" instead of being sent. A firmware
 * error in the reply counts as a failure and is kept in `error` for the page to show
 */
export function useMacroRunner(code: Ref<string>) {
	const uiStore = useUiStore();
	const busy = ref(false);
	const error = ref<string | null>(null);
	const configured = computed(() => !isPlaceholderMacro(code.value));

	async function run(): Promise<boolean> {
		if (!configured.value) {
			uiStore.log(LogLevel.warning, i18n.global.t("plugins.CHX350.generic.notConfigured"));
			return false;
		}
		busy.value = true;
		error.value = null;
		try {
			// sendCode logs the reply and any exception itself
			await sendChecked(code.value);
			return true;
		} catch (e) {
			error.value = getErrorMessage(e);
			return false;
		} finally {
			busy.value = false;
		}
	}

	return { busy, error, configured, run };
}
