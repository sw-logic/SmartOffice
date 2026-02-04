import 'dotenv/config';
import { SvelteKitAuth } from '@auth/sveltekit';
import Credentials from '@auth/sveltekit/providers/credentials';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

// Lazy-load prisma to avoid initialization issues
let prismaInstance: PrismaClient | null = null;

function getPrisma() {
	if (!prismaInstance) {
		const pool = new Pool({
			connectionString: process.env.DATABASE_URL
		});
		const adapter = new PrismaPg(pool);
		prismaInstance = new PrismaClient({ adapter });
	}
	return prismaInstance;
}

export const { handle, signIn, signOut } = SvelteKitAuth({
	providers: [
		Credentials({
			id: 'credentials',
			name: 'Credentials',
			credentials: {
				email: { label: 'Email', type: 'email' },
				password: { label: 'Password', type: 'password' }
			},
			authorize: async (credentials) => {
				if (!credentials?.email || !credentials?.password) {
					return null;
				}

				try {
					const prisma = getPrisma();

					const user = await prisma.user.findFirst({
						where: {
							email: String(credentials.email),
							deletedAt: null
						}
					});

					if (!user?.password) {
						return null;
					}

					const isValid = await bcrypt.compare(
						String(credentials.password),
						user.password
					);

					if (!isValid) {
						return null;
					}

					// Return user object - must have id
					return {
						id: user.id,
						email: user.email,
						name: user.name ?? undefined,
						image: user.image ?? undefined
					};
				} catch (error) {
					console.error('Auth error:', error);
					return null;
				}
			}
		})
	],
	secret: process.env.AUTH_SECRET,
	session: {
		strategy: 'jwt'
	},
	pages: {
		signIn: '/login'
	},
	callbacks: {
		jwt: async ({ token, user }) => {
			if (user) {
				token.id = user.id;
			}
			return token;
		},
		session: async ({ session, token }) => {
			if (token?.id) {
				session.user.id = token.id as string;
			}
			return session;
		}
	},
	trustHost: true
});
