import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const createPrismaClient = () => {
	const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
		max: parseInt(process.env.DB_POOL_MAX || '30'),
		min: parseInt(process.env.DB_POOL_MIN || '5'),
		idleTimeoutMillis: 30000,
		connectionTimeoutMillis: 5000
	});

	const adapter = new PrismaPg(pool);

	return new PrismaClient({
		adapter,
		log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
	});
};

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

// Global declaration for development hot reload
declare const globalThis: {
	prismaGlobal: PrismaClientInstance;
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
