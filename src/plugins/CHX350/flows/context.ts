import { useMachineStore } from "@/stores/machine";

/**
 * Variables of the flow templates: the object model's top-level keys (state, move, heat, ...) and
 * the globals as a plain object, so `global.machine_mode` reads as it does in RRF. Call it inside
 * a computed: the values a template reads are then tracked and the text follows the machine
 */
export function flowContext(): Record<string, unknown> {
	const model = useMachineStore().model as unknown as Record<string, unknown> & { global: Map<string, unknown> };
	const context: Record<string, unknown> = {};
	for (const key of Object.keys(model)) {
		context[key] = model[key];
	}
	context.global = Object.fromEntries(model.global);
	return context;
}
