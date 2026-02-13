import type { PageServerLoad } from './$types';
import { requirePermission } from '$lib/server/access-control';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'settings', 'company');
};
