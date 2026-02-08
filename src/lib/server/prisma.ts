import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Models that support soft delete (have a deletedAt field)
const softDeleteModels = new Set([
	'User',
	'UserGroup',
	'Permission',
	'Company',
	'Person',
	'Client',
	'Vendor',
	'Project',
	'Task',
	'TimeRecord',
	'Milestone',
	'KanbanBoard',
	'KanbanColumn',
	'KanbanSwimlane',
	'Note',
	'Income',
	'Expense',
	'Payment',
	'PriceListItem',
	'Offer',
	'EnumType',
	'EnumValue'
]);

// Read operations that should auto-filter soft-deleted records
const readOperations = new Set([
	'findMany',
	'findFirst',
	'findUnique',
	'findFirstOrThrow',
	'findUniqueOrThrow',
	'count',
	'aggregate',
	'groupBy'
]);

// Instantiate Prisma Client with soft-delete extension
const createPrismaClient = () => {
	const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
		max: parseInt(process.env.DB_POOL_MAX || '30'),
		min: parseInt(process.env.DB_POOL_MIN || '5'),
		idleTimeoutMillis: 30000,
		connectionTimeoutMillis: 5000
	});

	const adapter = new PrismaPg(pool);

	const base = new PrismaClient({
		adapter,
		log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
	});

	// Extend with automatic soft-delete filtering on read operations.
	// If a query explicitly includes 'deletedAt' in its where clause (even as undefined),
	// the extension will NOT override it. This allows admin "show all" views to work
	// by setting: where.deletedAt = undefined
	return base.$extends({
		query: {
			$allModels: {
				async $allOperations({ model, operation, args, query }) {
					if (readOperations.has(operation) && softDeleteModels.has(model)) {
						const where = (args as any).where ?? {};
						if (!('deletedAt' in where)) {
							(args as any).where = { ...where, deletedAt: null };
						}
					}
					return query(args);
				}
			}
		}
	});
};

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// Global declaration for development hot reload
declare const globalThis: {
	prismaGlobal: ExtendedPrismaClient;
} & typeof global;

// Force fresh client if enumType is missing (schema changed)
if (globalThis.prismaGlobal && !('enumType' in globalThis.prismaGlobal)) {
	console.log('Prisma client outdated, creating fresh instance...');
	delete (globalThis as any).prismaGlobal;
}

// Use existing instance in development to prevent multiple connections
export const prisma = globalThis.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
	globalThis.prismaGlobal = prisma;
}

export default prisma;
