<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import EnumBadge from './EnumBadge.svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import NoteFormModal from './NoteFormModal.svelte';
	import MarkdownViewer from './MarkdownViewer.svelte';
	import { toast } from 'svelte-sonner';
	import { Plus, Pencil, Trash2 } from 'lucide-svelte';
	import { formatDateTime } from '$lib/utils/date';

	interface Note {
		id: number;
		content: string;
		priority: string;
		color: string | null;
		createdAt: string | Date;
		author: { id: string; name: string; image?: string | null };
	}

	interface EnumOption {
		value: string;
		label: string;
		color?: string | null;
	}

	interface Props {
		entityType: string;
		entityId: string;
		notePriorities?: EnumOption[];
	}

	let { entityType, entityId, notePriorities = [] }: Props = $props();

	let notes = $state<Note[]>([]);
	let loading = $state(true);

	// Modal state
	let formModalOpen = $state(false);
	let editingNote = $state<Note | null>(null);

	// Delete confirmation state
	let deleteDialogOpen = $state(false);
	let deletingNote = $state<Note | null>(null);
	let isDeleting = $state(false);

	$effect(() => {
		if (entityType && entityId) {
			loadNotes();
		}
	});

	async function loadNotes() {
		loading = true;
		try {
			const res = await fetch(`/api/notes?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`);
			if (res.ok) {
				const data = await res.json();
				notes = data.notes;
			}
		} catch {
			toast.error('Failed to load notes');
		} finally {
			loading = false;
		}
	}

	function openCreateModal() {
		editingNote = null;
		formModalOpen = true;
	}

	function openEditModal(note: Note) {
		editingNote = note;
		formModalOpen = true;
	}

	function openDeleteDialog(note: Note) {
		deletingNote = note;
		deleteDialogOpen = true;
	}

	async function handleSubmit(data: { content: string; priority: string; color?: string | null }): Promise<{ success: boolean; error?: string }> {
		if (editingNote) {
			// Update
			const res = await fetch(`/api/notes/${editingNote.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			if (res.ok) {
				const { note } = await res.json();
				notes = notes.map(n => n.id === editingNote!.id ? note : n);
				toast.success('Note updated');
				return { success: true };
			} else {
				const err = await res.json();
				return { success: false, error: err.error || 'Failed to update note' };
			}
		} else {
			// Create
			const res = await fetch('/api/notes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ entityType, entityId, ...data })
			});

			if (res.ok) {
				const { note } = await res.json();
				notes = [note, ...notes];
				toast.success('Note added');
				return { success: true };
			} else {
				const err = await res.json();
				return { success: false, error: err.error || 'Failed to add note' };
			}
		}
	}

	async function handleDelete() {
		if (!deletingNote) return;
		isDeleting = true;

		try {
			const res = await fetch(`/api/notes/${deletingNote.id}`, { method: 'DELETE' });
			if (res.ok) {
				notes = notes.filter(n => n.id !== deletingNote!.id);
				toast.success('Note deleted');
			} else {
				toast.error('Failed to delete note');
			}
		} catch {
			toast.error('Failed to delete note');
		} finally {
			isDeleting = false;
			deleteDialogOpen = false;
			deletingNote = null;
		}
	}

	async function handleContentChange(noteId: number, content: string) {
		try {
			const res = await fetch(`/api/notes/${noteId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content })
			});
			if (res.ok) {
				notes = notes.map(n => n.id === noteId ? { ...n, content } : n);
			}
		} catch {
			// silent — checkbox toggle is best-effort
		}
	}

	function getInitials(name: string): string {
		return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between pb-3">
		<h4 class="text-sm font-medium text-muted-foreground">
			Notes ({notes.length})
		</h4>
		<Button size="sm" variant="outline" onclick={openCreateModal}>
			<Plus class="mr-1 h-3 w-3" />
			New Note
		</Button>
	</div>

	<!-- Notes list -->
	<div class="flex-1 space-y-3 overflow-y-auto">
		{#if loading}
			<p class="py-4 text-center text-sm text-muted-foreground">Loading notes...</p>
		{:else if notes.length === 0}
			<p class="py-4 text-center text-sm text-muted-foreground">No notes yet.</p>
		{:else}
			{#each notes as note (note.id)}
				<div class="rounded-lg border p-3 space-y-2">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Avatar.Root class="h-6 w-6">
								{#if note.author.image}
									<Avatar.Image src="/api/uploads/{note.author.image}" alt="{note.author.name}" />
								{/if}
								<Avatar.Fallback class="text-[10px]">{getInitials(note.author.name)}</Avatar.Fallback>
							</Avatar.Root>
							<span class="text-sm font-medium">{note.author.name}</span>
							<span class="text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</span>
							{#if note.priority !== 'normal'}
								<EnumBadge enums={notePriorities} value={note.priority} class="text-xs" />
							{/if}
						</div>
						<div class="flex items-center gap-1">
							<Button
								size="icon"
								variant="ghost"
								class="h-7 w-7"
								onclick={() => openEditModal(note)}
							>
								<Pencil class="h-3.5 w-3.5" />
							</Button>
							<Button
								size="icon"
								variant="ghost"
								class="h-7 w-7 text-destructive hover:text-destructive"
								onclick={() => openDeleteDialog(note)}
							>
								<Trash2 class="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>
					<div class="text-sm">
						<MarkdownViewer value={note.content} onchange={(md) => handleContentChange(note.id, md)} />
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<!-- Create/Edit Modal -->
<NoteFormModal
	bind:open={formModalOpen}
	onOpenChange={(v) => { formModalOpen = v; if (!v) editingNote = null; }}
	onSubmit={handleSubmit}
	note={editingNote ? { content: editingNote.content, priority: editingNote.priority, color: editingNote.color } : null}
/>

<!-- Delete Confirmation -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Note</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete this note? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={handleDelete}
				disabled={isDeleting}
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
			>
				{isDeleting ? 'Deleting...' : 'Delete'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
