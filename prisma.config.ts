import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
	earlyAccess: true,
	schema: './prisma/schema.prisma',

	// Database connection for all Prisma CLI commands (migrate, db push, etc.)
	datasource: {
		url: process.env.DATABASE_URL!
	},

	// Adapter for migrations
	migrate: {
		adapter: async () => {
			const { PrismaPg } = await import('@prisma/adapter-pg');
			const { Pool } = await import('pg');

			const pool = new Pool({
				connectionString: process.env.DATABASE_URL
			});

			return new PrismaPg(pool);
		}
	}
});
