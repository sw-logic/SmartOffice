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
		{ module: 'projects', action: 'kanban', description: 'Manage kanban boards' },
		{ module: 'projects', action: 'milestones', description: 'Manage project milestones' },
		{ module: 'projects', action: 'budget', description: 'View project budget and estimates' },

		// Tasks
		{ module: 'tasks', action: 'read', description: 'View tasks' },
		{ module: 'tasks', action: 'create', description: 'Create tasks' },
		{ module: 'tasks', action: 'update', description: 'Update tasks' },
		{ module: 'tasks', action: 'delete', description: 'Delete tasks' },

		// Time Records
		{ module: 'time_records', action: 'read', description: 'View time records' },
		{ module: 'time_records', action: 'create', description: 'Create time records' },
		{ module: 'time_records', action: 'update', description: 'Update time records' },
		{ module: 'time_records', action: 'delete', description: 'Delete time records' },

		// Notes
		{ module: 'notes', action: 'read', description: 'View notes' },
		{ module: 'notes', action: 'create', description: 'Create notes' },
		{ module: 'notes', action: 'update', description: 'Update notes' },
		{ module: 'notes', action: 'delete', description: 'Delete notes' },

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

	// Helper: split permission string into module + action
	// Handles dotted modules like "finances.income.read" -> module="finances.income", action="read"
	function splitPerm(permStr: string): { module: string; action: string } {
		const lastDot = permStr.lastIndexOf('.');
		return { module: permStr.substring(0, lastDot), action: permStr.substring(lastDot + 1) };
	}

	// Helper: assign permissions to a group
	async function assignGroupPermissions(groupId: number, permStrings: string[]) {
		for (const permStr of permStrings) {
			const { module, action } = splitPerm(permStr);
			const perm = await prisma.permission.findUnique({
				where: { module_action: { module, action } }
			});
			if (perm) {
				await prisma.groupPermission.upsert({
					where: {
						userGroupId_permissionId: {
							userGroupId: groupId,
							permissionId: perm.id
						}
					},
					update: {},
					create: {
						userGroupId: groupId,
						permissionId: perm.id
					}
				});
			}
		}
	}

	// Assign permissions to Manager group
	await assignGroupPermissions(managerGroup.id, [
		'dashboard.read',
		'clients.read', 'clients.create', 'clients.update', 'clients.contacts',
		'vendors.read', 'vendors.create', 'vendors.update',
		'employees.read',
		'projects.read', 'projects.create', 'projects.update', 'projects.tasks',
		'projects.kanban', 'projects.milestones',
		'finances.income.read', 'finances.expenses.read', 'finances.payments.read',
		'offers.read', 'offers.create', 'offers.update', 'offers.send',
		'pricelists.read',
		'settings.read',
		'tasks.read', 'tasks.create', 'tasks.update', 'tasks.delete',
		'time_records.read', 'time_records.create',
		'notes.read', 'notes.create'
	]);

	// Assign permissions to Accountant group
	await assignGroupPermissions(accountantGroup.id, [
		'dashboard.read', 'dashboard.finances',
		'clients.read', 'vendors.read', 'projects.read',
		'projects.budget',
		'finances.income.read', 'finances.income.create', 'finances.income.update', 'finances.income.delete', 'finances.income.export',
		'finances.expenses.read', 'finances.expenses.create', 'finances.expenses.update', 'finances.expenses.delete', 'finances.expenses.export',
		'finances.payments.read', 'finances.payments.create', 'finances.payments.update', 'finances.payments.delete', 'finances.payments.reconcile',
		'offers.read', 'pricelists.read',
		'time_records.read'
	]);

	// Assign permissions to Employee group
	await assignGroupPermissions(employeeGroup.id, [
		'dashboard.read',
		'clients.read',
		'projects.read', 'projects.tasks',
		'offers.read',
		'tasks.read', 'tasks.create', 'tasks.update',
		'time_records.read', 'time_records.create', 'time_records.update',
		'notes.read', 'notes.create'
	]);

	// Create a default company
	console.log('Creating default company...');
	const company = await prisma.company.upsert({
		where: { id: 1 },
		update: {},
		create: {
			name: 'My Company',
			currency: 'HUF',
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
			currency: 'HUF',
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
			currency: 'HUF',
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

	const createdEmployees = [];
	for (const emp of employees) {
		const person = await prisma.person.create({
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
		createdEmployees.push(person);
	}
	const [alice, bob] = createdEmployees;

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
				currency: 'HUF',
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
				currency: 'HUF',
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
				{ value: 'HUF', label: 'Hungarian Forint', sortOrder: 1, isDefault: true, metadata: { symbol: 'HUF', code: 'HUF' } },
				{ value: 'USD', label: 'US Dollar', sortOrder: 1, metadata: { symbol: '$', code: 'USD' } },
				{ value: 'EUR', label: 'Euro', sortOrder: 2, metadata: { symbol: '€', code: 'EUR' } },
				{ value: 'GBP', label: 'British Pound', sortOrder: 3, metadata: { symbol: '£', code: 'GBP' } },
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
				{ value: 'cancelled', label: 'Cancelled', sortOrder: 5 },
				{ value: 'archived', label: 'Archived', sortOrder: 6 }
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
		},
		{
			code: 'task_type',
			name: 'Task Types',
			description: 'Types of tasks',
			group: 'Projects',
			isSystem: false,
			values: [
				{ value: 'bug', label: 'Bug', sortOrder: 1 },
				{ value: 'feature', label: 'Feature', sortOrder: 2, isDefault: true },
				{ value: 'task', label: 'Task', sortOrder: 3 },
				{ value: 'improvement', label: 'Improvement', sortOrder: 4 },
				{ value: 'research', label: 'Research', sortOrder: 5 },
				{ value: 'documentation', label: 'Documentation', sortOrder: 6 }
			]
		},
		{
			code: 'task_category',
			name: 'Task Categories',
			description: 'Categories for tasks',
			group: 'Projects',
			isSystem: false,
			values: [
				{ value: 'frontend', label: 'Frontend', sortOrder: 1 },
				{ value: 'backend', label: 'Backend', sortOrder: 2, isDefault: true },
				{ value: 'design', label: 'Design', sortOrder: 3 },
				{ value: 'testing', label: 'Testing', sortOrder: 4 },
				{ value: 'devops', label: 'DevOps', sortOrder: 5 },
				{ value: 'other', label: 'Other', sortOrder: 99 }
			]
		},
		{
			code: 'time_record_type',
			name: 'Time Record Types',
			description: 'Types of time records',
			group: 'Projects',
			isSystem: false,
			values: [
				{ value: 'development', label: 'Development', sortOrder: 1, isDefault: true },
				{ value: 'design', label: 'Design', sortOrder: 2 },
				{ value: 'meeting', label: 'Meeting', sortOrder: 3 },
				{ value: 'review', label: 'Review', sortOrder: 4 },
				{ value: 'testing', label: 'Testing', sortOrder: 5 },
				{ value: 'documentation', label: 'Documentation', sortOrder: 6 },
				{ value: 'support', label: 'Support', sortOrder: 7 },
				{ value: 'other', label: 'Other', sortOrder: 99 }
			]
		},
		{
			code: 'time_record_category',
			name: 'Time Record Categories',
			description: 'Billing categories for time records',
			group: 'Projects',
			isSystem: false,
			values: [
				{ value: 'billable', label: 'Billable', sortOrder: 1, isDefault: true },
				{ value: 'non_billable', label: 'Non-billable', sortOrder: 2 },
				{ value: 'overtime', label: 'Overtime', sortOrder: 3 },
				{ value: 'internal', label: 'Internal', sortOrder: 4 }
			]
		},
		{
			code: 'note_priority',
			name: 'Note Priorities',
			description: 'Priority levels for notes',
			group: 'Generic',
			isSystem: true,
			values: [
				{ value: 'low', label: 'Low', sortOrder: 1 },
				{ value: 'normal', label: 'Normal', sortOrder: 2, isDefault: true },
				{ value: 'high', label: 'High', sortOrder: 3 },
				{ value: 'urgent', label: 'Urgent', sortOrder: 4 }
			]
		},
		{
			code: 'project_tags',
			name: 'Project Tags',
			description: 'Tags for projects',
			group: 'Projects',
			isSystem: false,
			values: [
				{ value: 'high_priority', label: 'High Priority', sortOrder: 1, color: '#EF4444' },
				{ value: 'flagship', label: 'Flagship', sortOrder: 2, color: '#8B5CF6' },
				{ value: 'internal', label: 'Internal', sortOrder: 3, color: '#3B82F6' },
				{ value: 'client_facing', label: 'Client Facing', sortOrder: 4, color: '#10B981' },
				{ value: 'maintenance', label: 'Maintenance', sortOrder: 5, color: '#F59E0B' }
			]
		},
		{
			code: 'client_tags',
			name: 'Client Tags',
			description: 'Tags for clients',
			group: 'Clients',
			isSystem: false,
			values: [
				{ value: 'vip', label: 'VIP', sortOrder: 1, color: '#EF4444' },
				{ value: 'enterprise', label: 'Enterprise', sortOrder: 2, color: '#8B5CF6' },
				{ value: 'startup', label: 'Startup', sortOrder: 3, color: '#3B82F6' },
				{ value: 'recurring', label: 'Recurring', sortOrder: 4, color: '#10B981' },
				{ value: 'prospect', label: 'Prospect', sortOrder: 5, color: '#F59E0B' }
			]
		},
		{
			code: 'task_tags',
			name: 'Task Tags',
			description: 'Tags for tasks',
			group: 'Projects',
			isSystem: false,
			values: [
				{ value: 'blocker', label: 'Blocker', sortOrder: 1, color: '#EF4444' },
				{ value: 'quick_win', label: 'Quick Win', sortOrder: 2, color: '#10B981' },
				{ value: 'tech_debt', label: 'Tech Debt', sortOrder: 3, color: '#F59E0B' },
				{ value: 'needs_review', label: 'Needs Review', sortOrder: 4, color: '#3B82F6' },
				{ value: 'wont_fix', label: "Won't Fix", sortOrder: 5, color: '#6B7280' }
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
					color: value.color || null,
					metadata: value.metadata || null
				},
				create: {
					enumTypeId: createdType.id,
					value: value.value,
					label: value.label,
					sortOrder: value.sortOrder,
					isDefault: value.isDefault || false,
					isActive: true,
					color: value.color || null,
					metadata: value.metadata || null
				}
			});
		}
	}

	// ============================================================================
	// SAMPLE PROJECT DATA
	// ============================================================================
	console.log('Creating sample project data...');

	// Create project
	const project = await prisma.project.upsert({
		where: { id: 1 },
		update: {},
		create: {
			name: 'Website Redesign',
			description: '# Website Redesign\n\nComplete redesign of the Acme Corp corporate website.\n\n## Goals\n- Modern responsive design\n- Improved performance\n- Better SEO\n- CMS integration',
			companyId: company.id,
			clientId: client.id,
			status: 'active',
			priority: 'high',
			startDate: new Date('2026-01-15'),
			endDate: new Date('2026-06-30'),
			budgetEstimate: 50000,
			estimatedHours: 800,
			projectManagerId: alice.id,
			createdById: adminUser.id
		}
	});

	// Assign employees to project
	console.log('Assigning employees to project...');
	for (const person of [alice, bob]) {
		await prisma.projectEmployee.upsert({
			where: {
				projectId_personId: {
					projectId: project.id,
					personId: person.id
				}
			},
			update: {},
			create: {
				projectId: project.id,
				personId: person.id,
				role: person.id === alice.id ? 'Lead Developer' : 'Developer'
			}
		});
	}

	// Create milestones
	console.log('Creating milestones...');
	const milestone1 = await prisma.milestone.create({
		data: {
			projectId: project.id,
			name: 'Design Phase Complete',
			description: 'All wireframes and mockups approved by client.',
			date: new Date('2026-03-01'),
			order: 1
		}
	});

	const milestone2 = await prisma.milestone.create({
		data: {
			projectId: project.id,
			name: 'Launch',
			description: 'Production deployment of the new website.',
			date: new Date('2026-06-30'),
			order: 2
		}
	});

	// Create kanban board
	console.log('Creating kanban board...');
	const kanbanBoard = await prisma.kanbanBoard.create({
		data: {
			projectId: project.id,
			name: 'Main Board',
			description: 'Primary kanban board for website redesign'
		}
	});

	// Add board members
	for (const person of [alice, bob]) {
		await prisma.kanbanBoardMember.create({
			data: {
				kanbanBoardId: kanbanBoard.id,
				personId: person.id,
				role: 'member'
			}
		});
	}

	// Create columns
	const columnNames = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];
	const columns: Record<string, { id: number }> = {};
	for (let i = 0; i < columnNames.length; i++) {
		const col = await prisma.kanbanColumn.create({
			data: {
				kanbanBoardId: kanbanBoard.id,
				name: columnNames[i],
				order: i
			}
		});
		columns[columnNames[i]] = col;
	}

	// Create swimlanes
	const swimlaneNames = ['Bugs', 'New Requests', 'Tasks', 'Ideas'];
	const swimlanes: Record<string, { id: number }> = {};
	for (let i = 0; i < swimlaneNames.length; i++) {
		const sl = await prisma.kanbanSwimlane.create({
			data: {
				kanbanBoardId: kanbanBoard.id,
				name: swimlaneNames[i],
				order: i
			}
		});
		swimlanes[swimlaneNames[i]] = sl;
	}

	// Create tasks
	console.log('Creating tasks...');
	const taskData = [
		{
			name: 'Fix navigation menu on mobile',
			description: 'The hamburger menu does not open on iOS Safari.\n\n## Steps to reproduce\n1. Open site on iPhone\n2. Tap hamburger icon\n3. Nothing happens',
			type: 'bug', category: 'frontend', status: 'in_progress', priority: 'high',
			column: 'In Progress', swimlane: 'Bugs',
			assignedToId: alice.id, estimatedTime: 4, order: 0
		},
		{
			name: 'Design new homepage layout',
			description: 'Create wireframe and high-fidelity mockup for the new homepage.',
			type: 'feature', category: 'design', status: 'review', priority: 'high',
			column: 'Review', swimlane: 'New Requests',
			assignedToId: bob.id, estimatedTime: 16, order: 0
		},
		{
			name: 'Set up CI/CD pipeline',
			description: 'Configure automated testing and deployment pipeline using GitHub Actions.',
			type: 'task', category: 'devops', status: 'todo', priority: 'medium',
			column: 'To Do', swimlane: 'Tasks',
			assignedToId: null, estimatedTime: 8, order: 0
		},
		{
			name: 'Implement contact form',
			description: 'Build the contact form with validation and email notification.',
			type: 'feature', category: 'backend', status: 'todo', priority: 'medium',
			column: 'To Do', swimlane: 'New Requests',
			assignedToId: alice.id, estimatedTime: 12, order: 1
		},
		{
			name: 'Research analytics integration',
			description: 'Evaluate Google Analytics 4 vs Plausible for privacy-friendly analytics.',
			type: 'research', category: 'other', status: 'backlog', priority: 'low',
			column: 'Backlog', swimlane: 'Ideas',
			assignedToId: null, estimatedTime: 6, order: 0
		},
		{
			name: 'Write API documentation',
			description: 'Document all REST API endpoints with request/response examples.',
			type: 'documentation', category: 'backend', status: 'backlog', priority: 'low',
			column: 'Backlog', swimlane: 'Tasks',
			assignedToId: bob.id, estimatedTime: 10, order: 1
		}
	];

	const createdTasks = [];
	for (const t of taskData) {
		const task = await prisma.task.create({
			data: {
				name: t.name,
				description: t.description,
				type: t.type,
				category: t.category,
				status: t.status,
				priority: t.priority,
				projectId: project.id,
				kanbanBoardId: kanbanBoard.id,
				columnId: columns[t.column].id,
				swimlaneId: swimlanes[t.swimlane].id,
				assignedToId: t.assignedToId,
				estimatedTime: t.estimatedTime,
				order: t.order,
				createdById: adminUser.id
			}
		});
		createdTasks.push(task);
	}

	// Create time records
	console.log('Creating time records...');
	const timeRecordData = [
		{ taskIndex: 0, date: '2026-01-20', hours: 2.5, description: 'Investigated iOS Safari bug, found CSS issue', type: 'development', category: 'billable' },
		{ taskIndex: 0, date: '2026-01-21', hours: 1.5, description: 'Applied fix and tested across devices', type: 'development', category: 'billable' },
		{ taskIndex: 1, date: '2026-01-18', hours: 4, description: 'Initial wireframe sketches for homepage', type: 'design', category: 'billable' },
		{ taskIndex: 1, date: '2026-01-22', hours: 6, description: 'High-fidelity mockup in Figma', type: 'design', category: 'billable' }
	];

	for (const tr of timeRecordData) {
		await prisma.timeRecord.create({
			data: {
				taskId: createdTasks[tr.taskIndex].id,
				date: new Date(tr.date),
				hours: tr.hours,
				description: tr.description,
				type: tr.type,
				category: tr.category,
				createdById: adminUser.id
			}
		});
	}

	// Create notes
	console.log('Creating notes...');
	await prisma.note.create({
		data: {
			entityType: 'Project',
			entityId: String(project.id),
			content: '## Kickoff Meeting Notes\n\nClient wants a modern, clean design. Key requirements:\n- Mobile-first approach\n- Fast page load times (< 2s)\n- Integration with their existing CRM',
			authorId: adminUser.id,
			priority: 'high',
			color: '#3B82F6'
		}
	});

	await prisma.note.create({
		data: {
			entityType: 'Client',
			entityId: String(client.id),
			content: '## Account Notes\n\nAcme Corp is our largest enterprise client. Primary contact is John Smith (CEO).\nPrefers communication via email. Billing handled through Sarah Johnson (CFO).',
			authorId: adminUser.id,
			priority: 'normal',
			color: '#10B981'
		}
	});

	await prisma.note.create({
		data: {
			entityType: 'Task',
			entityId: String(createdTasks[0].id),
			content: 'This bug only affects iOS 16+. The CSS `dvh` unit is not supported in older Safari versions. Consider using a fallback.',
			authorId: adminUser.id,
			priority: 'normal'
		}
	});

	// Create entity tags
	console.log('Creating entity tags...');
	const projectTagType = await prisma.enumType.findUnique({ where: { code: 'project_tags' }, include: { values: true } });
	const clientTagType = await prisma.enumType.findUnique({ where: { code: 'client_tags' }, include: { values: true } });

	if (projectTagType) {
		const flagshipTag = projectTagType.values.find(v => v.value === 'flagship');
		const highPriorityTag = projectTagType.values.find(v => v.value === 'high_priority');
		if (flagshipTag) {
			await prisma.entityTag.create({
				data: { entityType: 'Project', entityId: String(project.id), enumValueId: flagshipTag.id }
			});
		}
		if (highPriorityTag) {
			await prisma.entityTag.create({
				data: { entityType: 'Project', entityId: String(project.id), enumValueId: highPriorityTag.id }
			});
		}
	}

	if (clientTagType) {
		const enterpriseTag = clientTagType.values.find(v => v.value === 'enterprise');
		const vipTag = clientTagType.values.find(v => v.value === 'vip');
		if (enterpriseTag) {
			await prisma.entityTag.create({
				data: { entityType: 'Client', entityId: String(client.id), enumValueId: enterpriseTag.id }
			});
		}
		if (vipTag) {
			await prisma.entityTag.create({
				data: { entityType: 'Client', entityId: String(client.id), enumValueId: vipTag.id }
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
	console.log('  - 1 Project (Website Redesign) with 2 milestones');
	console.log('  - 1 Kanban Board with 5 columns and 4 swimlanes');
	console.log('  - 6 Tasks across kanban board');
	console.log('  - 4 Time Records');
	console.log('  - 3 Notes (on project, client, and task)');
	console.log('  - 4 Entity Tags (on project and client)');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
