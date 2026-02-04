import type { LayoutServerLoad } from './$types';
import { getUserPermissions } from '$lib/server/access-control';

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		return {
			user: null,
			permissions: []
		};
	}

	const permissions = await getUserPermissions(user.id);

	return {
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			companyId: user.companyId
		},
		permissions: permissions.map(p => ({
			module: p.module,
			action: p.action
		}))
	};
};
