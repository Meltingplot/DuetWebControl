<style scoped>
.sidebar {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	height: 100%;
	padding: 18px 0 14px;
	background: var(--mp-primary-dark, #004276);
}
.sidebar__logo {
	display: flex;
	justify-content: center;
	padding-bottom: 22px;
}
.sidebar__logo img {
	width: 44px;
	height: auto;
	display: block;
}
.nav-item {
	all: unset;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 7px;
	padding: 16px 4px;
	cursor: pointer;
	border-left: 4px solid transparent;
	color: #D7E8F4;
	min-height: 72px;
	transition: background var(--mp-dur, 200ms) var(--mp-ease, ease);
}
.nav-item:hover {
	background: rgba(255, 255, 255, 0.08);
}
.nav-item--active {
	background: rgba(255, 255, 255, 0.14);
	border-left-color: var(--mp-accent, #E89B26);
	color: #fff;
}
.nav-item__label {
	font: 600 11px/1 var(--mp-font-body, sans-serif);
	letter-spacing: 0.06em;
	text-transform: uppercase;
}
.nav-item--service {
	border-top: 1px solid rgba(255, 255, 255, 0.14);
}
</style>

<template>
	<nav class="sidebar">
		<div class="sidebar__logo">
			<img :src="logoUrl" alt="Meltingplot">
		</div>
		<button v-for="item in items" :key="item.path" type="button" class="nav-item"
				:class="{ 'nav-item--active': isActive(item) }" :title="$t(item.caption)" @click="go(item.path)">
			<v-icon size="26">{{ item.icon }}</v-icon>
			<span class="nav-item__label">{{ $t(item.caption) }}</span>
		</button>
		<div class="flex-grow-1" />
		<button type="button" class="nav-item nav-item--service" :class="{ 'nav-item--active': isActive(serviceItem) }"
				:title="$t(serviceItem.caption)" @click="go(serviceItem.path)">
			<v-icon size="24">{{ serviceItem.icon }}</v-icon>
			<span class="nav-item__label">{{ $t(serviceItem.caption) }}</span>
		</button>
	</nav>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";

import logoUrl from "../assets/meltingplot-logo.svg";
import { useMachineState } from "../composables/useMachineState";
import { NAV_ITEMS, ROUTES, SERVICE_ITEM, type NavItem } from "../routes";

const route = useRoute();
const router = useRouter();
const state = useMachineState();

const items = NAV_ITEMS;
const serviceItem = SERVICE_ITEM;

function isActive(item: NavItem): boolean {
	return item.matches.some((prefix) => prefix === "/" ? route.path === "/" : route.path.startsWith(prefix));
}

function go(path: string) {
	// While a job runs (or is paused) the start page offers nothing but the job tile, so "Start"
	// leads straight to the job page and saves the operator a tap
	const target = path === ROUTES.start && state.printing.value ? ROUTES.job : path;
	if (route.path !== target) {
		router.push(target);
	}
}
</script>
