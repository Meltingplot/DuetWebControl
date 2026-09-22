<style scoped>
.grid {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	grid-template-rows: auto minmax(0, 1fr);
	gap: 12px;
	overflow: auto;
}
.card {
	padding: 14px 16px;
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-height: 0;
}
.kv {
	display: flex;
	justify-content: space-between;
	gap: 12px;
	font: 500 13px/1.35 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	padding: 4px 0;
	border-bottom: 1px solid var(--border-subtle);
}
.kv:last-child {
	border-bottom: 0;
}
.kv b {
	font-family: var(--mp-font-mono, monospace);
	color: var(--text-strong);
	text-align: right;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.contact__big {
	font: 700 22px/1.2 var(--mp-font-mono, monospace);
	color: var(--text-strong);
}
.hint {
	font: 400 13px/1.45 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	margin: 0;
}
.later {
	color: var(--text-muted);
	font: 400 13px/1.4 var(--mp-font-body, sans-serif);
}
</style>

<template>
	<div class="chx-page">
		<ChxPageHeader :title="$t('plugins.CHX350.support.title')" />
		<div class="grid">
			<div class="chx-card card">
				<div class="chx-label">{{ support.company }}</div>
				<div>
					<div class="chx-label">{{ $t("plugins.CHX350.support.phone") }} · {{ support.phoneHours }}</div>
					<div class="contact__big">{{ support.phone }}</div>
				</div>
				<div>
					<div class="chx-label">{{ $t("plugins.CHX350.support.email") }}</div>
					<div class="contact__big">{{ support.email }}</div>
				</div>
				<div v-if="support.url">
					<div class="chx-label">{{ $t("plugins.CHX350.support.web") }}</div>
					<div class="contact__big" style="font-size: 16px">{{ support.url }}</div>
				</div>
				<p class="hint">{{ $t("plugins.CHX350.support.serialHint") }}</p>
			</div>

			<div class="chx-card card">
				<div class="chx-label">{{ $t("plugins.CHX350.support.machine") }}</div>
				<div class="kv"><span>{{ $t("plugins.CHX350.support.model") }}</span><b>{{ support.model }}</b></div>
				<div class="kv"><span>{{ $t("plugins.CHX350.support.serial") }}</span><b>{{ serial }}</b></div>
				<div class="kv"><span>{{ $t("plugins.CHX350.support.board") }}</span><b>{{ board?.name ?? "—" }}</b></div>
				<div class="kv"><span>{{ $t("plugins.CHX350.support.firmware") }}</span><b>{{ board?.firmwareVersion ?? "—" }}</b></div>
				<div class="kv"><span>{{ $t("plugins.CHX350.support.dsf") }}</span><b>{{ dsfVersion }}</b></div>
				<div class="kv"><span>{{ $t("plugins.CHX350.support.dwc") }}</span><b>DWC {{ dwcVersion }} · CHX {{ pluginVersion }}</b></div>
				<div class="kv"><span>{{ $t("plugins.CHX350.support.uptime") }}</span><b>{{ displayTime(model.state.upTime) }}</b></div>
			</div>

			<div class="chx-card card">
				<div class="chx-label">{{ $t("plugins.CHX350.support.state") }}</div>
				<template v-if="vigil">
					<div class="kv"><span>{{ $t("plugins.CHX350.support.machineHours") }}</span><b>{{ vigil.machineHours }} h</b></div>
					<div class="kv"><span>{{ $t("plugins.CHX350.support.printHours") }}</span><b>{{ vigil.printHours }} h</b></div>
					<div class="kv"><span>{{ $t("plugins.CHX350.support.jobsTotal") }}</span><b>{{ vigil.jobsTotal }}</b></div>
				</template>
				<div v-else class="later">{{ $t("plugins.CHX350.support.vigilMissing") }}</div>
				<div class="kv"><span>{{ $t("plugins.CHX350.support.mcuTemp") }}</span><b>{{ board?.mcuTemp ? `${board.mcuTemp.current.toFixed(1)} °C` : "—" }}</b></div>
				<div class="kv"><span>{{ $t("plugins.CHX350.support.vin") }}</span><b>{{ board?.vIn ? `${board.vIn.current.toFixed(1)} V` : "—" }}</b></div>
				<div class="kv"><span>{{ $t("plugins.CHX350.support.v12") }}</span><b>{{ board?.v12 ? `${board.v12.current.toFixed(1)} V` : "—" }}</b></div>
				<div v-if="model.sbc" class="kv"><span>{{ $t("plugins.CHX350.support.cpuTemp") }}</span><b>{{ model.sbc.cpu.temperature !== null ? `${model.sbc.cpu.temperature.toFixed(1)} °C` : "—" }}</b></div>
				<div v-if="model.sbc" class="kv"><span>{{ $t("plugins.CHX350.support.cpuLoad") }}</span><b>{{ model.sbc.cpu.avgLoad !== null ? `${model.sbc.cpu.avgLoad.toFixed(1)} %` : "—" }}</b></div>
				<div v-if="model.sbc" class="kv"><span>{{ $t("plugins.CHX350.support.memory") }}</span><b>{{ model.sbc.memory.available !== null ? displaySize(Number(model.sbc.memory.available)) : "—" }}</b></div>
				<div class="kv"><span>{{ $t("plugins.CHX350.support.storage") }}</span><b>{{ storageFree }}</b></div>
			</div>

			<div class="chx-card card">
				<div class="chx-label">{{ $t("plugins.CHX350.support.diagnostics") }}</div>
				<p class="hint">{{ $t("plugins.CHX350.support.diagnosticsHint") }}</p>
				<v-btn color="secondary" size="x-large" class="chx-btn mt-auto" :loading="exporting" :disabled="!machineStore.isConnected" @click="exportDiagnostics">
					<v-icon start>mdi-download</v-icon>
					{{ $t("plugins.CHX350.support.export") }}
				</v-btn>
			</div>
			<div class="chx-card card">
				<div class="chx-label">{{ $t("plugins.CHX350.support.remote") }}</div>
				<div class="later">{{ $t("plugins.CHX350.support.later") }}</div>
			</div>
			<div class="chx-card card">
				<div class="chx-label">{{ $t("plugins.CHX350.support.tickets") }} · {{ $t("plugins.CHX350.support.sendState") }}</div>
				<div class="later">{{ $t("plugins.CHX350.support.later") }}</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import i18n from "@/i18n";
import { getBuiltInPlugins } from "@/plugins";
import { useMachineStore } from "@/stores/machine";
import { LogLevel, useUiStore } from "@/stores/ui";
import { displaySize, displayTime } from "@/utils/display";
import { saveBlob } from "@/utils/download";

import packageInfo from "../../../../package.json";
import ChxPageHeader from "../components/ChxPageHeader.vue";
import { PLUGIN_ID, useChxSettings } from "../settings";

const machineStore = useMachineStore();
const uiStore = useUiStore();
const { support: supportRef } = useChxSettings();
const support = computed(() => supportRef.value);

const model = computed(() => machineStore.model);
const board = computed(() => model.value.boards[0] ?? null);
const serial = computed(() => model.value.network.name || "—");
const dsfVersion = computed(() => model.value.sbc?.dsf.version ?? "—");
const dwcVersion = packageInfo.version;
const pluginVersion = computed(() => getBuiltInPlugins().find((p) => p.id === PLUGIN_ID)?.version ?? dwcVersion);

const vigil = computed(() => {
	const data = model.value.plugins.get("Vigil")?.data;
	if (!data || !(data instanceof Map) || !data.has("machineHours")) {
		return null;
	}
	return { machineHours: String(data.get("machineHours")), printHours: String(data.get("printHours")), jobsTotal: String(data.get("jobsTotal")) };
});

const storageFree = computed(() => {
	const volumes = model.value.volumes.filter((v) => v.mounted && v.capacity !== null && Number(v.capacity) > 256 * 1024 * 1024);
	const best = volumes.sort((a, b) => Number(b.freeSpace ?? 0) - Number(a.freeSpace ?? 0))[0];
	return best && best.freeSpace !== null ? displaySize(Number(best.freeSpace)) : "—";
});

const exporting = ref(false);
async function exportDiagnostics() {
	exporting.value = true;
	try {
		const parts: Array<string> = [];
		const now = new Date();
		parts.push(`# CHX 350 diagnostics ${now.toISOString()}`, `# ${serial.value} · ${board.value?.firmwareVersion ?? ""} · DSF ${dsfVersion.value} · DWC ${dwcVersion}`, "");
		try {
			const reply = await machineStore.sendCode("M122", false, false);
			parts.push("## M122", reply ?? "", "");
		} catch (e) {
			parts.push("## M122", `(failed: ${String(e)})`, "");
		}
		try {
			const log = await machineStore.download({ filename: "0:/sys/eventlog.log", type: "text" }, false, false, false);
			parts.push("## eventlog.log (tail)", String(log).split("\n").slice(-500).join("\n"), "");
		} catch (e) {
			parts.push("## eventlog.log", `(not available: ${String(e)})`, "");
		}
		try {
			if ((model.value.plugins.get("Vigil")?.pid ?? -1) > 0) {
				const vigilExport = await machineStore.request("GET", "machine/Vigil/export", { format: "json" }, "json");
				parts.push("## Vigil", JSON.stringify(vigilExport, null, 1), "");
			}
		} catch {
			// optional
		}
		parts.push("## Object model", JSON.stringify(model.value, null, 1));
		const blob = new Blob([parts.join("\n")], { type: "text/plain" });
		saveBlob(`chx350-diagnostics-${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`, blob);
		uiStore.log(LogLevel.success, i18n.global.t("plugins.CHX350.support.exportDone"));
	} catch (e) {
		uiStore.log(LogLevel.error, i18n.global.t("plugins.CHX350.support.exportError"), String(e));
	} finally {
		exporting.value = false;
	}
}
</script>
