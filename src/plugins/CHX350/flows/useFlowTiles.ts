import { MachineStatus } from "@duet3d/objectmodel";
import { computed } from "vue";

import i18n from "@/i18n";

import { useMachineState } from "../composables/useMachineState";
import { flowContext } from "./context";
import type { FlowPage } from "./parse";
import { renderFlag, renderText } from "./render";
import { useFlowStore } from "./store";

export interface FlowTile {
	path: string;
	title: string;
	icon: string;
	subtitle: string;
	disabled: boolean;
	/** The index found problems in the file (listed on the service page) */
	warn: boolean;
	run: () => void;
}

/**
 * Tiles of the flows that name this page in their front matter. `enabled` and the texts are
 * templates, so the tiles follow the machine state. One flow runs at a time
 */
export function useFlowTiles(page: FlowPage) {
	const flowStore = useFlowStore();
	const state = useMachineState();

	return computed<Array<FlowTile>>(() => {
		const files = flowStore.flowsOn(page);
		if (files.length === 0) {
			return [];
		}
		const context = flowContext();
		const running = flowStore.active !== null && flowStore.active.result === null;
		return files.map((file) => {
			const meta = file.meta!;
			// Without `enabled` a flow may start only while the machine is idle
			const enabled = (meta.enabled === null) ? state.status.value === MachineStatus.idle : renderFlag(meta.enabled, context);
			let subtitle: string;
			if (running && flowStore.active!.path === file.path) {
				subtitle = i18n.global.t("plugins.CHX350.flows.running");
			} else if (!enabled && meta.hint) {
				subtitle = renderText(meta.hint, context);
			} else {
				subtitle = renderText(meta.description, context);
			}
			return {
				path: file.path,
				title: meta.title,
				icon: meta.icon || "mdi-play-circle-outline",
				subtitle,
				disabled: !state.connected.value || state.uiFrozen.value || running || !enabled,
				warn: flowStore.hasIssues(file.path),
				run: () => { flowStore.start(file.path); }
			};
		});
	});
}
