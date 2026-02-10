<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import MarkdownEditor from '$lib/components/shared/MarkdownEditor.svelte';
	import {
		Plus,
		Trash2,
		GripVertical,
		Search,
		ChevronUp,
		ChevronDown,
		Package,
		GripHorizontal
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface ClientData {
		id: number;
		name: string;
		email?: string | null;
		companyName?: string | null;
		paymentTerms?: number;
	}

	interface PriceListItemData {
		id: number;
		name: string;
		description: string | null;
		sku: string | null;
		category: string | null;
		unitPrice: number;
		currency: string;
		unitOfMeasure: string;
		taxRate: number | null;
	}

	interface ItemState {
		id: string;
		priceListItemId: number | null;
		name: string;
		description: string;
		sku: string;
		unitOfMeasure: string;
		quantity: number;
		unitPrice: number;
		discount: number;
		taxRate: number;
		subtotal: number;
		discountAmount: number;
		taxAmount: number;
		total: number;
	}

	interface CatalogDndItem {
		id: string;
		priceListItemId: number;
		name: string;
		description: string;
		sku: string;
		unitOfMeasure: string;
		unitPrice: number;
		taxRate: number;
	}

	interface OptionState {
		id: string;
		name: string;
		description: string;
		items: ItemState[];
	}

	interface ExistingOffer {
		id: number;
		offerNumber: string;
		title: string | null;
		showGrandTotal: boolean;
		date: string;
		validUntil: string;
		clientId: number | null;
		status: string;
		currency: string;
		discountType: string | null;
		discountValue: number | null;
		notes: string | null;
		terms: string | null;
		options: {
			id: number;
			name: string;
			description: string | null;
			items: {
				id: number;
				priceListItemId: number | null;
				name: string;
				description: string | null;
				sku: string | null;
				unitOfMeasure: string;
				quantity: number;
				unitPrice: number;
				discount: number;
				taxRate: number;
				subtotal: number;
				discountAmount: number;
				taxAmount: number;
				total: number;
			}[];
		}[];
	}

	interface Props {
		offer?: ExistingOffer | null;
		clients: ClientData[];
		priceListItems: PriceListItemData[];
		enums: Record<string, any[]>;
		onSave: (payload: any) => Promise<void>;
		onCancel: () => void;
	}

	let { offer = null, clients, priceListItems, enums, onSave, onCancel }: Props = $props();

	let nextId = 1;
	function genId() {
		return `dnd_${nextId++}`;
	}

	// Form state
	let title = $state(offer?.title ?? '');
	let showGrandTotal = $state(offer?.showGrandTotal ?? true);
	let clientId = $state<number | null>(offer?.clientId ?? null);
	let offerDate = $state(offer?.date ? offer.date.split('T')[0] : new Date().toISOString().split('T')[0]);
	let validUntil = $state(offer?.validUntil ? offer.validUntil.split('T')[0] : '');
	let currency = $state(offer?.currency ?? 'USD');
	let notes = $state(offer?.notes ?? '');
	let terms = $state(offer?.terms ?? '');
	let discountType = $state<string | null>(offer?.discountType ?? null);
	let discountValue = $state(offer?.discountValue ?? 0);
	let isSaving = $state(false);

	// Initialize options from existing offer or default
	let options = $state<OptionState[]>(
		offer?.options?.map((opt) => ({
			id: genId(),
			name: opt.name,
			description: opt.description ?? '',
			items: opt.items.map((item) => ({
				id: genId(),
				priceListItemId: item.priceListItemId,
				name: item.name,
				description: item.description ?? '',
				sku: item.sku ?? '',
				unitOfMeasure: item.unitOfMeasure,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				discount: item.discount,
				taxRate: item.taxRate,
				subtotal: item.subtotal,
				discountAmount: item.discountAmount,
				taxAmount: item.taxAmount,
				total: item.total
			}))
		})) ?? [{ id: genId(), name: 'Option 1', description: '', items: [] }]
	);

	// Price list catalog state
	let catalogSearch = $state('');
	let catalogCategory = $state('');

	let filteredCatalog = $derived(() => {
		let items = priceListItems;
		if (catalogSearch) {
			const s = catalogSearch.toLowerCase();
			items = items.filter(
				(i) =>
					i.name.toLowerCase().includes(s) ||
					(i.sku && i.sku.toLowerCase().includes(s)) ||
					(i.description && i.description.toLowerCase().includes(s))
			);
		}
		if (catalogCategory) {
			items = items.filter((i) => i.category === catalogCategory);
		}
		return items;
	});

	let catalogCategories = $derived(() => {
		const cats = new Set(priceListItems.map((i) => i.category).filter(Boolean));
		return Array.from(cats).sort() as string[];
	});

	// Catalog DnD items (wraps filteredCatalog for svelte-dnd-action)
	let catalogDndItems = $state<CatalogDndItem[]>([]);

	function buildCatalogDndItems(items: PriceListItemData[]): CatalogDndItem[] {
		return items.map((item) => ({
			id: `catalog_${item.id}`,
			priceListItemId: item.id,
			name: item.name,
			description: item.description ?? '',
			sku: item.sku ?? '',
			unitOfMeasure: item.unitOfMeasure,
			unitPrice: item.unitPrice,
			taxRate: item.taxRate ?? 0
		}));
	}

	function resetCatalogItems() {
		catalogDndItems = buildCatalogDndItems(filteredCatalog());
	}

	$effect(() => {
		// Re-sync whenever the filtered catalog changes
		const items = filteredCatalog();
		catalogDndItems = buildCatalogDndItems(items);
	});

	function handleCatalogConsider(e: CustomEvent<{ items: CatalogDndItem[] }>) {
		catalogDndItems = e.detail.items;
	}

	function handleCatalogFinalize(e: CustomEvent<{ items: CatalogDndItem[] }>) {
		// Always restore catalog to full filtered list (copy semantics)
		resetCatalogItems();
	}

	// Recompute item calculated fields
	function recomputeItem(item: ItemState): void {
		item.subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
		item.discountAmount = Math.round(item.subtotal * (item.discount / 100) * 100) / 100;
		item.taxAmount =
			Math.round((item.subtotal - item.discountAmount) * (item.taxRate / 100) * 100) / 100;
		item.total = Math.round((item.subtotal - item.discountAmount + item.taxAmount) * 100) / 100;
	}

	// Grand total computation
	let grandTotalInfo = $derived(() => {
		let subtotal = 0;
		let taxTotal = 0;
		for (const opt of options) {
			for (const item of opt.items) {
				subtotal += item.subtotal - item.discountAmount;
				taxTotal += item.taxAmount;
			}
		}
		let total = subtotal + taxTotal;
		let discountApplied = 0;
		if (discountType && discountValue > 0) {
			if (discountType === 'percentage') {
				discountApplied = Math.round(total * (discountValue / 100) * 100) / 100;
			} else {
				discountApplied = discountValue;
			}
			total -= discountApplied;
		}
		return {
			subtotal: Math.round(subtotal * 100) / 100,
			taxTotal: Math.round(taxTotal * 100) / 100,
			discountApplied: Math.round(discountApplied * 100) / 100,
			grandTotal: Math.round(total * 100) / 100
		};
	});

	function addCatalogItem(priceItem: PriceListItemData, targetOptionIndex: number = 0) {
		const newItem: ItemState = {
			id: genId(),
			priceListItemId: priceItem.id,
			name: priceItem.name,
			description: priceItem.description ?? '',
			sku: priceItem.sku ?? '',
			unitOfMeasure: priceItem.unitOfMeasure,
			quantity: 1,
			unitPrice: priceItem.unitPrice,
			discount: 0,
			taxRate: priceItem.taxRate ?? 0,
			subtotal: 0,
			discountAmount: 0,
			taxAmount: 0,
			total: 0
		};
		recomputeItem(newItem);
		options[targetOptionIndex].items = [...options[targetOptionIndex].items, newItem];
	}

	function addCustomItem(optionIndex: number) {
		const newItem: ItemState = {
			id: genId(),
			priceListItemId: null,
			name: '',
			description: '',
			sku: '',
			unitOfMeasure: 'piece',
			quantity: 1,
			unitPrice: 0,
			discount: 0,
			taxRate: 0,
			subtotal: 0,
			discountAmount: 0,
			taxAmount: 0,
			total: 0
		};
		options[optionIndex].items = [...options[optionIndex].items, newItem];
	}

	function removeItem(optionIndex: number, itemId: string) {
		options[optionIndex].items = options[optionIndex].items.filter((i) => i.id !== itemId);
	}

	function addOption() {
		options = [
			...options,
			{ id: genId(), name: `Option ${options.length + 1}`, description: '', items: [] }
		];
	}

	function removeOption(index: number) {
		if (options.length <= 1) {
			toast.error('At least one option is required');
			return;
		}
		options = options.filter((_, i) => i !== index);
	}

	function moveOption(index: number, direction: 'up' | 'down') {
		const target = direction === 'up' ? index - 1 : index + 1;
		if (target < 0 || target >= options.length) return;
		const newOptions = [...options];
		[newOptions[index], newOptions[target]] = [newOptions[target], newOptions[index]];
		options = newOptions;
	}

	function handleItemChange(optionIndex: number, itemIndex: number) {
		recomputeItem(options[optionIndex].items[itemIndex]);
		// Trigger reactivity
		options = [...options];
	}

	const flipDurationMs = 150;

	function handleDndConsider(optionIndex: number, e: CustomEvent<{ items: any[] }>) {
		options[optionIndex].items = e.detail.items;
	}

	function handleDndFinalize(optionIndex: number, e: CustomEvent<{ items: any[] }>) {
		const newItems = e.detail.items.map((item: any) => {
			if (typeof item.id === 'string' && item.id.startsWith('catalog_')) {
				// Convert catalog item → full ItemState
				const newItem: ItemState = {
					id: genId(),
					priceListItemId: item.priceListItemId,
					name: item.name,
					description: item.description ?? '',
					sku: item.sku ?? '',
					unitOfMeasure: item.unitOfMeasure,
					quantity: 1,
					unitPrice: item.unitPrice,
					discount: 0,
					taxRate: item.taxRate ?? 0,
					subtotal: 0,
					discountAmount: 0,
					taxAmount: 0,
					total: 0
				};
				recomputeItem(newItem);
				return newItem;
			}
			return item;
		});
		options[optionIndex].items = newItems;
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency
		}).format(amount);
	}

	function getOptionTotal(opt: OptionState) {
		let subtotal = 0;
		let tax = 0;
		let total = 0;
		for (const item of opt.items) {
			subtotal += item.subtotal - item.discountAmount;
			tax += item.taxAmount;
			total += item.total;
		}
		return {
			subtotal: Math.round(subtotal * 100) / 100,
			tax: Math.round(tax * 100) / 100,
			total: Math.round(total * 100) / 100
		};
	}

	async function handleSave() {
		// Validation
		if (!offerDate) {
			toast.error('Date is required');
			return;
		}
		if (!validUntil) {
			toast.error('Valid until date is required');
			return;
		}
		if (options.length === 0) {
			toast.error('At least one option is required');
			return;
		}
		for (const opt of options) {
			if (!opt.name.trim()) {
				toast.error('All options must have a name');
				return;
			}
			for (const item of opt.items) {
				if (!item.name.trim()) {
					toast.error('All items must have a name');
					return;
				}
			}
		}

		isSaving = true;
		try {
			const payload = {
				title: title.trim() || null,
				showGrandTotal,
				clientId,
				date: offerDate,
				validUntil,
				currency,
				notes: notes || null,
				terms: terms || null,
				discountType: discountType || null,
				discountValue: discountValue || null,
				status: offer?.status || 'draft',
				options: options.map((opt, optIdx) => ({
					name: opt.name,
					description: opt.description || null,
					order: optIdx,
					items: opt.items.map((item, itemIdx) => ({
						priceListItemId: item.priceListItemId,
						name: item.name,
						description: item.description || null,
						sku: item.sku || null,
						unitOfMeasure: item.unitOfMeasure,
						quantity: item.quantity,
						unitPrice: item.unitPrice,
						discount: item.discount,
						taxRate: item.taxRate,
						order: itemIdx
					}))
				}))
			};

			await onSave(payload);
		} catch (err: any) {
			toast.error(err.message || 'Failed to save offer');
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="flex gap-4 h-[calc(100vh-8rem)]">
	<!-- Left: Price List Catalog -->
	<div class="w-1/4 flex-shrink-0 flex flex-col border rounded-lg bg-muted/30">
		<div class="p-3 border-b space-y-2">
			<h3 class="font-semibold flex items-center gap-2">
				<Package class="h-4 w-4" />
				Price List Catalog
			</h3>
			<p class="text-xs text-muted-foreground">Drag items into an option below</p>
			<div class="flex items-center gap-2">
				<Input
					type="search"
					placeholder="Search items..."
					class="h-8 text-sm"
					bind:value={catalogSearch}
				/>
			</div>
			{#if catalogCategories().length > 0}
				<Select.Root
					type="single"
					value={catalogCategory}
					onValueChange={(v) => (catalogCategory = v)}
				>
					<Select.Trigger class="h-8 text-sm">
						{catalogCategory || 'All Categories'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="">All Categories</Select.Item>
						{#each catalogCategories() as cat}
							<Select.Item value={cat}>{cat}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{/if}
		</div>
		<div
			class="flex-1 overflow-y-auto p-2 space-y-2"
			use:dndzone={{
				items: catalogDndItems,
				type: 'offerItems',
				dropFromOthersDisabled: true,
				flipDurationMs
			}}
			onconsider={handleCatalogConsider}
			onfinalize={handleCatalogFinalize}
		>
			{#each catalogDndItems as item (item.id)}
				<div
					class="border rounded-md p-2 bg-background text-sm space-y-1 cursor-grab active:cursor-grabbing"
					animate:flip={{ duration: flipDurationMs }}
				>
					<div class="flex items-center gap-1.5">
						<GripHorizontal class="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
						<span class="font-medium">{item.name}</span>
					</div>
					{#if item.sku}
						<div class="text-xs text-muted-foreground">SKU: {item.sku}</div>
					{/if}
					<div class="flex items-center justify-between">
						<span class="text-xs text-muted-foreground">
							{formatCurrency(item.unitPrice)}/{item.unitOfMeasure}
						</span>
						{#if item.taxRate}
							<span class="text-xs text-muted-foreground">Tax: {item.taxRate}%</span>
						{/if}
					</div>
				</div>
			{/each}
			{#if catalogDndItems.length === 0}
				<div class="text-center text-sm text-muted-foreground py-8">
					{priceListItems.length === 0 ? 'No price list items available' : 'No items match your search'}
				</div>
			{/if}
		</div>
	</div>

	<!-- Right: Offer Builder -->
	<div class="flex-1 flex flex-col overflow-hidden">
		<div class="flex-1 overflow-y-auto space-y-4 pr-1">
			<!-- Offer Header Fields -->
			<Card.Root>
				<Card.Content class="pt-4 space-y-4">
					<div class="space-y-1">
						<Label for="title">Title</Label>
						<Input id="title" bind:value={title} placeholder="Offer title (optional)" />
					</div>
					<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<div class="space-y-1">
							<Label for="clientId">Client</Label>
							<Select.Root
								type="single"
								value={clientId ? String(clientId) : ''}
								onValueChange={(v) => (clientId = v ? parseInt(v) : null)}
							>
								<Select.Trigger id="clientId">
									{clients.find((c) => c.id === clientId)?.name || 'Select client...'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="">No client</Select.Item>
									{#each clients as client}
										<Select.Item value={String(client.id)}>{client.name}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="space-y-1">
							<Label for="offerDate">Date</Label>
							<Input id="offerDate" type="date" bind:value={offerDate} />
						</div>
						<div class="space-y-1">
							<Label for="validUntil">Valid Until</Label>
							<Input id="validUntil" type="date" bind:value={validUntil} />
						</div>
						<div class="space-y-1">
							<Label for="currency">Currency</Label>
							<Select.Root
								type="single"
								value={currency}
								onValueChange={(v) => (currency = v)}
							>
								<Select.Trigger id="currency">
									{enums.currency?.find((c: any) => c.value === currency)?.label || currency}
								</Select.Trigger>
								<Select.Content>
									{#each enums.currency || [] as cur}
										<Select.Item value={cur.value}>{cur.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Options -->
			{#each options as option, optIndex (option.id)}
				{@const optTotal = getOptionTotal(option)}
				<Card.Root>
					<Card.Header class="pb-3">
						<div class="flex items-center gap-2">
							<Input
								class="text-lg font-semibold h-9 flex-1"
								bind:value={option.name}
								placeholder="Option name..."
							/>
							<div class="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8"
									disabled={optIndex === 0}
									onclick={() => moveOption(optIndex, 'up')}
									title="Move up"
								>
									<ChevronUp class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8"
									disabled={optIndex === options.length - 1}
									onclick={() => moveOption(optIndex, 'down')}
									title="Move down"
								>
									<ChevronDown class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8 text-destructive"
									onclick={() => removeOption(optIndex)}
									title="Remove option"
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						</div>
					</Card.Header>
					<Card.Content>
						<!-- Items table -->
						<div class="rounded-md border">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b bg-muted/50">
										<th class="w-8 p-2"></th>
										<th class="p-2 text-left font-medium">Name</th>
										<th class="p-2 text-right font-medium w-20">Qty</th>
										<th class="p-2 text-right font-medium w-28">Unit Price</th>
										<th class="p-2 text-right font-medium w-20">Disc %</th>
										<th class="p-2 text-right font-medium w-20">Tax %</th>
										<th class="p-2 text-right font-medium w-28">Total</th>
										<th class="w-10 p-2"></th>
									</tr>
								</thead>
								<tbody
                                    class="h-12"
									use:dndzone={{
										items: option.items,
										flipDurationMs,
										type: 'offerItems',
										morphDisabled: true,
										dropTargetStyle: {
											outline: '2px dashed hsl(var(--primary) / 0.3)',
											'outline-offset': '-2px',
											'border-radius': '4px'
										}
									}}
									onconsider={(e) => handleDndConsider(optIndex, e)}
									onfinalize={(e) => handleDndFinalize(optIndex, e)}
								>
									{#each option.items as item, itemIndex (item.id)}
										<tr class="border-b" animate:flip={{ duration: flipDurationMs }}>
											<td class="p-1 text-center cursor-grab">
												<GripVertical class="h-4 w-4 text-muted-foreground inline" />
											</td>
											<td class="p-1">
												<Input
													class="h-8 text-sm"
													bind:value={item.name}
													placeholder="Item name"
													onchange={() => handleItemChange(optIndex, itemIndex)}
												/>
											</td>
											<td class="p-1">
												<Input
													type="number"
													class="h-8 text-sm text-right"
													bind:value={item.quantity}
													min="0"
													step="0.01"
													onchange={() => handleItemChange(optIndex, itemIndex)}
												/>
											</td>
											<td class="p-1">
												<Input
													type="number"
													class="h-8 text-sm text-right"
													bind:value={item.unitPrice}
													min="0"
													step="0.01"
													onchange={() => handleItemChange(optIndex, itemIndex)}
												/>
											</td>
											<td class="p-1">
												<Input
													type="number"
													class="h-8 text-sm text-right"
													bind:value={item.discount}
													min="0"
													max="100"
													step="0.1"
													onchange={() => handleItemChange(optIndex, itemIndex)}
												/>
											</td>
											<td class="p-1">
												<Input
													type="number"
													class="h-8 text-sm text-right"
													bind:value={item.taxRate}
													min="0"
													max="100"
													step="0.1"
													onchange={() => handleItemChange(optIndex, itemIndex)}
												/>
											</td>
											<td class="p-1 text-right font-medium pr-2">
												{formatCurrency(item.total)}
											</td>
											<td class="p-1">
												<Button
													variant="ghost"
													size="icon"
													class="h-7 w-7 text-destructive"
													onclick={() => removeItem(optIndex, item.id)}
												>
													<Trash2 class="h-3 w-3" />
												</Button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<div class="flex items-center justify-between mt-2">
							<Button
								variant="outline"
								size="sm"
								onclick={() => addCustomItem(optIndex)}
							>
								<Plus class="mr-1 h-3 w-3" />
								Add custom item
							</Button>
							<div class="text-sm space-x-4">
								<span class="text-muted-foreground">
									Subtotal: <strong>{formatCurrency(optTotal.subtotal)}</strong>
								</span>
								<span class="text-muted-foreground">
									Tax: <strong>{formatCurrency(optTotal.tax)}</strong>
								</span>
								<span>
									Total: <strong>{formatCurrency(optTotal.total)}</strong>
								</span>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}

			<Button variant="outline" onclick={addOption} class="w-full">
				<Plus class="mr-2 h-4 w-4" />
				Add Option
			</Button>

			<!-- Global Settings -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Global Settings</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<!-- Display Options -->
					<div class="flex items-center gap-2">
						<Checkbox
							id="showGrandTotal"
							checked={showGrandTotal}
							onCheckedChange={(v) => (showGrandTotal = v === true)}
						/>
						<Label for="showGrandTotal" class="cursor-pointer">Show grand total on offer</Label>
					</div>

					<!-- Global Discount -->
					<div class="grid gap-4 md:grid-cols-3">
						<div class="space-y-1">
							<Label>Discount Type</Label>
							<Select.Root
								type="single"
								value={discountType ?? ''}
								onValueChange={(v) => {
									discountType = v || null;
									if (!v) discountValue = 0;
								}}
							>
								<Select.Trigger>
									{discountType === 'percentage' ? 'Percentage' : discountType === 'fixed' ? 'Fixed Amount' : 'No discount'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="">No discount</Select.Item>
									<Select.Item value="percentage">Percentage</Select.Item>
									<Select.Item value="fixed">Fixed Amount</Select.Item>
								</Select.Content>
							</Select.Root>
						</div>
						{#if discountType}
							<div class="space-y-1">
								<Label for="discountValue">
									{discountType === 'percentage' ? 'Discount %' : 'Discount Amount'}
								</Label>
								<Input
									id="discountValue"
									type="number"
									bind:value={discountValue}
									min="0"
									step={discountType === 'percentage' ? '0.1' : '0.01'}
									max={discountType === 'percentage' ? '100' : undefined}
								/>
							</div>
						{/if}
					</div>

					<!-- Notes -->
					<div class="space-y-1">
						<Label>Notes</Label>
						<MarkdownEditor bind:value={notes} placeholder="Internal notes..." />
					</div>

					<!-- Terms -->
					<div class="space-y-1">
						<Label>Terms & Conditions</Label>
						<MarkdownEditor bind:value={terms} placeholder="Terms and conditions..." />
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Grand Total -->
			{#if showGrandTotal}
				<Card.Root class="bg-muted/50">
					<Card.Content class="pt-4">
						<div class="flex items-center justify-between">
							<div class="space-y-1 text-sm">
								<div class="flex gap-6">
									<span>Subtotal: <strong>{formatCurrency(grandTotalInfo().subtotal)}</strong></span>
									<span>Tax: <strong>{formatCurrency(grandTotalInfo().taxTotal)}</strong></span>
									{#if grandTotalInfo().discountApplied > 0}
										<span class="text-red-600">
											Discount: <strong>-{formatCurrency(grandTotalInfo().discountApplied)}</strong>
										</span>
									{/if}
								</div>
							</div>
							<div class="text-2xl font-bold">
								{formatCurrency(grandTotalInfo().grandTotal)}
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/if}
		</div>

		<!-- Footer Actions -->
		<div class="flex items-center justify-end gap-3 pt-4 border-t mt-4">
			<Button variant="outline" onclick={onCancel} disabled={isSaving}>Cancel</Button>
			<Button onclick={handleSave} disabled={isSaving}>
				{isSaving ? 'Saving...' : offer ? 'Update Offer' : 'Create Offer'}
			</Button>
		</div>
	</div>
</div>
