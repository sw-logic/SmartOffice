import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Instantiate Prisma Client with PostgreSQL adapter for Prisma 7
const prismaClientSingleton = () => {
	const pool = new Pool({
		connectionString: process.env.DATABASE_URL
	});

	const adapter = new PrismaPg(pool);

	const prisma = new PrismaClient({
		adapter,
		log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
	});

	return prisma;
};

// Global declaration for development hot reload
declare const globalThis: {
	prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

// Force fresh client if enumType is missing (schema changed)
if (globalThis.prismaGlobal && !('enumType' in globalThis.prismaGlobal)) {
	console.log('Prisma client outdated, creating fresh instance...');
	delete (globalThis as any).prismaGlobal;
}

// Use existing instance in development to prevent multiple connections
export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
	globalThis.prismaGlobal = prisma;
}

export default prisma;

// Soft delete models list - use this for manual filtering when needed
export const softDeleteModels = [
	'User',
	'UserGroup',
	'Permission',
	'Company',
	'Person',
	'Client',
	'Vendor',
	'Project',
	'Task',
	'Income',
	'Expense',
	'Payment',
	'PriceListItem',
	'Offer',
	'EnumType',
	'EnumValue'
] as const;
