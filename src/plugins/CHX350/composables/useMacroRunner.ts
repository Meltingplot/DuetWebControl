import { useMachineStore } from "@/stores/machine";

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
