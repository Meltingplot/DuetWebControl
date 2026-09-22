<style scoped>
.page-header {
	display: flex;
	align-items: center;
	gap: 14px;
	min-height: 48px;
}
.page-header__back {
	all: unset;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 48px;
	height: 48px;
	border-radius: var(--mp-radius);
	background: var(--surface-card);
	border: 1px solid var(--border-default);
	color: var(--text-strong);
	cursor: pointer;
}
.page-header__sub {
	font: 600 15px/1.3 var(--mp-font-body, sans-serif);
	letter-spacing: 0.02em;
	color: var(--text-strong);
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>

<template>
	<!-- Page titles are redundant with the sidebar, so the header only carries the back button,
		 an optional context line (step counter, job name, lock reason) and page actions -->
	<div v-if="back !== undefined || subtitle || $slots.actions" class="page-header">
		<button v-if="back !== undefined" type="button" class="page-header__back" :aria-label="$t('plugins.CHX350.generic.back')" @click="goBack">
			<v-icon size="26">mdi-arrow-left</v-icon>
		</button>
		<div v-if="subtitle" class="page-header__sub">{{ subtitle }}</div>
		<div class="flex-grow-1" />
		<slot name="actions" />
	</div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

const props = defineProps<{
	subtitle?: string;
	/** Route to navigate to on back; when set to "" the browser history is used */
	back?: string;
}>();

const emit = defineEmits<{
	(e: "back"): void;
}>();

const router = useRouter();

function goBack() {
	emit("back");
	if (props.back) {
		router.push(props.back);
	} else if (props.back === "") {
		router.back();
	}
}
</script>
