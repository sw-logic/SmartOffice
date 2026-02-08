import type { LayoutServerLoad } from './$types';
import { getUserPermissions } from '$lib/server/access-control';
import { prisma } from '$lib/server/prisma';
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

	const [permissions, person, enums] = await Promise.all([
		getUserPermissions(user.id),
		prisma.person.findUnique({
			where: { userId: user.id },
			select: { id: true }
		}),
		getEnumValuesBatch([...ALL_ENUM_CODES])
	]);

	return {
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			companyId: user.companyId,
			personId: person?.id ?? null
		},
		permissions: permissions.map(p => ({
			module: p.module,
			action: p.action
		})),
		enums
	};
};
