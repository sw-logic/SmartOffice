import {
	LayoutDashboard,
	Users,
	Briefcase,
	Building2,
	DollarSign,
	FileText,
	ListChecks,
	Settings,
	TrendingUp,
	TrendingDown,
	CreditCard,
	UserCog,
	Package,
	Shield,
	UsersRound,
	List,
	Kanban,
	ClipboardList,
	FolderOpen
} from 'lucide-svelte';
import type { ComponentType } from 'svelte';

export interface Module {
	id: string;
	name: string;
	icon: ComponentType;
	route: string;
	permissions: string[];
	description?: string;
	subModules?: Module[];
}

export const modules: Module[] = [
	{
		id: 'dashboard',
		name: 'Dashboard',
		icon: LayoutDashboard,
		route: '/dashboard',
		permissions: ['dashboard.read'],
		description: 'Overview and key metrics'
	},
	{
		id: 'clients',
		name: 'Clients',
		icon: Building2,
		route: '/clients',
		permissions: ['clients.read'],
		description: 'Manage company clients'
	},
	{
		id: 'vendors',
		name: 'Vendors',
		icon: Package,
		route: '/vendors',
		permissions: ['vendors.read'],
		description: 'Manage vendors and suppliers'
	},
	{
		id: 'employees',
		name: 'Employees',
		icon: Users,
		route: '/employees',
		permissions: ['employees.read'],
		description: 'Manage company employees'
	},
	{
		id: 'projects',
		name: 'Projects',
		icon: Briefcase,
		route: '/projects',
		permissions: ['projects.read'],
		description: 'Project management',
		subModules: [
			{
				id: 'projects.list',
				name: 'Projects',
				icon: FolderOpen,
				route: '/projects',
				permissions: ['projects.read'],
				description: 'Manage projects'
			},
			{
				id: 'projects.boards',
				name: 'Boards',
				icon: Kanban,
				route: '/projects/boards',
				permissions: ['projects.read'],
				description: 'Kanban boards'
			},
			{
				id: 'projects.tasks',
				name: 'Tasks',
				icon: ClipboardList,
				route: '/projects/tasks',
				permissions: ['projects.read'],
				description: 'Task management'
			}
		]
	},
	{
		id: 'finances',
		name: 'Finances',
		icon: DollarSign,
		route: '/finances',
		permissions: ['finances.income.read', 'finances.expenses.read', 'finances.payments.read', 'offers.read', 'pricelists.read'],
		description: 'Financial management',
		subModules: [
			{
				id: 'finances.income',
				name: 'Income',
				icon: TrendingUp,
				route: '/finances/income',
				permissions: ['finances.income.read'],
				description: 'Track income'
			},
			{
				id: 'finances.expenses',
				name: 'Expenses',
				icon: TrendingDown,
				route: '/finances/expenses',
				permissions: ['finances.expenses.read'],
				description: 'Track expenses'
			},
			{
				id: 'finances.payments',
				name: 'Payments',
				icon: CreditCard,
				route: '/finances/payments',
				permissions: ['finances.payments.read'],
				description: 'Track payments'
			},
			{
				id: 'finances.offers',
				name: 'Offers',
				icon: FileText,
				route: '/offers',
				permissions: ['offers.read'],
				description: 'Create and manage offers'
			},
			{
				id: 'finances.pricelists',
				name: 'Price Lists',
				icon: ListChecks,
				route: '/pricelists',
				permissions: ['pricelists.read'],
				description: 'Manage product/service pricing'
			}
		]
	},
	{
		id: 'users',
		name: 'Users',
		icon: UsersRound,
		route: '/users',
		permissions: ['settings.users'],
		description: 'User management',
		subModules: [
			{
				id: 'users.list',
				name: 'Users',
				icon: UserCog,
				route: '/users',
				permissions: ['settings.users'],
				description: 'Manage system users'
			},
			{
				id: 'users.groups',
				name: 'User Groups',
				icon: Shield,
				route: '/users/groups',
				permissions: ['settings.users'],
				description: 'Manage user groups and permissions'
			}
		]
	},
	{
		id: 'settings',
		name: 'Settings',
		icon: Settings,
		route: '/settings',
		permissions: ['settings.read'],
		description: 'System configuration',
		subModules: [
			{
				id: 'settings.company',
				name: 'Company',
				icon: Building2,
				route: '/settings/company',
				permissions: ['settings.company'],
				description: 'Company profile'
			},
			{
				id: 'settings.enums',
				name: 'Enums',
				icon: List,
				route: '/settings/enums',
				permissions: ['settings.enums'],
				description: 'Manage dropdown values'
			}
		]
	}
];

/**
 * Get a module by ID
 */
export function getModule(id: string): Module | undefined {
	for (const module of modules) {
		if (module.id === id) return module;
		if (module.subModules) {
			const subModule = module.subModules.find(m => m.id === id);
			if (subModule) return subModule;
		}
	}
	return undefined;
}

/**
 * Get all flat modules (including sub-modules)
 */
export function getAllModules(): Module[] {
	const all: Module[] = [];
	for (const module of modules) {
		all.push(module);
		if (module.subModules) {
			all.push(...module.subModules);
		}
	}
	return all;
}

/**
 * Filter modules based on user permissions
 */
export function filterModulesByPermissions(
	userPermissions: Array<{ module: string; action: string }>
): Module[] {
	const hasPermission = (required: string[]): boolean => {
		// Check for admin permission
		if (userPermissions.some(p => p.module === '*' && p.action === '*')) {
			return true;
		}

		return required.some(req => {
			const [module, action] = req.split('.');
			return userPermissions.some(
				p =>
					(p.module === module && p.action === action) ||
					(p.module === module && p.action === '*')
			);
		});
	};

	return modules
		.filter(module => hasPermission(module.permissions))
		.map(module => ({
			...module,
			subModules: module.subModules?.filter(sub => hasPermission(sub.permissions))
		}));
}

/**
 * Default permissions for each user group
 */
export const defaultGroupPermissions: Record<string, Array<{ module: string; action: string }>> = {
	Admin: [{ module: '*', action: '*' }],
	Manager: [
		{ module: 'dashboard', action: 'read' },
		{ module: 'clients', action: 'read' },
		{ module: 'clients', action: 'create' },
		{ module: 'clients', action: 'update' },
		{ module: 'vendors', action: 'read' },
		{ module: 'vendors', action: 'create' },
		{ module: 'vendors', action: 'update' },
		{ module: 'employees', action: 'read' },
		{ module: 'projects', action: 'read' },
		{ module: 'projects', action: 'create' },
		{ module: 'projects', action: 'update' },
		{ module: 'finances.income', action: 'read' },
		{ module: 'finances.expenses', action: 'read' },
		{ module: 'finances.payments', action: 'read' },
		{ module: 'offers', action: 'read' },
		{ module: 'offers', action: 'create' },
		{ module: 'offers', action: 'update' },
		{ module: 'offers', action: 'send' },
		{ module: 'pricelists', action: 'read' },
		{ module: 'settings', action: 'read' }
	],
	Accountant: [
		{ module: 'dashboard', action: 'read' },
		{ module: 'dashboard', action: 'finances' },
		{ module: 'clients', action: 'read' },
		{ module: 'vendors', action: 'read' },
		{ module: 'projects', action: 'read' },
		{ module: 'finances.income', action: '*' },
		{ module: 'finances.expenses', action: '*' },
		{ module: 'finances.payments', action: '*' },
		{ module: 'offers', action: 'read' },
		{ module: 'pricelists', action: 'read' }
	],
	Employee: [
		{ module: 'dashboard', action: 'read' },
		{ module: 'clients', action: 'read' },
		{ module: 'projects', action: 'read' },
		{ module: 'offers', action: 'read' }
	]
};
