<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';
	import { setContext } from 'svelte';
	import commands from '../commands/toolbar-commands.js';
	import type { EdraToolbarProps } from '../types.js';
	import ToolBarIcon from './components/ToolBarIcon.svelte';
	import Alignment from './components/toolbar/Alignment.svelte';
	import FontSize from './components/toolbar/FontSize.svelte';
	import Headings from './components/toolbar/Headings.svelte';
	import Link from './components/toolbar/Link.svelte';
	import Lists from './components/toolbar/Lists.svelte';
	import QuickColors from './components/toolbar/QuickColors.svelte';

	const { editor, class: className, excludedCommands, children }: EdraToolbarProps = $props();

	const toolbarCommands = Object.keys(commands).filter((key) => !excludedCommands?.includes(key));

	// Shared dropdown state — only one dropdown open at a time
	let openDropdown = $state<string | null>(null);
	setContext('edra-toolbar-dropdown', {
		get current() { return openDropdown; },
		open(name: string) { openDropdown = name; },
		close(name: string) { if (openDropdown === name) openDropdown = null; }
	});
</script>

<div
	class={cn(
		'edra-toolbar flex items-center gap-0.5',
		className
	)}
>
	{#if children}
		{@render children()}
	{:else}
		{#each toolbarCommands as cmd (cmd)}
			{#if cmd === 'headings'}
				<Headings {editor} />
			{:else if cmd === 'alignment'}
				<Alignment {editor} />
			{:else if cmd === 'lists'}
				<Lists {editor} />
			{:else}
				{@const commandGroup = commands[cmd]}
				{#each commandGroup as command (command)}
					{#if excludedCommands?.includes(command.name)}
						<!-- individual command excluded -->
					{:else if command.name === 'link'}
						<Link {editor} />
					{:else if command.name === 'paragraph'}
						<span></span>
					{:else}
						<ToolBarIcon {editor} {command} />
					{/if}
				{/each}
			{/if}
		{/each}
		{#if !excludedCommands?.includes('fontSize')}
			<FontSize {editor} />
		{/if}
		{#if !excludedCommands?.includes('colors')}
			<QuickColors {editor} />
		{/if}
	{/if}
</div>
