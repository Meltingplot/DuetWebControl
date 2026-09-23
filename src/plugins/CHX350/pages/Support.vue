<style scoped>
.grid {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr) 380px;
	grid-template-rows: repeat(2, minmax(0, 1fr));
	gap: 14px;
}
.card {
	padding: 16px 18px;
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-height: 0;
	overflow: auto;
}

/* Contact card */
.contact {
	display: flex;
	align-items: center;
	gap: 14px;
	padding: 6px 0;
}
.contact__icon {
	width: 48px;
	height: 48px;
	flex: none;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: var(--mp-radius);
	background: var(--surface-sunken);
	color: var(--text-brand);
}
.contact__value {
	font: 700 22px/1.2 var(--mp-font-mono, monospace);
	color: var(--text-strong);
	margin-top: 4px;
	word-break: break-all;
}
.contact__value--small {
	font-size: 16px;
}
.hint {
	font: 400 14px/1.45 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	margin: 0;
	max-width: 56ch;
}

/* Key/value rows */
.kv {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: 12px;
	font: 500 13px/1.35 var(--mp-font-body, sans-serif);
	color: var(--text-body);
	padding: 5px 0;
	border-bottom: 1px solid var(--border-subtle);
}
.kv:last-child {
	border-bottom: 0;
}
.kv b {
	font: 600 13px/1.35 var(--mp-font-mono, monospace);
	color: var(--text-strong);
	text-align: right;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.kv-columns {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	column-gap: 32px;
	align-content: start;
}
.muted {
	color: var(--text-muted);
	font: 400 13px/1.4 var(--mp-font-body, sans-serif);
}
</style>

<template>
	<div class="chx-page">
		<div class="grid">
			<!-- Contact -->
			<div class="chx-card card">
				<div class="chx-label">{{ support.company }}</div>
				<div v-for="c in contacts" :key="c.icon" class="contact">
					<span class="contact__icon"><v-icon size="26">{{ c.icon }}</v-icon></span>
					<div style="min-width: 0">
						<div class="chx-label">{{ c.label }}</div>
						<div class="contact__value" :class="{ 'contact__value--small': c.small }">{{ c.value }}</div>
					</div>
				</div>
				<p class="hint mt-auto">{{ $t("plugins.CHX350.support.serialHint") }}</p>
			</div>

			<!-- Machine identity -->
			<div class="chx-card card">
				<div class="chx-label">{{ $t("plugins.CHX350.support.machine") }}</div>
				<div>
					<div v-for="row in machineRows" :key="row.label" class="kv">
						<span>{{ $t(`plugins.CHX350.support.${row.label}`) }}</span><b>{{ row.value }}</b>
					</div>
				</div>
			</div>

			<!-- Machine state: operating counters (Vigil) and electronics -->
			<div class="chx-card card">
				<div class="chx-label">{{ $t("plugins.CHX350.support.state") }}</div>
				<div class="kv-columns">
					<div>
						<template v-if="vigil">
							<div v-for="row in vigil" :key="row.label" class="kv">
								<span>{{ $t(`plugins.CHX350.support.${row.label}`) }}</span><b>{{ row.value }}</b>
							</div>
						</template>
						<div v-else class="muted">{{ $t("plugins.CHX350.support.vigilMissing") }}</div>
						<div class="kv"><span>{{ $t("plugins.CHX350.support.storage") }}</span><b>{{ storageFree }}</b></div>
					</div>
					<div>
						<div v-for="row in electronicsRows" :key="row.label" class="kv">
							<span>{{ $t(`plugins.CHX350.support.${row.label}`) }}</span><b>{{ row.value }}</b>
						</div>
					</div>
				</div>
			</div>

			<!-- Diagnostics export. Remote access, ticket history and "send machine state" from the
				 prototype are deferred until a support backend exists; they get their own cards here -->
			<div class="chx-card card">
				<div class="chx-label">{{ $t("plugins.CHX350.support.diagnostics") }}</div>
				<p class="hint">{{ $t("plugins.CHX350.support.diagnosticsHint") }}</p>
				<v-btn color="secondary" size="large" class="chx-btn mt-auto" :loading="exporting" :disabled="!machineStore.isConnected" @click="exportDiagnostics">
					<v-icon start>mdi-download</v-icon>
					{{ $t("plugins.CHX350.support.export") }}
				</v-btn>
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
import { PLUGIN_ID, useChxSettings } from "../settings";

const machineStore = useMachineStore();
const uiStore = useUiStore();
const { support } = useChxSettings();
const t = (key: string) => i18n.global.t(`plugins.CHX350.support.${key}`);

const model = computed(() => machineStore.model);
const board = computed(() => model.value.boards[0] ?? null);
const serial = computed(() => model.value.network.name || "—");
const dsfVersion = computed(() => model.value.sbc?.dsf.version ?? "—");
const dwcVersion = packageInfo.version;
const pluginVersion = getBuiltInPlugins().find((p) => p.id === PLUGIN_ID)?.version ?? dwcVersion;

const contacts = computed(() => [
	{ icon: "mdi-phone", label: support.value.phoneHours ? `${t("phone")} · ${support.value.phoneHours}` : t("phone"), value: support.value.phone, small: false },
	{ icon: "mdi-email-outline", label: t("email"), value: support.value.email, small: false },
	{ icon: "mdi-web", label: t("web"), value: support.value.url, small: true }
].filter((c) => c.value));

// Model and serial number are the header's name and host line
const machineRows = computed(() => [
	{ label: "board", value: board.value?.name ?? "—" },
	{ label: "firmware", value: board.value?.firmwareVersion ?? "—" },
	{ label: "dsf", value: dsfVersion.value },
	{ label: "dwc", value: `DWC ${dwcVersion} · CHX ${pluginVersion}` },
	{ label: "uptime", value: displayTime(model.value.state.upTime) }
]);

/** Operating counters published by the Vigil plugin (strings in its object model data) */
const vigil = computed(() => {
	const data = model.value.plugins.get("Vigil")?.data;
	if (!(data instanceof Map) || !data.has("machineHours")) {
		return null;
	}
	return [
		{ label: "machineHours", value: `${data.get("machineHours")} h` },
		{ label: "printHours", value: `${data.get("printHours")} h` },
		{ label: "jobsTotal", value: String(data.get("jobsTotal")) }
	];
});

const fmt = (value: number | null | undefined, unit: string) => (value === null || value === undefined) ? "—" : `${value.toFixed(1)} ${unit}`;

const electronicsRows = computed(() => {
	const rows = [
		{ label: "mcuTemp", value: fmt(board.value?.mcuTemp?.current, "°C") },
		{ label: "vin", value: fmt(board.value?.vIn?.current, "V") },
		{ label: "v12", value: fmt(board.value?.v12?.current, "V") }
	];
	const sbc = model.value.sbc;
	if (sbc) {
		rows.push(
			{ label: "cpuTemp", value: fmt(sbc.cpu.temperature, "°C") },
			{ label: "cpuLoad", value: fmt(sbc.cpu.avgLoad, "%") },
			{ label: "memory", value: sbc.memory.available !== null ? displaySize(Number(sbc.memory.available)) : "—" }
		);
	}
	return rows;
});

/** Free space of the largest mounted volume; the SBC lists every bind mount, so tiny ones are skipped */
const storageFree = computed(() => {
	const volumes = model.value.volumes.filter((v) => v.mounted && v.capacity !== null && Number(v.capacity) > 256 * 1024 * 1024);
	const best = volumes.sort((a, b) => Number(b.freeSpace ?? 0) - Number(a.freeSpace ?? 0))[0];
	return best && best.freeSpace !== null ? displaySize(Number(best.freeSpace)) : "—";
});

const exporting = ref(false);

/** Collect M122, the event log tail, Vigil's export and the object model into one text file */
async function exportDiagnostics() {
	exporting.value = true;
	try {
		const now = new Date();
		const parts: Array<string> = [
			`# CHX 350 diagnostics ${now.toISOString()}`,
			`# ${serial.value} · ${board.value?.firmwareVersion ?? ""} · DSF ${dsfVersion.value} · DWC ${dwcVersion} · CHX ${pluginVersion}`,
			""
		];
		const section = async (title: string, read: () => Promise<string>) => {
			try {
				parts.push(`## ${title}`, await read(), "");
			} catch (e) {
				parts.push(`## ${title}`, `(not available: ${String(e)})`, "");
			}
		};
		await section("M122", async () => (await machineStore.sendCode("M122", false, false)) ?? "");
		await section("eventlog.log (tail)", async () => {
			const log = await machineStore.download({ filename: "0:/sys/eventlog.log", type: "text" }, false, false, false);
			return String(log).split("\n").slice(-500).join("\n");
		});
		if ((model.value.plugins.get("Vigil")?.pid ?? -1) > 0) {
			await section("Vigil", async () => JSON.stringify(await machineStore.request("GET", "machine/Vigil/export", { format: "json" }, "json"), null, 1));
		}
		parts.push("## Object model", JSON.stringify(model.value, null, 1));

		const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
		saveBlob(`chx350-diagnostics-${stamp}.txt`, new Blob([parts.join("\n")], { type: "text/plain" }));
		uiStore.log(LogLevel.success, t("exportDone"));
	} catch (e) {
		uiStore.log(LogLevel.error, t("exportError"), String(e));
	} finally {
		exporting.value = false;
	}
}
</script>
