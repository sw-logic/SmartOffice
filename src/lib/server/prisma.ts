import { Prisma, PrismaClient } from '@prisma/client';
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

// Schema fingerprint: changes whenever prisma generate adds/removes model fields
const SCHEMA_FINGERPRINT = Prisma.dmmf.datamodel.models
	.map((m) => `${m.name}:${m.fields.length}`)
	.join(',');

// Global declaration for development hot reload
declare const globalThis: {
	prismaGlobal: PrismaClientInstance;
	prismaSchemaFingerprint: string;
} & typeof global;

// Force fresh client when schema changes (detected via field-count fingerprint)
if (globalThis.prismaGlobal && globalThis.prismaSchemaFingerprint !== SCHEMA_FINGERPRINT) {
	console.log('Prisma schema changed, creating fresh client...');
	delete (globalThis as any).prismaGlobal;
}

// Use existing instance in development to prevent multiple connections
export const prisma = globalThis.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
	globalThis.prismaGlobal = prisma;
	globalThis.prismaSchemaFingerprint = SCHEMA_FINGERPRINT;
}

export default prisma;
