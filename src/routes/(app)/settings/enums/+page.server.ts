import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'settings', 'enums');

	const isAdmin = checkPermission(locals, '*', '*');

	const search = url.searchParams.get('search') || '';
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';

	const where = {
		...(search
			? {
					OR: [
						{ name: { contains: search, mode: 'insensitive' as const } },
						{ code: { contains: search, mode: 'insensitive' as const } }
					]
				}
			: {})
	};

	console.log('Enums page: checking prisma.enumType availability');
	console.log('prisma.enumType exists:', 'enumType' in prisma);

	let enumTypes;
	try {
		enumTypes = await prisma.enumType.findMany({
			where,
			orderBy: { [sortBy]: sortOrder },
			include: {
				_count: {
					select: {
						values: true
					}
				}
			}
		});
		console.log('Enums page: found', enumTypes.length, 'enum types');
	} catch (error) {
		console.error('Enums page error:', error);
		throw error;
	}

	return {
		enumTypes: enumTypes.map((et) => ({
			id: et.id,
			code: et.code,
			name: et.name,
			description: et.description,
			group: et.group,
			isSystem: et.isSystem,
			valueCount: et._count.values,
			createdAt: et.createdAt
		})),
		filters: {
			search,
			sortBy,
			sortOrder
		},
		isAdmin
	};
};
