export interface LeadStage {
	value: string;
	label: string;
	color: string;
	description: string;
}

export const LEAD_STAGES: LeadStage[] = [
	{ value: 'lead', label: 'Lead', color: '#3B82F6', description: 'New lead, initial contact' },
	{ value: 'offer', label: 'Offer', color: '#F97316', description: 'Offer sent to client' },
	{ value: 'approval', label: 'Approval', color: '#EAB308', description: 'Waiting for client approval' },
	{ value: 'won', label: 'Won', color: '#22C55E', description: 'Deal closed, won' },
	{ value: 'lost', label: 'Lost', color: '#EF4444', description: 'Deal lost' },
	{ value: 'postponed', label: 'Postponed', color: '#6B7280', description: 'Deal postponed' },
	{ value: 'archived', label: 'Archived', color: '#64748B', description: 'Archived lead' }
];

export const STAGE_MAP = new Map(LEAD_STAGES.map((s) => [s.value, s]));

/** Active pipeline stages (shown as main columns) */
export const ACTIVE_STAGES = LEAD_STAGES.filter((s) =>
	['lead', 'offer', 'approval'].includes(s.value)
);
