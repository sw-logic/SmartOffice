import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

// Create Prisma client with PostgreSQL adapter for Prisma 7
const pool = new Pool({
	connectionString: process.env.DATABASE_URL
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
	console.log('Seeding database...');

	// Create permissions
	const permissionsList = [
		// Dashboard
		{ module: 'dashboard', action: 'read', description: 'View dashboard' },
		{ module: 'dashboard', action: 'finances', description: 'View financial widgets on dashboard' },

		// Clients
		{ module: 'clients', action: 'read', description: 'View clients' },
		{ module: 'clients', action: 'create', description: 'Create clients' },
		{ module: 'clients', action: 'update', description: 'Update clients' },
		{ module: 'clients', action: 'delete', description: 'Delete clients' },
		{ module: 'clients', action: 'export', description: 'Export clients' },
		{ module: 'clients', action: 'contacts', description: 'Manage client contacts' },

		// Vendors
		{ module: 'vendors', action: 'read', description: 'View vendors' },
		{ module: 'vendors', action: 'create', description: 'Create vendors' },
		{ module: 'vendors', action: 'update', description: 'Update vendors' },
		{ module: 'vendors', action: 'delete', description: 'Delete vendors' },
		{ module: 'vendors', action: 'export', description: 'Export vendors' },
		{ module: 'vendors', action: 'contacts', description: 'Manage vendor contacts' },

		// Employees
		{ module: 'employees', action: 'read', description: 'View employees' },
		{ module: 'employees', action: 'create', description: 'Create employees' },
		{ module: 'employees', action: 'update', description: 'Update employees' },
		{ module: 'employees', action: 'delete', description: 'Delete employees' },
		{ module: 'employees', action: 'permissions', description: 'Manage employee permissions' },
		{ module: 'employees', action: 'salary', description: 'View/edit salary information' },

		// Projects
		{ module: 'projects', action: 'read', description: 'View projects' },
		{ module: 'projects', action: 'create', description: 'Create projects' },
		{ module: 'projects', action: 'update', description: 'Update projects' },
		{ module: 'projects', action: 'delete', description: 'Delete projects' },
		{ module: 'projects', action: 'tasks', description: 'Manage project tasks' },

		// Finances - Income
		{ module: 'finances.income', action: 'read', description: 'View income' },
		{ module: 'finances.income', action: 'create', description: 'Create income records' },
		{ module: 'finances.income', action: 'update', description: 'Update income records' },
		{ module: 'finances.income', action: 'delete', description: 'Delete income records' },
		{ module: 'finances.income', action: 'export', description: 'Export income reports' },

		// Finances - Expenses
		{ module: 'finances.expenses', action: 'read', description: 'View expenses' },
		{ module: 'finances.expenses', action: 'create', description: 'Create expense records' },
		{ module: 'finances.expenses', action: 'update', description: 'Update expense records' },
		{ module: 'finances.expenses', action: 'delete', description: 'Delete expense records' },
		{ module: 'finances.expenses', action: 'export', description: 'Export expense reports' },

		// Finances - Payments
		{ module: 'finances.payments', action: 'read', description: 'View payments' },
		{ module: 'finances.payments', action: 'create', description: 'Create payment records' },
		{ module: 'finances.payments', action: 'update', description: 'Update payment records' },
		{ module: 'finances.payments', action: 'delete', description: 'Delete payment records' },
		{ module: 'finances.payments', action: 'reconcile', description: 'Reconcile payments' },

		// Price Lists
		{ module: 'pricelists', action: 'read', description: 'View price lists' },
		{ module: 'pricelists', action: 'create', description: 'Create price list items' },
		{ module: 'pricelists', action: 'update', description: 'Update price list items' },
		{ module: 'pricelists', action: 'delete', description: 'Delete price list items' },
		{ module: 'pricelists', action: 'history', description: 'View price history' },

		// Offers
		{ module: 'offers', action: 'read', description: 'View offers' },
		{ module: 'offers', action: 'create', description: 'Create offers' },
		{ module: 'offers', action: 'update', description: 'Update offers' },
		{ module: 'offers', action: 'delete', description: 'Delete offers' },
		{ module: 'offers', action: 'send', description: 'Send offers via email' },
		{ module: 'offers', action: 'convert', description: 'Convert offers to projects' },

		// Settings
		{ module: 'settings', action: 'read', description: 'View settings' },
		{ module: 'settings', action: 'company', description: 'Edit company settings' },
		{ module: 'settings', action: 'users', description: 'Manage users' },
		{ module: 'settings', action: 'system', description: 'System settings' },

		// Admin - All permissions
		{ module: '*', action: '*', description: 'Full access to all modules' }
	];

	console.log('Creating permissions...');
	for (const perm of permissionsList) {
		await prisma.permission.upsert({
			where: { module_action: { module: perm.module, action: perm.action } },
			update: { description: perm.description },
			create: perm
		});
	}

	// Create user groups
	console.log('Creating user groups...');
	const adminGroup = await prisma.userGroup.upsert({
		where: { name: 'Admin' },
		update: {},
		create: {
			name: 'Admin',
			description: 'Full access to all modules and features'
		}
	});

	const managerGroup = await prisma.userGroup.upsert({
		where: { name: 'Manager' },
		update: {},
		create: {
			name: 'Manager',
			description: 'Can manage clients, projects, and offers'
		}
	});

	const accountantGroup = await prisma.userGroup.upsert({
		where: { name: 'Accountant' },
		update: {},
		create: {
			name: 'Accountant',
			description: 'Full access to finances, read-only on other modules'
		}
	});

	const employeeGroup = await prisma.userGroup.upsert({
		where: { name: 'Employee' },
		update: {},
		create: {
			name: 'Employee',
			description: 'Basic read access to clients and projects'
		}
	});

	// Assign permissions to Admin group (all permissions)
	console.log('Assigning permissions to groups...');
	const allPermission = await prisma.permission.findUnique({
		where: { module_action: { module: '*', action: '*' } }
	});

	if (allPermission) {
		await prisma.groupPermission.upsert({
			where: {
				userGroupId_permissionId: {
					userGroupId: adminGroup.id,
					permissionId: allPermission.id
				}
			},
			update: {},
			create: {
				userGroupId: adminGroup.id,
				permissionId: allPermission.id
			}
		});
	}

	// Assign permissions to Manager group
	const managerPermissions = [
		'dashboard.read',
		'clients.read', 'clients.create', 'clients.update', 'clients.contacts',
		'vendors.read', 'vendors.create', 'vendors.update',
		'employees.read',
		'projects.read', 'projects.create', 'projects.update', 'projects.tasks',
		'finances.income.read', 'finances.expenses.read', 'finances.payments.read',
		'offers.read', 'offers.create', 'offers.update', 'offers.send',
		'pricelists.read',
		'settings.read'
	];

	for (const permStr of managerPermissions) {
		const [module, action] = permStr.split('.');
		const perm = await prisma.permission.findUnique({
			where: { module_action: { module, action } }
		});
		if (perm) {
			await prisma.groupPermission.upsert({
				where: {
					userGroupId_permissionId: {
						userGroupId: managerGroup.id,
						permissionId: perm.id
					}
				},
				update: {},
				create: {
					userGroupId: managerGroup.id,
					permissionId: perm.id
				}
			});
		}
	}

	// Assign permissions to Accountant group
	const accountantPermissions = [
		'dashboard.read', 'dashboard.finances',
		'clients.read', 'vendors.read', 'projects.read',
		'finances.income.read', 'finances.income.create', 'finances.income.update', 'finances.income.delete', 'finances.income.export',
		'finances.expenses.read', 'finances.expenses.create', 'finances.expenses.update', 'finances.expenses.delete', 'finances.expenses.export',
		'finances.payments.read', 'finances.payments.create', 'finances.payments.update', 'finances.payments.delete', 'finances.payments.reconcile',
		'offers.read', 'pricelists.read'
	];

	for (const permStr of accountantPermissions) {
		const [module, action] = permStr.split('.');
		const perm = await prisma.permission.findUnique({
			where: { module_action: { module, action } }
		});
		if (perm) {
			await prisma.groupPermission.upsert({
				where: {
					userGroupId_permissionId: {
						userGroupId: accountantGroup.id,
						permissionId: perm.id
					}
				},
				update: {},
				create: {
					userGroupId: accountantGroup.id,
					permissionId: perm.id
				}
			});
		}
	}

	// Assign permissions to Employee group
	const employeePermissions = [
		'dashboard.read',
		'clients.read',
		'projects.read',
		'offers.read'
	];

	for (const permStr of employeePermissions) {
		const [module, action] = permStr.split('.');
		const perm = await prisma.permission.findUnique({
			where: { module_action: { module, action } }
		});
		if (perm) {
			await prisma.groupPermission.upsert({
				where: {
					userGroupId_permissionId: {
						userGroupId: employeeGroup.id,
						permissionId: perm.id
					}
				},
				update: {},
				create: {
					userGroupId: employeeGroup.id,
					permissionId: perm.id
				}
			});
		}
	}

	// Create a default company
	console.log('Creating default company...');
	const company = await prisma.company.upsert({
		where: { id: 'default-company' },
		update: {},
		create: {
			id: 'default-company',
			name: 'My Company',
			currency: 'USD',
			fiscalYearStart: 1
		}
	});

	// Create admin user
	console.log('Creating admin user...');
	const hashedPassword = await bcrypt.hash('admin123', 10);
	const adminUser = await prisma.user.upsert({
		where: { email: 'admin@example.com' },
		update: {},
		create: {
			email: 'admin@example.com',
			name: 'Admin User',
			password: hashedPassword
		}
	});

	// Create person record for admin
	await prisma.person.upsert({
		where: { userId: adminUser.id },
		update: {},
		create: {
			firstName: 'Admin',
			lastName: 'User',
			email: 'admin@example.com',
			personType: 'company_employee',
			companyId: company.id,
			userId: adminUser.id,
			employeeStatus: 'active'
		}
	});

	// Assign admin to Admin group
	await prisma.userGroupUser.upsert({
		where: {
			userId_userGroupId: {
				userId: adminUser.id,
				userGroupId: adminGroup.id
			}
		},
		update: {},
		create: {
			userId: adminUser.id,
			userGroupId: adminGroup.id
		}
	});

	console.log('Seeding completed!');
	console.log('');
	console.log('Default admin credentials:');
	console.log('  Email: admin@example.com');
	console.log('  Password: admin123');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
