<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import DurationInput from '$lib/components/shared/DurationInput.svelte';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';

	interface EnumOption {
		value: string;
		label: string;
	}

	interface PersonOption {
		id: number;
		firstName: string;
		lastName: string;
	}

	interface TimeRecordData {
		id?: number;
		date: string;
		minutes: number;
		description: string | null;
		type: string | null;
		category: string | null;
		billable: boolean;
		personId: number | null;
	}

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		taskId: number;
		record?: TimeRecordData | null;
		typeOptions: EnumOption[];
		categoryOptions: EnumOption[];
		employees: PersonOption[];
		defaultPersonId: number | null;
		onSaved: (record: any) => void;
		onDeleted?: (id: number) => void;
	}

	let {
		open = $bindable(),
		onOpenChange,
		taskId,
		record = null,
		typeOptions,
		categoryOptions,
		employees,
		defaultPersonId,
		onSaved,
		onDeleted
	}: Props = $props();

	let isSubmitting = $state(false);
	let isDeleting = $state(false);
	let error = $state<string | null>(null);

	let date = $state('');
	let minutes = $state<number | null>(null);
	let description = $state('');
	let type = $state('');
	let category = $state('');
	let billable = $state(true);
	let personId = $state<number | null>(null);

	let isEditing = $derived(!!record?.id);

	let canSubmit = $derived(
		date !== '' && minutes !== null && minutes > 0
	);

	$effect(() => {
		if (open) {
			if (record) {
				date = record.date;
				minutes = record.minutes;
				description = record.description || '';
				type = record.type || '';
				category = record.category || '';
				billable = record.billable;
				personId = record.personId;
			} else {
				date = new Date().toISOString().slice(0, 10);
				minutes = null;
				description = '';
				type = '';
				category = '';
				billable = true;
				personId = defaultPersonId;
			}
			error = null;
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!canSubmit || isSubmitting) return;

		isSubmitting = true;
		error = null;

		const payload = {
			date,
			minutes: minutes!,
			description: description.trim() || null,
			type: type || null,
			category: category || null,
			billable,
			personId: personId || null
		};

		try {
			const url = isEditing
				? `/api/tasks/${taskId}/time-records/${record!.id}`
				: `/api/tasks/${taskId}/time-records`;
			const method = isEditing ? 'PATCH' : 'POST';

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (res.ok) {
				const data = await res.json();
				onSaved(data.timeRecord);
				onOpenChange(false);
			} else {
				const data = await res.json();
				error = data.error || `Failed to ${isEditing ? 'update' : 'create'} time record`;
			}
		} catch {
			error = `Failed to ${isEditing ? 'update' : 'create'} time record`;
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDelete() {
		if (!record?.id || isDeleting) return;

		isDeleting = true;
		error = null;

		try {
			const res = await fetch(`/api/tasks/${taskId}/time-records/${record.id}`, {
				method: 'DELETE'
			});

			if (res.ok) {
				onDeleted?.(record.id);
				onOpenChange(false);
			} else {
				const data = await res.json();
				error = data.error || 'Failed to delete time record';
			}
		} catch {
			error = 'Failed to delete time record';
		} finally {
			isDeleting = false;
		}
	}

	function handleOpenChange(newOpen: boolean) {
		if (!isSubmitting && !isDeleting) {
			onOpenChange(newOpen);
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="sm:max-w-[420px]">
		<Dialog.Header>
			<Dialog.Title>{isEditing ? 'Edit Time Record' : 'New Time Record'}</Dialog.Title>
		</Dialog.Header>

		<form onsubmit={handleSubmit} class="space-y-4">
			{#if error}
				<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="trDate">Date *</Label>
					<Input
						id="trDate"
                        class="w-full"
						type="date"
						bind:value={date}
						required
					/>
				</div>

				<div class="space-y-2">
					<Label for="trMinutes">Duration *</Label>
					<DurationInput
						id="trMinutes"
						class="w-full"
						value={minutes}
						onchange={(v) => { minutes = v; }}
						required
					/>
				</div>
			</div>

            <div class="space-y-2">
                <Label for="trDescription">Description</Label>
                <Textarea
                        id="trDescription"
                        placeholder="What did you work on?"
                        bind:value={description}
                        rows={3}
                />
            </div>

			<div class="grid grid-cols-2 gap-4">
				{#if typeOptions.length > 0}
					<div class="space-y-2">
						<Label>Type</Label>
						<Select.Root
							type="single"
							value={type || 'none'}
							onValueChange={(v) => { type = v === 'none' ? '' : v; }}
						>
							<Select.Trigger class="w-full">
								{typeOptions.find(o => o.value === type)?.label || 'None'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="none">None</Select.Item>
								{#each typeOptions as option}
									<Select.Item value={option.value}>{option.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				{/if}
				{#if categoryOptions.length > 0}
					<div class="space-y-2">
						<Label>Category</Label>
						<Select.Root
							type="single"
							value={category || 'none'}
							onValueChange={(v) => { category = v === 'none' ? '' : v; }}
						>
							<Select.Trigger class="w-full">
								{categoryOptions.find(o => o.value === category)?.label || 'None'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="none">None</Select.Item>
								{#each categoryOptions as option}
									<Select.Item value={option.value}>{option.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				{/if}
			</div>

            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                    <Label>Person</Label>
                    <Select.Root
                            type="single"
                            value={personId ? String(personId) : 'none'}
                            onValueChange={(v) => { personId = v === 'none' ? null : parseInt(v); }}
                    >
                        <Select.Trigger class="w-full">
                            {employees.find(e => e.id === personId)
                                ? `${employees.find(e => e.id === personId)!.firstName} ${employees.find(e => e.id === personId)!.lastName}`
                                : 'None'}
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="none">None</Select.Item>
                            {#each employees as emp}
                                <Select.Item value={String(emp.id)}>{emp.firstName} {emp.lastName}</Select.Item>
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </div>

                <div class="space-y-2">
                    <Label>&nbsp;</Label>
                    <div class="flex items-center gap-2 h-9">
                        <Checkbox bind:checked={billable} id="trBillable" />
                        <Label for="trBillable" class="font-normal">Billable</Label>
                    </div>
                </div>
            </div>

            <hr>

			<Dialog.Footer class="flex items-center">
				{#if isEditing}
					<Button
						type="button"
						variant="destructive"
						size="sm"
						onclick={handleDelete}
						disabled={isSubmitting || isDeleting}
						class="mr-auto"
					>
						{isDeleting ? 'Deleting...' : 'Delete'}
					</Button>
				{/if}
				<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={isSubmitting || isDeleting}>
					Cancel
				</Button>
				<Button type="submit" disabled={!canSubmit || isSubmitting || isDeleting}>
					{isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Record'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
