<style scoped>
/* Covers the page area below the header and beside the sidebar; header (NOT-AUS) stays reachable */
.flow {
	position: fixed;
	top: var(--v-layout-top, 72px);
	left: var(--v-layout-left, 104px);
	right: 0;
	bottom: 0;
	z-index: 1000;
	box-sizing: border-box;
	padding: var(--chx-page-padding, 16px);
	background: var(--surface-page);
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	gap: 16px;
}
.flow--steps {
	grid-template-columns: 280px minmax(0, 1fr);
}
.steps {
	padding: 18px 16px;
	overflow: auto;
	display: flex;
	flex-direction: column;
	gap: 12px;
}
.steps__title {
	font: 700 17px/1.25 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
.steps ol {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.steps li {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 7px 8px;
	border-radius: var(--mp-radius);
	font: 500 14px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.steps li.current {
	background: var(--surface-sunken);
	color: var(--text-strong);
	font-weight: 700;
}
.steps__dot {
	flex: none;
	width: 26px;
	height: 26px;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font: 700 12px/1 var(--mp-font-mono, monospace);
	background: var(--surface-sunken);
	color: var(--text-body);
}
.steps li.current .steps__dot {
	background: var(--mp-primary);
	color: #fff;
}
.steps li.done .steps__dot {
	background: rgb(var(--v-theme-success));
	color: #fff;
}
.main {
	min-height: 0;
	padding: 22px 24px;
	display: flex;
	flex-direction: column;
	gap: 16px;
}
.main__flow {
	margin-bottom: -8px;
}
.main__title {
	font: 700 26px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
	margin: 0;
}
.main__body {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	gap: 20px;
}
.main__body--jog {
	grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
}
.main__text {
	min-height: 0;
	overflow: auto;
	display: flex;
	flex-direction: column;
	gap: 14px;
}
.md {
	font: 400 17px/1.5 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.md :deep(p),
.md :deep(ul),
.md :deep(ol) {
	margin: 0 0 12px;
}
.md :deep(ul),
.md :deep(ol) {
	padding-left: 24px;
}
.md :deep(strong) {
	color: var(--text-strong);
}
.md :deep(h1),
.md :deep(h2),
.md :deep(h3) {
	font: 700 19px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
	margin: 4px 0 8px;
}
.md :deep(img) {
	display: block;
	max-width: 100%;
	max-height: 42vh;
	border-radius: var(--mp-radius);
	margin: 4px 0 12px;
}
.md :deep(blockquote) {
	margin: 0 0 12px;
	padding: 10px 14px;
	border-radius: var(--mp-radius);
	background: rgba(232, 155, 38, 0.14);
	color: var(--text-strong);
	font-weight: 600;
}
.md :deep(code) {
	font-family: var(--mp-font-mono, monospace);
}
.md :deep(table) {
	border-collapse: collapse;
	margin: 0 0 12px;
}
.md :deep(th),
.md :deep(td) {
	padding: 4px 10px;
	border-bottom: 1px solid var(--border-subtle);
	text-align: left;
}
.working {
	display: flex;
	align-items: center;
	gap: 14px;
	font: 600 16px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-strong);
}
.jog {
	min-height: 0;
	display: flex;
	flex-direction: column;
	gap: 12px;
}
.jog__row {
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.jog__head {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	font: 600 14px/1.2 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.jog__buttons {
	display: grid;
	grid-auto-flow: column;
	grid-auto-columns: minmax(0, 1fr);
	gap: 6px;
}
.jog__buttons .v-btn {
	min-width: 0;
	padding: 0 4px;
	font-family: var(--mp-font-mono, monospace);
}
.input {
	display: flex;
	flex-direction: column;
	gap: 10px;
	max-width: 420px;
}
.input__row {
	display: flex;
	gap: 8px;
}
.input__value {
	flex: 1;
	font: 700 32px/1.2 var(--mp-font-mono, monospace);
	color: var(--text-strong);
	padding: 10px 14px;
	border-radius: var(--mp-radius);
	background: var(--surface-sunken);
	min-height: 60px;
	text-align: right;
}
.input__range {
	font: 400 13px/1.3 var(--mp-font-body, sans-serif);
	color: var(--text-body);
}
.keypad {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
}
.keypad .v-btn {
	font: 700 20px/1 var(--mp-font-mono, monospace);
}
.choices {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
}
.actions {
	display: flex;
	gap: 10px;
	justify-content: flex-end;
}
.actions .v-btn {
	min-width: 180px;
}
</style>

<template>
	<div v-if="active !== null" class="flow" :class="{ 'flow--steps': stepList.length > 1 }">
		<aside v-if="stepList.length > 1" class="chx-card steps">
			<div class="chx-label">{{ $t("plugins.CHX350.flows.steps") }}</div>
			<div class="steps__title">{{ flowTitle }}</div>
			<ol ref="stepListEl">
				<li v-for="(s, i) in stepList" :key="s.title" :class="{ current: i === currentIndex, done: i < progress && i !== currentIndex }">
					<span class="steps__dot">
						<v-icon v-if="i < progress && i !== currentIndex" size="16">mdi-check</v-icon>
						<template v-else>{{ i + 1 }}</template>
					</span>
					<span>{{ s.title }}</span>
				</li>
			</ol>
		</aside>

		<section class="chx-card main">
			<div v-if="stepList.length <= 1 && flowTitle && flowTitle !== heading" class="chx-label main__flow">{{ flowTitle }}</div>
			<h2 class="main__title">{{ heading }}</h2>

			<div class="main__body" :class="{ 'main__body--jog': jogAxes.length > 0 }">
				<div class="main__text">
					<!-- Sanitized: DOMPurify has run on it, see flows/render.ts -->
					<div v-if="content.html" class="md" v-html="content.html" />

					<div v-if="isWorking" class="working">
						<v-progress-circular indeterminate size="28" width="3" color="primary" />
						<span>{{ $t("plugins.CHX350.flows.working") }}</span>
					</div>

					<template v-if="result">
						<v-alert v-if="result.ok" type="success" variant="tonal" :text="$t('plugins.CHX350.flows.done')" />
						<v-alert v-else type="error" variant="tonal" :title="$t('plugins.CHX350.flows.failed')" :text="result.error ?? ''" />
					</template>

					<!-- Number input with an on-screen keypad (touch panels have no keyboard) -->
					<div v-if="needsNumber" class="input">
						<div class="input__row">
							<div class="input__value chx-mono">{{ numberText || "0" }}</div>
							<v-btn size="x-large" variant="tonal" class="chx-btn" :disabled="answering || numberText === ''" @click="press('back')">
								<v-icon>mdi-backspace-outline</v-icon>
							</v-btn>
						</div>
						<div v-if="rangeLabel" class="input__range">{{ rangeLabel }}</div>
						<div class="keypad">
							<v-btn v-for="key in keypadKeys" :key="key" size="x-large" variant="tonal" class="chx-btn"
								   :disabled="answering || (key === '.' && box?.mode === MessageBoxMode.intInput)" @click="press(key)">
								{{ key }}
							</v-btn>
						</div>
					</div>
					<div v-else-if="needsString" class="input">
						<v-text-field v-model="stringInput" variant="outlined" hide-details autofocus
									  :minlength="box?.min ?? undefined" :maxlength="box?.max || 100" @keyup.enter="ok" />
					</div>
					<div v-else-if="isChoice" class="choices">
						<v-btn v-for="(choice, index) in box?.choices ?? []" :key="index" size="x-large" class="chx-btn"
							   :color="box?.default === index ? 'secondary' : undefined" :variant="box?.default === index ? 'flat' : 'outlined'"
							   :disabled="answering" @click="accept(index)">
							{{ choice }}
						</v-btn>
					</div>
				</div>

				<!-- Jog step (M291 Z…): the camera shows what the axis is doing -->
				<div v-if="jogAxes.length > 0" class="jog">
					<ChxCameraBox>
						<ChxCamera />
					</ChxCameraBox>
					<div v-for="axis in jogAxes" :key="axis.letter" class="jog__row">
						<div class="jog__head">
							<span>{{ $t("plugins.CHX350.flows.axis", { axis: axis.letter }) }}</span>
							<span class="chx-value">{{ axisPosition(axis) }}</span>
						</div>
						<div class="jog__buttons">
							<v-btn v-for="step in [...jogSteps(axis)].reverse()" :key="`-${step}`" size="large" variant="tonal" class="chx-btn"
								   :disabled="!canMove(axis, true)" @click="jog(axis, -step)">
								{{ axis.letter }} −{{ step }}
							</v-btn>
						</div>
						<div class="jog__buttons">
							<v-btn v-for="step in jogSteps(axis)" :key="`+${step}`" size="large" variant="tonal" class="chx-btn"
								   :disabled="!canMove(axis, false)" @click="jog(axis, step)">
								{{ axis.letter }} +{{ step }}
							</v-btn>
						</div>
					</div>
				</div>
			</div>

			<div class="actions">
				<template v-if="result">
					<v-btn color="secondary" size="x-large" class="chx-btn" @click="flowStore.close()">
						{{ $t("plugins.CHX350.flows.close") }}
					</v-btn>
				</template>
				<template v-else-if="box">
					<v-btn v-if="box.cancelButton" variant="outlined" size="x-large" class="chx-btn" :disabled="answering" @click="cancel">
						{{ $t("plugins.CHX350.flows.cancel") }}
					</v-btn>
					<v-btn v-if="needsOk" color="secondary" size="x-large" class="chx-btn" :disabled="answering || !canConfirm" @click="ok">
						<v-icon start>mdi-arrow-right</v-icon>
						{{ $t("plugins.CHX350.flows.next") }}
					</v-btn>
				</template>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import { AxisLetter, MachineStatus, MessageBoxMode, type Axis, type MessageBox } from "@duet3d/objectmodel";
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

import { isAxisAtLimit } from "@/composables/useMoveSteps";
import i18n from "@/i18n";
import { registerMessageBoxClaim, unregisterMessageBoxClaim } from "@/plugins/interception";
import { useMachineStore } from "@/stores/machine";
import { display, displayZ } from "@/utils/display";
import { axisGCodeLetter } from "@/utils/gcode";
import { isNumber } from "@/utils/numbers";

import ChxCamera from "../components/ChxCamera.vue";
import ChxCameraBox from "../components/ChxCameraBox.vue";
import { PLUGIN_ID, useChxSettings } from "../settings";
import { flowContext } from "./context";
import { renderStepHtml, sanitizeHtml, type SanitizedHtml } from "./render";
import { useFlowStore } from "./store";

const machineStore = useMachineStore();
const flowStore = useFlowStore();
const { bedMap } = useChxSettings();

// The shell shows every box of a running flow, and boxes that a flow file documents
onMounted(() => registerMessageBoxClaim(PLUGIN_ID, (box) => flowStore.claims(box)));
onBeforeUnmount(() => unregisterMessageBoxClaim(PLUGIN_ID));

const active = computed(() => flowStore.active);
const file = computed(() => active.value ? flowStore.files[active.value.path] ?? null : null);
const result = computed(() => active.value?.result ?? null);

/** Open message box, null when there is none */
const box = computed<MessageBox | null>(() => {
	const b = machineStore.model.state.messageBox;
	return (b !== null && b.mode !== null) ? b : null;
});
const match = computed(() => box.value ? flowStore.findStep(box.value.title) : null);

// A documented box of a flow nobody started here (console, other panel, reload): follow it. A box
// of another flow replaces a followed one
watch(match, (to) => {
	if (to === null) {
		return;
	}
	const current = flowStore.active;
	if (current === null) {
		flowStore.attach(to.file.path);
	} else if (!current.startedHere && current.path !== to.file.path && to.file.meta !== null) {
		flowStore.close();
		flowStore.attach(to.file.path);
	}
}, { immediate: true });

/**
 * A followed flow ends with its prompts: a file that only documents prompts right away, a flow
 * once no box has been open for a while and no macro keeps the machine busy (paused or printing
 * machines never report busy, hence the delay). One started here waits for the macro's reply
 */
const FOLLOW_END_DELAY = 3000;
let endTimer: ReturnType<typeof setTimeout> | null = null;
watch([box, () => machineStore.model.state.status, active], () => {
	if (endTimer !== null) {
		clearTimeout(endTimer);
		endTimer = null;
	}
	const flow = flowStore.active;
	if (flow === null || flow.startedHere || box.value !== null) {
		return;
	}
	if (!file.value?.meta) {
		flowStore.close();
		return;
	}
	endTimer = setTimeout(() => {
		if (flowStore.active === flow && box.value === null && machineStore.model.state.status !== MachineStatus.busy) {
			flowStore.close();
		}
	}, FOLLOW_END_DELAY);
});
onBeforeUnmount(() => {
	if (endTimer !== null) {
		clearTimeout(endTimer);
	}
});

const flowTitle = computed(() => file.value?.meta?.title ?? "");
const stepList = computed(() => (file.value?.meta ? file.value.steps : []));

/** Index of the open box among the flow's steps, -1 when the box is not one of them */
const currentIndex = computed(() => (match.value && match.value.file.path === active.value?.path) ? match.value.index : -1);
const lastIndex = ref(-1);
const stepListEl = ref<HTMLElement | null>(null);
watch(currentIndex, async (to) => {
	if (to >= 0) {
		lastIndex.value = to;
		// Long flows (z-height has 18 steps) scroll the list to the current one
		await nextTick();
		stepListEl.value?.children[to]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
	}
});
watch(() => active.value?.path, () => { lastIndex.value = currentIndex.value; });
/** Steps below this index are done */
const progress = computed(() => {
	if (result.value?.ok) {
		return stepList.value.length;
	}
	return currentIndex.value >= 0 ? currentIndex.value : lastIndex.value + 1;
});

const heading = computed(() => box.value?.title || flowTitle.value);
const isWorking = computed(() => result.value === null && (box.value === null || box.value.mode === MessageBoxMode.noButtons || box.value.mode === MessageBoxMode.closeOnly));

// #region Content

/** Machine images (`0:/…`) as object URLs, loaded on first use */
const images = reactive(new Map<string, string>());
const loadingImages = new Set<string>();
function resolveImage(path: string): string {
	const url = images.get(path);
	if (url === undefined && !loadingImages.has(path)) {
		loadingImages.add(path);
		queueMicrotask(async () => {
			try {
				const blob = await machineStore.download({ filename: path, type: "blob" }, false, false, false);
				images.set(path, URL.createObjectURL(blob as Blob));
			} catch (e) {
				console.warn(`[CHX350] flow image ${path}`, e);
			}
		});
	}
	return url ?? "";
}
onBeforeUnmount(() => {
	for (const url of images.values()) {
		URL.revokeObjectURL(url);
	}
});

const content = computed<SanitizedHtml & { line: number | null }>(() => {
	if (match.value) {
		return { ...renderStepHtml(match.value.step.markdown, flowContext(), resolveImage), line: match.value.step.docLine };
	}
	if (box.value) {
		// A box nobody documented, inside a running flow: the firmware's text, sanitized
		return { ...sanitizeHtml(box.value.message), line: null };
	}
	return { html: "", removed: [], line: null };
});

// What a template or the firmware produced is sanitized again; report what that removed
watch(content, (to) => {
	if (to.removed.length > 0 && to.line !== null && match.value) {
		flowStore.reportRuntimeIssue(match.value.file.path, to.line, to.removed);
	}
});

// #endregion

// #region Answering the box (same codes as DWC's message box dialog)

const answeredSeq = ref<number | null>(null);
const answering = computed(() => box.value !== null && answeredSeq.value === box.value.seq);
const numberText = ref("");
const stringInput = ref("");

watch(() => box.value?.seq, () => {
	const b = box.value;
	numberText.value = (b && typeof b.default === "number") ? String(b.default) : "";
	stringInput.value = (b && typeof b.default === "string") ? b.default : "";
}, { immediate: true });

const needsNumber = computed(() => box.value !== null && [MessageBoxMode.intInput, MessageBoxMode.floatInput].includes(box.value.mode));
const needsString = computed(() => box.value?.mode === MessageBoxMode.stringInput);
const isChoice = computed(() => box.value?.mode === MessageBoxMode.multipleChoice);
const needsOk = computed(() => box.value !== null && [MessageBoxMode.okOnly, MessageBoxMode.okCancel, MessageBoxMode.intInput, MessageBoxMode.floatInput, MessageBoxMode.stringInput].includes(box.value.mode));

const keypadKeys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "±", "0", "."];
function press(key: string) {
	if (key === "back") {
		numberText.value = numberText.value.slice(0, -1);
	} else if (key === "±") {
		numberText.value = numberText.value.startsWith("-") ? numberText.value.slice(1) : `-${numberText.value}`;
	} else if (key === ".") {
		if (!numberText.value.includes(".")) {
			numberText.value = (numberText.value === "" || numberText.value === "-") ? `${numberText.value}0.` : `${numberText.value}.`;
		}
	} else {
		numberText.value = (numberText.value === "0") ? key : numberText.value + key;
	}
}
const numberValue = computed(() => parseFloat(numberText.value));
const rangeLabel = computed(() => {
	const b = box.value;
	if (!b || (b.min === null && b.max === null)) {
		return "";
	}
	return i18n.global.t("plugins.CHX350.flows.range", { min: b.min ?? "−∞", max: b.max ?? "∞" });
});

const canConfirm = computed(() => {
	const b = box.value;
	if (!b) {
		return false;
	}
	if (needsNumber.value) {
		const value = numberValue.value;
		const valid = isNumber(value) && (b.mode !== MessageBoxMode.intInput || value === Math.round(value));
		return valid && (b.min === null || value >= b.min) && (b.max === null || value <= b.max);
	}
	if (needsString.value) {
		return (b.min === null || stringInput.value.length >= b.min) && (b.max === null || stringInput.value.length <= b.max);
	}
	return true;
});

// M292 goes out with noWait: in standalone mode a pending code swallows the next rr_reply
function answer(code: string) {
	if (!box.value) {
		return;
	}
	const seq = box.value.seq;
	answeredSeq.value = seq;
	machineStore.sendCode(code, false, false, true).catch((e) => {
		// Not delivered: let the operator answer again
		console.warn(e);
		if (answeredSeq.value === seq) {
			answeredSeq.value = null;
		}
	});
}

function ok() {
	const b = box.value;
	if (!b || !canConfirm.value || answering.value) {
		return;
	}
	if (needsNumber.value) {
		answer(`M292 R{${numberValue.value}} S${b.seq}`);
	} else if (needsString.value) {
		answer(`M292 R{"${stringInput.value.replace(/"/g, '""').replace(/'/g, "''")}"} S${b.seq}`);
	} else {
		answer(`M292 S${b.seq}`);
	}
}

function accept(choice: number) {
	if (box.value && !answering.value) {
		answer(`M292 R{${choice}} S${box.value.seq}`);
	}
}

function cancel() {
	if (box.value?.cancelButton && !answering.value) {
		answer(`M292 P1 S${box.value.seq}`);
	}
}

// #endregion

// #region Jogging

const jogAxes = computed(() => {
	const mask = box.value?.axisControls ?? 0;
	return machineStore.model.move.axes.filter((axis, index) => axis.visible && (mask & (1 << index)) !== 0);
});

/** Step sizes: Z from the plugin settings, the other axes in mm */
function jogSteps(axis: Axis): Array<number> {
	return (axis.letter === AxisLetter.Z) ? bedMap.value.zSteps : [0.1, 1, 10, 50];
}

function canMove(axis: Axis, decrementing: boolean): boolean {
	return !answering.value && (axis.homed || !machineStore.model.move.noMovesBeforeHoming) && !isAxisAtLimit(axis, decrementing);
}

function axisPosition(axis: Axis): string {
	if (axis.userPosition === null) {
		return i18n.global.t("generic.noValue");
	}
	return (axis.letter === AxisLetter.Z) ? displayZ(axis.userPosition, false) : display(axis.userPosition, 1);
}

function jog(axis: Axis, distance: number) {
	const code = `M120\nG91\nG1 ${axisGCodeLetter(axis.letter)}${distance} F${bedMap.value.moveFeedrate}\nM121`;
	machineStore.sendCode(code, false, false, true).catch((e) => console.warn(e));
}

// #endregion
</script>
