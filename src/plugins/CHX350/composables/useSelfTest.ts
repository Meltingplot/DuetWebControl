import { computed } from "vue";

import i18n from "@/i18n";

import { truthy, useChxGlobals } from "./useChxGlobals";

/*
 * Outcome of the power-on self-test of the machine configuration (chx350-config,
 * sys/meltingplot/self-test/). The machine decides and start.g refuses the job with M0; the UI only
 * shows that beforehand. Every global is missing on an older configuration, which reads as "nothing
 * to report". None of them is bit-flip hardened
 */
/** What the machine is doing as German text, "" = no check runs. Rewritten while a check runs */
const GLOBAL_ACTIVITY = "self_test_activity";
/** Findings per tier as text (0 quick, 1 weekly, 2 monthly), "" = none. Carries changing readings */
const GLOBAL_FAILED = "self_test_failed";
/** false in global-override.g: findings of the quick and weekly tier are only reported */
const GLOBAL_BLOCK_JOBS = "self_test_block_jobs";
/** Emergency stop test of the monthly tier; 2 and 3 mean it was reported as defective */
const GLOBAL_ESTOP_STATE = "self_test_estop_state";
const ESTOP_DEFECT_STATES: ReadonlyArray<unknown> = [2, 3];

export function useSelfTest() {
	const globals = useChxGlobals();

	/** Findings of a tier without the separator the machine ends each of them with */
	function tierFindings(tier: number): string {
		const failed = globals.get(GLOBAL_FAILED);
		const text = Array.isArray(failed) ? failed[tier] : undefined;
		return (typeof text === "string") ? text.trim().replace(/;$/, "") : "";
	}

	const activity = computed(() => {
		const text = globals.get(GLOBAL_ACTIVITY);
		return (typeof text === "string") ? text.trim() : "";
	});

	/** Findings of the quick and weekly tier, empty when there are none */
	const findings = computed(() => [tierFindings(0), tierFindings(1)].filter((text) => text !== "").join("; "));
	/** Defects of the monthly tier; they never refuse a job, the tier just stays due */
	const monthlyFindings = computed(() => tierFindings(2));

	const blocksJobs = computed(() => findings.value !== "" && truthy(globals.get(GLOBAL_BLOCK_JOBS)));
	/** Refuses every job, whatever self_test_block_jobs says */
	const estopDefect = computed(() => ESTOP_DEFECT_STATES.includes(globals.get(GLOBAL_ESTOP_STATE)));

	/** Why start.g would refuse a new job, empty when it would not */
	const refusal = computed(() => {
		const t = i18n.global.t;
		if (estopDefect.value) {
			return `${t("plugins.CHX350.selfTest.estopTitle")} ${t("plugins.CHX350.selfTest.estopBody")}`;
		}
		if (blocksJobs.value) {
			return `${t("plugins.CHX350.selfTest.failedTitle")}: ${t("plugins.CHX350.selfTest.failedBody", { findings: findings.value })}`;
		}
		return "";
	});

	return { activity, findings, monthlyFindings, blocksJobs, estopDefect, refusal };
}
