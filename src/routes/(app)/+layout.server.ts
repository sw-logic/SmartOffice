import type { LayoutServerLoad } from './$types';
import { getUserPermissions } from '$lib/server/access-control';
import { getEnumValuesBatch, ALL_ENUM_CODES, type EnumOption } from '$lib/server/enums';

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		return {
			user: null,
			permissions: [],
			enums: {} as Record<string, EnumOption[]>
		};
	}

	const [permissions, enums] = await Promise.all([
		getUserPermissions(user.id),
		getEnumValuesBatch([...ALL_ENUM_CODES])
	]);

	return {
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			image: user.image,
			companyId: user.companyId
		},
		permissions: permissions.map(p => ({
			module: p.module,
			action: p.action
		})),
		enums
	};
};
