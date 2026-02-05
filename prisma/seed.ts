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
		{ module: 'settings', action: 'enums', description: 'Manage enum values' },

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
		where: { id: 1 },
		update: {},
		create: {
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

	// Create a sample client
	console.log('Creating sample client...');
	const client = await prisma.client.upsert({
		where: { id: 1 },
		update: {},
		create: {
			name: 'Acme Corporation',
			companyName: 'Acme Corp LLC',
			email: 'info@acmecorp.com',
			phone: '+1 (555) 100-1000',
			street: '123 Business Ave',
			city: 'New York',
			postalCode: '10001',
			country: 'USA',
			taxId: 'US12-3456789',
			vatNumber: 'US123456789',
			website: 'https://acmecorp.com',
			industry: 'Technology',
			status: 'active',
			paymentTerms: 30,
			currency: 'USD',
			notes: 'Key enterprise client',
			companyId: company.id,
			createdById: adminUser.id
		}
	});

	// Create 3 contacts for the client
	console.log('Creating client contacts...');
	const clientContacts = [
		{ firstName: 'John', lastName: 'Smith', email: 'john.smith@acmecorp.com', phone: '+1 (555) 100-1001', position: 'CEO', isPrimary: true },
		{ firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@acmecorp.com', phone: '+1 (555) 100-1002', position: 'CFO', isPrimary: false },
		{ firstName: 'Michael', lastName: 'Brown', email: 'm.brown@acmecorp.com', phone: '+1 (555) 100-1003', position: 'Project Manager', isPrimary: false }
	];

	for (const contact of clientContacts) {
		await prisma.person.create({
			data: {
				firstName: contact.firstName,
				lastName: contact.lastName,
				email: contact.email,
				phone: contact.phone,
				position: contact.position,
				personType: 'client_contact',
				clientId: client.id,
				isPrimaryContact: contact.isPrimary
			}
		});
	}

	// Create a sample vendor
	console.log('Creating sample vendor...');
	const vendor = await prisma.vendor.upsert({
		where: { id: 1 },
		update: {},
		create: {
			name: 'TechSupply Inc',
			companyName: 'TechSupply International Inc',
			email: 'sales@techsupply.com',
			phone: '+1 (555) 200-2000',
			street: '456 Supplier Street',
			city: 'San Francisco',
			postalCode: '94102',
			country: 'USA',
			taxId: 'US98-7654321',
			vatNumber: 'US987654321',
			website: 'https://techsupply.com',
			category: 'supplier',
			status: 'active',
			paymentTerms: 45,
			currency: 'USD',
			notes: 'Primary hardware supplier'
		}
	});

	// Create 3 contacts for the vendor
	console.log('Creating vendor contacts...');
	const vendorContacts = [
		{ firstName: 'Emily', lastName: 'Davis', email: 'emily.d@techsupply.com', phone: '+1 (555) 200-2001', position: 'Account Manager' },
		{ firstName: 'Robert', lastName: 'Wilson', email: 'r.wilson@techsupply.com', phone: '+1 (555) 200-2002', position: 'Sales Director' },
		{ firstName: 'Jennifer', lastName: 'Taylor', email: 'j.taylor@techsupply.com', phone: '+1 (555) 200-2003', position: 'Support Lead' }
	];

	for (const contact of vendorContacts) {
		await prisma.person.create({
			data: {
				firstName: contact.firstName,
				lastName: contact.lastName,
				email: contact.email,
				phone: contact.phone,
				position: contact.position,
				personType: 'vendor_contact',
				vendorId: vendor.id
			}
		});
	}

	// Create 5 employees
	console.log('Creating employees...');
	const employees = [
		{ firstName: 'Alice', lastName: 'Anderson', email: 'alice@mycompany.com', department: 'Engineering', jobTitle: 'Senior Developer', salary: 95000 },
		{ firstName: 'Bob', lastName: 'Baker', email: 'bob@mycompany.com', department: 'Engineering', jobTitle: 'Developer', salary: 75000 },
		{ firstName: 'Carol', lastName: 'Clark', email: 'carol@mycompany.com', department: 'Sales', jobTitle: 'Sales Manager', salary: 85000 },
		{ firstName: 'David', lastName: 'Dixon', email: 'david@mycompany.com', department: 'Marketing', jobTitle: 'Marketing Specialist', salary: 65000 },
		{ firstName: 'Eva', lastName: 'Evans', email: 'eva@mycompany.com', department: 'Finance', jobTitle: 'Accountant', salary: 70000 }
	];

	for (const emp of employees) {
		await prisma.person.create({
			data: {
				firstName: emp.firstName,
				lastName: emp.lastName,
				email: emp.email,
				personType: 'company_employee',
				companyId: company.id,
				department: emp.department,
				jobTitle: emp.jobTitle,
				salary: emp.salary,
				employeeStatus: 'active',
				hireDate: new Date('2024-01-15'),
				employmentType: 'full-time'
			}
		});
	}

	// Create 10 income records for January 2026
	console.log('Creating income records...');
	const incomeRecords = [
		{ date: '2026-01-03', amount: 15000, description: 'Website development - Phase 1', category: 'project_payment' },
		{ date: '2026-01-05', amount: 8500, description: 'Consulting services - January', category: 'consulting' },
		{ date: '2026-01-08', amount: 12000, description: 'Mobile app development milestone', category: 'project_payment' },
		{ date: '2026-01-10', amount: 3500, description: 'Technical support package', category: 'consulting' },
		{ date: '2026-01-12', amount: 25000, description: 'Enterprise software license', category: 'product_sale' },
		{ date: '2026-01-15', amount: 7500, description: 'API integration project', category: 'project_payment' },
		{ date: '2026-01-18', amount: 4200, description: 'Training workshop', category: 'consulting' },
		{ date: '2026-01-22', amount: 18000, description: 'E-commerce platform - Final payment', category: 'project_payment' },
		{ date: '2026-01-25', amount: 6000, description: 'Maintenance contract - Q1', category: 'other' },
		{ date: '2026-01-28', amount: 9800, description: 'Cloud migration services', category: 'consulting' }
	];

	for (const income of incomeRecords) {
		await prisma.income.create({
			data: {
				date: new Date(income.date),
				amount: income.amount,
				currency: 'USD',
				description: income.description,
				category: income.category,
				clientId: client.id,
				createdById: adminUser.id
			}
		});
	}

	// Create 10 expense records for January 2026
	console.log('Creating expense records...');
	const expenseRecords = [
		{ date: '2026-01-02', amount: 2500, description: 'Cloud hosting - January', category: 'software' },
		{ date: '2026-01-04', amount: 1200, description: 'Office supplies', category: 'office' },
		{ date: '2026-01-07', amount: 5500, description: 'New development laptops', category: 'equipment' },
		{ date: '2026-01-09', amount: 800, description: 'Team lunch meeting', category: 'office' },
		{ date: '2026-01-11', amount: 3200, description: 'Software licenses renewal', category: 'software' },
		{ date: '2026-01-14', amount: 1500, description: 'Marketing campaign - Social media', category: 'marketing' },
		{ date: '2026-01-17', amount: 2800, description: 'Contractor payment - Design work', category: 'contractor' },
		{ date: '2026-01-20', amount: 950, description: 'Business travel - Client meeting', category: 'travel' },
		{ date: '2026-01-24', amount: 4500, description: 'Server hardware upgrade', category: 'equipment' },
		{ date: '2026-01-29', amount: 1800, description: 'Professional development courses', category: 'other' }
	];

	for (const expense of expenseRecords) {
		await prisma.expense.create({
			data: {
				date: new Date(expense.date),
				amount: expense.amount,
				currency: 'USD',
				description: expense.description,
				category: expense.category,
				vendorId: vendor.id,
				createdById: adminUser.id,
				taxDeductible: true
			}
		});
	}

	// ============================================================================
	// ENUM TYPES AND VALUES
	// ============================================================================
	console.log('Creating enum types and values...');

	const enumTypes = [
		{
			code: 'currency',
			name: 'Currencies',
			description: 'Available currencies for financial transactions',
			group: 'Generic',
			isSystem: true,
			values: [
				{ value: 'USD', label: 'US Dollar', sortOrder: 1, isDefault: true, metadata: { symbol: '$', code: 'USD' } },
				{ value: 'EUR', label: 'Euro', sortOrder: 2, metadata: { symbol: '€', code: 'EUR' } },
				{ value: 'GBP', label: 'British Pound', sortOrder: 3, metadata: { symbol: '£', code: 'GBP' } },
				{ value: 'JPY', label: 'Japanese Yen', sortOrder: 4, metadata: { symbol: '¥', code: 'JPY' } },
				{ value: 'CHF', label: 'Swiss Franc', sortOrder: 5, metadata: { symbol: 'CHF', code: 'CHF' } },
				{ value: 'CAD', label: 'Canadian Dollar', sortOrder: 6, metadata: { symbol: 'C$', code: 'CAD' } },
				{ value: 'AUD', label: 'Australian Dollar', sortOrder: 7, metadata: { symbol: 'A$', code: 'AUD' } },
				{ value: 'CNY', label: 'Chinese Yuan', sortOrder: 8, metadata: { symbol: '¥', code: 'CNY' } },
				{ value: 'INR', label: 'Indian Rupee', sortOrder: 9, metadata: { symbol: '₹', code: 'INR' } },
				{ value: 'HRK', label: 'Croatian Kuna', sortOrder: 10, metadata: { symbol: 'kn', code: 'HRK' } }
			]
		},
		{
			code: 'priority',
			name: 'Priority Levels',
			description: 'Priority levels for projects and tasks',
			group: 'Generic',
			isSystem: true,
			values: [
				{ value: 'low', label: 'Low', sortOrder: 1 },
				{ value: 'medium', label: 'Medium', sortOrder: 2, isDefault: true },
				{ value: 'high', label: 'High', sortOrder: 3 },
				{ value: 'urgent', label: 'Urgent', sortOrder: 4 }
			]
		},
		{
			code: 'entity_status',
			name: 'Entity Status',
			description: 'General status values for clients, vendors, etc.',
			group: 'Generic',
			isSystem: true,
			values: [
				{ value: 'active', label: 'Active', sortOrder: 1, isDefault: true },
				{ value: 'inactive', label: 'Inactive', sortOrder: 2 },
				{ value: 'archived', label: 'Archived', sortOrder: 3 }
			]
		},
		{
			code: 'income_category',
			name: 'Income Categories',
			description: 'Categories for income records',
			group: 'Finances',
			isSystem: true,
			values: [
				{ value: 'project_payment', label: 'Project Payment', sortOrder: 1, isDefault: true },
				{ value: 'consulting', label: 'Consulting', sortOrder: 2 },
				{ value: 'product_sale', label: 'Product Sale', sortOrder: 3 },
				{ value: 'subscription', label: 'Subscription', sortOrder: 4 },
				{ value: 'maintenance', label: 'Maintenance', sortOrder: 5 },
				{ value: 'license', label: 'License Fee', sortOrder: 6 },
				{ value: 'other', label: 'Other', sortOrder: 99 }
			]
		},
		{
			code: 'income_status',
			name: 'Income Status',
			description: 'Status values for income records',
			group: 'Finances',
			isSystem: true,
			values: [
				{ value: 'pending', label: 'Pending', sortOrder: 1, isDefault: true },
				{ value: 'paid', label: 'Paid', sortOrder: 2 },
				{ value: 'late', label: 'Late', sortOrder: 3 },
				{ value: 'suspended', label: 'Suspended', sortOrder: 4 }
			]
		},
		{
			code: 'expense_category',
			name: 'Expense Categories',
			description: 'Categories for expense records',
			group: 'Finances',
			isSystem: true,
			values: [
				{ value: 'salary', label: 'Salary', sortOrder: 1, isDefault: true },
				{ value: 'software', label: 'Software', sortOrder: 2 },
				{ value: 'office', label: 'Office', sortOrder: 3 },
				{ value: 'marketing', label: 'Marketing', sortOrder: 4 },
				{ value: 'travel', label: 'Travel', sortOrder: 5 },
				{ value: 'equipment', label: 'Equipment', sortOrder: 6 },
				{ value: 'contractor', label: 'Contractor', sortOrder: 7 },
				{ value: 'utilities', label: 'Utilities', sortOrder: 8 },
				{ value: 'insurance', label: 'Insurance', sortOrder: 9 },
				{ value: 'rent', label: 'Rent', sortOrder: 10 },
				{ value: 'other', label: 'Other', sortOrder: 99 }
			]
		},
		{
			code: 'expense_status',
			name: 'Expense Status',
			description: 'Status values for expense records',
			group: 'Finances',
			isSystem: true,
			values: [
				{ value: 'pending', label: 'Pending', sortOrder: 1, isDefault: true },
				{ value: 'paid', label: 'Paid', sortOrder: 2 },
				{ value: 'late', label: 'Late', sortOrder: 3 },
				{ value: 'suspended', label: 'Suspended', sortOrder: 4 }
			]
		},
		{
			code: 'payment_method',
			name: 'Payment Methods',
			description: 'Available payment methods',
			group: 'Finances',
			isSystem: true,
			values: [
				{ value: 'bank_transfer', label: 'Bank Transfer', sortOrder: 1, isDefault: true },
				{ value: 'cash', label: 'Cash', sortOrder: 2 },
				{ value: 'credit_card', label: 'Credit Card', sortOrder: 3 },
				{ value: 'check', label: 'Check', sortOrder: 4 },
				{ value: 'paypal', label: 'PayPal', sortOrder: 5 },
				{ value: 'stripe', label: 'Stripe', sortOrder: 6 },
				{ value: 'other', label: 'Other', sortOrder: 99 }
			]
		},
		{
			code: 'payment_status',
			name: 'Payment Status',
			description: 'Status values for payments',
			group: 'Finances',
			isSystem: true,
			values: [
				{ value: 'pending', label: 'Pending', sortOrder: 1, isDefault: true },
				{ value: 'completed', label: 'Completed', sortOrder: 2 },
				{ value: 'failed', label: 'Failed', sortOrder: 3 },
				{ value: 'cancelled', label: 'Cancelled', sortOrder: 4 }
			]
		},
		{
			code: 'recurring_period',
			name: 'Recurring Periods',
			description: 'Periods for recurring income/expenses',
			group: 'Finances',
			isSystem: true,
			values: [
				{ value: 'weekly', label: 'Weekly', sortOrder: 1 },
				{ value: 'biweekly', label: 'Bi-weekly', sortOrder: 2 },
				{ value: 'monthly', label: 'Monthly', sortOrder: 3, isDefault: true },
				{ value: 'quarterly', label: 'Quarterly', sortOrder: 4 },
				{ value: 'yearly', label: 'Yearly', sortOrder: 5 }
			]
		},
		{
			code: 'client_industry',
			name: 'Client Industries',
			description: 'Industry classifications for clients',
			group: 'Clients',
			isSystem: false,
			values: [
				{ value: 'technology', label: 'Technology', sortOrder: 1, isDefault: true },
				{ value: 'finance', label: 'Finance', sortOrder: 2 },
				{ value: 'healthcare', label: 'Healthcare', sortOrder: 3 },
				{ value: 'retail', label: 'Retail', sortOrder: 4 },
				{ value: 'manufacturing', label: 'Manufacturing', sortOrder: 5 },
				{ value: 'education', label: 'Education', sortOrder: 6 },
				{ value: 'real_estate', label: 'Real Estate', sortOrder: 7 },
				{ value: 'hospitality', label: 'Hospitality', sortOrder: 8 },
				{ value: 'consulting', label: 'Consulting', sortOrder: 9 },
				{ value: 'media', label: 'Media & Entertainment', sortOrder: 10 },
				{ value: 'nonprofit', label: 'Non-Profit', sortOrder: 11 },
				{ value: 'government', label: 'Government', sortOrder: 12 },
				{ value: 'other', label: 'Other', sortOrder: 99 }
			]
		},
		{
			code: 'vendor_category',
			name: 'Vendor Categories',
			description: 'Categories for vendors',
			group: 'Vendors',
			isSystem: false,
			values: [
				{ value: 'supplier', label: 'Supplier', sortOrder: 1, isDefault: true },
				{ value: 'contractor', label: 'Contractor', sortOrder: 2 },
				{ value: 'service_provider', label: 'Service Provider', sortOrder: 3 },
				{ value: 'consultant', label: 'Consultant', sortOrder: 4 },
				{ value: 'manufacturer', label: 'Manufacturer', sortOrder: 5 },
				{ value: 'distributor', label: 'Distributor', sortOrder: 6 },
				{ value: 'other', label: 'Other', sortOrder: 99 }
			]
		},
		{
			code: 'department',
			name: 'Departments',
			description: 'Company departments for employees',
			group: 'Employees',
			isSystem: false,
			values: [
				{ value: 'engineering', label: 'Engineering', sortOrder: 1, isDefault: true },
				{ value: 'sales', label: 'Sales', sortOrder: 2 },
				{ value: 'marketing', label: 'Marketing', sortOrder: 3 },
				{ value: 'finance', label: 'Finance', sortOrder: 4 },
				{ value: 'hr', label: 'Human Resources', sortOrder: 5 },
				{ value: 'operations', label: 'Operations', sortOrder: 6 },
				{ value: 'support', label: 'Support', sortOrder: 7 },
				{ value: 'design', label: 'Design', sortOrder: 8 },
				{ value: 'management', label: 'Management', sortOrder: 9 },
				{ value: 'legal', label: 'Legal', sortOrder: 10 },
				{ value: 'other', label: 'Other', sortOrder: 99 }
			]
		},
		{
			code: 'employment_type',
			name: 'Employment Types',
			description: 'Types of employment contracts',
			group: 'Employees',
			isSystem: true,
			values: [
				{ value: 'full-time', label: 'Full-time', sortOrder: 1, isDefault: true },
				{ value: 'part-time', label: 'Part-time', sortOrder: 2 },
				{ value: 'contractor', label: 'Contractor', sortOrder: 3 },
				{ value: 'intern', label: 'Intern', sortOrder: 4 },
				{ value: 'temporary', label: 'Temporary', sortOrder: 5 }
			]
		},
		{
			code: 'employee_status',
			name: 'Employee Status',
			description: 'Employment status values',
			group: 'Employees',
			isSystem: true,
			values: [
				{ value: 'active', label: 'Active', sortOrder: 1, isDefault: true },
				{ value: 'on_leave', label: 'On Leave', sortOrder: 2 },
				{ value: 'terminated', label: 'Terminated', sortOrder: 3 },
				{ value: 'retired', label: 'Retired', sortOrder: 4 }
			]
		},
		{
			code: 'project_status',
			name: 'Project Status',
			description: 'Status values for projects',
			group: 'Projects',
			isSystem: true,
			values: [
				{ value: 'planning', label: 'Planning', sortOrder: 1, isDefault: true },
				{ value: 'active', label: 'Active', sortOrder: 2 },
				{ value: 'on_hold', label: 'On Hold', sortOrder: 3 },
				{ value: 'completed', label: 'Completed', sortOrder: 4 },
				{ value: 'cancelled', label: 'Cancelled', sortOrder: 5 }
			]
		},
		{
			code: 'task_status',
			name: 'Task Status',
			description: 'Status values for tasks',
			group: 'Projects',
			isSystem: true,
			values: [
				{ value: 'backlog', label: 'Backlog', sortOrder: 1 },
				{ value: 'todo', label: 'To Do', sortOrder: 2, isDefault: true },
				{ value: 'in_progress', label: 'In Progress', sortOrder: 3 },
				{ value: 'review', label: 'Review', sortOrder: 4 },
				{ value: 'client_review', label: 'Client Review', sortOrder: 5 },
				{ value: 'done', label: 'Done', sortOrder: 6 }
			]
		},
		{
			code: 'offer_status',
			name: 'Offer Status',
			description: 'Status values for offers',
			group: 'Offers',
			isSystem: true,
			values: [
				{ value: 'draft', label: 'Draft', sortOrder: 1, isDefault: true },
				{ value: 'sent', label: 'Sent', sortOrder: 2 },
				{ value: 'accepted', label: 'Accepted', sortOrder: 3 },
				{ value: 'rejected', label: 'Rejected', sortOrder: 4 },
				{ value: 'expired', label: 'Expired', sortOrder: 5 }
			]
		},
		{
			code: 'unit_of_measure',
			name: 'Units of Measure',
			description: 'Units of measure for price list items',
			group: 'Price Lists',
			isSystem: true,
			values: [
				{ value: 'piece', label: 'Piece', sortOrder: 1, isDefault: true },
				{ value: 'hour', label: 'Hour', sortOrder: 2 },
				{ value: 'day', label: 'Day', sortOrder: 3 },
				{ value: 'week', label: 'Week', sortOrder: 4 },
				{ value: 'month', label: 'Month', sortOrder: 5 },
				{ value: 'project', label: 'Project', sortOrder: 6 },
				{ value: 'license', label: 'License', sortOrder: 7 },
				{ value: 'subscription', label: 'Subscription', sortOrder: 8 }
			]
		},
		{
			code: 'pricelist_category',
			name: 'Price List Categories',
			description: 'Categories for price list items',
			group: 'Price Lists',
			isSystem: false,
			values: [
				{ value: 'hourly_rate', label: 'Hourly Rate', sortOrder: 1, isDefault: true },
				{ value: 'consulting', label: 'Consulting', sortOrder: 2 },
				{ value: 'design', label: 'Design', sortOrder: 3 },
				{ value: 'development', label: 'Development', sortOrder: 4 },
				{ value: 'hosting', label: 'Hosting', sortOrder: 5 },
				{ value: 'marketing', label: 'Marketing', sortOrder: 6 },
				{ value: 'planning', label: 'Planning', sortOrder: 7 },
				{ value: 'project_management', label: 'Project Management', sortOrder: 8 },
				{ value: 'seo', label: 'SEO', sortOrder: 9 },
				{ value: 'support', label: 'Support', sortOrder: 10 },
				{ value: 'training', label: 'Training', sortOrder: 11 },
				{ value: 'other', label: 'Other', sortOrder: 99 }
			]
		}
	];

	for (const enumType of enumTypes) {
		const createdType = await prisma.enumType.upsert({
			where: { code: enumType.code },
			update: {
				name: enumType.name,
				description: enumType.description,
				group: enumType.group,
				isSystem: enumType.isSystem
			},
			create: {
				code: enumType.code,
				name: enumType.name,
				description: enumType.description,
				group: enumType.group,
				isSystem: enumType.isSystem
			}
		});

		// Create or update values
		for (const value of enumType.values) {
			await prisma.enumValue.upsert({
				where: {
					enumTypeId_value: {
						enumTypeId: createdType.id,
						value: value.value
					}
				},
				update: {
					label: value.label,
					sortOrder: value.sortOrder,
					isDefault: value.isDefault || false,
					metadata: value.metadata || null
				},
				create: {
					enumTypeId: createdType.id,
					value: value.value,
					label: value.label,
					sortOrder: value.sortOrder,
					isDefault: value.isDefault || false,
					isActive: true,
					metadata: value.metadata || null
				}
			});
		}
	}

	console.log('Seeding completed!');
	console.log('');
	console.log('Default admin credentials:');
	console.log('  Email: admin@example.com');
	console.log('  Password: admin123');
	console.log('');
	console.log('Sample data created:');
	console.log('  - 1 Client (Acme Corporation) with 3 contacts');
	console.log('  - 1 Vendor (TechSupply Inc) with 3 contacts');
	console.log('  - 5 Employees');
	console.log('  - 10 Income records (January 2026)');
	console.log('  - 10 Expense records (January 2026)');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
